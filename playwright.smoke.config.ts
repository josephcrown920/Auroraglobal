import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "8080";

export default defineConfig({
  testDir: "./e2e/smoke",
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
  // The full E2E configuration also starts the separately deployed Adult
  // School artifact. Public smoke must remain independent of that artifact
  // and its private backend configuration so it can run on every main PR.
  webServer: {
    command: `bash -c 'NODE_OPTIONS=--max-old-space-size=3072 "$(available-pid2-node-paths | head -1)" node_modules/vite/bin/vite.js dev --host 0.0.0.0 --port ${PORT}'`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
