// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cartographer } from "@replit/vite-plugin-cartographer";

// Replit Visual Edits: inject source-mapping metadata (data-replit-metadata) so the
// click-to-edit tool can resolve any element to its exact JSX source line.
// Gated on REPL_ID — only active inside the Replit dev environment; absent from
// production Cloudflare builds where REPL_ID is not set.
const replitPlugins = process.env.REPL_ID ? [cartographer()] : [];

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
    },
    plugins: replitPlugins,
  },
});
