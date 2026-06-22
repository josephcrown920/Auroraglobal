
CREATE TABLE public.lipsync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_url text NOT NULL,
  audio_url text NOT NULL,
  engine text NOT NULL DEFAULT 'sync-v2',
  status text NOT NULL DEFAULT 'queued',
  result_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lipsync_jobs TO authenticated;
GRANT ALL ON public.lipsync_jobs TO service_role;

ALTER TABLE public.lipsync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lipsync own select" ON public.lipsync_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lipsync own insert" ON public.lipsync_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lipsync own update" ON public.lipsync_jobs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lipsync own delete" ON public.lipsync_jobs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lipsync admin read" ON public.lipsync_jobs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER lipsync_jobs_touch
  BEFORE UPDATE ON public.lipsync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
