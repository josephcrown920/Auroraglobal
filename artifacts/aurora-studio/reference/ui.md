# AURORA Performance Studio — UI Guide

Locked UI reference for the marketing site + in-app shell. Mirror this when porting to the Replit master.

## Brand

- Wordmark: **AURORA PERFORMANCE STUDIO** (all caps, `tracking-[0.18em]`, `font-display font-bold`).
- Mobile compact form: **AURORA** (below `sm` breakpoint).
- Accent: `bg-brand` dot at 8px, chromatic aurora gradient primary.
- Gold treatment (`bg-gradient-to-r from-[#f6d365] via-[#fbbf24] to-[#b8860b] bg-clip-text text-transparent`) is reserved for flagship Artists entries: **Infinity Canvas**, **Video Agent**, **Perform Anywhere**, **Colors Performance Sessions**.
- Assets:
  - App Store icon — `src/assets/aurora-app-icon.png` (1024×1024)
  - Play Store icon — `src/assets/aurora-play-icon.png` (512×512)
  - Website wordmark — `src/assets/aurora-wordmark.png` (1600×512)
- Favicon + apple-touch-icon in `src/routes/__root.tsx` use `aurora-app-icon`.

## Top Nav (landing, `src/routes/index.tsx`)

- `sticky top-0 z-50`, `h-14`, blurred `bg-zinc-950/80`.
- Two-column grid: brand left, CTA right. Truncates on narrow viewports so the wordmark never wraps.
- CTA: signed-out shows *Sign in* + *Start creating*; signed-in shows *Open Studio*.

## Global Menu Button (`src/components/MobileNav.tsx`)

- Floating pill, top-left, **positioned at `calc(env(safe-area-inset-top) + 4.25rem)`** — sits BELOW the sticky `h-14` nav so it never occludes the AURORA PERFORMANCE STUDIO wordmark.
- Class: `phone-edge-left fixed z-[60] aurora-glass-strong rounded-full px-3.5 py-2`.
- Label: `Menu` + `<Menu />` icon.

## Sidebar Drawer

Three sections, in order:

1. **Artists** — Infinity Canvas ⭐, Video Agent ⭐, Perform Anywhere ⭐, Colors Performance Sessions ⭐, Motion Control, Music Video, Storyboard, Live Studios, Lip Sync, Scene Builder. (⭐ = gold gradient.)
2. **Creators** — TikTok30 (Premium), UGC Ads, Content Line, Image Generation, Photo Editor, Talking Avatars.
3. **Account** — Gallery, Creator Hub, Plan & Billing, Affiliate, **Admin (owner-only, see below)**.

Footer: theme toggle.

> Note: there are **two** canvases. **Infinity Canvas** (`/canvas`) is the node-based workflow board; a separate legacy "Canvas" surface is not linked in nav. Always disambiguate by the full name **Infinity Canvas**.

## Bottom Tab Bar

3-column glass bar, safe-area padded. Breathing indicator + glow on active tab. Hidden on `/canvas`. Tabs (everyone gets these): **Infinity Canvas**, **Video Agent**, **TikTok30** — all flagged `premium` for the highlighted treatment.

## Admin Visibility

Admin is gated in the UI by an **owner allowlist** (`ADMIN_EMAILS` in `src/components/MobileNav.tsx`):

```
josephcrown920@gmail.com
outthemudrecordsltd@gmail.com
```

- Non-matching users never see the `Admin` link in the drawer.
- Server-side, `/admin` routes must still enforce `has_role(auth.uid(), 'admin')` — the UI hide is defense-in-depth, not the security boundary.

## Landing Sections

Hero carousel → Services grid (flagship first) → Ticker → FAQs → CTA. Full source: `src/routes/index.tsx`.
