# Aurora — Ship-to-Store Plan

Three phases, executed in order. Phase 1 (Testing Checklist) is the gate: every box must be ticked before Phase 2 (Turbo + Premium polish) ships, and Phase 2 must be green before Phase 3 (Store packaging).

---

## Phase 1 — Master Testing Checklist

I'll save this as `TESTING_CHECKLIST.md` at the project root so we can tick `[x]` as each one passes. Grouped by surface area.

### A. Landing & Marketing (public, no-auth)
- [ ] `/` renders < 2.5s LCP on 4G throttled
- [ ] "Go viral with TikTok" is FIRST section, auto-scroll runs
- [ ] Aurora logo + TikTok logo pulse animation visible
- [ ] Lipsync hero video centered, autoplays muted, loops
- [ ] Image-generation slideshow (10 Josh photos) cycles
- [ ] Colors teaser shows pink performance photos
- [ ] Motion control section: no clip, plain state
- [ ] Magenta cyclorama image present, blue cyc + neon-room removed
- [ ] UGC factory: 4 new UGC photos visible
- [ ] Split-reality demo plays
- [ ] Pricing tiles load, CTA → /auth
- [ ] FAQ accordions open/close
- [ ] Footer links resolve (no 404)
- [ ] Favicon = Aurora logo across all routes

### B. Auth
- [ ] Email sign-up → email confirmation off (dev) / on (prod)
- [ ] Email sign-in works
- [ ] Google OAuth round-trips successfully
- [ ] Sign-out clears session + redirects to `/`
- [ ] `/dashboard`, `/studio`, `/spin`, `/gallery` redirect to `/auth` when logged out
- [ ] Session persists across reload

### C. Studio — Image Generation
- [ ] Upload 1–6 reference images
- [ ] Prompt + Gemini 2.5 Flash → image returns < 30s
- [ ] Seedream / FLUX route through orchestrator
- [ ] Result saved to storage, public URL works
- [ ] Credits deducted (non-admin) / unlimited (admin)
- [ ] Failed gen refunds credits
- [ ] History appears in `/gallery`

### D. Studio — Video Generation
- [ ] Image → video (Seedance, 5s, 720p) returns
- [ ] Camera movement preset injected into prompt
- [ ] Kling start+end frame works
- [ ] MP4 plays inline + downloads

### E. Lip-Sync
- [ ] sync-lipsync v2 with mp4 + mp3 returns
- [ ] wav2lip fallback works
- [ ] Output plays with audio aligned

### F. Split Reality
- [ ] Single upload → ultra + cinematic render in parallel
- [ ] Both results display side-by-side
- [ ] Each charges 1 credit

### G. Spin 1 → 30 (NEW — needs hardening)
- [ ] `/spin` loads, prompt input visible
- [ ] Submit creates job + 30 queued variants
- [ ] Tick loop processes 6/batch, progress bar advances
- [ ] All 30 tiles render with distinct previews
- [ ] Job marked `done` when complete
- [ ] Reload mid-job resumes correctly
- [ ] RLS: user A cannot see user B's job

### H. UGC Factory
- [ ] Avatar list loads (Ava, Luna, Maya, Nova, Rio, Scarlet)
- [ ] Avatar holding lipstick product shoot returns
- [ ] Generated UGC saves to gallery

### I. Gallery
- [ ] Lists favourites first, then recent
- [ ] Toggle favorite persists
- [ ] Download button works for image + video

### J. Credits & Billing
- [ ] Buy credits → Paystack checkout opens
- [ ] Webhook crediting verified (test transaction)
- [ ] Balance updates in StickyCreditsBar
- [ ] Insufficient credits → friendly toast

### K. Admin
- [ ] `/admin` gated to admin role
- [ ] Orchestration panel lists providers
- [ ] Smoke tests page runs end-to-end

### L. Performance (post-Phase-2)
- [ ] Lighthouse mobile: Perf ≥ 90, A11y ≥ 95, SEO ≥ 95
- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms
- [ ] Bundle: initial JS < 250kb gz
- [ ] All hero images served as AVIF/WebP
- [ ] No layout shift on slideshow rotate

### M. Cross-device
- [ ] iPhone Safari (375, 390, 430)
- [ ] Android Chrome (360, 412)
- [ ] iPad (768, 1024)
- [ ] Desktop 1440 + 1920
- [ ] Dark mode parity

### N. SEO / Share
- [ ] Each route has unique title + meta + og:image
- [ ] `/sitemap.xml` lists all public routes
- [ ] `robots.txt` correct
- [ ] Twitter card preview renders

### O. Security (run security scan)
- [ ] No critical findings
- [ ] All public tables have RLS + GRANTs
- [ ] No service-role key in client bundle
- [ ] All server fns with privileged ops check `has_role`

---

## Phase 2 — Turbo Booster + Premium HD Polish

Only after Phase 1 column A–K is green.

1. **Turbo Booster (speed)**
   - Convert all hero JPG/PNG → AVIF + WebP via `vite-imagetools` (`?format=avif&w=…`)
   - Add `<link rel="preload" as="image">` for LCP hero on `/`
   - Code-split heavy routes (`/spin`, `/studio`, `/canvas`) via `.lazy.tsx`
   - Lazy-mount below-fold landing sections with `IntersectionObserver`
   - Add `fetchpriority="high"` to LCP, `loading="lazy"` everywhere else
   - Defer the Aurora chatbot bundle until first scroll or 3s idle
   - Pre-warm queryClient for `/dashboard` on hover of nav links

2. **Premium HD experience**
   - Bump all Josh slideshow + UGC images to 2x retina source
   - Switch video posters to high-res first-frame stills
   - Force `image-rendering: high-quality` + `will-change` on hero media
   - Add subtle gradient + film-grain overlay tokens in `styles.css`

3. **"Pulse on touch/click" interaction**
   - Add a global `usePulseOnInteract()` hook that adds a `.is-pulsing` class to the nearest `[data-pulse-section]` for 600ms on pointerdown
   - New keyframe `pulse-section` in `styles.css` (scale 1 → 1.012 → 1, shadow glow with `--primary`)
   - Tag every landing + studio section root with `data-pulse-section`
   - Respect `prefers-reduced-motion`

4. **Spin backend hardening**
   - Move tick loop from client polling to a server-driven batch (cron + pg trigger) so closing the tab doesn't pause renders
   - Add realtime channel on `spin_variants` so the panel updates without polling
   - Add `kind: 'image' | 'video'` per piece so previews match the platform (TikTok = 9:16 video frame, carousel = square, etc.)

---

## Phase 3 — Play Store + App Store packaging

Web→Native via **Capacitor** (no rewrite needed).

1. `bun add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init Aurora app.aurora.studio --web-dir=dist`
3. Generate native icons + splash from the Aurora logo (1024×1024 master) with `@capacitor/assets`
4. Add `capacitor.config.ts` with `server.url` pointing to published Lovable URL (or shipped `dist/`)
5. Add a PWA manifest first (`public/manifest.webmanifest`, theme + maskable icons) — required for Android install banner and TWA fallback
6. iOS: `npx cap add ios`, open in Xcode, set bundle id, signing team, ATS exceptions for media domains, screenshots 6.7" + 6.1"
7. Android: `npx cap add android`, set applicationId, sign AAB with upload key, Play Console listing + screenshots
8. Store listing copy: title, short desc, long desc, keywords, privacy URL → `/legal/privacy`
9. TestFlight + Play internal-testing track first → smoke test all Phase 1 boxes again on device → promote to production

---

## Gate rules
- I will NOT start Phase 2 work until you mark Phase 1 sections A–K complete
- I will NOT start Phase 3 packaging until Phase 2 sections L–O are green
- Each tick goes into `TESTING_CHECKLIST.md`; I update it as we verify

---

## Tech details (skip if not interested)
- Pulse: pointerdown listener at `__root.tsx`, walks up to `closest('[data-pulse-section]')`, toggles class with `requestAnimationFrame`. CSS uses `transform` + `box-shadow` only (GPU-cheap).
- Image pipeline: `vite-imagetools` query params handle AVIF/WebP at build; `<picture>` wrapper with AVIF→WebP→PNG fallback chain.
- Spin realtime: enable `supabase_realtime` publication on `spin_variants`, subscribe in `/spin` component, drop client tick loop.
- Capacitor wrapper ships the published web app — no duplicate codebase, both stores update when you publish.

---

**Next step:** approve this plan and I'll (1) write `TESTING_CHECKLIST.md` into the repo, (2) start ticking Phase 1.A–B with the browser, (3) report back so you can take over the manual ones.
