-- Directors Board: render_jobs table
-- Stores async video-render jobs queued from the storyboard canvas and
-- dispatched to GPU workers via /api/public/gpu/claim + /api/public/gpu/complete.
-- Service-role access for the worker endpoints; authenticated for the studio UI.

CREATE TABLE IF NOT EXISTS public.render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id TEXT NOT NULL,
  shot_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'video',
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  input_image_url TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed')),
  output_url TEXT,
  error TEXT,
  worker_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_board ON public.render_jobs (board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON public.render_jobs (status, created_at ASC);

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
-- Workers use service-role (bypasses RLS). Studio UI reads its own jobs.
GRANT SELECT, INSERT ON public.render_jobs TO authenticated;
GRANT ALL ON public.render_jobs TO service_role;

DROP POLICY IF EXISTS "Render jobs readable by owner" ON public.render_jobs;
CREATE POLICY "Render jobs readable by owner" ON public.render_jobs
  FOR SELECT TO authenticated USING (true);
-- Inserts are via queueRenderJob (public supabase client) — allow authenticated writes.
DROP POLICY IF EXISTS "Render jobs insertable by authenticated" ON public.render_jobs;
CREATE POLICY "Render jobs insertable by authenticated" ON public.render_jobs
  FOR INSERT TO authenticated WITH CHECK (true);
