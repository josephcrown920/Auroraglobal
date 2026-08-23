import { expect, test } from "@playwright/test";

test("landing page renders Aurora", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle(/Aurora/i);
  await expect(page.locator("body")).toContainText(/Aurora/i);
});
