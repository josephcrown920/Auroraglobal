---
name: Watchdog alert claim-then-send pattern
description: How the watchdog dedups operator emails race-safely — atomic claim before send, generation-fenced restore, tri-state delivery; do not reintroduce read-then-act.
---

# Watchdog alert claim-then-send pattern

The system watchdog (`/api/public/watchdog`, state in `watchdog_state`) guarantees **one alert email per outage + one recovery** even under overlapping passes:

1. **Claim before send** — `watchdog_claim_transition(subsystem, kind, now)` RPC takes a row lock and stamps `alert_sent_at`/`recovery_sent_at` only when the transition is valid. Every successful claim bumps `transition_gen` and returns it as `claim_gen`. Only the claiming pass may send.
2. **Generation-fenced restore** — on a *definitive* email rejection (4xx / no API key), `watchdog_restore_transition(subsystem, kind, claim_gen, prev_alert, prev_recovery)` rolls the claim back, but only `WHERE transition_gen = p_claim_gen`. Any later claim (alert OR recovery) bumps the generation, so a stale restore is a no-op. A timestamp-only fence is NOT enough: a recovery claim doesn't touch `alert_sent_at`, so it can't invalidate an alert restore.
3. **Tri-state delivery** — Resend 2xx = `sent`; 4xx/no-key = `rejected` (restore, retry next pass); network/5xx = `ambiguous` (keep claim: at-most-once for that attempt, never a duplicate).

**Why:** the first implementation read state → sent email → stamped, which double-sends under concurrent cron/manual passes and loses counter updates. Two architect review rounds required the RPC design above; the race scenarios are subtle (alert-claim → recovery-claim → stale-alert-restore was the last one).

**How to apply:** any change to watchdog alerting must keep claim-before-send and the generation fence. `watchdog_record_state` owns status/counters (atomic increment); it must never touch the alert/recovery stamps or `transition_gen`. Prove race-safety with a BEGIN…ROLLBACK psql drill against the live DB (see live-db-rollback-proof-pattern), including the interleaving: claim alert → claim recovery → restore alert with the old gen (must be `restored:false`, both stamps intact).

Related: new security-definer RPCs need `REVOKE FROM PUBLIC` (not just anon/authenticated — PUBLIC is inherited) + `GRANT TO service_role`; verified live with an anon-key RPC call expecting 42501.
