
CREATE TYPE public.session_status AS ENUM ('planned','completed','missed');
CREATE TYPE public.attendance_source AS ENUM ('university','self');

CREATE TABLE public.study_sessions_planned (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_ids uuid[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.session_status NOT NULL DEFAULT 'planned',
  actual_minutes int,
  is_manual boolean NOT NULL DEFAULT false,
  is_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_sessions_planned_user_start ON public.study_sessions_planned (user_id, starts_at);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_event_id uuid NOT NULL REFERENCES public.class_events(id) ON DELETE CASCADE,
  attended boolean NOT NULL DEFAULT true,
  source public.attendance_source NOT NULL DEFAULT 'self',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, class_event_id)
);

CREATE TABLE public.planner_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_hours text[] NOT NULL DEFAULT '{}',
  max_hours_per_day numeric NOT NULL DEFAULT 6,
  no_study_after time NOT NULL DEFAULT '23:00',
  personal_buffer numeric NOT NULL DEFAULT 1.5,
  plan_mode text NOT NULL DEFAULT 'full',
  plan_warnings jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_generated_at timestamptz,
  buffer_updated_courses uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  source public.data_source NOT NULL DEFAULT 'university',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.review_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.course_topics(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions_planned, public.attendance, public.review_tests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.planner_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_announcements TO authenticated;
GRANT ALL ON public.study_sessions_planned, public.attendance, public.planner_settings, public.course_announcements, public.review_tests TO service_role;

ALTER TABLE public.study_sessions_planned ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own planned sessions" ON public.study_sessions_planned FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Read own attendance" ON public.attendance FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Self-mark attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND source = 'self');
CREATE POLICY "Update self attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND source = 'self') WITH CHECK (user_id = auth.uid() AND source = 'self');
CREATE POLICY "Delete self attendance" ON public.attendance FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND source = 'self');

CREATE POLICY "Own planner settings read" ON public.planner_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own planner settings insert" ON public.planner_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own planner settings update" ON public.planner_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enrolled read announcements" ON public.course_announcements FOR SELECT TO authenticated
  USING (public.is_enrolled(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Teachers manage announcements" ON public.course_announcements FOR ALL TO authenticated
  USING (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Own review tests" ON public.review_tests FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Demo history so Progress isn't empty: ~14h over the last 2 weeks, 4-day streak ending yesterday.
CREATE OR REPLACE FUNCTION public.seed_demo_history(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _courses uuid[];
  _today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  _r record;
  _i int := 0;
  _course uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.study_sessions_planned WHERE user_id = _uid AND status = 'completed') THEN
    RETURN;
  END IF;
  SELECT array_agg(c.id ORDER BY c.name) INTO _courses
    FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id
    WHERE e.user_id = _uid AND e.role = 'student';
  IF _courses IS NULL THEN RETURN; END IF;
  FOR _r IN SELECT * FROM (VALUES (-13,'15:00',75),(-11,'15:00',90),(-10,'16:00',60),(-8,'15:00',90),(-7,'10:00',75),
                                 (-4,'15:00',90),(-4,'17:30',60),(-3,'15:00',90),(-2,'10:00',75),(-2,'16:00',60),(-1,'15:00',90))
                    AS v(d, t, m) LOOP
    _course := _courses[(_i % array_length(_courses,1)) + 1];
    INSERT INTO public.study_sessions_planned (user_id, course_id, topic_ids, starts_at, ends_at, status, actual_minutes)
    VALUES (_uid, _course,
      ARRAY(SELECT id FROM public.course_topics WHERE course_id = _course ORDER BY sort_order LIMIT 1),
      ((_today + _r.d) + _r.t::time) AT TIME ZONE 'Europe/Rome',
      ((_today + _r.d) + _r.t::time + make_interval(mins => _r.m)) AT TIME ZONE 'Europe/Rome',
      'completed', _r.m);
    _i := _i + 1;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_demo_history(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    RETURN NEW;
  END IF;

  _domain := lower(split_part(NEW.email, '@', 2));
  SELECT university_id INTO _uni FROM public.university_email_domains WHERE domain = _domain;
  IF _uni IS NULL THEN
    RAISE EXCEPTION 'EMAIL_DOMAIN_NOT_ALLOWED';
  END IF;

  _is_teacher := EXISTS (SELECT 1 FROM public.course_professors WHERE lower(email) = lower(NEW.email));
  IF NOT _is_teacher THEN
    SELECT id INTO _program FROM public.degree_programs WHERE university_id = _uni ORDER BY name LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, university_id, degree_program_id, program_year)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email,
          _uni, _program, CASE WHEN _is_teacher THEN NULL ELSE 2 END);
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
  END IF;
  RETURN NEW;
END;
$$;

-- Counts other students with sessions on the same topics as the caller this week (counts only, no identities).
CREATE OR REPLACE FUNCTION public.topic_peers_this_week()
RETURNS TABLE(topic_id uuid, topic_name text, course_id uuid, peers int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH wk AS (
    SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome') AS s
  ), mine AS (
    SELECT DISTINCT unnest(sp.topic_ids) AS tid FROM public.study_sessions_planned sp, wk
    WHERE sp.user_id = auth.uid() AND sp.starts_at >= wk.s AND sp.starts_at < wk.s + interval '7 days'
  )
  SELECT t.id, t.name, t.course_id, count(DISTINCT o.user_id)::int
  FROM mine JOIN public.course_topics t ON t.id = mine.tid
  JOIN public.study_sessions_planned o ON t.id = ANY(o.topic_ids) AND o.user_id <> auth.uid()
  CROSS JOIN wk
  WHERE auth.uid() IS NOT NULL AND o.starts_at >= wk.s AND o.starts_at < wk.s + interval '7 days'
  GROUP BY t.id, t.name, t.course_id
  ORDER BY 4 DESC
$$;
REVOKE EXECUTE ON FUNCTION public.topic_peers_this_week() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topic_peers_this_week() TO authenticated;
