import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? 8085);
const basePath = process.env.BASE_PATH ?? "/aurora-adult/";
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
      "/api/public/generate": { target: auroraUrl, changeOrigin: true },
      "/api/public/watermark-image": { target: auroraUrl, changeOrigin: true },
      "/api/public/watermark-video": { target: auroraUrl, changeOrigin: true },
    },
  },
  preview: { port, host: "0.0.0.0", allowedHosts: true },
  define: {
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
    // Admin passcode — used by AdminGate; sessionStorage-gated after first unlock.
    // Reading from the same ADMIN_PASSCODE secret the main app uses.
    "import.meta.env.VITE_ADMIN_PASSCODE": JSON.stringify(
      process.env.VITE_ADMIN_PASSCODE ?? process.env.ADMIN_PASSCODE ?? ""
    ),
  },
});
