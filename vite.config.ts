// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// Custom plugins (extraPlugins below) must be passed via `vite: { plugins: ... }`
// ONLY, not also as a top-level `plugins:` key — defineConfig merges both without
// deduping, so passing the same array in both places runs every custom plugin
// twice (bit us once already: a resolveId hook double-prefixed its virtual ids).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cartographer } from "@replit/vite-plugin-cartographer";

// TanStack's server packages must be external only in the Nitro production
// bundle. Applying that rule to `vite dev` makes Node resolve the package
// directly, which bypasses Vite's virtual router-entry module and breaks
// server-function RPCs at runtime.
const isProductionBuild = process.argv.includes("build");

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

// `*.server.ts` files (orchestrator.server.ts, compress.server.ts, etc.) are
// only ever meant to run inside `createServerFn` handlers — the client bundle
// should just get TanStack Start's RPC-call stub for those, never the real
// implementation. In practice several `.functions.ts` files import their
// helpers at module scope, and when a helper is referenced across multiple
// `createServerFn` handlers in the same file, Rollup's client-side
// tree-shaking doesn't always fully elide the import — pulling Node builtins
// (node:crypto, node:fs/promises, node:child_process, ...) into the client
// graph and crashing the build ("X is not exported by __vite-browser-external").
// Rather than patch each leaking file one at a time, generically stub EVERY
// `*.server.ts`/`*.server.tsx` module out of the CLIENT build only (SSR build
// is untouched) — read its real named exports off disk and re-export inert
// throwing placeholders under the same names, so any client code that
// (incorrectly) still references them fails loudly at runtime instead of
// crashing the build. Mirrors the Monaco SSR stub above, for the opposite
// (client) build pass.
const serverFileClientStub = {
  name: "aurora:server-file-client-stub",
  enforce: "pre" as const,
  async resolveId(
    source: string,
    importer: string | undefined,
    options?: { ssr?: boolean },
  ): Promise<string | null> {
    if (options?.ssr) return null;
    if (source.startsWith("\0server-stub:")) return null;
    if (!/\.server(\.tsx?)?$/.test(source)) return null;
    // `this` is Vite's PluginContext (bound at runtime); cast to access .resolve.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolved: { id: string } | null = await (this as any).resolve(source, importer, { ...options, skipSelf: true });
    if (!resolved) return null;
    return "\0server-stub:" + resolved.id;
  },
  async load(id: string) {
    if (!id.startsWith("\0server-stub:")) return null;
    const realPath = id.slice("\0server-stub:".length);
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(realPath, "utf-8");
    const names = new Set<string>();
    for (const m of src.matchAll(
      /export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g,
    )) {
      names.add(m[1]);
    }
    for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*(?!from)/g)) {
      for (const part of m[1].split(",")) {
        const piece = part.trim();
        if (!piece) continue;
        const asMatch = piece.match(/(?:.*\sas\s+)?([A-Za-z0-9_$]+)\s*$/);
        if (asMatch) names.add(asMatch[1]);
      }
    }
    names.delete("default");
    const hasDefault = /export\s+default\s+/.test(src);
    const lines = [
      `const __stubThrow = () => { throw new Error(${JSON.stringify(
        realPath + " is server-only and was stubbed out of the client bundle",
      )}); };`,
    ];
    for (const name of names) {
      lines.push(`export const ${name} = __stubThrow;`);
    }
    if (hasDefault) lines.push("export default __stubThrow;");
    return lines.join("\n");
  },
};

// monacoSsrStub and serverFileClientStub use resolveId hooks that must live in
// vite.plugins (client-only). Do NOT add replitPlugins here — cartographer must
// be in the top-level plugins: key so it runs on BOTH the SSR and client bundles
// with identical output. If it only runs on client (via vite.plugins), the
// server renders elements without data-replit-metadata but the client adds them,
// causing a hydration mismatch on every page load.
const extraPlugins = [monacoSsrStub, serverFileClientStub];

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  // replitPlugins (cartographer) lives here — top-level plugins: covers BOTH
  // the SSR and client Vite environments, so the server and browser render
  // identical data-replit-metadata / data-component-name attributes.
  // It must NOT also appear in vite.plugins (via extraPlugins) — that would
  // run it twice on the client bundle and corrupt JSX with duplicate attrs,
  // causing "Invalid hook call" crashes (hit us before; see memory note).
  plugins: replitPlugins,
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
    // Pre-bundle heavy client-side dependencies so Vite doesn't have to
    // transform them lazily on first request — shaves several seconds off
    // the first meaningful paint on cold start.
    ssr: {
      // Keep TanStack's server namespace as a native Node import. Bundling
      // its export-star chain through Nitro can emit createRequestHandler as
      // an unbound identifier in the production SSR chunk.
      external: [
        ...(isProductionBuild
          ? [
              "@tanstack/react-start/server",
              "@tanstack/react-start-server",
              "@tanstack/start-server-core",
            ]
          : []),
      ],
    },
    optimizeDeps: {
      // Commit the first optimization run as soon as the deps are bundled
      // instead of holding it until the static-import crawl ends. In this app
      // the crawl never settles (TanStack Start's server-fn transform keeps
      // requests pending), so with the default `true` the optimizer piles up
      // deps_temp_* dirs forever, never renames one to deps/, and every
      // request for an optimized dep (react, zod, ...) hangs indefinitely —
      // the browser spins forever on first load.
      holdUntilCrawlEnd: false,
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "@tanstack/react-query",
        "@tanstack/react-router",
        // "@tanstack/react-start" must NEVER be listed here: force-including it
        // overrides the Start plugin's own optimizeDeps.exclude, so Vite
        // pre-bundles the raw package for the browser WITHOUT the plugin's
        // server-code-stripping transform. The bundle then executes
        // start-storage-context's top-level `new AsyncLocalStorage()` (a
        // node:async_hooks import) in the client, which throws under Vite's
        // browser-external stub and kills hydration app-wide — every button,
        // form submit, and nav handler silently dies (forms fall back to
        // native GET submits). Broke sign-in + sidebar in July 2026.
        "sonner",
        "lucide-react",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
        "zod",
        "@simplewebauthn/browser",
      ],
      // These are server-only packages that leak into the dep-optimizer crawl
      // through SSR server-fn transforms. Excluding them stops Vite from adding
      // them to the CLIENT optimized bundle on every restart, which would
      // invalidate bundle hashes and cause blank-screen flashes in browsers
      // that cached the previous hash set (notably mobile Safari).
      exclude: ["openai", "@google/genai", "@anthropic-ai/sdk", "@simplewebauthn/server"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      // The bun install cache (~86k files) lives inside the workspace at
      // .cache/. Vite's chokidar watcher tries to watch it recursively and
      // exhausts file descriptors (EMFILE), which can crash startup. Artifact
      // dependency/output trees are likewise independent apps and must not
      // consume the web preview's shared watcher budget.
      watch: {
        ignored: [
          "**/.cache/**",
          "**/artifacts/**/node_modules/**",
          "**/artifacts/**/store-assets/**",
        ],
      },
      // Pre-transform the hottest files during server startup instead of
      // waiting for the first request to trigger lazy compilation.
      // Client files become JS bundles; SSR files compile the server fns.
      // Order matters — root first, then highest-traffic routes, then the
      // heaviest server modules (orchestrator owns ~40% of cold-start time).
      warmup: {
        clientFiles: [
          // Shell — always needed
          "./src/routes/__root.tsx",
          "./src/components/MobileNav.tsx",
          // Landing (highest traffic, already fast — keep it first)
          "./src/routes/index.tsx",
          // Keep navigation destinations interactive without making SSR
          // compile every server-function module before the first response.
          "./src/routes/auth.lazy.tsx",
          "./src/routes/studio.lazy.tsx",
          "./src/routes/gallery.lazy.tsx",
          "./src/routes/motion.lazy.tsx",
          "./src/routes/canvas.lazy.tsx",
          "./src/routes/edit.lazy.tsx",
          "./src/routes/lipsync.lazy.tsx",
          "./src/routes/music-video.lazy.tsx",
          "./src/routes/clips.lazy.tsx",
          "./src/routes/billing.lazy.tsx",
          "./src/routes/avatar.lazy.tsx",
          "./src/routes/dashboard.lazy.tsx",
          "./src/routes/orchestrate.tsx",
          "./src/routes/agent.lazy.tsx",
          "./src/routes/spin.lazy.tsx",
        ],
        ssrFiles: [
          // Root + landing
          "./src/routes/__root.tsx",
          "./src/routes/index.tsx",
        ],
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
            // Move eagerly-imported route metadata files (loaders, beforeLoad,
            // validateSearch) out of the generic "index" entry chunk into a
            // dedicated "routes-meta" sync chunk so the landing-page entry is
            // smaller.  The actual component code lives in the per-route async
            // *.lazy.tsx chunks — those are NOT grouped here so each route
            // remains independently loadable on first navigation.
            if (id.includes("src/routes/") && !id.includes(".lazy.")) return "routes-meta";
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
