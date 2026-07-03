---
name: gpu_workers.auth_token protection model
description: Why auth_token isn't column-revoked at the DB, and how it's actually kept off the client
---

`gpu_workers.auth_token` holds per-worker bearer tokens (RunPod API keys, etc.).

A column-level `REVOKE SELECT(auth_token)` is a **no-op** here because a table-level `GRANT SELECT` exists — Postgres cannot column-revoke a privilege granted at table level.

**Real protection:** all `gpu_workers` access is server-side via the service-role client (`supabaseAdmin`); the browser never reads the table directly. The admin `listWorkers` server fn strips `auth_token` and returns only `has_auth_token: boolean`.

**Why:** reworking the table grants adds zero benefit and risks breaking server reads; the app-layer strip is the safeguard.
**How to apply:** never include `auth_token` in any client-facing response; do NOT try to "fix" exposure with column grants/revokes.
