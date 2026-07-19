-- Aurora Partners program (2026-07-19)
-- 1. Commission bump 20% → 35% (growth doc approved: 30-40% band, page copy 35%).
--    The Paystack webhook reads affiliates.commission_pct per conversion, so this
--    takes effect immediately with no deploy-timing hazard. Only rows still at
--    the old default are bumped; any manually negotiated pct is left alone.
ALTER TABLE public.affiliates ALTER COLUMN commission_pct SET DEFAULT 35;
UPDATE public.affiliates SET commission_pct = 35 WHERE commission_pct = 20;

-- 2. Referral Aura grants dedup index. attachReferralToProfile always attempts
--    both grants (retriable if a crash lands between the CAS and the grants);
--    this partial unique index makes duplicates a true no-op: grant_credits
--    runs in one transaction, so a 23505 here rolls back the wallet increment
--    too. Mirrors the reason='monthly_aura' dedup pattern.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_referral_ref_uniq
  ON public.credit_ledger (ref_id)
  WHERE reason IN ('referral_signup', 'referral_reward');
