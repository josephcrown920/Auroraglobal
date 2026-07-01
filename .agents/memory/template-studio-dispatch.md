---
name: Template Studio dispatch + taxonomy
description: How the /templates One-Tap Studio maps categories to Aurora's real backends, plus the Spin free-preview caveat.
---
The /templates One-Tap Studio has EXACTLY five closed categories: **Lip-sync, Motion, UGC/Ad, Spin, Kids**. Do not invent extra buckets (a "Portrait" bucket was rejected). Each template declares its ordered orchestrator `kinds` plus a `dispatch` backend — the manifest is the single source of truth for flow + cost.

Three dispatch backends, all EXISTING paths (never add new models/kinds):
- **studio** — a client-side chain of the same studio server fns the Canvas uses (image → video → lipsync), gated by the template's `kinds`; each awaits to completion, then redirect to the gallery. Cost = SUM of per-kind pricing.
- **ugc** — the talking-ad path: enqueues an async job, then the drawer POLLS generation status until it terminates (bounded timeout). Flat cost = the server UGC constant.
- **spin** — the "1 → N" experience. CAVEAT: the /spin route is a FREE client-side live preview (placeholder tiles); it does NOT call the real charging spin backend, does not persist, and shows results in-place (not the gallery). So Spin templates must present as **Free** everywhere (cards, drawer, and the landing trending strip), never an Aura price.

**Why:** the taxonomy is a closed set, and a displayed Aura cost is a promise — if it doesn't map to a backend that actually charges that amount it's a phantom charge that misleads the user. Keep the two invariants: (a) no drift from the five categories, (b) nonzero displayed cost ⇒ a charging (studio/ugc) dispatch.
**How to apply:** keep the manifest module client-safe (no *.server import) — mirror server cost constants as literals and assert parity in the co-located test; that test also enforces "nonzero displayed cost ⇒ a charging (studio/ugc) dispatch". `.functions.ts` modules are client-importable (RPC-stubbed); `*.server` modules are not.
