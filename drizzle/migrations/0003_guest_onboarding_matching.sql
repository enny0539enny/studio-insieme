
ALTER TABLE public.privacy_settings ADD COLUMN map_active_allowed boolean NOT NULL DEFAULT false;

CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  place text NOT NULL,
  looking_for text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or demo sessions" ON public.study_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_demo));
CREATE POLICY "Insert own sessions" ON public.study_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own sessions" ON public.study_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own sessions" ON public.study_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _domain text;
  _uni uuid;
  _program uuid;
  _is_teacher boolean;
BEGIN
  -- Guests (anonymous sign-in) are linked to the Politecnico di Milano demo data
  IF COALESCE(NEW.is_anonymous, false) THEN
    _uni := '00000000-0000-0000-0000-000000000001';
    _program := '00000000-0000-0000-0000-000000000010';
    INSERT INTO public.profiles (id, full_name, email, university_id, degree_program_id, program_year)
      VALUES (NEW.id, '', NULL, _uni, _program, 1);
    INSERT INTO public.privacy_settings (user_id) VALUES (NEW.id);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
    INSERT INTO public.student_profiles (user_id) VALUES (NEW.id);
    INSERT INTO public.enrollments (user_id, course_id, role)
      SELECT NEW.id, id, 'student' FROM public.courses WHERE degree_program_id = _program
      ON CONFLICT DO NOTHING;
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
    INSERT INTO public.enrollments (user_id, course_id, role)
      SELECT NEW.id, id, 'student' FROM public.courses WHERE degree_program_id = _program
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Match candidates: onboarded, discoverable students sharing at least one course with the caller.
-- Returns only first name and matching fields, never email or full profile.
CREATE OR REPLACE FUNCTION public.get_match_candidates()
RETURNS TABLE(candidate_id uuid, first_name text, is_demo boolean, archetype text, likert jsonb,
              looking_for text, time_slots text[], tags text[], shared_course_ids uuid[], next_session jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    AND EXISTS (SELECT 1 FROM public.enrollments a JOIN public.enrollments b ON a.course_id = b.course_id
                WHERE a.user_id = p.id AND b.user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.get_match_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_candidates() TO authenticated;
