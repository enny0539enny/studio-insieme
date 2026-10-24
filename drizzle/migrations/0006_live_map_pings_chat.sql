CREATE TYPE public.ping_status AS ENUM ('pending','accepted','declined','cancelled','expired');

CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'library' CHECK (type IN ('library','study_room','university','cafe')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  opening_hours text,
  approved boolean NOT NULL DEFAULT false,
  suggested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues read approved or own" ON public.venues FOR SELECT TO authenticated
  USING (approved OR suggested_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "venues suggest" ON public.venues FOR INSERT TO authenticated
  WITH CHECK (suggested_by = auth.uid() AND approved = false);
CREATE POLICY "venues admin update" ON public.venues FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id),
  subject_label text NOT NULL,
  general_subject text NOT NULL DEFAULT 'other',
  activity text NOT NULL CHECK (activity IN ('exam_review','exercises','project','reading')),
  place_kind text NOT NULL DEFAULT 'venue' CHECK (place_kind IN ('venue','home','online')),
  venue_id uuid REFERENCES public.venues(id),
  ends_at timestamptz NOT NULL,
  open_to_invitations boolean NOT NULL DEFAULT true,
  demo_auto_accept boolean NOT NULL DEFAULT true,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_sessions_active_idx ON public.live_sessions (ends_at) WHERE ended_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own live sessions read" ON public.live_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own live sessions insert" ON public.live_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND ends_at <= now() + interval '5 hours 1 minute' AND (place_kind <> 'venue' OR venue_id IS NOT NULL));
CREATE POLICY "own live sessions update" ON public.live_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_live_session() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ends_at > now() + interval '5 hours 1 minute' THEN RAISE EXCEPTION 'MAX_5_HOURS'; END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE public.live_sessions SET ended_at = now() WHERE user_id = NEW.user_id AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER live_sessions_validate BEFORE INSERT ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_live_session();

ALTER TABLE public.privacy_settings ADD COLUMN map_consent_at timestamptz;

CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks read" ON public.blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "own blocks insert" ON public.blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());
CREATE POLICY "own blocks delete" ON public.blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a))
$$;

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports insert own" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports admin read" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports admin update" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  message text NOT NULL,
  status public.ping_status NOT NULL DEFAULT 'pending',
  chat_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX pings_sender_idx ON public.pings (sender_id, created_at);
CREATE INDEX pings_recipient_idx ON public.pings (recipient_id, status);
GRANT SELECT ON public.pings TO authenticated;
GRANT ALL ON public.pings TO service_role;
ALTER TABLE public.pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pings read own" ON public.pings FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ping_id uuid REFERENCES public.pings(id) ON DELETE SET NULL,
  pinned jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_members (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id, user_id)
);
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_chat_idx ON public.chat_messages (chat_id, created_at);
GRANT SELECT ON public.chats TO authenticated;
GRANT SELECT ON public.chat_members TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chats, public.chat_members, public.chat_messages TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chat_member(_chat_id uuid, _user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = _chat_id AND user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.chat_partner_blocked(_chat_id uuid, _user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = _chat_id AND m.user_id <> _user_id
    AND public.is_blocked_between(m.user_id, _user_id))
$$;

CREATE POLICY "chats members read" ON public.chats FOR SELECT TO authenticated USING (public.is_chat_member(id, auth.uid()));
CREATE POLICY "chat members read" ON public.chat_members FOR SELECT TO authenticated USING (public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "messages members read" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()) AND NOT public.chat_partner_blocked(chat_id, auth.uid()));
CREATE POLICY "messages members send" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_chat_member(chat_id, auth.uid()) AND NOT public.chat_partner_blocked(chat_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_live_sessions()
RETURNS TABLE(session_id uuid, user_id uuid, first_name text, is_demo boolean, is_mine boolean, archetype text, social int,
  tags text[], university_id uuid, university_name text, program_name text, program_year int, course_id uuid,
  subject_label text, general_subject text, activity text, place_kind text, venue_id uuid, ends_at timestamptz, open_to_invitations boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.live_sessions ls SET ends_at = now() + make_interval(hours => 1 + abs(hashtext(ls.id::text)) % 4)
    FROM public.profiles p WHERE p.id = ls.user_id AND p.is_demo AND ls.ended_at IS NULL AND ls.ends_at < now() + interval '15 minutes';
  UPDATE public.pings pg SET status = 'expired' WHERE pg.status = 'pending'
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = pg.live_session_id AND (s.ended_at IS NOT NULL OR s.ends_at <= now()));
  RETURN QUERY
  SELECT ls.id, ls.user_id, split_part(p.full_name,' ',1), p.is_demo, ls.user_id = auth.uid(), sp.archetype,
    NULLIF(sp.likert_answers->>'social','')::int, COALESCE(sp.tags[1:3], '{}'), u.id, COALESCE(u.short_name, u.name), dp.name, p.program_year,
    ls.course_id, COALESCE(c.name, ls.subject_label), ls.general_subject, ls.activity, ls.place_kind,
    CASE WHEN ls.place_kind = 'venue' THEN ls.venue_id END, ls.ends_at, ls.open_to_invitations
  FROM public.live_sessions ls
  JOIN public.profiles p ON p.id = ls.user_id
  LEFT JOIN public.student_profiles sp ON sp.user_id = ls.user_id
  LEFT JOIN public.universities u ON u.id = p.university_id
  LEFT JOIN public.degree_programs dp ON dp.id = p.degree_program_id
  LEFT JOIN public.courses c ON c.id = ls.course_id
  WHERE ls.ended_at IS NULL AND ls.ends_at > now()
    AND NOT public.is_blocked_between(ls.user_id, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public._create_ping_chat(_ping_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pg record; _chat uuid;
BEGIN
  SELECT p.*, COALESCE(c.name, ls.subject_label) AS subj, v.name AS venue_name, ls.activity, ls.ends_at
    INTO pg FROM public.pings p JOIN public.live_sessions ls ON ls.id = p.live_session_id
    LEFT JOIN public.courses c ON c.id = ls.course_id LEFT JOIN public.venues v ON v.id = ls.venue_id WHERE p.id = _ping_id;
  INSERT INTO public.chats (ping_id, pinned) VALUES (_ping_id, jsonb_build_object('subject', pg.subj, 'venue', pg.venue_name,
    'activity', pg.activity, 'ends_at', pg.ends_at)) RETURNING id INTO _chat;
  INSERT INTO public.chat_members VALUES (_chat, pg.sender_id), (_chat, pg.recipient_id);
  INSERT INTO public.chat_messages (chat_id, sender_id, body, created_at) VALUES (_chat, pg.sender_id, pg.message, pg.created_at);
  UPDATE public.pings SET status = 'accepted', responded_at = now(), chat_id = _chat WHERE id = _ping_id;
  RETURN _chat;
END $$;
REVOKE EXECUTE ON FUNCTION public._create_ping_chat(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_ping(_session_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); s record; _id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT ls.*, COALESCE(c.name, ls.subject_label) AS subj, v.name AS venue_name INTO s
    FROM public.live_sessions ls LEFT JOIN public.courses c ON c.id = ls.course_id LEFT JOIN public.venues v ON v.id = ls.venue_id
    WHERE ls.id = _session_id;
  IF NOT FOUND OR s.ended_at IS NOT NULL OR s.ends_at <= now() THEN RAISE EXCEPTION 'SESSION_NOT_ACTIVE'; END IF;
  IF s.user_id = uid THEN RAISE EXCEPTION 'SELF'; END IF;
  IF NOT s.open_to_invitations THEN RAISE EXCEPTION 'NOT_OPEN'; END IF;
  IF public.is_blocked_between(uid, s.user_id) THEN RAISE EXCEPTION 'BLOCKED'; END IF;
  IF EXISTS (SELECT 1 FROM public.pings WHERE sender_id = uid AND recipient_id = s.user_id AND status = 'pending') THEN RAISE EXCEPTION 'ALREADY_PENDING'; END IF;
  IF EXISTS (SELECT 1 FROM public.pings WHERE sender_id = uid AND recipient_id = s.user_id AND status = 'declined' AND responded_at > now() - interval '24 hours') THEN RAISE EXCEPTION 'DECLINED_RECENTLY'; END IF;
  IF (SELECT count(*) FROM public.pings WHERE sender_id = uid AND created_at > now() - interval '1 hour') >= 5 THEN RAISE EXCEPTION 'RATE_LIMIT'; END IF;
  INSERT INTO public.pings (sender_id, recipient_id, live_session_id, message)
  VALUES (uid, s.user_id, s.id, format('Hey! I saw you''re studying %s at %s. Can I join your session?', s.subj, COALESCE(s.venue_name, 'your spot')))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.respond_ping(_ping_id uuid, _accept boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pings WHERE id = _ping_id AND recipient_id = auth.uid() AND status = 'pending') THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;
  IF _accept THEN RETURN public._create_ping_chat(_ping_id); END IF;
  UPDATE public.pings SET status = 'declined', responded_at = now() WHERE id = _ping_id;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_ping(_ping_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.pings SET status = 'cancelled', responded_at = now() WHERE id = _ping_id AND sender_id = auth.uid() AND status = 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.simulate_demo_reply(_ping_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pg record; _chat uuid;
BEGIN
  SELECT p.*, ls.demo_auto_accept, v.name AS venue_name INTO pg FROM public.pings p
    JOIN public.profiles r ON r.id = p.recipient_id AND r.is_demo
    JOIN public.live_sessions ls ON ls.id = p.live_session_id LEFT JOIN public.venues v ON v.id = ls.venue_id
    WHERE p.id = _ping_id AND p.sender_id = auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF pg.status <> 'pending' THEN RETURN pg.status::text; END IF;
  IF pg.created_at > now() - interval '4 seconds' THEN RETURN 'pending'; END IF;
  IF pg.demo_auto_accept THEN
    _chat := public._create_ping_chat(_ping_id);
    INSERT INTO public.chat_messages (chat_id, sender_id, body) VALUES (_chat, pg.recipient_id,
      format('Sure, come over! I''m at %s, I''ll keep a seat for you.', COALESCE(pg.venue_name, 'my spot')));
    RETURN 'accepted';
  END IF;
  UPDATE public.pings SET status = 'declined', responded_at = now() WHERE id = _ping_id;
  RETURN 'declined';
END $$;

CREATE OR REPLACE FUNCTION public.my_pings()
RETURNS TABLE(id uuid, incoming boolean, other_id uuid, other_first_name text, other_is_demo boolean, other_archetype text, other_social int,
  message text, status public.ping_status, chat_id uuid, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  UPDATE public.pings pg SET status = 'expired' WHERE pg.status = 'pending' AND (pg.sender_id = auth.uid() OR pg.recipient_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = pg.live_session_id AND (s.ended_at IS NOT NULL OR s.ends_at <= now()));
  RETURN QUERY
  SELECT pg.id, pg.recipient_id = auth.uid(), o.id, split_part(o.full_name,' ',1), o.is_demo, sp.archetype,
    NULLIF(sp.likert_answers->>'social','')::int, pg.message, pg.status, pg.chat_id, pg.created_at
  FROM public.pings pg
  JOIN public.profiles o ON o.id = CASE WHEN pg.sender_id = auth.uid() THEN pg.recipient_id ELSE pg.sender_id END
  LEFT JOIN public.student_profiles sp ON sp.user_id = o.id
  WHERE (pg.sender_id = auth.uid() OR pg.recipient_id = auth.uid()) AND NOT public.is_blocked_between(o.id, auth.uid())
    AND pg.created_at > now() - interval '7 days'
  ORDER BY pg.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.my_chats()
RETURNS TABLE(chat_id uuid, other_id uuid, other_first_name text, other_is_demo boolean, other_archetype text, other_social int,
  pinned jsonb, last_body text, last_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, o.id, split_part(o.full_name,' ',1), o.is_demo, sp.archetype, NULLIF(sp.likert_answers->>'social','')::int, c.pinned,
    lm.body, COALESCE(lm.created_at, c.created_at)
  FROM public.chats c
  JOIN public.chat_members me ON me.chat_id = c.id AND me.user_id = auth.uid()
  JOIN public.chat_members om ON om.chat_id = c.id AND om.user_id <> auth.uid()
  JOIN public.profiles o ON o.id = om.user_id
  LEFT JOIN public.student_profiles sp ON sp.user_id = o.id
  LEFT JOIN LATERAL (SELECT m.body, m.created_at FROM public.chat_messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) lm ON true
  WHERE NOT public.is_blocked_between(o.id, auth.uid())
  ORDER BY 9 DESC
$$;

CREATE OR REPLACE FUNCTION public.get_match_candidates()
 RETURNS TABLE(candidate_id uuid, first_name text, is_demo boolean, archetype text, likert jsonb, looking_for text, time_slots text[], tags text[], shared_course_ids uuid[], next_session jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, split_part(p.full_name, ' ', 1), p.is_demo, sp.archetype, sp.likert_answers,
    sp.looking_for, sp.time_slots, sp.tags,
    ARRAY(SELECT e.course_id FROM public.enrollments e
          WHERE e.user_id = p.id AND e.course_id IN (SELECT m.course_id FROM public.enrollments m WHERE m.user_id = auth.uid())),
    (SELECT jsonb_build_object('starts_at', s.starts_at, 'place', s.place, 'looking_for', s.looking_for)
       FROM public.study_sessions s WHERE s.user_id = p.id AND s.starts_at > now() ORDER BY s.starts_at LIMIT 1)
  FROM public.profiles p
  JOIN public.student_profiles sp ON sp.user_id = p.id
  LEFT JOIN public.privacy_settings ps ON ps.user_id = p.id
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid() AND sp.onboarding_completed
    AND COALESCE(ps.discoverable_in_matching, true)
    AND NOT public.is_blocked_between(p.id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.enrollments a JOIN public.enrollments b ON a.course_id = b.course_id
                WHERE a.user_id = p.id AND b.user_id = auth.uid())
$function$;