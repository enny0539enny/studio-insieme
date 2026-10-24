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
    RETURN NEW;
  END IF;

  _domain := lower(split_part(NEW.email, '@', 2));
  SELECT university_id INTO _uni FROM public.university_email_domains WHERE domain = _domain;
  _is_teacher := EXISTS (SELECT 1 FROM public.course_professors WHERE lower(email) = lower(NEW.email));
  IF _uni IS NULL THEN
    -- Any other email: link to the PoliMi demo program (same as guests).
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
  END IF;
  RETURN NEW;
END;
$function$;