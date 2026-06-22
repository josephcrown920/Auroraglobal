# Changelog: Motion Studio & Provider Orchestration v1.0

## Release Date
2026-06-11

## Version
v1.0.0 (Feature Release)

---

## ✨ New Features

### Motion Studio (`/motion`)
- Pose-based cinematic video generation from reference images
- Camera movement presets (orbit, dolly, pan)
- Lighting and scene controls
- **Component:** `src/components/landing/DemoReels.tsx`
- **Route:** `/motion`

### HeyGen Avatar Integration
- Avatar-based video generation (alternative to Replicate)
- 4 pre-configured avatars (Josh, Emily, Michael, Jessica)
- 4 voice options (US/British male/female)
- 5 background presets (office, beach, conference, studio, virtual)
- Script-to-video rendering
- **Component:** `src/components/HeyGenPanel.tsx`
- **Library:** `src/lib/heygen.server.ts`
- **Env:** `HEYGEN_API_KEY`

### Kling Direct Video Generation
- JWT-signed video generation (bypasses Replicate when available)
- Text-to-video and image-to-video support
- **Adapter:** `orchestrator.server.ts` → `klingDirect`
- **Env:** `KLING_ACCESS_KEY`, `KLING_SECRET_KEY`
- **Cost:** ~$0.30/video (vs Replicate's higher cost)

### Gemini Direct Image Generation
- Free tier Google Gemini integration (no credits consumed)
- Preferred before Lovable credits in orchestration chain
- **Adapter:** `orchestrator.server.ts` → `geminiDirect`
- **Env:** `GEMINI_API_KEY`
- **Cost:** Free (rate-limited)

### Fal.ai Fallback Provider
- Catch-all fallback for all generation types
- Ensures generation always succeeds (if keys configured)
- **Adapter:** `orchestrator.server.ts` → `falFallback`
- **Env:** `FAL_KEY`
- **Cost:** $0.005 (image) - $0.40 (video)

### Provider Orchestration Refactor
- New priority chains: free/cheap first → paid last
- Health tracking (in-memory, per-process)
- Cooldown on provider failures (exponential backoff)
- **Routes:** `/api/providers/status`, `/api/orchestration/health`
- **Dashboard:** Admin provider health view

### User Webhooks
- Register callbacks for generation events
- Supported events: `render_complete`, `share_created`, `low_credits`
- HMAC-SHA256 signature verification (Stripe-compatible)
- Test webhook endpoint
- **Library:** `src/lib/webhooks.server.ts`
- **Table:** `user_webhooks`

### Affiliate Program
- Referral code generation
- Click tracking
- Conversion recording (on payment)
- Payout calculation (20% commission default)
- **Library:** `src/lib/affiliate-complete.functions.ts`
- **Tables:** `affiliates`, `affiliate_events`

### Gift Cards
- Issue gift cards with custom credit amounts
- Redeem via code
- Track redemption history
- **Library:** `src/lib/gifts-complete.functions.ts`
- **Table:** `gift_cards`

### Paystack Webhook Integration
- Secure payment verification (HMAC-SHA512)
- Automatic credit grant on successful payment
- Affiliate conversion tracking on payment
- **Library:** `src/lib/paystack-webhook.server.ts`
- **Endpoint:** `/api/webhooks/paystack`

### Email Service Refactor
- Modular, provider-agnostic email system
- 6 transactional templates:
  - `welcome-5-credits` — new user onboarding
  - `render-complete` — generation finished
  - `low-credit-nudge` — credit warning
  - `weekly-digest` — stats summary
  - `payment-receipt` — payment confirmation
  - `gift-redeemed` — gift claimed
- **Library:** `src/lib/emails.server.ts`
- Ready for Resend, Mailgun, SendGrid swap

### Connect Replicate Banner
- Appears when Replicate is not configured
- Shows active provider alternatives
- Links to integration docs
- Dismissible
- **Component:** `src/components/ConnectReplicateBanner.tsx`

### Lipsync Gallery
- Browse past lipsync generations
- View status, prompt, model used
- Delete individual renders
- **Library:** `src/lib/lipsync-gallery.functions.ts`
- **Route:** `/lipsync`

### UGC Video Generation
- Product ad generation with avatars
- Avatar preset + product prompt → TTS → lipsync → composite
- **Library:** `src/lib/ugc-generation.functions.ts`

### Demo Reels
- Landing page video showcasing Motion and Lipsync
- Floating animations, shimmer effects
- Links to respective studios
- **Component:** `src/components/landing/DemoReels.tsx`

### Provider Status API
- Public endpoint checking configured providers
- Returns boolean flags only (no secrets)
- Used by banners and UI
- **Endpoint:** `/api/providers/status`

### GPU Worker Health Monitoring
- Track worker heartbeats
- Monitor failure rates and capacity
- Automatic status updates (online/offline/degraded)
- **Library:** `src/lib/gpu-worker-health.ts`

### Error Toast Helpers
- Consistent error messaging for:
  - Generation failures (credits, rate limit, provider down, timeout)
  - Payment failures (declined, expired, 3D Secure)
  - Auth errors (invalid credentials, user not found, email unconfirmed)
  - Webhook failures (signature invalid, not found, etc.)
- **Library:** `src/lib/error-toasts.ts`

### OG Image Generation
- Dynamic Open Graph images for social sharing
- Used for render shares and profile pages
- **Library:** `src/lib/og-image.server.ts`

### Color Export
- Export color palettes as JSON, CSS, or Tailwind config
- Download to local file
- **Library:** `src/lib/colors-export.ts`

### CLI Improvements
- Refactored Aurora CLI structure
- Simplified command set
- Help text improvements
- Version bump: 0.1.0 → 0.2.0
- **File:** `cli/bin/aurora.mjs`

---

## 🔄 Changes

### Orchestration Priority Chains (New)

**Image Generation:**
1. Gemini direct (free) — `GEMINI_API_KEY`
2. HuggingFace Inference (free) — `HF_TOKEN`
3. Replicate (paid) — `REPLICATE_API_KEY`
4. Lovable (paid credits, fallback) — `LOVABLE_API_KEY`
5. GPU worker
6. Fal.ai (catch-all)

**Video Generation:**
1. Kling direct (JWT, cheaper) — `KLING_ACCESS_KEY` + `KLING_SECRET_KEY`
2. Replicate — `REPLICATE_API_KEY`
3. GPU worker
4. Fal.ai

**Lipsync:**
1. Sync.so (preferred) — `SYNC_API_KEY`
2. HeyGen (new) — `HEYGEN_API_KEY`
3. Replicate (fallback) — `REPLICATE_API_KEY`
4. GPU worker
5. Fal.ai

### Email System
- Replaced Resend-specific logic with modular helpers
- All templates in single namespace
- Provider-agnostic (can swap Resend ↔ Mailgun ↔ SendGrid)
- Logging to `email_log` table

### Database Schema
- `generations.input_videos: Json` — store input video URLs
- New `user_webhooks` table — webhook registration & delivery logs
- Schema version: Updated

### Dependencies
| Package | Old | New | Reason |
|---------|-----|-----|--------|
| nitro | 3.0.260429-beta | 3.0.260603-beta | H3 + env-runner fixes |
| h3 | 2.0.1-rc.20 | 2.0.1-rc.22 | Routing improvements |
| @lovable.dev/vite-tanstack-config | 1.7.0 | 2.3.2 | Lightningcss, new Nitro support |
| rolldown | 1.0.2 → 1.1.0 | Binding updates, OXC types upgrade |
| @oxc-project/types | 0.132.0 | 0.134.0 | ESM improvements |
| srvx | 0.11.15 | 0.11.16 | Bug fixes |

---

## 🛠️ Infrastructure

### New Files (17)
```
.github/workflows/publish-cli.yml          # npm publish automation
cli/.npmignore
cli/LICENSE                                # Expanded MIT text
src/components/ConnectReplicateBanner.tsx
src/components/HeyGenPanel.tsx
src/components/landing/DemoReels.tsx
src/lib/affiliate-complete.functions.ts
src/lib/colors-export.ts
src/lib/error-toasts.ts
src/lib/gifts-complete.functions.ts
src/lib/gpu-worker-health.ts
src/lib/heygen.server.ts
src/lib/lipsync-gallery.functions.ts
src/lib/og-image.server.ts
src/lib/paystack-webhook.server.ts
src/lib/provider-status.functions.ts
src/lib/ugc-generation.functions.ts
src/lib/webhooks.server.ts
```

### Modified Files (10)
```
bun.lock                                   # Dependency updates
cli/bin/aurora.mjs                         # CLI refactor
cli/package.json                           # v0.2.0
package.json                               # nitro, vite-tanstack
src/integrations/supabase/types.ts         # Schema additions
src/lib/emails.server.ts                   # Modular refactor
src/lib/legal.ts                           # Privacy policy
src/lib/orchestration.functions.ts         # Health tracking
src/lib/orchestrator.server.ts             # New adapters
src/components/studio/ColorsShotsGallery.tsx  # Animations
src/routeTree.gen.ts                       # /motion route
```

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Files Changed | 37 |
| Additions | +2,600 |
| Deletions | -308 |
| Commits | 53 |
| New Routes | 1 (/motion) |
| New Components | 3 |
| New Libraries | 15 |
| New Adapters | 4 (Gemini, Kling, HeyGen, Fal) |
| Database Tables | +1 (user_webhooks) |
| Email Templates | +6 |

---

## 🔒 Security

- **Webhook signatures:** HMAC-SHA256 (Stripe-compatible)
- **Paystack verification:** HMAC-SHA512 (timing-safe comparison)
- **Secrets:** Never logged, only env vars checked (boolean)
- **Provider keys:** Lovable connector gateway supports Replicate encryption

---

## 🚀 Deployment

### Pre-Deployment
1. [ ] All env vars configured in production
2. [ ] Database migrations run (`user_webhooks` table, schema updates)
3. [ ] Cache cleared (if using Cloudflare)
4. [ ] CDN updated for demo video URLs
5. [ ] Email templates tested in production

### Post-Deployment
1. [ ] Monitor provider health dashboard
2. [ ] Verify webhooks fire correctly
3. [ ] Test affiliate conversions
4. [ ] Validate payment flow (Paystack)
5. [ ] Check GPU worker heartbeats

---

## 📚 Documentation

- **PR_DESCRIPTION.md** — Full technical overview
- **FEATURE_SUMMARY.md** — Feature highlights
- **TESTING_GUIDE.md** — Comprehensive test scenarios
- **CHANGELOG.md** — This file

---

## 🐛 Known Issues

None at release.

---

## 🔮 Future Work

- [ ] Fal.ai orchestration dashboard
- [ ] Advanced affiliate analytics
- [ ] Gift card design templates
- [ ] Webhook retry logic with exponential backoff
- [ ] Email template builder UI
- [ ] Provider cost optimization dashboard
- [ ] Multi-language email templates

---

## 🙏 Contributors

- @josephpaxful-netizen (Author)
- Aurora Studio Team (Review & Testing)

---

## 📞 Support

For issues or questions:
1. Check PR_DESCRIPTION.md
2. Review TESTING_GUIDE.md
3. Consult provider documentation:
   - [HeyGen API Docs](https://docs.heygen.ai)
   - [Kling API Docs](https://developers.klingai.com)
   - [Fal.ai Docs](https://fal.ai/docs)
4. Contact team lead

---

**Release Approved:** ___________  
**Date:** 2026-06-11
