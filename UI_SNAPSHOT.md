# UI Snapshot — Aurora Studio

**Date:** 2026-09-04
**Status:** Current appearance reference. Use this to verify the UI matches when importing/syncing the project into another workspace.

---

## Brand & Theme

- **Brand accent: VIOLET** — the `--primary` token is a violet around `oklch` hue ~295. (The earlier red accent was a mistake and was corrected in Aug 2026 — do not reintroduce it.)
- Dark, premium look throughout: near-black backgrounds, glassy panels, soft ambient glows.
- **Status colours are reserved and never restyled to brand:** error = red, recording = red, running/active = cyan, success = green.
- Currency displays as **"Aura"** in all user-facing copy (stored internally as credits). "Aurora" is the brand name only.

## Layout system

- **Single-column, phone-first layout everywhere.** Tailwind responsive breakpoints are effectively disabled (pushed to 9990px+), so `sm:`/`md:`/`lg:` variants never apply. Design for one column.
- Full-screen chrome uses the `.phone-*` helper classes.
- Page shells: `aurora-page-shell` + ambient background layers (`pointer-events-none`) + content wrapped in `relative z-10`.
- Buttons: shadcn `Button` with custom `premium` and `glass` variants; `aurora-*` utility classes for cards/glows.
- Decorative pills, badges, and suggestion chips are borderless. Use tonal fills, text contrast, and a visible focus ring for selected/keyboard states; keep borders on cards, media frames, forms, and action buttons.
- User-visible generation prices and pack-value examples derive from `src/lib/pricing.ts` and `src/lib/billing.plans.ts`. Do not duplicate Aura amounts in page copy.

## Key surfaces

- **Landing (`/`)** — cinematic first-visit intro (localStorage-gated), hero slideshow, creator carousel, TikTok section, process steps, gallery marquee. Hero/section photos and all landing text are **operator-editable** (see Admin below) with bundled defaults as fallback.
- **Home composer** — idea box + hook chips.
- **Motion Control (`/motion`)** — `/perform` 307-redirects here.
- **Video Agent (`/video-agent`)** — in Content nav; `/agent` is the separate Prime Director 3-panel UI (sidebar / chat / inspector).
- **Templates (`/templates`)** — 5 fixed categories; template cards show "Free" only when cost is 0.
- **Admin (`/admin`)** — passcode or Supabase-admin unlock. Tabs include Generations, GPU Workers, Promo Codes, Site Images, Site Copy, AI Router, Resources.

## Admin editing with live preview (added 2026-08-07)

- **Site Images** (`/admin/site-images`): grid of photo slots grouped by landing section. Picking a file now opens a **confirm dialog (current vs new side-by-side)** before publishing. Changes go live immediately.
- **Site Copy** (Admin → Site Copy tab): per-key text overrides with history + restore.
- Both screens have a floating **Preview** button (bottom-right) opening a bottom drawer with the **real landing page in an iframe**; it auto-reloads after every save so the operator sees exactly what visitors see without leaving the editor.
- Component: `src/components/admin/LandingLivePreview.tsx`.

## Adult School artifact (`artifacts/aurora-adult`, preview `/aurora-adult`)

- Separate rose/pink-accented brand (`#e11d6a` gradients) on near-black.
- Flow: Landing → **straight into Studio** (the operator passcode gate was removed 2026-08-07 by owner request; API calls still authenticate via the build-time passcode under the hood). Header CTA reads "Enter studio".

## Sync notes

- npm `package-lock.json` is the **authoritative lockfile**. `bun.lock` is gitignored — never commit one; a stale bun.lock hijacks remote/EAS/deploy builds.
- Site images/copy overrides live in the `site_images` / `site_copy` tables; when absent (fresh DB), the landing falls back to bundled defaults.
- The site layout map PDF (`public/Aurora-Site-Layout-Map.pdf`) is a static Playwright snapshot — regenerate via `scripts/generate-site-layout-map.mjs` after page/nav changes.
