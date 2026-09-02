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
  webServer: {
    // CI only needs the canonical Aurora app. Start Vite directly instead of
    // wrapping the command in nested shell quotes; Playwright already launches
    // webServer commands through a shell and nested quotes broke CI startup.
    command: `NODE_OPTIONS=--max-old-space-size=3072 node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
