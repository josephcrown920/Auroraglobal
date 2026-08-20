# Embedding Aurora tools

Use `src/components/embed/AuroraEmbed.tsx` to mount independently deployed Aurora tools without copying their markup or CSS into Aurora Global.

```tsx
import { AuroraEmbed } from "@/components/embed/AuroraEmbed";

<AuroraEmbed
  kind="layers"
  src="https://your-layers-domain/embed"
  title="Aurora Layers"
  ssoToken={shortLivedEmbedToken}
/>

<AuroraEmbed
  kind="scene-weaver"
  src="https://your-scene-weaver-domain/embed"
  title="Scene Weaver"
/>

<AuroraEmbed
  kind="presets-engine"
  src="https://your-presets-engine-domain/embed"
  title="Aurora Presets Engine"
/>

<AuroraEmbed
  kind="soul"
  src="https://your-soul-domain/embed"
  title="Soul Studio"
/>

<AuroraEmbed
  kind="youtube-shorts"
  src="https://your-shorts-domain/embed"
  title="YouTube Shorts Automation"
/>
```

The component validates the source window and origin for every message, resizes only from a tool's own height events, and sends Layers SSO only after the trusted iframe announces it is ready.

Do not add a `sandbox` attribute unless the target tool is changed and tested for it; the editors need normal browser behavior for uploads, clipboard actions, and authentication. Configure each deployed tool's `AURORA_EMBED_ALLOWED_ORIGINS` with Aurora Global's exact production origin.

## Directors Room

The Directors Room is the parent workspace. Storyboard is its first section;
Layers, Scene Weaver, and Presets Engine appear as sibling sections inside that
room. Set the following public build variables in Aurora Global before
deploying:

```text
VITE_AURORA_LAYERS_EMBED_URL=https://your-layers-domain/embed
VITE_AURORA_SCENE_WEAVER_EMBED_URL=https://your-scene-weaver-domain/embed
VITE_AURORA_PRESETS_ENGINE_EMBED_URL=https://your-presets-engine-domain/embed
VITE_AURORA_SOUL_EMBED_URL=https://your-soul-domain/embed
VITE_AURORA_YOUTUBE_SHORTS_EMBED_URL=https://your-shorts-domain/embed
```

The URLs are intentionally not hardcoded. If a variable is unset, Directors
Room shows a configuration notice instead of loading an untrusted or unknown
origin. Soul Studio and YouTube Shorts retain their own sign-in flows inside
their isolated editors; only Layers receives optional Aurora session handoff.
