# Aurora Video Agent End-to-End Acceptance — 2026-09-02

## Canonical rule
Every video-facing agent must operate on the same Production Brain. A UI, prompt, provider adapter or render button alone is not completion.

## Covered surfaces
- Conversational Aurora Agent / Director: `agent_sessions` is bridged into `video_production_projects` by database trigger.
- Cinematic Video Agent: `VIDEO_DIRECTION` calls inherit the shared production contract through the AI router.
- Aurora Baby Agent: creates a persistent Production Brain per run and dispatches shot jobs through the shared queue.
- Video Editor: creates a Production Brain per edit session; editor commands calculate dependency-aware impact; export state is mirrored into the brain.
- Dedicated Video Agent project / Director Workspace: `video_agent_projects` is bridged into the Production Brain by database trigger.
- Exported Aurora Video Agent: receives the same production contract and keeps its own local contract copy so the export is self-contained.
- Generation records: `generations` with `session_id` + `agent_shot_id` mirror terminal/per-shot status into the Production Brain.

## Brain contract
The shared state contains:
- creative intent and assumptions
- brief, script, treatment
- character/world/style bibles
- locked reference roles
- scene/shot dependency graph
- timeline tracks for video, image, voice, music, SFX, text, captions, overlays and brand
- provider/model decisions
- QA results
- rough-cut/creative-review state
- delivery formats, resolutions and outputs
- immutable-ish production history entries

## Natural-language revision rule
Local instructions must invalidate only the affected production subgraph. Scene/character/world/style changes propagate to dependent shots. Unrelated approved shots remain approved. Project-level changes may request a re-plan.

## Capability floor
Prompt→video, script→video, image→video, video→video, URL/document/presentation inputs, repurposing, multi-aspect output, templates, brand state, AI image/video, voice, music/SFX, captions, timeline editing, AI revision, asset management, provider routing, QA, rough-cut review and render/export are represented by the canonical contract.

## Still-open operational verification
1. Real frame-level visual QA requires a live vision worker and stored frames; the schema and repair semantics exist, but credentials/compute are not assumed.
2. Live ModelArk/Seedance/Seedream access remains environment-dependent and is never hard-coded as guaranteed.
3. Durable worker/event scale still depends on the deployed queue/worker infrastructure.
4. The free Pollinations keyframe route remains deliberately free; it is not silently converted to paid generation without the existing authenticated credit boundary.
5. Streaming backend exists; UI consumption should be verified in E2E before calling streaming production-complete.

## Acceptance path
`UI → authenticated API → persistent brain → specialist planning → provider router/queue → generation → event/status persistence → QA → targeted repair → rough cut → creative review → render → verified artifact`
