import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "8080";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // GitHub Actions does not provide Replit's available-pid2-node-paths helper.
      // Use the root install so CI never needs to install the nested artifact's
      // Replit-specific dependency lockfile.
      command: `bash -lc 'NODE_OPTIONS=--max-old-space-size=3072 node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port ${PORT}'`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Aurora Adult is an artifact in the same repository. Start it with the
      // root Vite installation; its config owns the artifact source/aliases.
      // This avoids artifacts/aurora-adult/package-lock.json, which contains
      // Replit-only package-firewall URLs and cannot be resolved on GitHub CI.
      command:
        "bash -lc 'PORT=8085 BASE_PATH=/aurora-adult/ AURORA_DEV_URL=http://localhost:8080 node_modules/vite/bin/vite.js dev --config artifacts/aurora-adult/vite.config.ts --host 0.0.0.0 --port 8085'",
      url: "http://localhost:8085/aurora-adult/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
