import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "8080";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // One retry absorbs transient dev-server hiccups (vite SSR restarts, slow auth
  // round-trips) so the validation gate reports real regressions, not infra blips.
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: "**/mobile-usability.e2e.ts",
      use: {
        // Preserve Playwright's pre-project default so existing desktop coverage
        // continues to exercise the same viewport it did before this config grew projects.
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "mobile",
      testMatch: "**/mobile-usability.e2e.ts",
      use: {
        // iPhone SE's narrow viewport catches fixed-width and overflow regressions.
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      // Use the same node-path-aware command as the "Start application" workflow so
      // that Playwright can boot the dev server itself when reuseExistingServer misses
      // (e.g. the workflow hasn't started yet).  reuseExistingServer: true means this
      // command is skipped entirely when port 8080 is already open.
      // Wrapped in bash -c so available-pid2-node-paths (which uses set -o pipefail)
      // runs under bash rather than /bin/sh which Playwright uses by default.
      // NODE_OPTIONS caps the dev server's heap: this container has OOM-killed heavy
      // node processes before, and a mid-suite server death shows up as
      // ERR_CONNECTION_REFUSED in every remaining test.
      command: `bash -c 'NODE_OPTIONS=--max-old-space-size=3072 "$(available-pid2-node-paths | head -1)" node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port ${PORT}'`,
      // reuseExistingServer + url polling also makes the parallel "Project" workflow
      // safe: if the "Start application" workflow already owns port 8080, Playwright
      // reuses it; otherwise Playwright boots its own server and waits for readiness.
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Adult School is a separately registered artifact. Its Vite base path and
      // port must be explicit so the test exercises the same /aurora-adult/
      // artifact route that users get through the shared preview proxy.
      command:
        "bash -c 'PORT=8085 BASE_PATH=/aurora-adult/ AURORA_DEV_URL=http://localhost:8080 artifacts/aurora-adult/start-dev.sh'",
      url: "http://localhost:8085/aurora-adult/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
