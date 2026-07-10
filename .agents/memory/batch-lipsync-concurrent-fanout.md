---
name: Batch Lip Sync concurrent fan-out (no async queue)
description: Why Batch Lip Sync (N photos + 1 audio -> N videos) reuses the synchronous single-job path concurrently instead of the Content Machine async jobs-queue pattern
---

Batch Lip Sync intentionally does NOT use the Content Machine-style async `jobs`/`generations` queue + cron poller. Each photo just calls the existing single-item `runLipsyncJob` (own row, own credit charge/refund, own `orchestrate()` call), but all N calls are dispatched with `Promise.allSettled` (concurrent, not sequential) from one request/response cycle.

**Why:** the app is a persistent Node process (not edge/serverless), so a single HTTP request can safely await N concurrent I/O-bound provider calls — wall-clock time is ~one job's duration, not N x duration, so there's no timeout risk. This avoids duplicating engine-specific logic (xai-ugc two-stage chain, self-hosted worker checks, photo-vs-video engine branching) that lives only in `runLipsyncJob`/`lipsync.server.ts`, not in the generic `runMediaJob` queue handler.

**How to apply:** for any new "run the same single-item operation N times" feature on this app, prefer concurrent fan-out inside one request over a new async queue/table, UNLESS a single item's duration alone risks the request timeout — only then reach for the jobs-queue pattern. Rows are grouped via a nullable `batch_id` column on the item table (see `lipsync_jobs.batch_id`), not a separate batch table.
