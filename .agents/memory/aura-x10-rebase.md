---
name: Aura ×10 rebase (2026-07-19)
description: The credit economy was rebased ×10 (CapCut-style); DB + code are new-scale, guarded by rebase_events
---

On 2026-07-19 the entire Aura economy was multiplied ×10 (USD prices unchanged): all code constants, UI copy, and every Aura-denominated DB value (profiles wallets/limits, full credit_ledger history, jobs/generations, gift_cards, promo_codes, marketplace pricing+splits, payments.credits_granted).

Durable facts:
- The live shared DB is NEW-scale. Guard: `public.rebase_events` key `aura_rebase_x10` — any future economy rebase must use the same one-row event-key pattern so a re-applied migration can never double-multiply balances.
- `profiles.credits` is now **bigint** (one admin wallet holds ~1e10). Any plpgsql local receiving a `credits` value must be bigint — `deduct_credits._new` and `reserve_credits._ok` were widened for exactly this; new functions must follow suit or the admin wallet errors on every spend.
- ALTER TYPE on `profiles.credits` requires dropping/recreating the "profile self update" RLS policy (it references the column). Recreate verbatim — it is the credit-tamper guard.
- SQL-side hardcoded grants live in `handle_new_user` (signup 50) and `grant_free_monthly_aura_all` (200); they duplicate TS constants and must be changed in lockstep with billing.functions/billing.plans.
- Old-scale literals hid in threshold comparisons, not just display copy (e.g. low-credit email gate `credits > 5`); a rebase sweep must grep comparisons against credit columns, not only "N Aura" strings.

**Why:** prevents double-applying the rebase, and prevents reintroducing int4 assumptions that break the 1e10 admin wallet.
**How to apply:** any migration touching credit columns/functions, any new plpgsql reading `credits`, any future price-scale change.
