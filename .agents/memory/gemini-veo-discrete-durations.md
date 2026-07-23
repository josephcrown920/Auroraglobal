---
name: Gemini Veo Discrete Durations
description: veo-3.1-fast-generate-preview only accepts specific durationSeconds values; 5 is rejected with 400 INVALID_ARGUMENT even though the error says "between 4 and 8 inclusive".
---

## Rule
`veo-3.1-fast-generate-preview` (used in the `geminiVideo` adapter) accepts **only discrete durations** as `durationSeconds`. Verified accepted: 4 and 8. Value 5 (and likely 6, 7) returns a 400 INVALID_ARGUMENT error: "The number value for `durationSeconds` is out of bound. Please provide a value between 4 and 8, inclusive." — the error message is misleading (implies continuous range).

## Why
Determined empirically by sending the Veo `predictLongRunning` API three requests: duration=4 → 429 quota (accepted by API, fails for billing), duration=5 → 400 INVALID_ARGUMENT (rejected), duration=8 → 429 quota (accepted).

## How to Apply
The `geminiVideo` adapter in `src/lib/orchestrator.server.ts` snaps duration as:
```typescript
durationSeconds: (r.duration ?? 8) <= 5 ? 4 : 8,
```
- Studio chain preview pass sends `duration: 5` → snaps to 4 ✅
- Normal renders with duration > 5 → snaps to 8 ✅

Never pass 5, 6, or 7 as `durationSeconds` to this model endpoint.

## Provider Quota Note (July 2026)
GEMINI_API_KEY has no Veo quota on free tier → both duration=4 and duration=8 return 429.
The fix is correct but step-14 smoke still fails until Gemini Veo quota is funded OR another video provider (fal, Replicate, BytePlus) has credit.
