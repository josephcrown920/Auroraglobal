# Aurora Launch, Learning & Growth Plan

## Current objective
Move from core-platform completion into real-user launch while preserving the existing Aurora architecture.

## P0 — Launch blockers
- Verify ModelArk -> managed agent -> Dola Seed end-to-end operation.
- Verify current provider/GPU capacity.
- Complete Android/Google Play production prerequisites and submit when ready.
- Confirm authentication, billing/credits, onboarding, and production monitoring.
- Establish ModelArk replacement/fallback path before the current access window ends.

## P1 — Product growth
### Supademo
Create interactive demos for:
1. AI/video generation
2. Aurora agent orchestration
3. Dola Seed coding/editor workflow
4. campaign/content generation
5. end-to-end user journey

### Aurora Content Agent
Pipeline:
idea -> research/context -> script -> visual plan -> generation -> edit/repurpose -> caption -> platform variants -> human approval -> publish -> analytics.

Targets:
- Instagram
- TikTok
- YouTube Shorts

### Learning loop
Record job outcomes and feedback without allowing uncontrolled self-modification.

Metrics:
- completion rate
- latency
- retries
- provider/model reliability
- quality feedback
- cost
- user edits/rejections
- publish performance where available

Use these to generate routing recommendations and workflow improvements.

## P2 — Optimization
Optimize the combined objective of quality, latency, reliability, and cost.

Potential controls:
- model selection
- provider fallback
- prompt/template versioning
- concurrency
- GPU lifecycle
- caching where safe
- retry strategy

## P3 — ModelArk independence
Keep all ModelArk access behind replaceable adapters/director interfaces. Maintain a provider capability registry so Aurora can move workloads without changing user-facing workflows.

## P4 — Security
For future agentic coding and publishing:
- sandbox workspace actions
- allowlist commands
- protect secrets
- isolate network access
- audit every write/publish/deploy action
- require approval for destructive/high-impact operations
- treat external content as untrusted prompt input

## Success state
Aurora has real users, measurable job outcomes, a repeatable content-growth engine, an interactive onboarding/demo layer, a submitted mobile app, and provider-independent orchestration.
