/**
 * Tutorial PDF generator.
 * Prints the live /tutorial page with Playwright and copies the result
 * to all three canonical PDF locations.
 *
 * Usage (from workspace root, with dev server running on :8080):
 *   bash scripts/regen-tutorial-pdf.sh
 *
 * Or directly:
 *   <node-from-available-pid2-node-paths> scripts/gen-tutorial-pdf.cjs
 */

"use strict";
const { chromium } = require("playwright-core");
const fs   = require("fs");
const path = require("path");

(async () => {
  const WORKSPACE = path.resolve(__dirname, "..");
  const TMP = path.join(WORKSPACE, "public", "_tutorial-guide-tmp.pdf");

  const DESTINATIONS = [
    path.join(WORKSPACE, "public", "tutorial-guide.pdf"),
    path.join(WORKSPACE, "public", "Aurora-Studio-Tutorial-Guide.pdf"),
    path.join(WORKSPACE, "artifacts", "web", "public", "Aurora-Studio-Tutorial-Guide.pdf"),
  ];

  // Verify each destination directory exists (create if needed)
  for (const dest of DESTINATIONS) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
  }

  console.log("Launching Chromium…");
  const browser = await chromium.launch({
    executablePath:
      "/home/runner/workspace/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  console.log("Navigating to http://localhost:8080/tutorial …");
  await page.goto("http://localhost:8080/tutorial", {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForSelector("text=Aurora Studio", { timeout: 30_000 });
  await page.waitForTimeout(3000); // let fonts settle

  console.log("Generating PDF…");
  await page.pdf({
    path: TMP,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();

  console.log("Copying to all public locations:");
  for (const dest of DESTINATIONS) {
    fs.copyFileSync(TMP, dest);
    console.log("  ✓ " + path.relative(WORKSPACE, dest));
  }
  fs.unlinkSync(TMP);

  console.log("\nDone. Tutorial PDF updated at all 3 locations.");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
