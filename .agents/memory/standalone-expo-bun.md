---
name: Standalone Expo app with bun on Replit
description: How to safely add an Expo mobile app to a bun-managed root repo without breaking the live web app.
---

## Rule
Never use `createArtifact` for an Expo app when the root is managed by bun. The artifact system runs a background `pnpm install` at the repo root, which clobbers bun's root `node_modules` and takes the live web app down. Use a **self-contained standalone scaffold** instead.

**Why:** Observed in production — createArtifact + pnpm-workspace.yaml broke the web app once already. Architect confirmed: standalone approach is correct.

**How to apply:**
1. Copy the expo scaffold template to `artifacts/<slug>/` (do NOT use createArtifact).
2. Write a standalone `package.json` (no `catalog:` refs, no `@workspace/*` deps, concrete semver versions).
3. Install with `cd artifacts/<slug> && bun install` (never root pnpm install).
4. Configure a manual workflow: `configureWorkflow({ name: "...", command: "cd artifacts/<slug> && PORT=<port> bun run dev", outputType: "webview", autoStart: true })` — **omit `waitForPort`** (Metro cold start on Replit is >3 min and will always timeout).
5. Verify isolation: root `node_modules/@lovable.dev/vite-tanstack-config` still present + web HTTP 200.

## Metro cold start timing
Metro on Replit takes 3–5 minutes on first cold start (downloading + transpiling 400MB+ of RN packages). `restart_workflow` with `waitForPort` will always time out. Use `autoStart:true` (no waitForPort) + verify manually with `curl http://localhost:<port>/` after ~35s.

## Confirmed working setup (Aurora)
- Expo SDK 54, React 19.1.0, RN 0.81.5, bun
- Port 8099 (supported Replit port, avoids conflict with web app at 8080)
- Supabase: EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY set as shared env vars
- URL polyfill: `import "react-native-url-polyfill/auto"` at top of `lib/supabase.ts`
- Auth: AsyncStorage + supabase.auth.startAutoRefresh on AppState foreground

## useColors.ts fix
The scaffold's `useColors.ts` casts `colors as Record<string, palette>`, which breaks if `colors` has a non-palette top-level key like `radius: number`. Fix: remove the cast entirely — just index `colors.dark` or `colors.light` directly.
