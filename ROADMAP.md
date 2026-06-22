# Aurora Studio — Build Roadmap

Living doc of where we are vs. what's left to be a complete SaaS. Update as we ship so we don't over-build.

Last updated: 2026-06-12

---

## 🧪 Feature test matrix (current sprint)

Goal: green every row before we deploy to production. Test order is fixed — don't jump ahead until the previous row is ✅.

| # | Feature        | Endpoint / fn                                  | Auth | How to test                                                                 | Status |
|---|----------------|------------------------------------------------|------|-----------------------------------------------------------------------------|--------|
| 1 | Image gen      | `studio.functions.ts → generatePerformanceShot` | yes  | `/studio` → upload selfie → pick preset → Generate. Expect Gemini → Replicate fallback. | ⏳ |
| 2 | Video gen      | `studio.functions.ts → generateVideoFromImage`  | yes  | After a successful image, click "Bring it to life". Expect Replicate kling-v2.1.        | ⏳ |
| 3 | Lip sync       | `lipsync.functions.ts → startLipsync` + `getLipsyncJob` | yes  | `/lipsync` → upload video + audio → Sync. Poll job. Expect Sync.so primary, Replicate fallback. | ⏳ |
| 4 | Canvas         | `studio.functions.ts → generateSplitReality` + workflows | yes  | `/canvas` → drag image→video→lipsync nodes → Run. Watch LiveJobsPanel.          | ⏳ |
| 5 | UGC factory    | `ugc-generation.functions.ts → generateUGCAd`   | yes  | `/ugc` → pick template + selfie → Generate. Expect 3 shots + lipsync stitch.     | ⏳ |
| 6 | Colors studio  | `studio.functions.ts` (single-color cyclorama preset) | yes  | `/colors` → upload selfie → pick color → Generate. Expect single-color cyc shot. | ⏳ |

Secrets: all providers configured (FAL, Kling, Replicate, Gemini, OpenAI, OpenRouter, Sync, HF, **HeyGen ✅ 2026-06-12**).

Pass criteria for each row:
- HTTP 200 from the serverFn
- Output asset URL renders in UI
- Row appears in `generations` (or `lipsync_jobs`) with `status='ok'`
- `provider_logs` shows the call with non-null `latency_ms` and `cost_usd`
- No 4xx/5xx in `server-function-logs`

If a row fails: capture the `provider_logs` row + the worker log line, file under "Bugs blocking launch" below, then fix before moving on.

### Bugs blocking launch

_(empty — populate as we test)_

---

## ✅ Shipped (works end-to-end)

### Core creative engine
- [x] **Studio** — selfie + outfit + scene + prop + motion → generate (Nano Banana, Seedream, etc.)
- [x] **Canvas** — node workflow editor (image-gen, video-gen, lipsync, split-reality)
- [x] **Lipsync** — Sync v2 + Wav2Lip
- [x] **UGC ads** — TikTok POV templates
- [x] **Colors** — single-color cyclorama performance preset
- [x] **Gallery** — user generations
- [x] **Gifts** — credit gifting
- [x] **Trending workflows** — pre-built Canvas templates
- [x] **Aurora Agent** — paragraph → full shot list + image prompts
- [x] **Aurora Concierge chatbot** — in-app assistant (Gemini)

### Platform
- [x] Auth (email + Google)
- [x] Credits, Paystack billing, plans
- [x] Affiliate / referral tracking
- [x] Admin dashboard
- [x] Public API + webhook surface (`/api/public/*`)
- [x] Landing page (hero, CLI, showcases, services, workflows, testimonials)

---

## 🚧 In progress / partial

- [ ] **CLI** — `@aurora-studio/cli` npm package (landing section live; package not published yet)
- [ ] **Lovable Emails** — transactional email scaffolding (decided: built-in, not external blaster)
- [ ] **Motion clip → real video motion transfer** (currently stored as pose reference only)
- [x] **Finished workflows gallery** — recipes + copyable prompts so customers can recreate (shipped 06-03)
- [ ] **Paystack USD** — needs merchant-side enablement. Paystack does not show USD as a default currency in the dashboard; you have to request "Multi-currency / USD payouts" from Paystack support (support@paystack.com) and have it whitelisted on your business account. Until then, the init call will reject USD with `currency_not_supported`. Two options: (a) email Paystack to enable USD on your account, or (b) switch billing to NGN and convert on display.

---

## ⏭️ Next up (ranked, don't skip the order)

1. **Publish the CLI** to npm so the install command on the landing page actually works
   - `aurora login`, `aurora generate`, `aurora workflows run <id>`
   - Reads `~/.aurora/config.json`, hits existing `/api/public/generate`
2. **Onboarding flow** ✅ shipped 06-04 — first-run modal on /studio: pick vibe → drop selfie → prompt + selfie loaded into Studio
3. **Email lifecycle** (Lovable Emails)
   - Welcome + 5 free credits
   - Render-complete notification
   - Low-credit nudge
   - Weekly digest of your renders
4. **Sharing / public links** — every render gets a `aurora.studio/r/<id>` page with OG image
5. **Webhooks for users** — let pro users register a webhook for render-complete

---

## 🔮 Later (don't build until users ask)

- Team workspaces / multi-seat
- White-label / agency mode
- Mobile app (PWA covers 80% for now)
- Marketplace for user-submitted workflows
- Real-time collab in Canvas
- Stripe (Paystack covers current markets)

---

## 🛑 Explicitly out of scope (rejected)

- Standalone "email blaster" SaaS — using Lovable Emails instead
- Re-adding "Editorial collage panel" preset (replaced with Urban cuts)
- Re-adding the giant Lighting grid in Studio (cluttered the page)
- Anonymous sign-ups
- Hosting our own LLM — Lovable AI Gateway covers it

---

## Definition of "complete SaaS"

We call v1 complete when:
- ✅ Auth + billing + credits
- ✅ Core generation (image + video + lipsync)
- ✅ Canvas workflows
- 🚧 CLI published
- 🚧 Onboarding gets a new user to first render without help
- 🚧 Lifecycle emails firing
- 🚧 Public share pages

Then we ship, watch the funnel, and let real usage decide what's next.

---

## 🚀 Production launch checklist

### Phase 1 — Pre-deploy (today)
- [ ] Feature test matrix above all green
- [ ] `supabase--linter` reports 0 issues
- [ ] `npm run build` (handled by harness) succeeds
- [ ] No errors in `server-function-logs` for last hour
- [ ] All `*.asset.json` pointers return 200 (lipsync videos, josh shots, ugc avatars)

### Phase 2 — Staging smoke (30 min)
- [ ] Sign up new user → receives 5 free credits + welcome email
- [ ] Buy smallest credit pack via Paystack test card → ledger updates
- [ ] Generate image → video → lipsync chain end-to-end
- [ ] Canvas: run a 3-node workflow, verify each job appears in LiveJobsPanel
- [ ] UGC: generate a 3-shot ad, verify final stitched mp4
- [ ] Refresh + return next session → gallery still loads, assets stream
- [ ] Mobile (430px viewport): home, studio, lipsync, canvas all usable

### Phase 3 — Production cutover
- [ ] Publish the app (Lovable → Publish)
- [ ] Verify `project--{id}.lovable.app/api/public/paystack-webhook` returns 200 to a signed payload
- [ ] Point Paystack live webhook at the published URL
- [ ] Confirm `LOVABLE_API_KEY`, `REPLICATE_API_KEY`, `SYNC_API_KEY`, `PAYSTACK_SECRET_KEY` exist in prod secrets
- [ ] First real $1 purchase → credits land, receipt email sends

### Phase 4 — Post-launch (first 24h)
- [ ] Watch `provider_logs` for error spikes
- [ ] Check `gpu_workers.last_heartbeat` every 30 min
- [ ] Monitor webhook delivery (`webhooks` table)
- [ ] Triage any user-reported errors before adding new features

---

## 🐛 Known issues / open items

- Browser console: `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY` — appears in the **published** bundle (`index-mbcunwr0.js`), pre-dates the `.env` fix. **Resolves on next publish.** Preview is clean.
- `HEYGEN_API_KEY` referenced in orchestration health row but not yet added to secrets — only needed if we wire HeyGen into orchestrator. Leave unconfigured for now.
- Foreign-project asset pointers were re-uploaded on 2026-06-12; if any new 404s appear, run the same re-upload script.
