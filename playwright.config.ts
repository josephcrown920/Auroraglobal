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
      // Use the runner's Node directly so Playwright can start Vite in CI.
      command: `bash -lc 'NODE_OPTIONS=--max-old-space-size=3072 node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port ${PORT}'`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        "bash -c 'PORT=8085 BASE_PATH=/aurora-adult/ AURORA_DEV_URL=http://localhost:8080 artifacts/aurora-adult/start-dev.sh'",
      url: "http://localhost:8085/aurora-adult/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
