---
name: Aurora landing muted-autoplay video hydration warning (FIXED)
description: The landing page React hydration "attributes didn't match" warning came from muted/autoplay <video>; now fixed via a shared AutoplayVideo wrapper — don't reintroduce raw muted/autoPlay video on landing.
---

The Aurora landing page (TanStack Start, React 19, SSR) used to emit a
console.error: "A tree hydrated but some attributes of the server rendered HTML
didn't match the client properties." It came from `<video autoPlay muted loop
playsInline ...>` — React's SSR vs client handling of the `muted`/`autoPlay`
attributes mismatches during hydration (can cause a first-load flicker).

**Fix (the rule):** all landing videos render through one shared wrapper
`src/components/landing/AutoplayVideo.tsx`. It NEVER emits `muted`/`autoPlay`
as JSX attributes (so SSR HTML and the hydrated tree are byte-identical — verify
with `curl localhost:8080/ | grep '<video'` → no `muted=""`/`autoPlay=""`),
carries `suppressHydrationWarning`, and sets `el.defaultMuted/muted=true`,
`el.autoplay=true` + `el.play().catch()` imperatively in a mount effect.
Behaviour is unchanged (muted autoplay loop). It forwards a ref (SplitReality /
LipSyncDemo drive playback manually) and passes through all other video props
(loop, playsInline, preload, controls, poster, onLoadedData, style, ...).

**How to apply:** when adding/editing a landing video, use `<AutoplayVideo>`,
not a raw `<video muted autoPlay>` — reintroducing the raw attributes brings the
warning + flicker back. The same wrapper would fix the identical warning on the
non-landing routes (studio/canvas/motion/lipsync/etc. still use raw
`<video muted autoPlay>`) if console cleanliness is ever needed there too.
