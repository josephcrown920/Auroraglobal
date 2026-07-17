import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? 8082);
const basePath = process.env.BASE_PATH ?? "/video-agent/";
// In development the proxy forwards API calls to the running Aurora backend.
// In production set VITE_AURORA_URL to your deployed Aurora instance.
const auroraUrl = process.env.AURORA_DEV_URL ?? "http://localhost:8080";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      // Forward /api/video-agent/* → Aurora backend (dev only)
      "/api/video-agent": { target: auroraUrl, changeOrigin: true },
    },
  },
  preview: { port, host: "0.0.0.0", allowedHosts: true },
  define: {
    // Bake runtime env into the production bundle.
    // VITE_SUPABASE_PUBLISHABLE_KEY is the shared-env name; ANON_KEY is the
    // legacy alias used by this artifact's supabase.ts.
    "import.meta.env.VITE_AURORA_URL": JSON.stringify(process.env.VITE_AURORA_URL ?? ""),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
    ),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      ""
    ),
  },
});
