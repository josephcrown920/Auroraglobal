---
name: Aurora muted-autoplay video hydration warning (FIXED, app-wide)
description: React hydration "attributes didn't match" warning came from muted/autoplay <video>; fixed app-wide via a shared AutoplayVideo wrapper — don't reintroduce raw muted/autoPlay video anywhere.
---

The Aurora landing page (TanStack Start, React 19, SSR) used to emit a
console.error: "A tree hydrated but some attributes of the server rendered HTML
didn't match the client properties." It came from `<video autoPlay muted loop
playsInline ...>` — React's SSR vs client handling of the `muted`/`autoPlay`
attributes mismatches during hydration (can cause a first-load flicker).

**Wrapper moved:** the shared wrapper now lives at
`src/components/ui/AutoplayVideo.tsx` (no longer landing-specific);
`src/components/landing/AutoplayVideo.tsx` is a thin re-export so old landing
imports keep working. All non-landing routes/components (studio, canvas, motion,
lipsync, tiktok, ugc, gallery, dashboard, admin, clips, UploadSlot,
LiveJobsPanel, SplitRealityPlayer, TutorialModal) now use it too. For muted-only
(non-autoplay) videos pass `autoPlay={false}`; for autoplay-but-not-muted pass
`muted={false}`.

**Fix (the rule):** all autoplaying/muted videos render through one shared wrapper.
It NEVER emits `muted`/`autoPlay`
as JSX attributes (so SSR HTML and the hydrated tree are byte-identical — verify
with `curl localhost:8080/ | grep '<video'` → no `muted=""`/`autoPlay=""`),
carries `suppressHydrationWarning`, and sets `el.defaultMuted/muted=true`,
`el.autoplay=true` + `el.play().catch()` imperatively in a mount effect.
Behaviour is unchanged (muted autoplay loop). It forwards a ref (SplitReality /
LipSyncDemo drive playback manually) and passes through all other video props
(loop, playsInline, preload, controls, poster, onLoadedData, style, ...).

**How to apply:** when adding/editing ANY video with `muted` and/or `autoPlay`,
use `<AutoplayVideo>` (import from `@/components/ui/AutoplayVideo`), not a raw
`<video muted autoPlay>` — reintroducing the raw attributes brings the warning +
flicker back. Plain `<video controls>` with no muted/autoPlay is fine as-is.
