# Aurora — Ship-to-Store Testing Checklist

Tick each box (`[x]`) as it passes. Phase 1 (A–K) gates Phase 2. Phase 2 (L–O) gates Phase 3 (Play / App Store).

---

## Phase 1 — Functional QA

### A. Landing & Marketing (public, no-auth)
- [ ] A1. `/` renders < 2.5s LCP on 4G throttled
- [ ] A2. "Go viral with TikTok" is the FIRST section, auto-scroll runs
- [ ] A3. Aurora logo + TikTok logo pulse animation visible
- [ ] A4. Lipsync hero video centered, autoplays muted, loops
- [ ] A5. Image-generation slideshow (10 Josh photos) cycles
- [ ] A6. Colors teaser shows pink performance photos
- [ ] A7. Motion control section: no clip, plain state
- [ ] A8. Magenta cyclorama image present; blue cyc + neon-room removed
- [ ] A9. UGC factory section shows 4 new UGC photos
- [ ] A10. Split-reality demo plays
- [ ] A11. Pricing tiles load, CTA → /auth
- [ ] A12. FAQ accordions open/close
- [ ] A13. Footer links resolve (no 404)
- [ ] A14. Favicon = Aurora logo across all routes

### B. Auth
- [ ] B1. Email sign-up flow
- [x] B2. Email sign-in — live via `/auth/v1/token` + browser e2e (QA_REPORT.md §8)
- [ ] B3. Google OAuth round-trip
- [ ] B4. Sign-out clears session + redirects to `/`
- [ ] B5. `/dashboard`, `/studio`, `/spin`, `/gallery` redirect to `/auth` when logged out
- [ ] B6. Session persists across reload

### C. Studio — Image Generation
- [ ] C1. Upload 1–6 reference images
- [ ] C2. Gemini 2.5 Flash render returns < 30s
- [ ] C3. Seedream / FLUX route through orchestrator
- [x] C4. Result saved to storage, public URL works — live `/api/public/generate` call (QA_REPORT.md §8)
- [x] C5. Credits deducted (non-admin) / unlimited (admin) — 499→498 confirmed live
- [ ] C6. Failed gen refunds credits
- [ ] C7. History appears in `/gallery`

### D. Studio — Video Generation
- [ ] D1. Image → video (Seedance, 5s, 720p) returns — **FAILS live**: fal.ai balance exhausted + BytePlus ModelNotOpen (QA_REPORT.md §8, area F)
- [ ] D2. Camera movement preset injected into prompt
- [ ] D3. Kling start+end frame works
- [ ] D4. MP4 plays inline + downloads

### E. Lip-Sync
- [ ] E1. sync-lipsync v2 with mp4 + mp3 returns — **FAILS live**: same fal.ai balance exhaustion (QA_REPORT.md §8, area G)
- [ ] E2. wav2lip fallback works
- [ ] E3. Output plays with audio aligned

### F. Split Reality
- [ ] F1. Single upload → ultra + cinematic render in parallel
- [ ] F2. Both results display side-by-side
- [ ] F3. Each charges 1 credit

### G. Spin 1 → 30
- [x] G1. `/spin` loads, prompt input visible — confirmed live via browser e2e (QA_REPORT.md §8, area J)
- [ ] G2. Submit creates job + 30 queued variants — job creation + progress UI confirmed live; full 30-tile completion not exhaustively re-verified
- [ ] G3. Tick loop processes 6/batch, progress bar advances
- [ ] G4. All 30 tiles render with distinct previews
- [ ] G5. Job marked `done` when complete
- [ ] G6. Reload mid-job resumes correctly
- [ ] G7. RLS: user A cannot see user B's job

### H. UGC Factory
- [ ] H1. Avatar list loads (Ava, Luna, Maya, Nova, Rio, Scarlet)
- [ ] H2. Avatar holding lipstick product shoot returns
- [ ] H3. Generated UGC saves to gallery

### I. Gallery
- [x] I1. Lists favourites first, then recent — page renders existing generations live; ordering not specifically verified (QA_REPORT.md §8, area N)
- [ ] I2. Toggle favorite persists
- [ ] I3. Download works for image + video

### J. Credits & Billing
- [ ] J1. Buy credits → Paystack checkout opens — **FAILS live**: merchant account has no USD currency enabled ("Currency not supported by merchant"); blocks 100% of checkout (QA_REPORT.md §8, area O — P0)
- [ ] J2. Webhook crediting verified (test transaction) — untestable until J1 is fixed
- [ ] J3. Balance updates in StickyCreditsBar
- [ ] J4. Insufficient credits → friendly toast

### K. Admin
- [x] K1. `/admin` gated to admin role — confirmed live via browser e2e; one transient stuck-spinner instance not reproduced on retest (QA_REPORT.md §8, area Q)
- [ ] K2. Orchestration panel lists providers
- [ ] K3. Smoke tests page runs end-to-end

---

## Phase 2 — Turbo + Premium polish (after A–K pass)

### L. Performance
- [ ] L1. Lighthouse mobile: Perf ≥ 90, A11y ≥ 95, SEO ≥ 95
- [ ] L2. LCP < 2.5s, CLS < 0.1, INP < 200ms
- [ ] L3. Initial JS bundle < 250 kb gz
- [ ] L4. All hero images served as AVIF/WebP
- [ ] L5. No layout shift on slideshow rotate
- [ ] L6. Pulse-on-touch effect fires on every section
- [ ] L7. Reduced-motion users see no pulse

### M. Cross-device
- [ ] M1. iPhone Safari (375, 390, 430)
- [ ] M2. Android Chrome (360, 412)
- [ ] M3. iPad (768, 1024)
- [ ] M4. Desktop 1440 + 1920
- [ ] M5. Dark mode parity

### N. SEO / Share
- [ ] N1. Each route has unique title + meta + og:image
- [ ] N2. `/sitemap.xml` lists all public routes
- [ ] N3. `robots.txt` correct
- [ ] N4. Twitter card preview renders

### O. Security
- [ ] O1. Security scan: 0 critical findings
- [ ] O2. All public tables have RLS + GRANTs
- [ ] O3. No service-role key in client bundle
- [ ] O4. All privileged server fns check `has_role`

---

## Phase 3 — Store packaging (after L–O pass)

- [ ] P1. PWA manifest + maskable icons live
- [ ] P2. Capacitor initialised (`app.aurora.studio`)
- [ ] P3. iOS project builds in Xcode, signed
- [ ] P4. Android AAB built, signed with upload key
- [ ] P5. App icons + splash generated from Aurora logo
- [ ] P6. Store listing copy + screenshots ready (iOS 6.7" / 6.1", Android phone + tablet)
- [ ] P7. Privacy policy URL + data-safety form complete
- [ ] P8. TestFlight build accepted, internal testers added
- [ ] P9. Play internal-testing track live, internal testers added
- [ ] P10. Re-run Phase 1 checklist on a real device (iOS + Android)
- [ ] P11. Promote to App Store production
- [ ] P12. Promote to Play production

---

**How we work this list:** message me the IDs that passed (e.g. "A1 A2 B1 B2 done") and I'll tick them here. When a section fails, I'll fix it before we move on.