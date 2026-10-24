
-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('student','teacher','admin');
CREATE TYPE public.data_source AS ENUM ('university','student');
CREATE TYPE public.topic_weight AS ENUM ('high','medium','low');
CREATE TYPE public.enrollment_role AS ENUM ('student','teacher');

-- ===== Institutional tables =====
CREATE TABLE public.universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  city text,
  source public.data_source NOT NULL DEFAULT 'university',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.university_email_domains (
  domain text PRIMARY KEY,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE
);
CREATE TABLE public.degree_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text,
  source public.data_source NOT NULL DEFAULT 'university'
);
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  degree_program_id uuid REFERENCES public.degree_programs(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  credits int NOT NULL,
  class_hours int,
  semester int NOT NULL,
  program_year int,
  source public.data_source NOT NULL DEFAULT 'university'
);
-- Official list of professors per course, used to verify teachers at signup.
CREATE TABLE public.course_professors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  profile_id uuid,
  source public.data_source NOT NULL DEFAULT 'university'
);
CREATE TABLE public.course_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  weight public.topic_weight NOT NULL DEFAULT 'medium',
  sort_order int NOT NULL DEFAULT 0,
  source public.data_source NOT NULL DEFAULT 'university'
);
CREATE TABLE public.course_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.course_topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_path text,
  version int NOT NULL DEFAULT 1,
  uploaded_by uuid,
  source public.data_source NOT NULL DEFAULT 'university',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  exam_date timestamptz NOT NULL,
  kind text NOT NULL DEFAULT 'scritto',
  room text,
  source public.data_source NOT NULL DEFAULT 'university',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.class_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  room text,
  source public.data_source NOT NULL DEFAULT 'university'
);

-- ===== People =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  university_id uuid REFERENCES public.universities(id),
  degree_program_id uuid REFERENCES public.degree_programs(id),
  program_year int,
  avatar_url text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  role public.enrollment_role NOT NULL DEFAULT 'student',
  source public.data_source NOT NULL DEFAULT 'university',
  UNIQUE (user_id, course_id)
);
CREATE TABLE public.student_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  archetype text,
  likert_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  exam_scenario text,
  looking_for text,
  group_size text,
  places text[] NOT NULL DEFAULT '{}',
  time_slots text[] NOT NULL DEFAULT '{}',
  living_situation text,
  tags text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  bio text,
  photo_url text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  map_active boolean NOT NULL DEFAULT false,
  open_to_invitations boolean NOT NULL DEFAULT true,
  discoverable_in_matching boolean NOT NULL DEFAULT true,
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Grants =====
GRANT SELECT ON public.universities, public.university_email_domains, public.degree_programs TO anon, authenticated;
GRANT SELECT ON public.courses, public.course_professors, public.class_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_topics, public.course_materials, public.exams, public.class_events TO authenticated;
GRANT UPDATE ON public.courses TO authenticated;
GRANT SELECT ON public.profiles, public.user_roles, public.enrollments TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_profiles, public.privacy_settings TO authenticated;
GRANT ALL ON public.universities, public.university_email_domains, public.degree_programs, public.courses,
  public.course_professors, public.course_topics, public.course_materials, public.exams, public.class_events,
  public.profiles, public.user_roles, public.enrollments, public.student_profiles, public.privacy_settings TO service_role;

-- ===== RLS =====
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degree_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

-- ===== Helper functions =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_enrolled(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _user_id AND course_id = _course_id)
$$;
CREATE OR REPLACE FUNCTION public.is_course_teacher(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = _user_id AND course_id = _course_id AND role = 'teacher')
    AND public.has_role(_user_id, 'teacher')
$$;

-- Public reference data
CREATE POLICY "Anyone reads universities" ON public.universities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone reads email domains" ON public.university_email_domains FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone reads degree programs" ON public.degree_programs FOR SELECT TO anon, authenticated USING (true);

-- Courses: catalog readable by signed-in users, editable only by the course teacher or admin
CREATE POLICY "Signed-in read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers update own courses" ON public.courses FOR UPDATE TO authenticated
  USING (public.is_course_teacher(auth.uid(), id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_course_teacher(auth.uid(), id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Signed-in read professors" ON public.course_professors FOR SELECT TO authenticated USING (true);

-- Topics & class events: readable by signed-in, managed by course teacher/admin
CREATE POLICY "Signed-in read topics" ON public.course_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers manage topics" ON public.course_topics FOR ALL TO authenticated
  USING (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Signed-in read class events" ON public.class_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers manage class events" ON public.class_events FOR ALL TO authenticated
  USING (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'));

-- Materials: only enrolled users (students or teachers of the course)
CREATE POLICY "Enrolled read materials" ON public.course_materials FOR SELECT TO authenticated
  USING (public.is_enrolled(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Teachers manage materials" ON public.course_materials FOR ALL TO authenticated
  USING (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'));

-- Exams: official ones readable by all signed-in; student-added ones only by their author
CREATE POLICY "Read official or own exams" ON public.exams FOR SELECT TO authenticated
  USING (source = 'university' OR created_by = auth.uid());
CREATE POLICY "Students add own exam dates" ON public.exams FOR INSERT TO authenticated
  WITH CHECK (source = 'student' AND created_by = auth.uid() AND public.is_enrolled(auth.uid(), course_id));
CREATE POLICY "Students edit own exam dates" ON public.exams FOR UPDATE TO authenticated
  USING (source = 'student' AND created_by = auth.uid())
  WITH CHECK (source = 'student' AND created_by = auth.uid());
CREATE POLICY "Students delete own exam dates" ON public.exams FOR DELETE TO authenticated
  USING (source = 'student' AND created_by = auth.uid());
CREATE POLICY "Teachers manage official exams" ON public.exams FOR ALL TO authenticated
  USING (source = 'university' AND (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (source = 'university' AND (public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin')));

-- Profiles: own, demo people, admin
CREATE POLICY "Read own or demo profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_demo OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Read own enrollments" ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_course_teacher(auth.uid(), course_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Own student profile read" ON public.student_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_demo));
CREATE POLICY "Own student profile insert" ON public.student_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own student profile update" ON public.student_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own privacy read" ON public.privacy_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own privacy insert" ON public.privacy_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own privacy update" ON public.privacy_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== Signup: university email only, role from institutional data =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _domain text := lower(split_part(NEW.email, '@', 2));
  _uni uuid;
  _program uuid;
  _is_teacher boolean;
BEGIN
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
    -- Demo: enroll in the seeded semester courses of the degree program
    INSERT INTO public.enrollments (user_id, course_id, role)
      SELECT NEW.id, id, 'student' FROM public.courses WHERE degree_program_id = _program
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Demo seed =====
INSERT INTO public.universities (id, name, short_name, city) VALUES
  ('00000000-0000-0000-0000-000000000001','Politecnico di Milano','PoliMi','Milano');
INSERT INTO public.university_email_domains (domain, university_id) VALUES
  ('polimi.it','00000000-0000-0000-0000-000000000001'),
  ('mail.polimi.it','00000000-0000-0000-0000-000000000001');
INSERT INTO public.degree_programs (id, university_id, name, level) VALUES
  ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Ingegneria Gestionale','Laurea Triennale');

INSERT INTO public.courses (id, university_id, degree_program_id, code, name, credits, class_hours, semester, program_year) VALUES
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','085811','Analisi Matematica 2',8,80,1,2),
  ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','085812','Ricerca Operativa',8,80,1,2),
  ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','085813','Economia e Organizzazione Aziendale',10,100,1,2),
  ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','085814','Fisica Tecnica',6,60,1,2),
  ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','085815','Statistica',8,80,1,2);

-- Demo teachers (no login accounts)
INSERT INTO public.profiles (id, full_name, email, university_id, is_demo) VALUES
  ('00000000-0000-0000-0000-000000000201','Prof.ssa Laura Bellini',NULL,'00000000-0000-0000-0000-000000000001',true),
  ('00000000-0000-0000-0000-000000000202','Prof. Marco Ferrante',NULL,'00000000-0000-0000-0000-000000000001',true),
  ('00000000-0000-0000-0000-000000000203','Prof.ssa Giulia Conti',NULL,'00000000-0000-0000-0000-000000000001',true),
  ('00000000-0000-0000-0000-000000000204','Prof. Andrea Galli',NULL,'00000000-0000-0000-0000-000000000001',true),
  ('00000000-0000-0000-0000-000000000205','Prof.ssa Elena Moretti',NULL,'00000000-0000-0000-0000-000000000001',true);
INSERT INTO public.user_roles (user_id, role) SELECT id, 'teacher' FROM public.profiles WHERE id::text LIKE '%0000020_';
INSERT INTO public.course_professors (course_id, full_name, email, profile_id) VALUES
  ('00000000-0000-0000-0000-000000000101','Prof.ssa Laura Bellini','docente.demo1@polimi.it','00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000102','Prof. Marco Ferrante','docente.demo2@polimi.it','00000000-0000-0000-0000-000000000202'),
  ('00000000-0000-0000-0000-000000000103','Prof.ssa Giulia Conti','docente.demo3@polimi.it','00000000-0000-0000-0000-000000000203'),
  ('00000000-0000-0000-0000-000000000104','Prof. Andrea Galli','docente.demo4@polimi.it','00000000-0000-0000-0000-000000000204'),
  ('00000000-0000-0000-0000-000000000105','Prof.ssa Elena Moretti','docente.demo5@polimi.it','00000000-0000-0000-0000-000000000205');
INSERT INTO public.enrollments (user_id, course_id, role)
  SELECT profile_id, course_id, 'teacher' FROM public.course_professors;

-- Demo students
INSERT INTO public.profiles (id, full_name, university_id, degree_program_id, program_year, is_demo) VALUES
  ('00000000-0000-0000-0000-000000000301','Sofia Ricci','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',2,true),
  ('00000000-0000-0000-0000-000000000302','Luca Marino','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',2,true),
  ('00000000-0000-0000-0000-000000000303','Chiara Esposito','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',2,true),
  ('00000000-0000-0000-0000-000000000304','Matteo Greco','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',2,true),
  ('00000000-0000-0000-0000-000000000305','Aurora Lombardi','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',2,true),
  ('00000000-0000-0000-0000-000000000306','Davide Colombo','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010',2,true);
INSERT INTO public.user_roles (user_id, role) SELECT id, 'student' FROM public.profiles WHERE id::text LIKE '%0000030_';
INSERT INTO public.enrollments (user_id, course_id, role)
  SELECT p.id, c.id, 'student' FROM public.profiles p CROSS JOIN public.courses c WHERE p.id::text LIKE '%0000030_';
INSERT INTO public.privacy_settings (user_id) SELECT id FROM public.profiles WHERE id::text LIKE '%0000030_';
INSERT INTO public.student_profiles (user_id, archetype, looking_for, group_size, places, time_slots, living_situation, tags, languages, bio, onboarding_completed) VALUES
  ('00000000-0000-0000-0000-000000000301','pianificatrice','gruppo di studio','3-4',ARRAY['biblioteca'],ARRAY['mattina'],'fuori sede',ARRAY['analisi','statistica'],ARRAY['italiano','inglese'],'Mi piace arrivare agli esami con un piano chiaro.',true),
  ('00000000-0000-0000-0000-000000000302','sprinter','compagno di studio','2',ARRAY['aula studio'],ARRAY['sera'],'in sede',ARRAY['ricerca operativa'],ARRAY['italiano'],'Studio a blocchi intensi, poi pausa.',true),
  ('00000000-0000-0000-0000-000000000303','spiegatrice','gruppo di studio','3-4',ARRAY['biblioteca','online'],ARRAY['pomeriggio'],'pendolare',ARRAY['economia'],ARRAY['italiano','spagnolo'],'Imparo meglio spiegando agli altri.',true),
  ('00000000-0000-0000-0000-000000000304','costante','compagno di studio','2',ARRAY['casa'],ARRAY['mattina','pomeriggio'],'in sede',ARRAY['fisica tecnica'],ARRAY['italiano'],'Poco ma ogni giorno.',true),
  ('00000000-0000-0000-0000-000000000305','pianificatrice','gruppo di studio','5+',ARRAY['aula studio'],ARRAY['pomeriggio'],'fuori sede',ARRAY['statistica'],ARRAY['italiano','inglese','francese'],'Cerco persone per ripassare in vista degli appelli.',true),
  ('00000000-0000-0000-0000-000000000306','sprinter','compagno di studio','2',ARRAY['online'],ARRAY['sera'],'pendolare',ARRAY['analisi'],ARRAY['italiano'],'Pendolare, studio volentieri online la sera.',true);

-- Topics
INSERT INTO public.course_topics (course_id, name, weight, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000101','Funzioni di più variabili','high',1),
  ('00000000-0000-0000-0000-000000000101','Integrali multipli','high',2),
  ('00000000-0000-0000-0000-000000000101','Equazioni differenziali','medium',3),
  ('00000000-0000-0000-0000-000000000101','Serie di funzioni','low',4),
  ('00000000-0000-0000-0000-000000000102','Programmazione lineare','high',1),
  ('00000000-0000-0000-0000-000000000102','Metodo del simplesso','high',2),
  ('00000000-0000-0000-0000-000000000102','Dualità','medium',3),
  ('00000000-0000-0000-0000-000000000102','Problemi su grafi','medium',4),
  ('00000000-0000-0000-0000-000000000103','Contabilità e bilancio','high',1),
  ('00000000-0000-0000-0000-000000000103','Analisi dei costi','high',2),
  ('00000000-0000-0000-0000-000000000103','Strutture organizzative','medium',3),
  ('00000000-0000-0000-0000-000000000103','Microeconomia di base','low',4),
  ('00000000-0000-0000-0000-000000000104','Termodinamica','high',1),
  ('00000000-0000-0000-0000-000000000104','Cicli termodinamici','high',2),
  ('00000000-0000-0000-0000-000000000104','Trasmissione del calore','medium',3),
  ('00000000-0000-0000-0000-000000000105','Probabilità','high',1),
  ('00000000-0000-0000-0000-000000000105','Variabili aleatorie','high',2),
  ('00000000-0000-0000-0000-000000000105','Stima e intervalli di confidenza','medium',3),
  ('00000000-0000-0000-0000-000000000105','Test di ipotesi','medium',4),
  ('00000000-0000-0000-0000-000000000105','Regressione lineare','low',5);

-- Materials (metadata only for now)
INSERT INTO public.course_materials (course_id, topic_id, title, version, uploaded_by)
  SELECT t.course_id, t.id, 'Dispense: ' || t.name, 1, cp.profile_id
  FROM public.course_topics t JOIN public.course_professors cp ON cp.course_id = t.course_id
  WHERE t.weight = 'high';

-- Exam dates (winter session 2027)
INSERT INTO public.exams (course_id, exam_date, kind, room) VALUES
  ('00000000-0000-0000-0000-000000000101','2027-01-18 09:00+01','scritto','Aula B.4.1'),
  ('00000000-0000-0000-0000-000000000101','2027-02-12 09:00+01','scritto','Aula B.4.1'),
  ('00000000-0000-0000-0000-000000000102','2027-01-22 14:00+01','scritto','Aula 3.0.2'),
  ('00000000-0000-0000-0000-000000000102','2027-02-16 14:00+01','scritto','Aula 3.0.2'),
  ('00000000-0000-0000-0000-000000000103','2027-01-26 10:00+01','scritto','Aula Rogers'),
  ('00000000-0000-0000-0000-000000000104','2027-01-29 09:30+01','scritto','Aula L.26.01'),
  ('00000000-0000-0000-0000-000000000104','2027-02-19 09:30+01','orale','Aula L.26.01'),
  ('00000000-0000-0000-0000-000000000105','2027-02-02 13:00+01','scritto','Aula 2.1.3');

-- Weekly class schedule, Sep 21 - Dec 18 2026
INSERT INTO public.class_events (course_id, starts_at, ends_at, room)
SELECT s.course_id,
       (d + s.start_time) AT TIME ZONE 'Europe/Rome',
       (d + s.start_time + s.duration) AT TIME ZONE 'Europe/Rome',
       s.room
FROM (VALUES
  ('00000000-0000-0000-0000-000000000101'::uuid, 1, time '08:30', interval '2 hours', 'Aula B.4.1'),
  ('00000000-0000-0000-0000-000000000101'::uuid, 3, time '10:30', interval '2 hours', 'Aula B.4.1'),
  ('00000000-0000-0000-0000-000000000102'::uuid, 2, time '14:15', interval '2 hours', 'Aula 3.0.2'),
  ('00000000-0000-0000-0000-000000000102'::uuid, 4, time '08:30', interval '2 hours', 'Aula 3.0.2'),
  ('00000000-0000-0000-0000-000000000103'::uuid, 1, time '14:15', interval '3 hours', 'Aula Rogers'),
  ('00000000-0000-0000-0000-000000000103'::uuid, 5, time '10:30', interval '2 hours', 'Aula Rogers'),
  ('00000000-0000-0000-0000-000000000104'::uuid, 2, time '10:30', interval '2 hours', 'Aula L.26.01'),
  ('00000000-0000-0000-0000-000000000105'::uuid, 3, time '14:15', interval '2 hours', 'Aula 2.1.3'),
  ('00000000-0000-0000-0000-000000000105'::uuid, 5, time '08:30', interval '2 hours', 'Aula 2.1.3')
) AS s(course_id, dow, start_time, duration, room)
CROSS JOIN generate_series(date '2026-09-21', date '2026-12-18', interval '1 day') AS d
WHERE extract(isodow FROM d) = s.dow;
