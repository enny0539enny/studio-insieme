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
  FOR _r IN SELECT * FROM (VALUES (-13,'17:00',75),(-11,'17:00',90),(-10,'18:00',60),(-8,'17:00',90),(-7,'17:00',75),
                                 (-4,'17:00',90),(-4,'18:45',60),(-3,'17:00',90),(-2,'17:00',75),(-2,'18:30',60),(-1,'17:00',90))
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