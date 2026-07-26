// Uses the same Lovable/TanStack Start config wrapper as the main Aurora app.
// Replit-specific overrides: bind 0.0.0.0 (not IPv6 ::), allow all proxy hosts,
// skip the LFS crawl deadlock, and read PORT from the environment.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: { preset: "node-server" },
  vite: {
    optimizeDeps: {
      // Commit the dep bundle as soon as it's ready — TanStack Start's
      // server-fn transform keeps requests pending so the crawl never settles,
      // causing deps_temp_* dirs to pile up and imports to hang indefinitely.
      holdUntilCrawlEnd: false,
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "sonner",
        "lucide-react",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
        "zod",
      ],
      // "@tanstack/react-start" must NOT be listed — force-including it
      // overrides the Start plugin's exclude, putting AsyncLocalStorage into
      // the client bundle and killing every button/form/nav handler.
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      watch: { ignored: ["**/.cache/**"] },
    },
    plugins: [],
  },
});
