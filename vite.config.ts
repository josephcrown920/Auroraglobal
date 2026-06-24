// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Replit preview is served through a proxied iframe on a different host,
  // so allow all hosts in dev. Bind explicitly to IPv4 (sandbox has no IPv6).
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      // Sandbox has a 65k inotify watch ceiling. Vite/TanStack otherwise watch the
      // entire repo (node_modules ~36k files, backups, vcs) and exhaust it, which
      // breaks sibling dev servers (e.g. the Expo mobile artifact). Watching source
      // is all we need for HMR; node_modules is excluded by Vite's default anyway.
      watch: {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/artifacts/**",
          "**/.scaffold-backup/**",
          "**/.local/**",
          "**/dist/**",
          "**/dist-ssr/**",
          "**/.tanstack/**",
          "**/.cache/**",
          "**/.wrangler/**",
        ],
      },
    },
  },
});
