# Aurora Studio — Live QA Report (Phase 1 Functional)

**Date:** 2026-06-28
**Scope:** Full functional QA pass of every Aurora Studio feature (image, video, lip-sync, motion, UGC, batch/spin, AI router/orchestrate, agent, canvas, gallery, billing, affiliate/gifts, admin), executing real generations wherever providers/workers are live.
**Out of scope:** Fixing bugs, writing automated tests, Phase 2–3 (perf/SEO/store).

---

## 0. Overall verdict

**The live "real generations" pass is BLOCKED end-to-end by missing backend configuration in this environment.**

This isolated environment has **no Supabase connection** and **no AI provider / payment keys**. Without Supabase the app cannot authenticate a single user (the auth hook calls `supabase.auth` on mount and throws), and without provider keys no generation can run even if auth worked. As a result, every authenticated and generation-dependent area is **BLOCKED** — not failing, but impossible to exercise here. The one area that is genuinely live-testable — the public marketing surface and SSR/routing — **PASSES**.

To convert the BLOCKED areas into a real PASS/FAIL pass, the environment needs the secrets listed in §1. Until then, gated areas below are assessed at the **code level** (static trace) and explicitly labeled as such.

---

## 1. Prerequisites & environment inventory

Inventory captured via `viewEnvVars()`, the Replit DB, and `src/lib/provider-status.functions.ts`.

### 1.1 Provider / payment keys — **ALL MISSING**

| Capability | Required key(s) | Configured? |
|---|---|---|
| Image (Gemini) | `GEMINI_API_KEY` | ❌ |
| Image/Video fallback (Lovable) | `LOVABLE_API_KEY` | ❌ |
| Replicate | `LOVABLE_CONNECTOR_REPLICATE_API_KEY` / `REPLICATE_API_KEY` | ❌ |
| HuggingFace | `HF_TOKEN` | ❌ |
| Fal | `FAL_KEY` | ❌ |
| Video (Kling) | `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` | ❌ |
| Lip-sync (Sync) | `SYNC_API_KEY` | ❌ |
| Lip-sync (HeyGen) | `HEYGEN_API_KEY` | ❌ |
| Text/Router | `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | ❌ |
| Payments | `PAYSTACK_SECRET_KEY` | ❌ |

`providerStatus` returns `false` for all nine provider flags.

### 1.2 Supabase (data, auth, storage) — **NOT CONFIGURED**

- Client (`src/integrations/supabase/client.ts`) requires `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (build-time) or `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (SSR) — **none present**. The client throws `Missing Supabase environment variable(s)` on first access.
- Server (`client.server.ts`, `auth-middleware.ts`) require `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — **none present**. Every server function that touches Supabase will fail.
- No `.env` / `.env.local` file exists (only `.env.example`).

### 1.3 Datastore

- The built-in **Replit PostgreSQL DB is empty** (0 public tables) — the app does **not** use it; all app data lives in Supabase, which is unreachable here.

### 1.4 GPU workers

- `gpu_workers` lives in Supabase and **cannot be queried** (no connection). Live worker availability is **UNKNOWN / BLOCKED**.

### 1.5 Artifact registration

- `listArtifacts()` returns **[]** — the web app is **not registered as an artifact**, so it is **not visible in the Replit preview pane** and screenshot tooling cannot target it. The app *is* reachable directly on `localhost:8080`.

---

## 2. Methodology

- Workflow `Start application` confirmed RUNNING (vite dev on `:8080`).
- Route reachability + SSR verified via `curl localhost:8080` (the `$REPLIT_DEV_DOMAIN` proxy returns 0 bytes here, per environment constraints).
- Unit test workflow executed.
- Authenticated/generation areas could not be exercised at runtime (see §0/§1) and were instead audited at the **code level** via a structured source trace.

---

## 3. Results by area

| # | Area | Verdict | Evidence |
|---|---|---|---|
| A | Public marketing / landing | **PASS** | `GET /` → HTTP 200, 585 KB SSR HTML. Sections present in rendered markup: TikTok, lip-sync, Aura, pricing/plan, FAQ, "Direct your", privacy/footer. Favicon resolves (`aurora-logo.png`). 19 `<video>`, 57 `<img>` tags rendered. Single `/auth` CTA wired. |
| B | Routing / SSR (all routes) | **PASS** | All 13 routes return HTTP 200 with full SSR HTML: `/ /auth /studio /spin /gallery /motion /lipsync /orchestrate /admin /dashboard /ugc /agent /canvas`. |
| C | Unit test suite | **PASS** | `bun test src/` → **79 pass / 0 fail**, 193 assertions, 8 files. |
| D | Auth (sign-up / sign-in / session / route guards) | **BLOCKED** | Supabase not configured. `use-auth.tsx` calls `supabase.auth.getSession()` + `onAuthStateChange` on mount → throws `Missing Supabase environment variable(s)`. No login possible; no authed route reachable. |
| E | Image generation (Studio) | **BLOCKED** (code: PASS) | No Supabase + no provider keys. Code trace: `studio.functions.ts > generatePerformanceShot` reserves via atomic `deduct_credits` RPC, skips deduction for admin (`admin_free_generation`), refunds via `grant_credits` on failure (`try/catch`). Logic correct; not runnable. |
| F | Video generation | **BLOCKED** (code: PASS) | `generateVideoFromImage` deducts `COST_VIDEO` (5) before `orchestrate`, refunds on failure. No Kling/Replicate/Fal keys → cannot run. |
| G | Lip-sync | **BLOCKED** (code: FAIL — see Bug #1) | Two paths: `studio.functions.ts > lipSyncVideo` charges `COST_LIPSYNC` (3) + refunds; `lipsync.server.ts > runLipsyncJob` (job-engine path) charges **no credits**. No Sync/HeyGen keys → cannot run live. |
| H | Motion | **BLOCKED** | Authenticated + provider-dependent. Not reachable without Supabase/keys. |
| I | UGC factory | **BLOCKED** (code: PASS) | `ugc-generation.functions.ts` uses `create_generation_and_reserve` (locked-credit hold) → `commit_reservation` on success / `release_reservation` on failure. Most robust credit pattern in the app. Not runnable. |
| J | Batch / Spin (1→30) | **BLOCKED** (code: FAIL — see Bug #2) | `tickSpinJob` is correctly user-scoped (`.eq("user_id", userId)` — RLS OK) and marks parent `done` when drained. But **no credit deduction** exists in the spin path (`spin.functions.ts` has zero credit refs). Not runnable live. |
| K | AI Router / Orchestrate (text/tts/image/video) | **BLOCKED** (code: PASS) | `orchestration.functions.ts > orchestrateGenerate` uses `reserveOrchestrateRecord`; `orchestrator.server.ts` iterates adapters with `isHealthy`/`supports`, cools down failed providers, falls through. No keys → all modalities fail at runtime. |
| L | Agent | **BLOCKED** | Authenticated + model-key dependent. Not reachable. |
| M | Canvas | **BLOCKED** | Authenticated + provider dependent. Not reachable. |
| N | Gallery | **BLOCKED** | Reads user generations from Supabase. Not reachable. |
| O | Billing (Paystack) | **BLOCKED** (code: PASS w/ Bug #3) | `paystack-webhook.server.ts` verifies HMAC-SHA512, grants via `grant_credits`, idempotent on `payment.status==="succeeded"`. No `PAYSTACK_SECRET_KEY` → no checkout/webhook testable. |
| P | Affiliate / Gifts | **BLOCKED** (code: PASS) | `affiliate-complete.functions.ts` computes commission on payment success; `gifts-complete.functions.ts > redeemGiftCard` guards double-redeem (`if (card.redeemed_at) throw`). Not runnable (Supabase/Paystack down). |
| Q | Admin (`/admin`, `/admin.orchestration`, `/admin.smoke`) | **BLOCKED** (code: PASS) | `AdminGate` + `hasAdminToken` UI gate, plus server-side `isAdmin` check against `user_roles`. Cannot verify live without Supabase. |

**No area is silently skipped or falsely marked PASS.** Every gated area is BLOCKED with a reason; where a static trace adds signal, the code-level assessment is noted in parentheses.

---

## 4. Prioritized bug list

| Pri | Bug | Location | Impact |
|---|---|---|---|
| **P0** | **Spin batch charges no credits** — the 1→30 spin path deducts nothing; users get up to 30 renders for free. | `src/lib/spin.functions.ts` (`spinThirty` / `tickSpinJob`) | Revenue loss / unmetered compute. |
| **P0** | **Lip-sync job engine charges no credits** — `runLipsyncJob` tracks status but never deducts, unlike `lipSyncVideo`. Free lip-sync via the job path. | `src/lib/lipsync.server.ts` | Revenue loss / unmetered compute. |
| **P1** | **Paystack webhook race** — if the webhook arrives before the `payments` row exists, it throws a hard error instead of retry/poll, potentially dropping a paid credit grant. | `src/lib/paystack-webhook.server.ts` (~L65) | Customer paid but not credited. |
| **P2** | **Web app not registered as an artifact** — `listArtifacts()` is empty, so the app is invisible in the preview pane and untargetable by screenshot tooling. | artifact config | UX/visibility; blocks visual QA. |
| **P3** | **Admin token stored in `sessionStorage`** — XSS-exposed; mitigated by server-side `user_roles` re-check on sensitive functions. | `AdminGate` | Defense-in-depth gap (low, mitigated). |

---

## 5. What is needed to unblock a true live pass

1. **Supabase** (foundational — unblocks D, H, L, M, N + enables everything else): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. **A seeded test account** with credits, and an **admin account** (row in `user_roles`).
3. **At least one provider key per modality** (e.g. `GEMINI_API_KEY` for image, `KLING_*` for video, `SYNC_API_KEY` for lip-sync, `OPENROUTER_API_KEY` for text), or **a live GPU worker** registered in `gpu_workers`.
4. **`PAYSTACK_SECRET_KEY`** (test mode) for billing/affiliate/gift flows.

With (1)–(4) in place, re-running this checklist would yield real PASS/FAIL verdicts for areas D–Q.
