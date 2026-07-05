---
name: Monaco SSR build OOM
description: Why huge client-only libs must be stubbed out of the SSR build in this app
---

Bundling Monaco locally (needed because the CDN loader stalls in the Replit preview) makes `vite build`'s SSR pass pull the entire monaco module graph (plus `?worker` bundles) into the server build — which OOMs Node in this ~7GB container even though the lib is lazy-loaded and mount-gated on the client.

**Fix:** `aurora:monaco-ssr-stub` plugin in vite.config.ts — a `resolveId`/`load` pair that, only when `options?.ssr`, replaces the CodeEditor module with a null component. Client build is untouched (monaco lands in its own lazy chunk).

**Why:** `lazy(() => import(...))` is statically analyzable, so runtime mount-gating does NOT keep a module out of the SSR graph.

**How to apply:** any future huge client-only dependency (editors, 3D, charts with workers) should get the same SSR-stub treatment rather than heap bumps; verify with a temp build workflow (builds exceed the 2-min bash timeout).
