-- Owner earnings accounting: persist the profit / credit-funding split for
-- each successful Paystack payment. Amounts are stored in the currency's minor
-- unit (matching payments.amount_kobo), and split_profit_pct records the split
-- that was in effect when the payment was processed so historical rows stay
-- accurate even if the split constant changes later.
alter table public.payments add column if not exists profit_amount_minor integer;
alter table public.payments add column if not exists credit_funding_amount_minor integer;
alter table public.payments add column if not exists split_profit_pct numeric(5,2);
