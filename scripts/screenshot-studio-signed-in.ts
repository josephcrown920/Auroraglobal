/**
 * One-off visual check: render /studio as the signed-in QA user and save a
 * screenshot. Reuses get-test-session (magic-link exchange, no passwords).
 *
 *   bun run scripts/screenshot-studio-signed-in.ts
 */
import { chromium } from "playwright";
import { getTestSession } from "./lib/get-test-session";

const { session } = await getTestSession();
const ref = new URL(process.env.SUPABASE_URL!).hostname.split(".")[0];
const storageKey = `sb-${ref}-auth-token`;
const payload = JSON.stringify(session);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.addInitScript(
    ([k, v]: string[]) => window.localStorage.setItem(k, v),
    [storageKey, payload],
  );
  await page.goto("http://localhost:8080/studio", { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Give auth + queries a moment to settle.
  await page.waitForTimeout(6_000);
  // Dismiss first-run onboarding if it appears so the hero is visible.
  const skip = page.getByText("Skip for now");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(1_500);
  }
  await page.screenshot({ path: "/tmp/studio-signed-in.png" });
  console.log("saved /tmp/studio-signed-in.png");
} finally {
  await browser.close();
}
