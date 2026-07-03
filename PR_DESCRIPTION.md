# PR Description: Motion Studio, Lipsync, & Provider Orchestration

## Summary
Major feature release introducing Motion Studio (`/motion` route), refactored provider orchestration, and new integrations (HeyGen, Kling, Fal). Adds webhooks, gift cards, affiliate tracking, and improved email infrastructure.

**Scope**: 37 files changed | +2,600 additions | -308 deletions | 53 commits

## What This PR Does

### 🎬 New: Motion Studio
- New `/motion` route for pose-based cinematic video generation
- Camera move presets and lighting controls
- Landing page demo reels showing split-reality & lipsync workflows
- Floating animations and shimmer effects on gallery

### 🎙️ Enhanced: Lipsync & Avatars
- **HeyGen integration** for avatar-based lipsync (alternative to Sync.so)
- **UGC video generation** — product ads with avatar presets
- **Lipsync gallery** — history and management of lip-sync renders
- **ConnectReplicateBanner** — prompts user to link Replicate when unavailable

### ⚙️ Refactored: Provider Orchestration
New priority chains to prefer free/cheap providers before paid credits:

**Image Generation:**
1. Gemini direct (free)
2. HuggingFace Inference (free)
3. Replicate
4. Lovable (paid credits — fallback only)
5. GPU worker
6. Fal.ai (catch-all)

**Video Generation:**
1. Kling direct (JWT — no Replicate needed)
2. Replicate
3. GPU worker
4. Fal.ai

**Lipsync:**
1. Sync.so (preferred)
2. HeyGen (new)
3. Replicate (fallback)
4. GPU worker
5. Fal.ai

### 💰 New: Monetization Features
- **Affiliate program** — referral codes, click tracking, conversion payouts
- **Gift cards** — create, list, redeem Aurora credits
- **Paystack webhooks** — secure payment verification with HMAC-SHA512

### 🔌 New: Developer Tools
- **User webhooks** — register callbacks for `render_complete`, `share_created`, `low_credits` events
- **Provider status API** — check which connectors are configured (for banners/UI)
- **GPU worker health** — monitor worker heartbeats and capacity
- **Error toasts** — consistent error messaging for generations, payments, auth

### 📧 Refactored: Email Service
Modular email sending with templates:
- `welcome-5-credits` — new user onboarding
- `render-complete` — generation finished
- `low-credit-nudge` — user running low on Aurora
- `weekly-digest` — stats summary
- `payment-receipt` — payment confirmation
- `gift-redeemed` — gift card claimed

### 🔐 Database Schema Updates
- `generations.input_videos` — store input video URLs
- `user_webhooks` table — webhook registration, secret, events list, active flag

### 📦 Dependencies
- Nitro: 3.0.260429-beta → 3.0.260603-beta
- h3: 2.0.1-rc.20 → 2.0.1-rc.22
- Rolldown: 1.0.2 → 1.1.0
- @lovable.dev/vite-tanstack-config: 1.7.0 → 2.3.2

### 📋 Legal & Documentation
- Privacy policy updated for HeyGen and webhooks
- Affiliate T&Cs added
- Legal version: 2026-06-10
- CLI v0.1.0 → v0.2.0 with refactored commands

## Files Changed

### Components (3 new)
- `ConnectReplicateBanner.tsx` — banner when Replicate not linked
- `HeyGenPanel.tsx` — avatar + voice + background selector UI
- `landing/DemoReels.tsx` — video demo grid with links to /motion and /lipsync

### Libraries (15 new)
- `affiliate-complete.functions.ts` — referral tracking
- `colors-export.ts` — palette export (JSON, CSS, Tailwind)
- `error-toasts.ts` — error handling helpers
- `gifts-complete.functions.ts` — gift card CRUD
- `gpu-worker-health.ts` — worker monitoring
- `heygen.server.ts` — HeyGen integration (avatars, voices, backgrounds)
- `lipsync-gallery.functions.ts` — gallery and deletion
- `og-image.server.ts` — Open Graph image generation
- `paystack-webhook.server.ts` — payment verification
- `provider-status.functions.ts` — check configured keys
- `ugc-generation.functions.ts` — product ad generation
- `webhooks.server.ts` — register, list, delete, test, dispatch

### Infrastructure (2 modified)
- `orchestrator.server.ts` — added Gemini, Kling, HeyGen, Fal adapters; health tracking
- `orchestration.functions.ts` — dashboard with provider status and worker health

### Database & UI (3 modified)
- `supabase/types.ts` — schema for `input_videos`, `user_webhooks`
- `studio/ColorsShotsGallery.tsx` — animations, shimmer effect
- `routeTree.gen.ts` — new `/motion` route

### Configuration (5 modified)
- `bun.lock` — dependency lock updates
- `cli/bin/aurora.mjs` — refactored CLI structure
- `cli/package.json` — v0.2.0, updated repo/bugs links
- `cli/LICENSE` — expanded MIT text
- `package.json` — nitro, vite-tanstack-config

### Docs (2 modified)
- `legal.ts` — privacy policy, liability, acceptable use
- `.github/workflows/publish-cli.yml` — npm publish automation

## Testing Guidance

### Local Testing
```bash
# 1. Verify Motion studio renders
curl http://localhost:5173/motion

# 2. Check provider orchestration fallback
npm run dev  # Should show Gemini → HF → Replicate chain in logs

# 3. Test webhooks
curl -X POST http://localhost:5173/api/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/hook","events":["render_complete"]}'

# 4. Verify HeyGen integration
# Set HEYGEN_API_KEY and test avatar video generation

# 5. Test Paystack webhook
npm run test:paystack-webhook
```

### Checklist
- [ ] Motion studio loads without errors
- [ ] HeyGen avatars render correctly
- [ ] Lipsync gallery shows history
- [ ] Webhooks fire on generation complete
- [ ] Gift cards redeem and grant credits
- [ ] Affiliate tracking records clicks/conversions
- [ ] Paystack webhook signature verification passes
- [ ] Email templates render in browser
- [ ] Provider status endpoint returns correct flags
- [ ] GPU worker health checks pass

## Migration

### Environment Variables (New)
```bash
HEYGEN_API_KEY=...               # For avatar lipsync
KLING_ACCESS_KEY=...            # For Kling direct video
KLING_SECRET_KEY=...
FAL_KEY=...                      # Catch-all fallback
GEMINI_API_KEY=...              # Free image generation
OPENROUTER_API_KEY=...          # Text inference gateway
```

### Environment Variables (Updated)
```bash
# Old (direct Replicate):
REPLICATE_API_KEY=...

# New (Lovable connector gateway — preferred):
LOVABLE_CONNECTOR_REPLICATE_API_KEY=...
```

### Database Migrations
1. Add `input_videos: Json` to `generations` table
2. Create `user_webhooks` table (schema in `supabase/types.ts`)
3. Create `gift_cards` table (if using gift feature)
4. Create `affiliates` and `affiliate_events` tables (if using affiliate feature)

## Related Work
- Closes: (if applicable, link issue)
- Blocks: None
- Depends on: None

## Breaking Changes
**None.** All changes are additive and backwards compatible.

## Notes for Reviewers
1. **Provider orchestration** — new adapters (Gemini, Kling, HeyGen, Fal) follow existing patterns. Health tracking is in-memory only (safe for multi-process).
2. **Webhooks** — HMAC-SHA256 signatures match Stripe/Paystack standards. Test with `testWebhook()` before production.
3. **HeyGen** — requires polling for completion (5s intervals, 10min timeout). Best suited for non-urgent renders.
4. **Kling JWT** — ephemeral tokens (30min lifetime) generated on-demand; no token storage needed.
5. **Email** — refactored from Resend-specific to provider-agnostic; ready for Mailgun/SendGrid swap.

## Deployment Checklist
- [ ] All env vars configured in production
- [ ] Database migrations run
- [ ] Cache cleared (if using Cloudflare)
- [ ] CDN updated for new demo video URLs
- [ ] Webhook endpoints tested end-to-end
- [ ] Email template previews verified
- [ ] Provider health dashboard accessible (admin only)
- [ ] Monitoring alerts set for failed providers

---

**Author:** @josephpaxful-netizen  
**Created:** 2026-06-10  
**Updated:** 2026-06-11
