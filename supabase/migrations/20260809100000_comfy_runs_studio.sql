-- Extend comfy_runs to support ComfyUI Studio (external REST service) runs.
--
-- Adds `external_run_id` to store the Studio job ID returned by POST /api/jobs,
-- and expands the `source` check to allow 'studio'. The ALTER CONSTRAINT
-- approach requires dropping and recreating the check.

ALTER TABLE public.comfy_runs
  ADD COLUMN IF NOT EXISTS external_run_id text;

-- Expand the source check to include 'studio'.
-- The original constraint name varies by Postgres version; drop both possible names.
ALTER TABLE public.comfy_runs
  DROP CONSTRAINT IF EXISTS comfy_runs_source_check;
ALTER TABLE public.comfy_runs
  DROP CONSTRAINT IF EXISTS comfy_runs_source_key;

ALTER TABLE public.comfy_runs
  ADD CONSTRAINT comfy_runs_source_check
    CHECK (source IN ('run', 'admin', 'canvas', 'studio'));
