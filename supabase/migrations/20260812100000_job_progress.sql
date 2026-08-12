-- Real server-side job progress (task #284).
-- The queue runner / orchestrator / self-hosted workers write coarse + fine
-- progress onto the job row while it is `processing`; getJobStatus surfaces it
-- so UI bars track actual GPU work instead of a purely synthetic client-side
-- animation.
--
-- Writes are fenced on status='processing' in application code so a late
-- progress report can never scribble on a finalized row.
--
-- No new functions/RPCs and no grants: `jobs` is already service-role-only
-- (no anon/authenticated grants exist), and worker reports enter through an
-- authenticated server route, never directly against the table.
alter table public.jobs
  add column if not exists progress_pct smallint,
  add column if not exists progress_stage text,
  add column if not exists progress_updated_at timestamptz;

comment on column public.jobs.progress_pct is
  'Latest real progress 0-99 reported while processing (100 is implied by terminal status, never written here).';
comment on column public.jobs.progress_stage is
  'Short stage string: starting | generating | uploading | finalizing, or worker-reported free text (<=120 chars).';
comment on column public.jobs.progress_updated_at is
  'When progress_pct/progress_stage was last written; lets ops spot stalled renders.';
