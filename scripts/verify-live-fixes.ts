/**
 * Verify two shipped fixes against a running Aurora origin (dev or production):
 *
 *   1. Landing hero renders full-opacity stills only — no ambient <video>
 *      layered underneath the slideshow (the "stuck clip").
 *   2. The signed-in global nav (desktop sidebar + mobile drawer) lists
 *      "Director's Room" exactly once and none of its internal tool labels.
 *
 * Reuses get-test-session (magic-link exchange, no passwords). The QA user
 * lives in the same Supabase project as production, so the same script works
 * against the live site.
 *
 *   bun run scripts/verify-live-fixes.ts                       # dev server
 *   BASE_URL=https://auroraperformancestudio.com \
 *     bun run scripts/verify-live-fixes.ts                     # live site
 *
 * Screenshots land in /tmp/verify-live-fixes/<label>-*.png.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { getTestSession } from "./lib/get-test-session";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const LABEL = process.env.LABEL ?? new URL(BASE_URL).hostname.replace(/[^a-z0-9.-]/gi, "_");
const OUT = "/tmp/verify-live-fixes";
mkdirSync(OUT, { recursive: true });

const DIRECTOR_TOOLS = [
  "Wardrobe",
  "Scenes",
  "Layers",
  "Storyboard",
  "Moodboard",
  "Scene Weaver",
  "Style Transfer",
  "Soundweaver",
];

const failures: string[] = [];
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};

async function checkHero(page: Page, viewport: string) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("header img", { timeout: 60_000 });
  const stats = await page.evaluate(() => {
    const header = document.querySelector("header");
    const videos = header ? Array.from(header.querySelectorAll("video")) : [];
    const stills = header ? header.querySelectorAll("img").length : 0;
    return {
      hasHeader: Boolean(header),
      videoSrcs: videos.map((v) => v.getAttribute("src") ?? v.querySelector("source")?.getAttribute("src") ?? "?"),
      stills,
    };
  });
  if (!stats.hasHeader) bad(`[${viewport}] landing hero <header> not found`);
  if (stats.videoSrcs.length === 0) ok(`[${viewport}] hero has no video layer`);
  else bad(`[${viewport}] hero still contains video: ${stats.videoSrcs.join(", ")}`);
  if (stats.stills > 0) ok(`[${viewport}] hero renders ${stats.stills} still image(s)`);
  else bad(`[${viewport}] hero renders no still images`);
  await page.screenshot({ path: `${OUT}/${LABEL}-hero-${viewport}.png` });
}

async function checkNav(page: Page, viewport: "phone" | "desktop") {
  await page.goto(`${BASE_URL}/studio`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(6_000);
  const skip = page.getByText("Skip for now");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(1_000);
  }
  if (viewport === "phone") {
    const trigger = page.getByRole("button", { name: "Open navigation menu" });
    await trigger.first().click({ timeout: 30_000 });
    await page.waitForTimeout(800);
  }
  const nav = page.locator('nav[aria-label="All features"]:visible').first();
  const visible = await nav.isVisible().catch(() => false);
  if (!visible) {
    bad(`[${viewport}] signed-in nav not visible (is the session valid?)`);
    await page.screenshot({ path: `${OUT}/${LABEL}-nav-${viewport}.png` });
    return;
  }
  const labels = await nav.locator("a, button").allInnerTexts();
  const norm = labels.map((l) => l.replace(/\s+/g, " ").trim());
  const directorCount = norm.filter((l) => /Director[’']s Room/.test(l)).length;
  if (directorCount === 1) ok(`[${viewport}] nav lists Director's Room exactly once`);
  else bad(`[${viewport}] nav lists Director's Room ${directorCount}× (expected 1)`);
  const leaked = DIRECTOR_TOOLS.filter((tool) => norm.some((l) => l === tool || l.startsWith(`${tool} `)));
  if (leaked.length === 0) ok(`[${viewport}] no Director's Room sub-tools in the global nav`);
  else bad(`[${viewport}] Director's Room sub-tools leaked into nav: ${leaked.join(", ")}`);
  await page.screenshot({ path: `${OUT}/${LABEL}-nav-${viewport}.png` });
}

const { session } = await getTestSession();
const ref = new URL(process.env.SUPABASE_URL!).hostname.split(".")[0];
const storageKey = `sb-${ref}-auth-token`;
const payload = JSON.stringify(session);

console.log(`Verifying ${BASE_URL}`);
const browser = await chromium.launch();
try {
  for (const [viewport, size] of [
    ["phone", { width: 390, height: 844 }],
    ["desktop", { width: 1366, height: 768 }],
  ] as const) {
    const page = await browser.newPage({ viewport: size });
    await checkHero(page, viewport);
    await page.close();
  }
  for (const viewport of ["phone", "desktop"] as const) {
    const page = await browser.newPage({
      viewport: viewport === "phone" ? { width: 390, height: 844 } : { width: 1366, height: 768 },
    });
    await page.addInitScript(([k, v]: string[]) => window.localStorage.setItem(k, v), [storageKey, payload]);
    await checkNav(page, viewport);
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed for ${BASE_URL}`);
  process.exit(1);
}
console.log(`\nAll checks passed for ${BASE_URL} — screenshots in ${OUT}/${LABEL}-*.png`);
