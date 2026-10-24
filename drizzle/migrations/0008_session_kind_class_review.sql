ALTER TABLE public.study_sessions_planned ADD COLUMN kind text NOT NULL DEFAULT 'study' CHECK (kind IN ('study','review','exam_review'));
ALTER TABLE public.study_sessions_planned ADD COLUMN class_event_id uuid REFERENCES public.class_events(id) ON DELETE SET NULL;
UPDATE public.study_sessions_planned SET kind = 'exam_review' WHERE is_review;