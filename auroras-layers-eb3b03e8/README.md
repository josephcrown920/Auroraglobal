# Aurora Performance Studio — Layers

Turn any flat image into editable layers. Upload a frame, describe the change in one
sentence, and only that layer re-renders. Built on TanStack Start + Lovable AI.

## What's inside

- **Landing page** (`src/routes/index.tsx`) — Aurora-branded marketing page: hero, layer
  decomposition walkthrough, outfit-swap and face-swap comparisons, live studio, CTA.
- **Layer Studio** (`src/components/LayerStudio.tsx`) — working UI: optional image upload,
  prompt box with trap/hip-hop presets, streaming output preview.
- **Image API** (`src/routes/api/generate-image.ts`) — server route that calls the Lovable AI
  Gateway (`google/gemini-3-pro-image`) and streams frames back as SSE.
- **Stream client** (`src/lib/streamImage.ts`) — SSE parser with a non-streaming fallback.

## How to use it

1. Open the site and scroll to **The Studio** section (or hit "Open Studio" in the hero).
2. **Upload media** (optional). Any photo works — a selfie, a press shot, a still.
   With no upload, the prompt generates a fresh frame instead of editing one.
3. **Write a layer prompt**, e.g. `Turn the outfit into full trap streetwear — puffer jacket,
iced-out cuban chains, designer shades`. Tap a preset chip to autofill.
4. Press **Run layer edit**. A blurred partial frame appears first, then sharpens into the
   final render.
5. Right-click / long-press the output to save it.

### Prompt tips

- Name the layer first ("her jacket", "his chain", "the background"), then the change.
- Add `preserve exact facial likeness, hairstyle and body proportions` to keep identity.
- Stack edits by re-uploading the previous output as the new source.

## Running locally

```sh
npm install
npm run dev      # http://localhost:8080
```

## Configuration

`LOVABLE_API_KEY` is provisioned automatically by Lovable Cloud and read server-side only
inside the API route. Nothing else to set up.

Errors from the AI gateway (rate limits, credit exhaustion) surface directly under the
Run button so you always know why a render didn't land.

## New in this build

- **Aurora Director (AI agent)** — a cinematic brain (Gemini 3.7 Flash, streaming) that returns
  LOGLINE / SHOT / LIGHT / WARDROBE / PALETTE / PROMPT / NEXT for any idea. One click sends the
  generated PROMPT straight into the studio.
- **Engine picker** — Banana Pro (`google/gemini-3-pro-image`), Banana Flash
  (`google/gemini-3.1-flash-image`), GPT Image 2 (`openai/gpt-image-2`).
- **Identity lock** — every edit re-feeds the previous render as the source and appends a
  "same face, skin tone, pose, framing, no mirroring" instruction so characters stay consistent.
- **Layer stack** — each generation is a layer; click a thumbnail to revisit any state.
- **Projects** — name, save, reopen and delete shoots (stored in your browser).
- **Export** — download the active frame as PNG, all layers as PNGs, or the whole project as a ZIP
  (source + numbered layers + final composite + `recipe.txt`).

### How to use

1. Scroll to **Direct your shoot**.
2. Pitch a scene to the Director → press **Send prompt to studio**.
3. Upload a reference image (optional), pick an engine, keep **Lock identity** on.
4. **Run layer edit**, then **Stack another layer** for each change.
5. **Save project** and **Export ZIP**.

## Embedding Aurora Layers in auroraperformancestudio.com

The studio ships an embed-only route: `/embed`. It renders the full LayerStudio
with every brand token, gradient, engine and export intact — no landing page chrome.

### 1. Drop-in script widget (any stack)

```html
<div
  data-aurora-layers
  data-src="https://<your-published-url>/embed"
  data-sso-token="<short-lived-signed-token>"
></div>
<script src="https://<your-published-url>/aurora-layers-embed.js" defer></script>
```

The script adds `hostOrigin`, creates the iframe, validates every message against
that iframe's exact origin, and keeps its height in sync. Omit `data-sso-token`
to run as an unauthenticated standalone Layers session.

### 2. React component

```tsx
import { AuroraLayersEmbed } from "./AuroraLayersEmbed";

<AuroraLayersEmbed
  src="https://<your-published-url>/embed"
  ssoToken={shortLivedEmbedToken}
  onAuth={(status) => console.info("Layers session:", status)}
/>;
```

Copy `src/components/embed/AuroraLayersEmbed.tsx` into any React host. It uses
the same strict source/origin checks as the script widget and does not put the
SSO token in the iframe URL.

### 3. Sign a short-lived SSO token in the host

Store the same `AURORA_EMBED_SSO_SECRET` in the host and Layers deployment.
Never expose it in browser code. The payload must contain `sub`, `email`, an
`exp` Unix timestamp no more than five minutes away, and `aud` set to the
host's exact HTTPS origin. Each valid token is accepted once.

```ts
import { createHmac } from "node:crypto";

const payload = {
  sub: currentUser.id,
  email: currentUser.email,
  name: currentUser.name,
  aud: "https://your-aurora-domain.example",
  exp: Math.floor(Date.now() / 1000) + 60,
};

const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
const signature = createHmac("sha256", process.env.AURORA_EMBED_SSO_SECRET!)
  .update(body)
  .digest("hex");
const shortLivedEmbedToken = `${body}.${signature}`;
```

### Notes

- Appearance and settings are preserved because the studio runs on its own deployment;
  the host site's CSS never touches it.
- Projects are saved per-origin (cloud + localStorage), so the embed keeps its own history.
- Use a subdomain such as `layers.auroraperformancestudio.com` (custom domain in Publish
  settings) if you want the embed to share the main site's domain.

## Putting Layers inside your Replit app (without losing the look)

There are three ways. Ranked by how much of Aurora's appearance survives.

### Option A — iframe embed (100% appearance, 5 minutes) — recommended

1. Deploy this project anywhere (Lovable Publish, Vercel, Replit Deploy, your own box).
2. Point a subdomain at it, e.g. `layers.auroraperformancestudio.com`.
3. Drop the `<iframe src=".../embed">` snippet above into the Replit app.

Why it never breaks: the studio loads its own CSS, fonts, tokens and JS inside the
iframe. Your Replit app's Tailwind/global CSS cannot leak in, and Aurora's styles
cannot leak out. Engines, Character Bible, storyboard, GPU compositing and exports
all keep working because they run against this deployment's own API routes.

Pass config through the URL: `/embed?engine=nano-banana-pro&mode=layers`.
Talk to the host app via `postMessage` (already used for height sync).

### Option B — copy the studio into the Replit app (source-level port)

Only do this if the studio must share the host's auth/session directly.
Copy, in this order:

1. `src/styles.css` — all Aurora tokens, gradients, fonts. Merge into the host's
   global CSS, keeping the `@theme` block and font `<link>` tags intact.
2. `src/components/LayerStudio.tsx`, `src/components/DirectorAgent.tsx`,
   `src/components/CharacterBibleEditor.tsx`, `src/components/video/*`.
3. `src/lib/` — `auroraModels.ts`, `characterBible.ts`, `storyboard.ts`,
   `streamImage.ts`, `gpuCompose.ts`.
4. `src/routes/api/*` — `generate-image.ts`, `director.ts`, `production.ts`.
   On Replit (Express/Next) these become one POST endpoint each; keep the SSE
   response shape identical or streaming previews stop working.
5. Env: `LOVABLE_API_KEY` (or your own gateway key) plus the Supabase URL/key.

Gotchas that cause the "it looks different" problem:

- The host app must not run its own CSS reset after Aurora's tokens.
- Fonts (Archivo + JetBrains Mono) must be linked in the host `<head>`.
- Tailwind v4 `@theme` variables are required — v3 config files will not read them.

### Option C — native app (Play Store / App Store)

Capacitor is already wired up:

```bash
npm run cap:sync          # build + sync both platforms
npm run cap:ios           # opens Xcode
npm run cap:android       # opens Android Studio
```

To keep the stores in sync with the web build without resubmitting, uncomment the
`server.url` block in `capacitor.config.ts` and point it at your published
`/embed` URL. Icons and splash live in `resources/`; app id is
`com.auroraperformancestudio.layers`.
