import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "8080";
const VITE_SERVER_COMMAND = `${JSON.stringify(process.execPath)} node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${PORT}`;

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
  webServer: {
    // Launch Vite through the same Node binary that loaded Playwright. This works
    // on GitHub-hosted runners and Replit without relying on a shell-only helper.
    // NODE_OPTIONS caps the dev server's heap so a heavy suite cannot OOM the host.
    command: `NODE_OPTIONS=--max-old-space-size=3072 ${VITE_SERVER_COMMAND}`,
    // reuseExistingServer + url polling also makes the parallel "Project" workflow
    // safe: if the "Start application" workflow already owns port 8080, Playwright
    // reuses it; otherwise Playwright boots its own server and waits for readiness.
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
