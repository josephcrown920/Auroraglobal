-- Log every call to /api/public/workers/register (success AND failure) so the
-- owner can see *why* a Kaggle/Colab/Vast worker never showed up in Admin ->
-- Workers, even when the attempt failed before a gpu_workers row could exist
-- (bad apikey, invalid payload, DB error). Without this, a failed
-- registration just vanishes — no row, no log the owner can see.
CREATE TABLE IF NOT EXISTS public.worker_register_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text,
  endpoint_url text,
  protocol text,
  ok boolean NOT NULL,
  -- Reason the attempt failed (auth, validation, DB error); NULL on success.
  error text,
  -- 'created' | 'updated' | NULL (failed before an upsert decision was made).
  outcome text
);

COMMENT ON TABLE public.worker_register_attempts IS
  'Audit log of every POST to /api/public/workers/register, success or failure. Lets the admin dashboard show *why* a worker never appeared as a gpu_workers row (e.g. wrong AURORA_REGISTER_KEY), instead of the attempt just vanishing.';

-- Keep the log bounded — attempts are diagnostic, not permanent records.
CREATE INDEX IF NOT EXISTS worker_register_attempts_created_at_idx
  ON public.worker_register_attempts (created_at DESC);

ALTER TABLE public.worker_register_attempts ENABLE ROW LEVEL SECURITY;
-- Written only via supabaseAdmin (service role) from the register route; read
-- only via supabaseAdmin from the admin-gated listWorkers server fn. No
-- client-side policies are needed — service role bypasses RLS entirely.
