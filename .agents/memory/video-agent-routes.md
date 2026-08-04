---
name: Video Agent routes & durable-render architecture
description: How the three /video-agent* routes split responsibilities, where state lives, and the credit-safety boundaries of the render pipeline.
---

## Route split (all require Supabase auth; guests redirect to /auth)
- `/video-agent` — create page: `createVideoAgentProject` → navigate to `-process?id=<uuid>`; lists recent projects from the server.
- `/video-agent-process?id=` — **plans EMPTY drafts only**. If the project already has scenes OR is queued/processing/succeeded/failed, it immediately `replace`-redirects to the editor. This prevents re-running script generation and clobbering an existing storyboard on reload.
- `/video-agent-edit?id=` — storyboard editor + the ONLY charge point ("Render video" → `enqueueVideoAgentRender`). Polls the project row every 4 s while queued/processing; editing is disabled during an active render so poll refreshes flow straight into local state.
- `/agent` redirects here. Old localStorage ids fail the server's uuid parse → "Project not found" card (deliberate; the localStorage store was deleted).

## State & safety boundaries
- Projects live in `video_agent_projects` (Supabase). The row is a **UI-polling convenience**: the runner/finalize path writes it best-effort AFTER winning the finalize_job CAS — `finalize_job` remains the only credit-safety boundary (same contract as kids_stories).
- Planning is free: script via `/api/video-agent/generate-script` (sanitize client-side: trim, drop scenes lacking script/description, clamp duration 3–15, max 12, re-index), storyboard frames via free Pollinations `/api/video-agent/generate-frame`. The renderer generates its own stills — storyboard frames are sketches, never render inputs.
- `updateVideoAgentProject` (server fn) rejects scene edits while queued/processing ("storyboard is locked") and never clobbers terminal statuses.
- Runner (`runVideoAgentRender`) fail-fast validates projectId/scenes/HF_TOKEN before any paid stage; per-scene validation precedes that scene's orchestrate calls; touches the job lock after each scene so the 15-min stale sweep never reclaims a long render mid-flight.

## Monitoring
- Queue-distress alerting rides `/api/public/uptime-monitor` with a SECOND `uptime_monitor_state` row `id='queue'` reusing the exact threshold/recovery mechanics (2 consecutive distressed checks → one email; recovery email on drain). Distress = eligible (past scheduled_at backoff) job queued >20 min, or processing lock >30 min (2× the sweep window ⇒ sweeps dead).
- `/admin/orchestration` has a "Generation queue" panel (24h per-kind counts, oldest eligible queued age, stale locks, Video Agent 7d outcomes) from `orchestrationHealth`'s `queue` block.

## Verification without spend
- `bun run scripts/va-live-roundtrip.ts` — inserts/updates/reads/deletes a real `video_agent_projects` row through every runner status transition against the live DB; proves the schema contract with zero provider cost.
- Runner failure paths are unit-tested in `jobs.server.test.ts` (mirrors the kids_story pattern: terminal fail → project row failed + single finalize; CAS-lost → row untouched; preflight fails before any orchestrate call).
