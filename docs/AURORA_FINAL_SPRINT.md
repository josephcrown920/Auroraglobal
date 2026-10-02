# Aurora Final Sprint

## Rule

No new major feature enters the scope unless it blocks a launch gate.

## Launch gates

### Generation
- Motion Control
- Style Transfer
- Seedance real-person reference routing
- Get Ready With Me
- Colors Performance
- Performance environments
- Clone Performance
- Rotoscope

### Agentic production
- Music Video Studio: song + long brief + references -> multi-shot output
- Production System: source -> multiple real deliverables
- TikTok 30: one request -> 30 finished pieces

### Workspace
- Canvas execution
- ComfyUI workflow migration with real execution proof
- Layers UI
- Music mastering

### Product
- Pricing conversion redesign
- PDF/tutorial cleanup
- full web/mobile preview board

### Reliability
- Build rollback proof
- Database restore proof
- Storage restore proof

## Definition of done

A feature is not green because its route, button, prompt, registry entry, or UI exists. It is green only after the promised workflow produces a real artifact and the artifact can be opened/exported.

## Canonical agent model

- Aurora Director: one user-facing creative director/orchestrator.
- Aurora Production: one autonomous content-production worker.
- Skills, providers, workflows and MCP tools are not user-facing agents.

## Evidence

Every launch gate should record:
- input assets
- workflow ID
- provider/model
- generation/job ID
- output artifact
- failure reason if applicable
- date/time of smoke test

## Current changes on this branch

- TikTok Spin batch count normalized to 30.
- Perform Anywhere final workflow contracts added.
- Seedance/ModelArk approved-asset helper added.
- Motion Control can now accept an approved ModelArk identity asset ID and emit asset:// reference material.
