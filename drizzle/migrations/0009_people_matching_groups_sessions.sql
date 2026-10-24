ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'ping';
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.privacy_settings ADD COLUMN IF NOT EXISTS notifications jsonb NOT NULL
  DEFAULT '{"matches":true,"messages":true,"pings":true,"sessions":true,"groups":true}'::jsonb;

CREATE TABLE public.swipes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  liked boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);
GRANT SELECT ON public.swipes TO authenticated;
GRANT ALL ON public.swipes TO service_role;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own swipes read" ON public.swipes FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id),
  chat_id uuid REFERENCES public.chats(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match participants read" ON public.matches FOR SELECT TO authenticated
  USING (auth.uid() IN (user_a, user_b));

CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  course_id uuid REFERENCES public.courses(id),
  topic_id uuid REFERENCES public.course_topics(id),
  description text NOT NULL DEFAULT '',
  organizer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT true,
  chat_id uuid REFERENCES public.chats(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE TABLE public.group_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  course_id uuid REFERENCES public.courses(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  venue_id uuid REFERENCES public.venues(id),
  online boolean NOT NULL DEFAULT false,
  max_participants integer NOT NULL DEFAULT 2 CHECK (max_participants BETWEEN 2 AND 30),
  visibility text NOT NULL DEFAULT 'invite' CHECK (visibility IN ('public','invite')),
  group_id uuid REFERENCES public.study_groups(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.chats(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE TABLE public.group_session_participants (
  session_id uuid NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined')),
  PRIMARY KEY (session_id, user_id)
);
GRANT SELECT ON public.study_groups, public.group_members, public.group_sessions, public.group_session_participants TO authenticated;
GRANT ALL ON public.study_groups, public.group_members, public.group_sessions, public.group_session_participants TO service_role;

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user)
$$;
CREATE OR REPLACE FUNCTION public.can_see_group(_group uuid, _user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = _group
    AND (g.is_public OR g.organizer_id = _user OR public.is_group_member(g.id, _user)))
$$;
CREATE OR REPLACE FUNCTION public.can_see_session(_session uuid, _user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_sessions s WHERE s.id = _session AND (
    s.organizer_id = _user OR s.visibility = 'public'
    OR EXISTS (SELECT 1 FROM public.group_session_participants p WHERE p.session_id = s.id AND p.user_id = _user)
    OR (s.group_id IS NOT NULL AND public.is_group_member(s.group_id, _user)))
    AND NOT public.is_blocked_between(s.organizer_id, _user))
$$;

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups visible" ON public.study_groups FOR SELECT TO authenticated USING (public.can_see_group(id, auth.uid()));
CREATE POLICY "group members visible" ON public.group_members FOR SELECT TO authenticated USING (public.can_see_group(group_id, auth.uid()));
CREATE POLICY "sessions visible" ON public.group_sessions FOR SELECT TO authenticated USING (public.can_see_session(id, auth.uid()));
CREATE POLICY "participants visible" ON public.group_session_participants FOR SELECT TO authenticated USING (public.can_see_session(session_id, auth.uid()));

-- Blocks only hide 1:1 chats; group chats stay readable.
CREATE OR REPLACE FUNCTION public.chat_partner_blocked(_chat_id uuid, _user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (SELECT 1 FROM public.chat_members m JOIN public.chats c ON c.id = m.chat_id
    WHERE m.chat_id = _chat_id AND m.user_id <> _user_id AND c.kind <> 'group'
    AND public.is_blocked_between(m.user_id, _user_id))
$function$;

CREATE OR REPLACE FUNCTION public.my_chats()
 RETURNS TABLE(chat_id uuid, other_id uuid, other_first_name text, other_is_demo boolean, other_archetype text, other_social integer, pinned jsonb, last_body text, last_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, o.id, split_part(o.full_name,' ',1), o.is_demo, sp.archetype, NULLIF(sp.likert_answers->>'social','')::int, c.pinned,
    lm.body, COALESCE(lm.created_at, c.created_at)
  FROM public.chats c
  JOIN public.chat_members me ON me.chat_id = c.id AND me.user_id = auth.uid()
  JOIN public.chat_members om ON om.chat_id = c.id AND om.user_id <> auth.uid()
  JOIN public.profiles o ON o.id = om.user_id
  LEFT JOIN public.student_profiles sp ON sp.user_id = o.id
  LEFT JOIN LATERAL (SELECT m.body, m.created_at FROM public.chat_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) lm ON true
  WHERE c.kind <> 'group' AND NOT public.is_blocked_between(o.id, auth.uid())
  ORDER BY 9 DESC
$function$;

-- Deck: every discoverable onboarded student not yet swiped or matched.
CREATE OR REPLACE FUNCTION public.get_deck()
RETURNS TABLE(candidate_id uuid, first_name text, is_demo boolean, archetype text, likert jsonb, looking_for text,
  group_size text, places text[], time_slots text[], tags text[], languages text[], university_id uuid,
  university_name text, program_name text, program_year integer, shared_course_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, split_part(p.full_name,' ',1), p.is_demo, sp.archetype, sp.likert_answers, sp.looking_for,
    sp.group_size, sp.places, sp.time_slots, sp.tags, sp.languages, p.university_id, u.name, dp.name, p.program_year,
    ARRAY(SELECT e.course_id FROM public.enrollments e WHERE e.user_id = p.id
          AND e.course_id IN (SELECT m.course_id FROM public.enrollments m WHERE m.user_id = auth.uid()))
  FROM public.profiles p
  JOIN public.student_profiles sp ON sp.user_id = p.id
  LEFT JOIN public.privacy_settings ps ON ps.user_id = p.id
  LEFT JOIN public.universities u ON u.id = p.university_id
  LEFT JOIN public.degree_programs dp ON dp.id = p.degree_program_id
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid() AND sp.onboarding_completed AND sp.archetype IS NOT NULL
    AND COALESCE(ps.discoverable_in_matching, true)
    AND NOT public.is_blocked_between(p.id, auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.user_id = auth.uid() AND s.target_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE (m.user_a, m.user_b) = (LEAST(p.id, auth.uid()), GREATEST(p.id, auth.uid())))
$$;

CREATE OR REPLACE FUNCTION public._create_match(_a uuid, _b uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _chat uuid; _course uuid; _cname text;
BEGIN
  SELECT chat_id INTO _chat FROM public.matches WHERE user_a = LEAST(_a,_b) AND user_b = GREATEST(_a,_b);
  IF FOUND THEN RETURN _chat; END IF;
  SELECT a.course_id, c.name INTO _course, _cname FROM public.enrollments a JOIN public.enrollments b ON a.course_id = b.course_id
    JOIN public.courses c ON c.id = a.course_id WHERE a.user_id = _a AND b.user_id = _b ORDER BY c.name LIMIT 1;
  INSERT INTO public.chats (kind, pinned) VALUES ('match', jsonb_build_object('match', true, 'course', _cname)) RETURNING id INTO _chat;
  INSERT INTO public.chat_members VALUES (_chat, _a), (_chat, _b);
  INSERT INTO public.matches (user_a, user_b, course_id, chat_id) VALUES (LEAST(_a,_b), GREATEST(_a,_b), _course, _chat);
  RETURN _chat;
END $$;

CREATE OR REPLACE FUNCTION public.swipe(_target uuid, _liked boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _demo boolean; _chat uuid; _cname text;
BEGIN
  IF _me IS NULL OR _target = _me THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT is_demo INTO _demo FROM public.profiles WHERE id = _target;
  IF NOT FOUND OR public.is_blocked_between(_me, _target) THEN RAISE EXCEPTION 'not available'; END IF;
  INSERT INTO public.swipes (user_id, target_id, liked) VALUES (_me, _target, _liked)
    ON CONFLICT (user_id, target_id) DO UPDATE SET liked = EXCLUDED.liked, created_at = now();
  IF NOT _liked THEN RETURN jsonb_build_object('matched', false); END IF;
  -- 60% of demo students like back immediately (stable per demo student).
  IF _demo AND abs(hashtext(_target::text)) % 10 < 6 THEN
    INSERT INTO public.swipes (user_id, target_id, liked) VALUES (_target, _me, true) ON CONFLICT DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM public.swipes WHERE user_id = _target AND target_id = _me AND liked) THEN
    _chat := public._create_match(_me, _target);
    SELECT c.name INTO _cname FROM public.matches m LEFT JOIN public.courses c ON c.id = m.course_id WHERE m.chat_id = _chat;
    RETURN jsonb_build_object('matched', true, 'chat_id', _chat, 'course', _cname);
  END IF;
  RETURN jsonb_build_object('matched', false);
END $$;

CREATE OR REPLACE FUNCTION public.undo_swipe(_target uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.swipes WHERE user_id = auth.uid() AND target_id = _target AND liked = false
$$;

CREATE OR REPLACE FUNCTION public.my_matches()
RETURNS TABLE(match_id uuid, other_id uuid, first_name text, is_demo boolean, archetype text, social integer, chat_id uuid, course_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, o.id, split_part(o.full_name,' ',1), o.is_demo, sp.archetype, NULLIF(sp.likert_answers->>'social','')::int,
    m.chat_id, c.name, m.created_at
  FROM public.matches m
  JOIN public.profiles o ON o.id = CASE WHEN m.user_a = auth.uid() THEN m.user_b ELSE m.user_a END
  LEFT JOIN public.student_profiles sp ON sp.user_id = o.id
  LEFT JOIN public.courses c ON c.id = m.course_id
  WHERE auth.uid() IN (m.user_a, m.user_b) AND NOT public.is_blocked_between(o.id, auth.uid())
  ORDER BY m.created_at DESC
$$;

-- Demo members answer a few seconds after the user writes.
CREATE OR REPLACE FUNCTION public.demo_chat_reply(_chat_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last record; _demo uuid; _n int; _body text;
  _replies text[] := ARRAY['Sounds good to me!', 'Ha, same here. When are you free this week?',
    'Great, I''ll bring my notes.', 'Perfect, see you there!', 'Yes, let''s do it.',
    'Good idea. I''m stuck on the same exercises.', 'Deal! I''ll keep a seat for you.'];
BEGIN
  IF NOT public.is_chat_member(_chat_id, auth.uid()) THEN RETURN NULL; END IF;
  SELECT sender_id, created_at INTO _last FROM public.chat_messages WHERE chat_id = _chat_id ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND OR _last.sender_id <> auth.uid() THEN RETURN NULL; END IF;
  SELECT m.user_id INTO _demo FROM public.chat_members m JOIN public.profiles p ON p.id = m.user_id AND p.is_demo
    WHERE m.chat_id = _chat_id AND NOT public.is_blocked_between(m.user_id, auth.uid()) ORDER BY random() LIMIT 1;
  IF _demo IS NULL THEN RETURN NULL; END IF;
  SELECT count(*) INTO _n FROM public.chat_messages WHERE chat_id = _chat_id;
  _body := _replies[1 + (_n % array_length(_replies, 1))];
  INSERT INTO public.chat_messages (chat_id, sender_id, body) VALUES (_chat_id, _demo, _body);
  RETURN _body;
END $$;

CREATE OR REPLACE FUNCTION public.propose_session(_title text, _course uuid, _starts timestamptz, _minutes int,
  _venue uuid, _online boolean, _max int, _visibility text, _invitee uuid, _chat uuid, _group uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _id uuid; _demo boolean; _vname text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _minutes < 15 OR _minutes > 300 THEN RAISE EXCEPTION 'duration must be 15-300 minutes'; END IF;
  IF _starts < now() - interval '10 minutes' THEN RAISE EXCEPTION 'start must be in the future'; END IF;
  IF NOT _online AND _venue IS NULL THEN RAISE EXCEPTION 'venue required'; END IF;
  IF _course IS NOT NULL AND NOT public.is_enrolled(_me, _course) THEN RAISE EXCEPTION 'course not allowed'; END IF;
  IF _chat IS NOT NULL AND NOT public.is_chat_member(_chat, _me) THEN RAISE EXCEPTION 'chat not allowed'; END IF;
  IF _group IS NOT NULL AND NOT public.is_group_member(_group, _me) THEN RAISE EXCEPTION 'group not allowed'; END IF;
  IF _invitee IS NOT NULL AND public.is_blocked_between(_me, _invitee) THEN RAISE EXCEPTION 'not available'; END IF;
  IF _group IS NOT NULL THEN SELECT chat_id INTO _chat FROM public.study_groups WHERE id = _group; END IF;
  INSERT INTO public.group_sessions (organizer_id, title, course_id, starts_at, ends_at, venue_id, online, max_participants, visibility, group_id, chat_id)
    VALUES (_me, trim(_title), _course, _starts, _starts + make_interval(mins => _minutes), CASE WHEN _online THEN NULL ELSE _venue END,
      _online, GREATEST(2, LEAST(_max, 30)), CASE WHEN _visibility = 'public' THEN 'public' ELSE 'invite' END, _group, _chat)
    RETURNING id INTO _id;
  INSERT INTO public.group_session_participants VALUES (_id, _me, 'accepted');
  IF _invitee IS NOT NULL AND _invitee <> _me THEN
    SELECT is_demo INTO _demo FROM public.profiles WHERE id = _invitee;
    INSERT INTO public.group_session_participants VALUES (_id, _invitee, CASE WHEN _demo THEN 'accepted' ELSE 'invited' END)
      ON CONFLICT DO NOTHING;
  END IF;
  IF _chat IS NOT NULL THEN
    SELECT name INTO _vname FROM public.venues WHERE id = _venue;
    INSERT INTO public.chat_messages (chat_id, sender_id, body) VALUES (_chat, _me,
      format('Proposed a session: %s · %s · %s', trim(_title), to_char(_starts AT TIME ZONE 'Europe/Rome', 'Dy DD Mon, HH24:MI'),
        CASE WHEN _online THEN 'Online' ELSE COALESCE(_vname, '') END));
  END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.respond_session(_session uuid, _accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; _count int;
BEGIN
  SELECT * INTO s FROM public.group_sessions WHERE id = _session;
  IF NOT FOUND OR NOT public.can_see_session(_session, auth.uid()) THEN RAISE EXCEPTION 'not available'; END IF;
  IF NOT _accept THEN
    UPDATE public.group_session_participants SET status = 'declined' WHERE session_id = _session AND user_id = auth.uid();
    RETURN;
  END IF;
  SELECT count(*) INTO _count FROM public.group_session_participants WHERE session_id = _session AND status = 'accepted';
  IF _count >= s.max_participants THEN RAISE EXCEPTION 'session full'; END IF;
  INSERT INTO public.group_session_participants VALUES (_session, auth.uid(), 'accepted')
    ON CONFLICT (session_id, user_id) DO UPDATE SET status = 'accepted';
END $$;

CREATE OR REPLACE FUNCTION public.my_group_sessions()
RETURNS TABLE(id uuid, title text, course_id uuid, starts_at timestamptz, ends_at timestamptz, venue_name text, online boolean,
  my_status text, organizer_first_name text, others text[], visibility text, group_id uuid, chat_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.title, s.course_id, s.starts_at, s.ends_at, v.name, s.online, me.status, split_part(o.full_name,' ',1),
    ARRAY(SELECT split_part(p.full_name,' ',1) FROM public.group_session_participants x JOIN public.profiles p ON p.id = x.user_id
          WHERE x.session_id = s.id AND x.status = 'accepted' AND x.user_id <> auth.uid() ORDER BY p.full_name),
    s.visibility, s.group_id, s.chat_id
  FROM public.group_sessions s
  JOIN public.group_session_participants me ON me.session_id = s.id AND me.user_id = auth.uid()
  JOIN public.profiles o ON o.id = s.organizer_id
  LEFT JOIN public.venues v ON v.id = s.venue_id
  WHERE NOT public.is_blocked_between(s.organizer_id, auth.uid())
  ORDER BY s.starts_at
$$;

CREATE OR REPLACE FUNCTION public.create_group(_name text, _course uuid, _topic uuid, _description text, _public boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _id uuid; _chat uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _course IS NOT NULL AND NOT public.is_enrolled(_me, _course) THEN RAISE EXCEPTION 'course not allowed'; END IF;
  INSERT INTO public.chats (kind, pinned) VALUES ('group', jsonb_build_object('group', trim(_name))) RETURNING id INTO _chat;
  INSERT INTO public.study_groups (name, course_id, topic_id, description, organizer_id, is_public, chat_id)
    VALUES (trim(_name), _course, _topic, left(COALESCE(_description, ''), 500), _me, COALESCE(_public, true), _chat) RETURNING id INTO _id;
  UPDATE public.chats SET group_id = _id WHERE id = _chat;
  INSERT INTO public.group_members (group_id, user_id) VALUES (_id, _me);
  INSERT INTO public.chat_members VALUES (_chat, _me);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.join_group(_group uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  SELECT * INTO g FROM public.study_groups WHERE id = _group;
  IF NOT FOUND OR NOT (g.is_public OR public.is_group_member(_group, auth.uid())) THEN RAISE EXCEPTION 'not available'; END IF;
  INSERT INTO public.group_members (group_id, user_id) VALUES (_group, auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.chat_members VALUES (g.chat_id, auth.uid()) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.leave_group(_group uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _chat uuid;
BEGIN
  SELECT chat_id INTO _chat FROM public.study_groups WHERE id = _group;
  DELETE FROM public.group_members WHERE group_id = _group AND user_id = auth.uid();
  DELETE FROM public.chat_members WHERE chat_id = _chat AND user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.global_search(_q text)
RETURNS TABLE(kind text, id uuid, title text, subtitle text, archetype text, social integer, is_demo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (SELECT '%' || replace(replace(trim(_q), '%', ''), '_', '') || '%' AS p)
  SELECT * FROM (
    (SELECT 'student'::text, p.id, split_part(p.full_name,' ',1), COALESCE(u.short_name, u.name), sp.archetype,
       NULLIF(sp.likert_answers->>'social','')::int, p.is_demo
     FROM public.profiles p JOIN public.student_profiles sp ON sp.user_id = p.id
     LEFT JOIN public.privacy_settings ps ON ps.user_id = p.id LEFT JOIN public.universities u ON u.id = p.university_id, q
     WHERE p.id <> auth.uid() AND sp.onboarding_completed AND COALESCE(ps.discoverable_in_matching, true)
       AND NOT public.is_blocked_between(p.id, auth.uid()) AND split_part(p.full_name,' ',1) ILIKE q.p LIMIT 8)
    UNION ALL
    (SELECT 'course', c.id, c.name, c.credits || ' CFU', NULL, NULL, false FROM public.courses c, q WHERE c.name ILIKE q.p LIMIT 8)
    UNION ALL
    (SELECT 'group', g.id, g.name, COALESCE(c.name, ''), NULL, NULL, false FROM public.study_groups g
       LEFT JOIN public.courses c ON c.id = g.course_id, q
     WHERE public.can_see_group(g.id, auth.uid()) AND NOT public.is_blocked_between(g.organizer_id, auth.uid())
       AND (g.name ILIKE q.p OR c.name ILIKE q.p) LIMIT 8)
    UNION ALL
    (SELECT 'session', s.id, s.title, to_char(s.starts_at AT TIME ZONE 'Europe/Rome', 'Dy DD Mon HH24:MI'), NULL, NULL, false
     FROM public.group_sessions s LEFT JOIN public.courses c ON c.id = s.course_id, q
     WHERE s.visibility = 'public' AND s.ends_at > now() AND NOT public.is_blocked_between(s.organizer_id, auth.uid())
       AND (s.title ILIKE q.p OR c.name ILIKE q.p) LIMIT 8)
    UNION ALL
    (SELECT 'venue', v.id, v.name, v.type, NULL, NULL, false FROM public.venues v, q WHERE v.approved AND v.name ILIKE q.p LIMIT 8)
  ) r WHERE auth.uid() IS NOT NULL AND length(trim(_q)) >= 2
$$;

CREATE OR REPLACE FUNCTION public.my_blocks()
RETURNS TABLE(blocked_id uuid, first_name text, is_demo boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.blocked_id, split_part(p.full_name,' ',1), p.is_demo, b.created_at
  FROM public.blocks b JOIN public.profiles p ON p.id = b.blocked_id WHERE b.blocker_id = auth.uid() ORDER BY b.created_at DESC
$$;

-- Starter social state: matches with Marta and Luca, chat history, and a session at Sormani this week.
CREATE OR REPLACE FUNCTION public.seed_social(_uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _marta uuid; _luca uuid; _chat uuid; _sid uuid; _start timestamptz; _week timestamptz; _c uuid;
BEGIN
  SELECT id INTO _marta FROM public.profiles WHERE is_demo AND full_name = 'Marta Ricci' LIMIT 1;
  SELECT id INTO _luca FROM public.profiles WHERE is_demo AND full_name = 'Luca Marino' LIMIT 1;
  IF _marta IS NULL OR _luca IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE _uid IN (user_a, user_b) AND _marta IN (user_a, user_b)) THEN RETURN; END IF;
  INSERT INTO public.swipes (user_id, target_id, liked) VALUES (_uid,_marta,true),(_marta,_uid,true),(_uid,_luca,true),(_luca,_uid,true)
    ON CONFLICT DO NOTHING;

  _chat := public._create_match(_uid, _marta);
  INSERT INTO public.chat_messages (chat_id, sender_id, body, created_at) VALUES
    (_chat, _marta, 'Hi! We matched for Analisi. Are you also behind on series?', now() - interval '2 days 3 hours'),
    (_chat, _uid, 'Totally. Limits are fine, series not so much.', now() - interval '2 days 2 hours'),
    (_chat, _marta, 'Let''s review together at Sormani this week, I booked us a table.', now() - interval '2 days 1 hour');
  SELECT course_id INTO _c FROM public.matches WHERE chat_id = _chat;

  _week := date_trunc('week', now() AT TIME ZONE 'Europe/Rome');
  SELECT x INTO _start FROM unnest(ARRAY[_week + interval '2 days 16 hours', _week + interval '4 days 16 hours',
      _week + interval '5 days 10 hours', _week + interval '6 days 15 hours 30 minutes']) x
    WHERE (x AT TIME ZONE 'Europe/Rome') > now() + interval '1 hour' ORDER BY x LIMIT 1;
  IF _start IS NULL THEN _start := date_trunc('day', now() AT TIME ZONE 'Europe/Rome') + interval '1 day 16 hours'; END IF;
  INSERT INTO public.group_sessions (organizer_id, title, course_id, starts_at, ends_at, venue_id, online, max_participants, visibility, chat_id)
    VALUES (_marta, 'Series review', _c, _start AT TIME ZONE 'Europe/Rome', (_start + interval '2 hours') AT TIME ZONE 'Europe/Rome',
      '00000000-0000-0000-0000-000000000501', false, 2, 'invite', _chat) RETURNING id INTO _sid;
  INSERT INTO public.group_session_participants VALUES (_sid, _marta, 'accepted'), (_sid, _uid, 'accepted');

  _chat := public._create_match(_uid, _luca);
  INSERT INTO public.chat_messages (chat_id, sender_id, body, created_at) VALUES
    (_chat, _luca, 'Hey! Want to quiz each other before the exam?', now() - interval '1 day 5 hours'),
    (_chat, _uid, 'Yes! I''m better with theory, you?', now() - interval '1 day 4 hours'),
    (_chat, _luca, 'Exercises. Sounds like a good trade.', now() - interval '1 day 4 hours' + interval '10 minutes');
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _domain text;
  _uni uuid;
  _program uuid;
  _is_teacher boolean;
BEGIN
  IF COALESCE(NEW.is_anonymous, false) THEN
    _uni := '00000000-0000-0000-0000-000000000001';
    _program := '00000000-0000-0000-0000-000000000010';
    INSERT INTO public.profiles (id, full_name, email, university_id, degree_program_id, program_year)
      VALUES (NEW.id, '', NULL, _uni, _program, 1);
    INSERT INTO public.privacy_settings (user_id) VALUES (NEW.id);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
    INSERT INTO public.student_profiles (user_id) VALUES (NEW.id);
    INSERT INTO public.planner_settings (user_id) VALUES (NEW.id);
    INSERT INTO public.enrollments (user_id, course_id, role)
      SELECT NEW.id, id, 'student' FROM public.courses WHERE degree_program_id = _program
      ON CONFLICT DO NOTHING;
    PERFORM public.seed_demo_history(NEW.id);
    PERFORM public.seed_social(NEW.id);
    RETURN NEW;
  END IF;

  _domain := lower(split_part(NEW.email, '@', 2));
  SELECT university_id INTO _uni FROM public.university_email_domains WHERE domain = _domain;
  _is_teacher := EXISTS (SELECT 1 FROM public.course_professors WHERE lower(email) = lower(NEW.email));
  IF _uni IS NULL THEN
    _uni := '00000000-0000-0000-0000-000000000001';
    _program := '00000000-0000-0000-0000-000000000010';
    _is_teacher := false;
  ELSIF NOT _is_teacher THEN
    _program := '00000000-0000-0000-0000-000000000010';
    IF NOT EXISTS (SELECT 1 FROM public.degree_programs WHERE id = _program AND university_id = _uni) THEN
      SELECT id INTO _program FROM public.degree_programs WHERE university_id = _uni ORDER BY name LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, university_id, degree_program_id, program_year)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email,
          _uni, _program, CASE WHEN _is_teacher THEN NULL ELSE 1 END);
  INSERT INTO public.privacy_settings (user_id) VALUES (NEW.id);

  IF _is_teacher THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
    INSERT INTO public.enrollments (user_id, course_id, role)
      SELECT NEW.id, course_id, 'teacher' FROM public.course_professors WHERE lower(email) = lower(NEW.email)
      ON CONFLICT DO NOTHING;
    UPDATE public.course_professors SET profile_id = NEW.id WHERE lower(email) = lower(NEW.email);
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
    INSERT INTO public.student_profiles (user_id) VALUES (NEW.id);
    INSERT INTO public.planner_settings (user_id) VALUES (NEW.id);
    INSERT INTO public.enrollments (user_id, course_id, role)
      SELECT NEW.id, id, 'student' FROM public.courses WHERE degree_program_id = _program
      ON CONFLICT DO NOTHING;
    PERFORM public.seed_demo_history(NEW.id);
    PERFORM public.seed_social(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.seed_social(uuid), public._create_match(uuid, uuid) FROM PUBLIC, anon, authenticated;