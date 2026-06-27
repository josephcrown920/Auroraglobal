// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cartographer } from "@replit/vite-plugin-cartographer";

// Replit's Visual Edits tool reads per-element source-location metadata that
// @replit/vite-plugin-cartographer injects at transform time. It is passed
// through the Lovable config's supported `plugins` escape hatch (NOT added as a
// second React/Tailwind/tagger plugin) so it coexists with componentTagger.
//
// Gated to the Replit environment (REPL_ID) and `apply: "serve"` so it only runs
// during `vite dev` — the production `vite build` (command "build") never
// includes it, keeping deploy output unaffected.
const replitPlugins =
  process.env.REPL_ID !== undefined
    ? [{ ...cartographer(), apply: "serve" as const }]
    : [];

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  plugins: replitPlugins,
  tanstackStart: {
    server: { entry: "server" },
  },
  // Replit preview is served through a proxied iframe on a different host,
  // so allow all hosts in dev. Bind explicitly to IPv4 (sandbox has no IPv6).
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      // The bun install cache (~86k files) lives inside the workspace at
      // .cache/. Vite's chokidar watcher tries to watch it recursively and
      // exhausts file descriptors (EMFILE), which can crash startup. Exclude it.
      watch: {
        ignored: ["**/.cache/**"],
      },
    },
    plugins: replitPlugins,
  },
});
