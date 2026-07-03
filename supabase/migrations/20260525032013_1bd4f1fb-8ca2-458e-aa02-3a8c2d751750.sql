
-- Generations: favorites + tags
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS generations_user_fav_idx ON public.generations(user_id, is_favorite) WHERE is_favorite = true;

-- Gift cards
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  credits integer NOT NULL CHECK (credits > 0),
  amount_usd numeric(10,2) NOT NULL DEFAULT 0,
  design text NOT NULL DEFAULT 'aurora',
  note text,
  created_by uuid NOT NULL,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can look up a card by code (needed for redemption flow);
-- redemption itself is performed server-side with the service role key.
CREATE POLICY "lookup gift cards" ON public.gift_cards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage gift cards" ON public.gift_cards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Provider logs (orchestration monitoring)
CREATE TABLE IF NOT EXISTS public.provider_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  provider text NOT NULL,
  endpoint text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  latency_ms integer,
  cost_usd numeric(10,4),
  error text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads provider logs" ON public.provider_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS provider_logs_created_idx ON public.provider_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS provider_logs_provider_idx ON public.provider_logs(provider, status);
