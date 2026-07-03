---
name: Credit reservation flow (reserve / commit / release)
description: Invariants for spending credits via the reserve_credits/commit_reservation/release_reservation RPCs in this repo
---

All credit-spending render paths MUST go through `reserveOrchestrateRecord()` in
`src/lib/generate-core.server.ts`. The public `/api/public/generate` route and the
Aurora Agent per-shot renderer both call it so the credit flow never drifts.

RPC semantics (defined in the reservation-RPCs migration):
- `reserve_credits` → boolean: `credits -= amount`, `credits_reserved += amount`; returns false if insufficient.
- `commit_reservation` → void: `credits_reserved -= amount` (finalizes — the credits already left `credits` at reserve time).
- `release_reservation` → void: `credits += amount`, `credits_reserved -= amount` (a REFUND).

Invariants:
- Supabase RPCs RESOLVE with `{ error }` — they do NOT throw. Every reserve/commit/release
  call must inspect `error`. A swallowed commit/release error leaks `credits_reserved`
  while still reporting success.
- On COMMIT failure the render + `generations` row already succeeded → do NOT release
  (releasing would refund a delivered render = revenue loss). Surface the error for manual
  `credits_reserved` reconciliation instead.
- On orchestrate/insert failure, release the reservation then rethrow. If release ALSO
  errors, surface BOTH the original error and the leak — never swallow it.

**Why:** an architect review caught a leak where commit/release `{ error }` was ignored,
and a naive catch-all would have refunded successfully-delivered renders.
**How to apply:** any new credit-spending path — reuse `reserveOrchestrateRecord`; never
hand-roll reserve/commit/release.

**Sanctioned exception — batch jobs (Spin):** a large fan-out batch charges UPFRONT via
`deduct_credits` (one atomic ledger ref for the whole batch), then refunds 1 credit per
FAILED piece via `grant_credits(ref = variant id)`. Do NOT also route each piece through
`reserveOrchestrateRecord` — that would double-charge. `grant_credits` has NO ref dedupe,
so every refund call must be behind a status-CAS fence (see job-finalization-fence): claim
queued→running with `.eq('status','queued').select()`, finalize done/error with
`.eq('status','running').select()`, and only act (record generation / refund) if rows came back.
