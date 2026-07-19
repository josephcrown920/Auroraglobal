---
name: Aurora Partners referral loop
description: Idempotent both-sides referral Aura grants + partner commission — invariants for anyone touching attach/grant logic
---

# Aurora Partners referral loop

Rules:
- All Partners numbers (commission %, per-signup Aura, referrer daily cap) live in the client-safe module `src/lib/partners.ts`; UI copy must interpolate these constants, never hardcode.
- Referral grants are deduped by a partial unique index on `credit_ledger(ref_id)` scoped to `reason IN ('referral_signup','referral_reward')`, with deterministic md5 UUIDs namespaced `reason:refereeId`. `grant_credits` runs in one transaction, so a 23505 rolls back the wallet increment too — duplicates are true no-ops. Treat 23505 as "already granted", never as an error.
- `attachReferralToProfile` must validate the code against `affiliates` BEFORE the compare-and-set write (a bad write racing a good one would permanently eat the good referral), then always attempt both grants (winner or already-set) so a crash between attach and grant retries next visit.
- ReferralAttacher only clears the localStorage ref when the referee grant did NOT return "failed" — clearing on transient failure silently loses the one-time bonus.
- Referrer-side grants are capped per trailing 24h by counting `referral_reward` ledger rows (read-then-grant, deliberately non-atomic — blunt anti-farming, slight overshoot accepted). Referee grants and attribution are never capped.

**Why:** grants touch real user credits with no undo path; the design was architect-reviewed twice (plan + final) and dedup was rollback-proven against the live DB.

**How to apply:** any new grant surface (e.g. first-purchase bonus) must add its reason to the partial index predicate in a migration and use the same deterministic-ref + 23505-no-op pattern.
