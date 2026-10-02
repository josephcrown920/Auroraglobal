---
name: aurora-video-production
description: "Aurora's unified video-production skill: brief → storyboard → asset generation → motion/lip-sync → edit → effects → QC → export. Use for cinematic videos, music videos, social clips, performance content, batch production, and autopilot production."
---

# Aurora Video Production

Use Aurora's existing Video Agent, MCP, production, Social Studio, Remotion and provider routing. Do not create a second orchestration layer.

## Production flow

1. Intake: identify subject, story, platform, aspect ratio, duration and references.
2. Plan: create brief, continuity ledger, shot list and render plan.
3. Generate: route image/video/motion/lip-sync work through the existing Aurora orchestrator.
4. Edit: build a real timeline with layers, cuts, transitions, captions, audio and effects.
5. Inspect: validate identity continuity, duration, aspect ratio, audio, captions and render health.
6. Export: produce platform-specific masters and derivatives.
7. Publish/queue: hand completed assets to Production/Social Studio rather than inventing a new queue.

## Quality gates

- Preserve identity anchors across shots.
- Never silently change wardrobe, props, story beats or supplied dialogue.
- Prefer short generated clips and compose them into longer edits.
- Use presets as starting points; expose every meaningful parameter for manual override.
- Effects must be deterministic and serializable.
- Every generated production should retain a machine-readable plan/receipt.

## Open-source capability mapping

Use the capability ideas from OpenMontage for stage-based production, resumable checkpoints, review gates, pipeline manifests and multi-format production. Use Etro's concepts for browser timeline layers, effect chains, keyframes and serializable effect parameters.

Do NOT copy GPL/AGPL source into Aurora. Implement compatible functionality in Aurora's own TypeScript/Remotion architecture unless a dependency is deliberately isolated and its license has been reviewed.

## Required integrations

- MCP: expose production actions as tools.
- Skill Library: discover/load this skill and specialized child skills.
- Video Agent: cinematic planning and generation.
- Remotion: composition/rendering.
- Effects registry: reusable effect definitions.
- Preset registry: reusable creative looks and production recipes.
- Production System: batch/autopilot execution.
- Social Studio: platform derivatives and publishing workflow.
