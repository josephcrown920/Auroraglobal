# Onboarding & Conversion Strategy

Working doc for the "every photo should be an onboarding, every fix should
be a way to hold customers" initiative. Captures the target journey, where
users were dropping off, and why each change was made — so future changes
stay consistent with the reasoning instead of re-litigating it.

## Target journey

1. **Land** on the marketing page → click a CTA into `/studio`.
2. **See value immediately** — the onboarding modal shows 3 real vibe
   preview images (not placeholders) so the first thing a new user sees is
   an actual example of what they'll get, not an empty form.
3. **Commit a first action** — pick a vibe, upload a selfie.
4. **Get rewarded for finishing setup** — a one-time bonus (+3 Aura) is
   granted server-side the moment they load their pick into the studio,
   with a toast confirming it and an immediate profile-balance refresh.
5. **Run a first real generation** — the bonus credits make this free-feeling
   even for a brand-new account with a very small starting balance.
6. **Come back if they stall** — if someone starts onboarding but never
   finishes (no bonus claimed) within a 2h–14d window, a single recovery
   email nudges them back, deduped so it only ever sends once.
7. **Buy when they run low** — an in-app low-credit banner surfaces the
   purchase path before the user hits a hard "0 credits" wall mid-session.

## Where users were dropping off (identified this session)

- **Empty-state onboarding**: the modal previously showed generic
  placeholders instead of real output, so new users had no concrete sense
  of what "a vibe" would actually produce before committing a selfie.
- **No reward for finishing setup**: completing onboarding felt identical
  to just closing the modal — no incentive to push through selfie upload.
- **Silent abandonment**: users who opened onboarding but bounced before
  finishing had no re-engagement path at all.
- **No low-credit warning surface**: users found out they were out of
  credits only when a generation failed, not before, at the worst possible
  moment (mid-flow, after intent had already peaked).
- **Pricing surprises in Spin templates**: the template picker showed "free
  live preview" with no indication that rendering all 30 real pieces costs
  Aura, so users could feel misled once they hit Spin Studio itself
  (reported live via screenshot, fixed the same session — see below).

## Changes made and why

| Change | Why |
|---|---|
| Real vibe preview images in `OnboardingModal` step 1 | Replace placeholders with the actual output so the value prop is concrete before any upload happens. |
| Server-verified one-time onboarding bonus (`claim_onboarding_bonus` RPC, compare-and-swap on `profiles.onboarding_bonus_granted`) | Gives a concrete reason to finish setup instead of abandoning after picking a vibe; the CAS guard makes it un-exploitable via retries. |
| `LowCreditBanner` in the studio shell | Surfaces the purchase path *before* a generation fails, not after. |
| Funnel event tracking (`onboarding_shown`, `onboarding_vibe_selected`, `onboarding_selfie_uploaded`, `onboarding_completed`, `onboarding_skipped`, `first_generation_completed`, `first_purchase_completed`) | Makes every step and every full-funnel milestone (first render, first paid conversion) queryable in the `events` table, so future drop-off analysis doesn't have to guess. |
| `onboarding_resume` recovery email, sent 2h–14d after an unclaimed bonus, deduped via `email_log` | Recovers users who started but never finished onboarding — previously a fully silent drop-off with zero touch. |
| Spin template drawer now shows the real render cost (`templateCost()`) alongside the free preview | Removes a pricing surprise reported by users mid-session; keeps the preview and the real Spin Studio charge from ever drifting apart, since both read the same helper. |

## Funnel events reference

All events are inserted client-side into the `events` table via
`src/lib/tracking.ts`'s `track()` (fire-and-forget, never blocks the UI on
failure). Each is intended to be queryable per-user to reconstruct the
funnel:

- `onboarding_shown` — modal opened for a new user.
- `onboarding_vibe_selected` — step 1 choice made.
- `onboarding_selfie_uploaded` — step 2 upload succeeded.
- `onboarding_completed` — "Load into Studio" clicked, bonus claim attempted.
- `onboarding_skipped` — user dismissed the modal before finishing (records
  the step they were on).
- `first_generation_completed` — fired exactly once per browser, the first
  time any generation (image/video/lip-sync) succeeds anywhere in the app.
  Gated via a `localStorage` flag in `src/lib/first-run.ts` so repeat
  generations don't re-fire it.
- `first_purchase_completed` — fired exactly once per browser, on return
  from a successful Paystack checkout (credit pack via `/studio?paid=1` or
  Pro subscription via `/billing?subscribed=1`). Same one-time dedup
  pattern as `first_generation_completed`.

## Known gaps / not done this session

- The onboarding flow was not fully verified with a live browser
  end-to-end test (interrupted mid-session by unrelated bug reports); the
  bonus RPC's correctness was instead verified via direct migration/SQL
  review (compare-and-swap + `service_role`-only grant).
- Funnel events are client-side only (no server-side backstop if a user
  has JS/tracking blocked) — acceptable for now since credit-granting logic
  itself is fully server-verified and doesn't depend on these events firing.
