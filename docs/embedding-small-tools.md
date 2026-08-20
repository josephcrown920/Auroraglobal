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
```

The component validates the source window and origin for every message, resizes only from a tool's own height events, and sends Layers SSO only after the trusted iframe announces it is ready.

Do not add a `sandbox` attribute unless the target tool is changed and tested for it; the editors need normal browser behavior for uploads, clipboard actions, and authentication. Configure each deployed tool's `AURORA_EMBED_ALLOWED_ORIGINS` with Aurora Global's exact production origin.