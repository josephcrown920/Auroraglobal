# Aurora Global Video-Agent Upgrade

This document records the shared upgrade now applied to Aurora Global's product-facing and exported video-agent surfaces.

## Shared contracts

### Project memory

`src/lib/video-agent-memory-core.ts` adds the common memory vocabulary for Context, Notebook, references, production locks, approvals, acceptance criteria and generations. The exported standalone agent receives the same contract under `exports/aurora-video-agent/src/lib/video-agent-memory-core.ts`.

### Production routing

`src/lib/video-agent-production-core.ts` adds the normalized production request, provider chain, candidate scoring, hard-fail checks, winner selection, natural-language edit compilation and campaign-variant acceptance baseline. The exported agent receives its aligned copy too.

### ModelArk streaming

`src/lib/modelark-stream.server.ts` provides direct ModelArk Chat Completions streaming. It keeps credentials server-side, requests `stream: true`, preserves upstream SSE behavior and wraps the result in Aurora events:

- `start`
- `delta`
- `usage`
- `done`
- `error`

`src/routes/api/video-agent/stream.ts` exposes the authenticated `/api/video-agent/stream` endpoint. The standalone exported video agent has the same endpoint and server helper.

## ModelArk configuration

```text
ARK_API_KEY=<server secret>
ARK_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3
MODELARK_TEXT_MODEL=<active ModelArk text model or endpoint>
MODELARK_IMAGE_MODEL=<active Seedream model or endpoint>
MODELARK_VIDEO_MODEL=<active Seedance model or endpoint>
```

Aurora already uses `ARK_API_KEY` / `ARK_BASE_URL` in its existing ModelArk/BytePlus integration. The new streaming layer intentionally follows those names rather than introducing another credential system.

## Response-streaming behavior

Text responses stream incrementally from ModelArk. The UI can render each `delta` as it arrives and use `done` as the authoritative completion event.

Long-running video generation should continue to use truthful job progress. A video task is not considered complete until the provider/worker reports completion and the resulting media passes the downstream verification gate.

## Skill layer

The supplied video skills are represented in `.agents/memory/video-skill-pack-2026-09.md` and the standalone agents' `skills/VIDEO_SKILLS.md` files. The routing distinctions are preserved between avatar creation, new presenter video, existing-video translation, source cutting, talking-head assembly, SVG motion and self-evolution.

## Product surfaces covered

- `/video-agent`
- `/video-agent/studio`
- `/video-agent/process`
- `/video-agent/edit`
- `exports/aurora-video-agent/*`

The existing routes remain intact. The new shared contracts and stream endpoint are additive, so existing generation and rendering paths do not need to be replaced just to consume the new architecture.

## Security

Never put ModelArk keys in client code, committed `.env` files or browser requests. The stream route authenticates the caller and the server reads the provider key from runtime secrets.

## Acceptance

A video-agent feature is only production-complete when it has a domain contract, API/workflow, UI entry where required, provider/worker boundary, observable status, failure path, revision path, persisted approved state and verifiable output.
