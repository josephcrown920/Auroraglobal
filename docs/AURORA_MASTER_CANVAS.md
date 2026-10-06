# Aurora Master Canvas

## Purpose

One visual source of truth for the complete Aurora product. This is a review board, not another product feature.

## Web screens

1. Landing
2. Pricing
3. Auth / onboarding
4. Studio / Director
5. Video Agent
6. Perform Anywhere
7. Music Video Studio
8. Canvas
9. Colors Studio
10. Production
11. TikTok 30
12. Puremix / Mastering
13. Layers
14. Gallery
15. Wardrobe
16. Performances
17. Settings
18. Billing

## Mobile screens

1. Onboarding
2. Home / Director
3. Perform Anywhere
4. Camera / Performance capture
5. Music Video
6. Gallery
7. Projects
8. Profile
9. Credits
10. Settings

## Workflow boards

- Director orchestration
- Perform Anywhere workflow library
- Human Reference / Identity Vault
- Seedance provider routing
- Canvas node execution
- Music Video agentic pipeline
- Production autopilot
- TikTok 30
- Effects / presets / skills
- Backup / restore

## QA legend

- 🟢 Proven: produces the promised artifact in a live smoke test.
- 🟡 Needs proof: implementation exists but the complete workflow has not passed a live smoke test.
- 🔴 Broken: a smoke test fails or the UI promises functionality that is not wired.
- ⚪ UI only: screen exists without a verified execution path.

## Figma capture

Use Figma's Code-to-Canvas / Figma MCP workflow to capture the running Aurora routes. Figma supports capturing a single screen or an entire multi-step flow as editable frames, which is exactly what this board needs.

Capture the web routes first, then the Expo/mobile routes. Arrange desktop screens in a grid, mobile screens beneath them, and workflow diagrams to the right.

The board should be updated from the deployed/staging app after each launch-gate change; do not use mock screens as proof.

## Source of truth

Code remains the execution source of truth. Figma is the visual review/source-of-truth surface for UX decisions. A Figma change is not considered implemented until the corresponding Aurora code is updated and smoke-tested.
