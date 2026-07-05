
-- 1. Credit reservation column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_reserved integer NOT NULL DEFAULT 0;

-- 2. Reservation RPCs

CREATE OR REPLACE FUNCTION public.reserve_credits(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ok int;
BEGIN
  UPDATE public.profiles
     SET credits = credits - _amount,
         credits_reserved = credits_reserved + _amount
   WHERE user_id = _user
     AND credits >= _amount
  RETURNING credits INTO _ok;
  IF _ok IS NULL THEN RETURN false; END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id)
    VALUES (_user, -_amount, 'reserve:' || _reason, _ref);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.commit_reservation(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET credits_reserved = GREATEST(credits_reserved - _amount, 0)
   WHERE user_id = _user;
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id)
    VALUES (_user, 0, 'commit:' || _reason, _ref);
END; $$;

CREATE OR REPLACE FUNCTION public.release_reservation(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET credits = credits + _amount,
         credits_reserved = GREATEST(credits_reserved - _amount, 0)
   WHERE user_id = _user;
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id)
    VALUES (_user, _amount, 'release:' || _reason, _ref);
END; $$;

-- 3. Jobs queue table

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

CREATE POLICY "Owners read jobs" ON public.jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert jobs" ON public.jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners cancel own queued jobs" ON public.jobs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('queued','processing'))
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS jobs_queue_idx
  ON public.jobs (status, scheduled_at, priority DESC)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS jobs_user_idx ON public.jobs (user_id, created_at DESC);

CREATE TRIGGER jobs_touch_updated
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Atomic create_generation_and_reserve

CREATE OR REPLACE FUNCTION public.create_generation_and_reserve(
  _user uuid,
  _kind text,
  _prompt text,
  _amount int,
  _payload jsonb
) RETURNS TABLE (job_id uuid, generation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gen uuid;
  _job uuid;
  _ok boolean;
BEGIN
  -- Reserve atomically (fails if not enough balance)
  _ok := public.reserve_credits(_user, _amount, 'job_' || _kind, gen_random_uuid());
  IF NOT _ok THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.generations (user_id, prompt, kind, status, credits_cost)
    VALUES (_user, COALESCE(_prompt, ''), _kind, 'pending', _amount)
    RETURNING id INTO _gen;

  INSERT INTO public.jobs (user_id, kind, payload, credits_reserved, generation_id)
    VALUES (_user, _kind, _payload, _amount, _gen)
    RETURNING id INTO _job;

  RETURN QUERY SELECT _job, _gen;
END; $$;

-- 5. claim_next_job: atomic worker checkout

CREATE OR REPLACE FUNCTION public.claim_next_job(_worker text)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.jobs;
BEGIN
  WITH next AS (
    SELECT id FROM public.jobs
     WHERE status = 'queued'
       AND scheduled_at <= now()
     ORDER BY priority DESC, scheduled_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.jobs j
     SET status = 'processing',
         started_at = COALESCE(j.started_at, now()),
         locked_at = now(),
         locked_by = _worker,
         attempts = j.attempts + 1
    FROM next
   WHERE j.id = next.id
  RETURNING j.* INTO _row;
  RETURN _row;
END; $$;

-- 6. TikTok remix table

CREATE TABLE IF NOT EXISTS public.tiktok_remixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_video_url text NOT NULL,
  source_generation_id uuid,
  target_count int NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'queued',
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  child_generation_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  child_job_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_remixes TO authenticated;
GRANT ALL ON public.tiktok_remixes TO service_role;

ALTER TABLE public.tiktok_remixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage remixes" ON public.tiktok_remixes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tiktok_remixes_touch_updated
  BEFORE UPDATE ON public.tiktok_remixes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
