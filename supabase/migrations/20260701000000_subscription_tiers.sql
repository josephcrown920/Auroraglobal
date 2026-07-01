-- Task #152 — Free / Pro subscription tiers
-- Adds subscription tracking, watermark flag on generations, queue-priority
-- trigger keyed to plan, and helper RPCs for the Paystack subscription webhook.

-- ── 1. Profile: subscription tracking columns ────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code text;

-- ── 2. Generations: watermark flag ──────────────────────────────────────────
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS is_watermarked boolean NOT NULL DEFAULT false;

-- ── 3. Subscriptions table (Paystack recurring billing state) ────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paystack_subscription_code text      NOT NULL,
  paystack_customer_code   text,
  paystack_email_token     text,
  plan_code                text,
  status                   text        NOT NULL DEFAULT 'active',
  next_payment_date        timestamptz,
  amount_minor             integer,
  currency                 text        NOT NULL DEFAULT 'USD',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active_idx
  ON public.subscriptions (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS subscriptions_code_idx
  ON public.subscriptions (paystack_subscription_code);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL    ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription select" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER subscriptions_touch
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 4. Trigger: auto-set job priority from the user's plan ───────────────────
-- Pro users → priority 10 (claimed first).  Free / unknown → 0.
-- claim_next_job already orders by priority DESC, scheduled_at ASC, so this is
-- the only change needed to give Pro users a faster queue.
CREATE OR REPLACE FUNCTION public.set_job_priority_from_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.priority := COALESCE((
    SELECT CASE
      WHEN p.plan = 'pro' THEN 10
      WHEN EXISTS(
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = NEW.user_id AND ur.role = 'admin'
      ) THEN 10
      ELSE 0
    END
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
    LIMIT 1
  ), 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_priority_from_plan ON public.jobs;
CREATE TRIGGER job_priority_from_plan
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_job_priority_from_plan();

-- ── 5. Trigger: auto-set is_watermarked from user's plan on generation insert ─
-- Pro users and admins get clean outputs.  Free users get a watermark overlay.
CREATE OR REPLACE FUNCTION public.set_generation_watermark_from_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan     text;
  _is_admin boolean := false;
BEGIN
  SELECT plan INTO _plan FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'admin'
  ) INTO _is_admin;
  NEW.is_watermarked := NOT (_plan = 'pro' OR _is_admin = true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generation_watermark_from_plan ON public.generations;
CREATE TRIGGER generation_watermark_from_plan
  BEFORE INSERT ON public.generations
  FOR EACH ROW EXECUTE FUNCTION public.set_generation_watermark_from_plan();

-- ── 6. RPC: activate_pro_subscription ───────────────────────────────────────
-- Called by the Paystack webhook when a new subscription is confirmed or renews.
CREATE OR REPLACE FUNCTION public.activate_pro_subscription(
  _user     uuid,
  _sub_code text,
  _expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET plan                     = 'pro',
      subscription_expires_at  = _expires_at,
      paystack_subscription_code = _sub_code
  WHERE user_id = _user;
END;
$$;

-- ── 7. RPC: deactivate_pro_subscription ─────────────────────────────────────
-- Called by the Paystack webhook when a subscription is disabled / cancelled.
CREATE OR REPLACE FUNCTION public.deactivate_pro_subscription(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET plan                       = 'free',
      subscription_expires_at    = null,
      paystack_subscription_code = null
  WHERE user_id = _user;
END;
$$;

-- ── 8. RPC: grant_monthly_aura ───────────────────────────────────────────────
-- Top-up Aura on each successful subscription renewal.
CREATE OR REPLACE FUNCTION public.grant_monthly_aura(
  _user   uuid,
  _amount integer,
  _ref    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, credits)
  VALUES (_user, _amount)
  ON CONFLICT (user_id)
  DO UPDATE SET credits = public.profiles.credits + _amount;
END;
$$;
