---
name: Template Studio dispatch + taxonomy
description: How the /templates One-Tap Studio maps categories to Aurora's real backends, including spin's charging behaviour.
---
The /templates One-Tap Studio has EXACTLY seven closed categories (2026-08-13): **Viral (first — discovery hook), Lip-sync, Motion, UGC/Ad, Spin, Kids, Editing**. Do not invent extra buckets (a "Portrait" bucket was rejected). Each template declares its ordered orchestrator `kinds` plus a `dispatch` backend — the manifest is the single source of truth for flow + cost. "Viral" maps to NO feature key (ungated, visible to everyone).

Three dispatch backends, all EXISTING paths (never add new models/kinds):
- **studio** — a client-side chain of the same studio server fns the Canvas uses (image → video → lipsync), gated by the template's `kinds`; each awaits to completion, then redirect to the gallery. Cost = SUM of per-kind pricing. **The video stage is ALWAYS the forced preview pass**: the drawer never sends `confirmPreviewId`, so the server gate downgrades to 480p/≤5s and charges that — `templateCost()` must quote the preview pass (client-safe mirrors of the gate constants, parity-tested), never the nominal 720p run. No template/gallery surface offers the confirm-to-HD upgrade yet (only /studio, /colors, /motion, /guides, /beat-reel handle confirmPreviewId).
- **ugc** — the talking-ad path: enqueues an async job, then the drawer POLLS generation status until it terminates (bounded timeout). Flat cost = the server UGC constant.
- **spin** — navigates to `/spin?prompt=…`. No credits are charged in the template drawer itself (`templateCost()` returns 0 → TemplateCard shows "Free"). The 30 Aura charge happens only when the user explicitly clicks "Spin 30 posts" on `/spin`. TemplateDrawer button says "Open Spin · Free →" and the cost row says "30 Aura charged on /spin".

**Why:** the taxonomy is a closed set, and a displayed Aura cost is a promise — if it doesn't map to a backend that actually charges that amount it's a phantom charge that misleads the user. Keep the invariant: nonzero displayed cost ⇒ a charging (studio/ugc/spin) dispatch.
**How to apply:** keep the manifest module client-safe (no *.server import) — mirror server cost constants as literals and assert parity in the co-located test; that test also enforces "nonzero displayed cost ⇒ a charging dispatch". `.functions.ts` modules are client-importable (RPC-stubbed); `*.server` modules are not.
