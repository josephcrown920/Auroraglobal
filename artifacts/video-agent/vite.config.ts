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
    // Bake the Aurora URL into the production bundle
    "import.meta.env.VITE_AURORA_URL": JSON.stringify(process.env.VITE_AURORA_URL ?? ""),
  },
});
