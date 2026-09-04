-- Persist a lightweight, gallery-safe representation of a workflow's latest output.
-- This is additive: existing policies and grants on workflows remain unchanged.
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS last_output_url text,
  ADD COLUMN IF NOT EXISTS last_output_kind text;

ALTER TABLE public.workflows
  DROP CONSTRAINT IF EXISTS workflows_last_output_kind_check;

ALTER TABLE public.workflows
  ADD CONSTRAINT workflows_last_output_kind_check
  CHECK (last_output_kind IS NULL OR last_output_kind IN ('image', 'video'));