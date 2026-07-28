import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Run setup before any test file so module-level env captures see the right values
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    conditions: ["import", "default"],
  },
});
