-- Add payments, jobs, agent_sessions, owner_withdrawals, scheduler_heartbeats
-- to the live database so runtime code that references them stops failing.

-- Shared updated_at trigger helper (idempotent; matches existing touch_updated_at fn signature)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'paystack',
  reference text NOT NULL UNIQUE,
  amount_kobo integer NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  credits_granted integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments self select" ON public.payments;
CREATE POLICY "payments self select" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE TRIGGER payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- jobs (background worker queue)
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  priority int NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  credits_reserved int NOT NULL DEFAULT 0,
  generation_id uuid,
  parent_job_id uuid,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read jobs" ON public.jobs;
CREATE POLICY "Owners read jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owners insert jobs" ON public.jobs;
CREATE POLICY "Owners insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owners cancel own queued jobs" ON public.jobs;
CREATE POLICY "Owners cancel own queued jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('queued','processing')) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS jobs_queue_idx ON public.jobs (status, scheduled_at, priority DESC) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS jobs_user_idx ON public.jobs (user_id, created_at DESC);
CREATE OR REPLACE TRIGGER jobs_touch_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- agent_sessions
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  brief text NOT NULL DEFAULT '',
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  iterations jsonb NOT NULL DEFAULT '[]'::jsonb,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_sessions_user_updated_idx ON public.agent_sessions (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_sessions TO authenticated;
GRANT ALL ON public.agent_sessions TO service_role;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own agent_sessions" ON public.agent_sessions;
CREATE POLICY "own agent_sessions" ON public.agent_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE TRIGGER agent_sessions_touch BEFORE UPDATE ON public.agent_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- owner_withdrawals
CREATE TABLE IF NOT EXISTS public.owner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_minor int NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  destination jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.owner_withdrawals TO authenticated;
GRANT ALL ON public.owner_withdrawals TO service_role;
ALTER TABLE public.owner_withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own withdrawals" ON public.owner_withdrawals;
CREATE POLICY "own withdrawals" ON public.owner_withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE TRIGGER owner_withdrawals_touch BEFORE UPDATE ON public.owner_withdrawals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- scheduler_heartbeats
CREATE TABLE IF NOT EXISTS public.scheduler_heartbeats (
  name text PRIMARY KEY,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scheduler_heartbeats TO authenticated;
GRANT ALL ON public.scheduler_heartbeats TO service_role;
ALTER TABLE public.scheduler_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "heartbeats read" ON public.scheduler_heartbeats;
CREATE POLICY "heartbeats read" ON public.scheduler_heartbeats FOR SELECT TO authenticated USING (true);
CREATE OR REPLACE TRIGGER scheduler_heartbeats_touch BEFORE UPDATE ON public.scheduler_heartbeats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
