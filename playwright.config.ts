import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || "8080";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "vite dev --host 0.0.0.0 --port " + PORT,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
