---
name: Previs Pro plate surfaces
description: Where previsualization plates live and the free/premium split contract
---

# Previs Pro plate surfaces

Previsualization ("previs") plates are shot stills rendered from a plan's engineered prompts, in two tiers:

- **Free tier** — Pollinations sketch engine (same $0 path as `/api/video-agent/generate-frame`). No charge, no `generations` row. Surfaces: chat Cinematic Plan shot cards (`/agent` HeyGen panel) and Video Agent storyboard "Free plate".
- **Premium tier ("Upgrade plate")** — the SAME shot prompt re-rendered through the canonical paid image pipeline (`reserveOrchestrateRecord`, `kind:"image"`, cost from `computeCost({features:["image"]})` — never hardcoded, `mode:"preview"` so no confirmation ticket is needed for a still). Surface: Video Agent storyboard editor; the upgraded URL is persisted onto the scene's `frame` so it survives reloads and feeds the final render.

**Why the split:** owner chose the Hybrid model — planning and default plates must stay free; only explicit per-plate upgrades and final renders may spend Aura.

**Key contract points:**
- Prompts for paid plates are ALWAYS read from stored server state (project/session row), never from the client body — injection/IDOR hardening on top of RLS.
- Plate URL, quality, and generation provenance are server-owned fields. General storyboard saves preserve them rather than accepting client replacements.
- A finished plate is the approved image input for the final scene render; do not regenerate a different still behind the user's back.
- Scene JSON updates use the database's raw timestamp as the optimistic-lock token. Never round-trip that token through JavaScript epoch milliseconds because PostgreSQL retains finer precision.
- `agent_sessions`-backed functions (`refineAuroraPlan`, `renderAgentShot`, `renderPrevisPlate`) have NO UI wiring — chat plans live on `agent_chat_messages` as markdown, not sessions. Don't assume a session exists for a chat-generated plan.

**How to apply:** any new previs/plate surface must route paid renders through `reserveOrchestrateRecord` with a `computeCost`-derived cost, keep the free tier out of the ledger entirely, and merge completed plates into the latest persisted scene under optimistic locking.
