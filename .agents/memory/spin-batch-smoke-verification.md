---
name: Spin batch smoke verification
description: Durable quirks when running paid spend-path smokes against the QA user and verifying spin batches
---

- The QA user carries the **admin role**, and charge points no-op for admins — a paid smoke must drop the role for the run (and restore it in `finally`) or its "charge happened" assertions silently pass without spending.
- Fund spend smokes from the **pricing engine** (`spinTotalCost`), never a hardcoded credit amount — batch size and per-piece cost both change over time and a stale constant underfunds the batch mid-run.
- The **cron sweeper finishes spin batches** even if the driving script dies — check job/variant rows directly before assuming a stall; a silent poll loop is not evidence of a stuck batch.
- Identity verification must be **strict evidence at the endpoint/model level, not provider level**: a provider name like "replicate" or "fal" serves both edit-capable and text-to-image models, so only the logged endpoint proves the face reference was honored. Treat query errors, missing logs, ambiguous logs, or unknown routes as failures.
- Long smoke drivers can **hang forever on a single unbounded HTTP fetch** while the batch completes fine server-side; always bound poll-loop fetches with a timeout, and background `nohup` processes started from a shell call may be silently reaped when the session rotates — verify outcomes from the DB, not the driver's log.

**Why:** each of these silently produced a false PASS or false FAIL in live paid-batch verification.
**How to apply:** any spend-path smoke against the QA user, and any batch identity verification.
