-- Batch Lip Sync: groups multiple single-photo lipsync_jobs rows (one per
-- uploaded photo, one shared audio track) under a single batch_id so the UI
-- and MCP tools can track/poll them together. Each row still carries its own
-- independent credit charge/refund via the existing runLipsyncJob path — no
-- change to that fencing, just an optional grouping key.
ALTER TABLE public.lipsync_jobs
  ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS lipsync_jobs_batch_id_idx
  ON public.lipsync_jobs (batch_id)
  WHERE batch_id IS NOT NULL;
