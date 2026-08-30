# Production Deployment & Launch Readiness

## Pre-Launch Checklist

### Phase 1: Code & Deployment Ready ✅
- [x] Production build passes (no errors)
- [x] All CI checks passing (lint, types, tests, migration audit)
- [x] E2E tests passing (desktop + mobile 430px)
- [x] Server-fn regression fixed (vite.config.ts — **needs republish**)
- [x] Rate limiting configured (per-route limits active)
- [x] RLS policies verified (83 tables audited, 5 gaps closed)
- [x] Error redaction complete (safe messages to client)
- [x] Health checks wired (`/api/ready` endpoint)

### Phase 2: Configuration & Secrets ⛔ Owner Action Required

**BEFORE going live, complete these in Lovable Cloud:**

1. **Supabase Project Settings**
   - [ ] Check backup tier → **Project Settings → Add-ons → Backups**
     - Free tier: no backups
     - Pro+: daily backups (confirm if adequate for launch)
     - Recommended: upgrade to Pro+ minimum, or add PITR for continuous backup

2. **Authentication Providers**
   - [x] Email/password — enabled
   - [x] GitHub OAuth — enabled
   - [x] Passkeys (WebAuthn) — enabled
   - [ ] Google OAuth — **go to Authentication → Providers → enable** (requires OAuth credentials from Google Cloud)
   - [ ] Apple OAuth — **enable if needed** (requires Apple Developer account + Services ID)
   - See `ROADMAP.md` §11 for credential setup instructions

3. **Secrets Configuration** (Lovable Cloud → Project Settings → Secrets)
   - [ ] `SEEDANCE_API_URL` — Seedance video generation endpoint
   - [ ] `SEEDANCE_API_KEY` — Seedance API key (for Soul video generation)
   - [ ] `SOUL_FAL_WEBHOOK_SECRET` — ed25519 signing key for fal training webhooks
   - [ ] All other provider keys are already configured (FAL_KEY, Kling keys, etc.)

4. **Email Configuration**
   - [x] `RESEND_API_KEY` — configured and verified (lifecycle emails working)
   - Optional: Set `AURORA_FROM_EMAIL` if using a custom sender

### Phase 3: Database Optimizations ⬜ Recommended Before Scale

1. **Daily Spend Index** (performance, not blocking)
   ```bash
   # Add this migration to improve high-volume user guardrail performance
   npm run supabase:migration add daily_spend_optimization
   # See docs/DAILY_SPEND_OPTIMIZATION.md for implementation
   ```

2. **Audio Upload Streaming** (architectural, not blocking)
   - Current: 200MB buffer in memory
   - Recommended post-launch: switch to streaming upload for 500MB+ files
   - See `ROADMAP.md` §8 item 5

### Phase 4: Monitoring & Runbooks ✅

- [x] `docs/BACKUP_AND_DR.md` — restore procedure documented
- [x] `.github/CI_GUIDE.md` — CI/CD pipeline + debugging guide
- [x] `.github/MOBILE_TESTING.md` — mobile test guidelines
- [x] Rate limiting alerts — configured per-route in code
- [x] Health check endpoint — `/api/ready` live (can wire to uptime monitor)

### Phase 5: Documentation ✅

- [x] Deployment docs — `docs/DEPLOYMENT.md`
- [x] Testing guides — `.github/CI_GUIDE.md`, `.github/MOBILE_TESTING.md`
- [x] Observability — `docs/OBSERVABILITY.md`
- [x] Architecture — `docs/ARCHITECTURE.md`
- [x] Mobile-specific — `docs/MOBILE_TESTING.md`

## Launch Day Procedure

### 1. Final Pre-Flight (1 hour before)
```bash
# Last local check
npm run production:gate

# Verify no pending migrations
npm run supabase:migration list

# Run e2e suite one final time
npm run test:e2e
```

### 2. Secrets Verification (Lovable Cloud)
- [ ] All required secrets present and non-empty
- [ ] No typos in secret names (case-sensitive)
- [ ] Backup tier confirmed

### 3. Deploy
```bash
# Option A: Lovable Cloud automatic deploy on main push
git push origin main

# Option B: Manual Replit deploy if needed
# npm run build && npm run preview
```

### 4. Post-Deploy Smoke Test (5 minutes)
```bash
# Check health endpoint
curl https://auroraperformancestudio.com/api/ready

# Verify key pages load
# - Homepage
# - Sign in (test email/GitHub/passkey)
# - Studio (test generation starts)
# - Canvas (test node creation)
# - Billing page (verify plan display)
```

### 5. Monitor First Hour
- Watch for error spikes in Sentry/logs
- Check database connection pool usage
- Verify rate limiting is triggering correctly (should be rare)
- Test a real generation end-to-end

## Post-Launch Monitoring

### Daily
- [ ] Error rate < 0.1%
- [ ] Generation success rate > 95%
- [ ] No unhandled server-fn crashes

### Weekly
- [ ] Database query performance (no unexpectedly slow queries)
- [ ] Storage usage trend
- [ ] User feedback on mobile experience

### First Month
- [ ] Run backup/restore drill (see `docs/BACKUP_AND_DR.md`)
- [ ] Gather mobile viewport feedback (test on real devices if possible)
- [ ] Performance baseline established

## Rollback Plan

If critical issue found post-launch:

1. **Immediate (< 1 min):** Disable the problematic feature via `feature-visibility.ts`
2. **Short-term (< 5 min):** Revert to previous deployment (Lovable: one-click rollback)
3. **Root cause:** Check CI logs, error traces, recent changes
4. **Redeploy:** Fix in dev, run gate, push to main

## Known Limitations & Acceptable Trade-offs

| Item | Status | Impact | Timeline |
|---|---|---|---|
| Soul video generation | ⛔ Blocked on Seedance secrets | Users see "configuration error" when trying Soul videos | Post-launch: set secrets in dashboard |
| Audio upload streaming | ⬜ Deferred | 200MB buffer limit (acceptable for MVP) | Post-launch optimization |
| Google/Apple OAuth | ⛔ Blocked on dashboard config | Only GitHub + email/password + passkeys available | Post-launch: enable in Supabase |
| iOS App Store | ⛔ Blocked on signing credentials | Web-only launch (acceptable) | Post-launch: sign + submit app |

## Questions Before Launch?

✅ All items in phases 1–4 are complete or documented.
⛔ Phase 2 (secrets/config) and phase 3 (optimizations) require owner action — see checklist above.

**If stuck on any item, refer to the linked docs files or the ROADMAP.md production-readiness summary.**
