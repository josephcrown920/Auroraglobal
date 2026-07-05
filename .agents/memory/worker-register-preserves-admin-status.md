---
name: Worker auto-registration must not override admin pause/drain
description: Self-registration on reconnect stamps status="active" for new workers only; existing paused/draining rows must stay parked.
---

# Auto-registration vs admin intent on gpu_workers.status

`POST /api/public/workers/register` is called every time a self-hosted worker
(Colab/Kaggle notebook) boots or reconnects, and it always believes itself to be
up. That's correct for a brand-new row, but if it unconditionally stamped
`status="active"` on every call, it would silently undo an admin's deliberate
`paused`/`draining` action the next time that notebook's session happened to
restart — the admin's Admin -> Workers action would look like it "didn't stick."

**Rule:** on a matched (existing) row, only force `status="active"` if the
current status is NOT `paused` or `draining`. If it is, keep it as-is; still
refresh `last_heartbeat`, `endpoint_url`, and other fields normally. A row with
no match (brand-new worker) still always comes up `active`.

**Why `draining` is treated the same as `paused` here:** both represent an
explicit admin decision that this worker should stop taking new work — the
distinction between them matters to the dispatcher/health-sweep, not to
whether an unrelated Colab reboot should be allowed to overwrite it.

**How to apply:** any future endpoint that upserts `gpu_workers` status based on
an external signal (register, health probe, sweep) must check the *existing*
row's status before overwriting it with an inferred "it's up now" value —
inference is not authorization to override an admin's paused/draining state.
