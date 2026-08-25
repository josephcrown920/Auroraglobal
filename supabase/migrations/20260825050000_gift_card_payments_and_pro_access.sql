-- Sellable gift cards and one-time Pro access.
-- All settlement stays server/service-role only; browser clients never get
-- write access to gift cards, payments, or the grant helper functions.

ALTER TABLE public.gift_cards
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'aura',
  ADD COLUMN IF NOT EXISTS pro_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchaser_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS purchase_reference text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'succeeded',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.gift_cards
  DROP CONSTRAINT IF EXISTS gift_cards_kind_check,
  DROP CONSTRAINT IF EXISTS gift_cards_pro_days_check,
  DROP CONSTRAINT IF EXISTS gift_cards_payment_status_check,
  DROP CONSTRAINT IF EXISTS gift_cards_status_check,
  -- Legacy inline CHECK (credits > 0) from the original table definition
  -- rejects Pro cards (which carry credits = 0 + pro_days > 0); replace it
  -- with a kind-aware invariant below.
  DROP CONSTRAINT IF EXISTS gift_cards_credits_check,
  DROP CONSTRAINT IF EXISTS gift_cards_credits_kind_check;

ALTER TABLE public.gift_cards
  ADD CONSTRAINT gift_cards_kind_check CHECK (kind IN ('aura', 'pro')),
  ADD CONSTRAINT gift_cards_credits_kind_check CHECK (
    (kind = 'aura' AND credits > 0) OR (kind = 'pro' AND credits = 0)
  ),
  ADD CONSTRAINT gift_cards_pro_days_check CHECK (
    (kind = 'aura' AND pro_days = 0) OR (kind = 'pro' AND pro_days > 0)
  ),
  ADD CONSTRAINT gift_cards_payment_status_check CHECK (payment_status IN ('pending', 'succeeded', 'failed')),
  ADD CONSTRAINT gift_cards_status_check CHECK (status IN ('pending', 'active', 'redeemed', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_purchase_reference_key
  ON public.gift_cards (purchase_reference)
  WHERE purchase_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS gift_cards_purchaser_created_idx
  ON public.gift_cards (purchaser_id, created_at DESC);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gift_card_id uuid REFERENCES public.gift_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'aura',
  ADD COLUMN IF NOT EXISTS pro_days integer NOT NULL DEFAULT 0;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_purpose_check,
  DROP CONSTRAINT IF EXISTS payments_pro_days_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_purpose_check CHECK (purpose IN ('aura', 'gift_card', 'pro_one_time')),
  ADD CONSTRAINT payments_pro_days_check CHECK (pro_days >= 0);

CREATE INDEX IF NOT EXISTS payments_gift_card_idx
  ON public.payments (gift_card_id)
  WHERE gift_card_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pro_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_ref uuid NOT NULL UNIQUE,
  days integer NOT NULL CHECK (days > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gift_cards FROM anon, authenticated;
REVOKE ALL ON TABLE public.pro_access_grants FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payments FROM anon, authenticated;
GRANT ALL ON TABLE public.gift_cards, public.pro_access_grants TO service_role;

CREATE OR REPLACE FUNCTION public.grant_pro_access(
  _user uuid,
  _days integer,
  _source_ref uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grant_row_count integer := 0;
BEGIN
  INSERT INTO public.pro_access_grants (user_id, source_ref, days)
  VALUES (_user, _source_ref, _days)
  ON CONFLICT (source_ref) DO NOTHING;
  GET DIAGNOSTICS grant_row_count = ROW_COUNT;
  IF grant_row_count = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET plan = 'pro',
      subscription_expires_at =
        GREATEST(COALESCE(subscription_expires_at, now()), now())
        + make_interval(days => _days)
  WHERE user_id = _user;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  _user uuid,
  _code text
)
RETURNS TABLE (
  credits integer,
  kind text,
  pro_days integer,
  design text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  card public.gift_cards%ROWTYPE;
BEGIN
  SELECT * INTO card
  FROM public.gift_cards
  WHERE code = upper(trim(_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid gift card code';
  END IF;
  IF card.redeemed_by IS NOT NULL OR card.status = 'redeemed' THEN
    RAISE EXCEPTION 'This card has already been redeemed';
  END IF;
  IF card.status <> 'active' OR card.payment_status <> 'succeeded' THEN
    RAISE EXCEPTION 'This gift card is not active yet';
  END IF;

  UPDATE public.gift_cards
  SET redeemed_by = _user,
      redeemed_at = now(),
      status = 'redeemed'
  WHERE id = card.id
    AND redeemed_by IS NULL
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card was just redeemed by someone else';
  END IF;

  IF card.kind = 'aura' THEN
    PERFORM public.grant_credits(_user, card.credits, 'gift_card_redeem', card.id);
  ELSE
    PERFORM public.grant_pro_access(_user, card.pro_days, card.id);
  END IF;

  RETURN QUERY SELECT card.credits, card.kind, card.pro_days, card.design;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_pro_access(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_gift_card(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_pro_access(uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card(uuid, text) TO service_role;