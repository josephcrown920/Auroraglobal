-- Promo codes: admin-issued discount/bonus codes, distinct from gift cards.
-- Two kinds:
--   'discount' — percent off applied to a checkout's price.amount_minor.
--   'bonus'    — flat Aura credited instantly on redeem (no purchase needed).
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('discount', 'bonus')),
  percent_off integer CHECK (percent_off BETWEEN 1 AND 100),
  bonus_credits integer CHECK (bonus_credits > 0),
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_kind_fields CHECK (
    (kind = 'discount' AND percent_off IS NOT NULL AND bonus_credits IS NULL) OR
    (kind = 'bonus' AND bonus_credits IS NOT NULL AND percent_off IS NULL)
  )
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can look up an active code by exact code (needed to
-- validate before redeeming/checking out); redemption itself always runs
-- server-side with the service role key.
CREATE POLICY "lookup promo codes" ON public.promo_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- One redemption per user per code (both kinds — a discount code can only
-- discount one checkout per user, a bonus code can only be claimed once).
CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, user_id)
);

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own promo redemptions" ON public.promo_code_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "service writes promo redemptions" ON public.promo_code_redemptions
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "admin read all promo redemptions" ON public.promo_code_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Track which promo code (if any) discounted a checkout, for admin reporting.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES public.promo_codes(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_percent_off integer;
