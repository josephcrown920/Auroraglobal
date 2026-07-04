-- Lets the owner record when accumulated profit has actually been paid out
-- (withdrawn from the business). The Earnings tab already reports accumulated
-- profit from `payments`, but had no ledger of what's already been taken out,
-- so the owner couldn't tell remaining-to-withdraw from already-withdrawn.
-- Deliberately a standalone table (NOT the ai-credit-system bundle's
-- profit_tracker schema) so it fits Aurora's own payments/profit-split model.
CREATE TABLE IF NOT EXISTS public.owner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- When the payout actually happened (may be backdated); defaults to now().
  withdrawn_at timestamptz NOT NULL DEFAULT now(),
  -- Amount taken out, in USD minor units (cents), matching payments.amount_kobo /
  -- profit_amount_minor's unit convention.
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  note text,
  -- auth.users id of the admin who recorded the withdrawal.
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.owner_withdrawals IS
  'Ledger of owner payouts against accumulated profit (src/lib/profit-split.ts). Written/read only via supabaseAdmin from admin-gated server fns; used by the Earnings tab to show total withdrawn vs remaining-to-withdraw.';

CREATE INDEX IF NOT EXISTS owner_withdrawals_withdrawn_at_idx
  ON public.owner_withdrawals (withdrawn_at DESC);

ALTER TABLE public.owner_withdrawals ENABLE ROW LEVEL SECURITY;
-- No client-side policies: all access goes through supabaseAdmin (service
-- role, bypasses RLS) from admin.functions.ts, gated by assertAdmin().
