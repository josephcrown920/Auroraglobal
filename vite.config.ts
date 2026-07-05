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

// The playground's Monaco editor (src/components/playground/CodeEditor.tsx) is
// strictly client-only — the /editor route gates it behind a mounted check, so
// it can never render on the server. Without this stub, the SSR build still
// pulls the entire monaco-editor module graph (plus its ?worker bundles) into
// the server bundle, which OOMs `vite build` and bloats the deploy output.
// Replace the module with a null component in every SSR compile.
const monacoSsrStub = {
  name: "aurora:monaco-ssr-stub",
  enforce: "pre" as const,
  resolveId(id: string, _importer: string | undefined, options?: { ssr?: boolean }) {
    if (options?.ssr && id.includes("components/playground/CodeEditor")) {
      return "\0monaco-ssr-stub";
    }
    return null;
  },
  load(id: string) {
    if (id === "\0monaco-ssr-stub") {
      return "export default function CodeEditorSsrStub() { return null; }";
    }
    return null;
  },
};

const extraPlugins = [monacoSsrStub, ...replitPlugins];

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  plugins: extraPlugins,
  tanstackStart: {
    server: { entry: "server" },
  },
  // Production target: emit a standalone Node server (Nitro `node-server` preset)
  // that binds `process.env.PORT` and serves SSR + built client assets, so the app
  // can be published on Replit autoscale. Nitro only runs at command "build"
  // (never during `vite dev`), so this leaves the dev path untouched. Outside a
  // Lovable build (isSandbox=false here) this preset is honored instead of the
  // Cloudflare Workers default.
  nitro: { preset: "node-server" },
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
    // Split heavy, route-specific dependencies (charts, code editor, flow
    // diagrams, the Supabase client) into their own chunks instead of letting
    // them fall into whatever chunk first imports them. These libraries are
    // each used by only a handful of routes (admin/creator dashboard, the
    // playground editor, canvas), so keeping them isolated means the landing
    // page and other common routes don't pay for their weight on first load.
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "vendor-monaco";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("@xyflow")) return "vendor-xyflow";
            if (id.includes("@supabase")) return "vendor-supabase";
            return undefined;
          },
        },
      },
    },
    plugins: extraPlugins,
  },
});
