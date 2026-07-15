---
name: TanStack package version alignment
description: router-plugin has a separate version cadence from react-start; routeTree.gen.ts auto-regenerates from file additions.
---

## The rule
When bumping `@tanstack/react-start`, check `@tanstack/router-plugin` separately on npm — the two packages do NOT always share the same version number. A version that exists for one may not exist for the other.

**Why:** Attempted to bump router-plugin to `^1.168.27` (matching react-start's new version) — npm rejected it as non-existent. react-start `^1.168.27` exists, router-plugin only goes to `^1.167.28` at the same release date.

**How to apply:** Before bumping: `npm info @tanstack/router-plugin versions --json | tail -5` to confirm the target version exists. Only bump what npm confirms.

## Route tree auto-regeneration
`src/routeTree.gen.ts` is auto-maintained by the TanStack Router Vite plugin. When a new `src/routes/foo.tsx` + `src/routes/foo.lazy.tsx` pair is created during dev, the plugin detects the file and regenerates the route tree automatically. No manual editing of routeTree.gen.ts needed — it will break things.

**Why:** Tried to determine if I needed to manually update routeTree.gen.ts after creating live-studio.tsx + live-studio.lazy.tsx. The plugin did it automatically within seconds of saving the files.
