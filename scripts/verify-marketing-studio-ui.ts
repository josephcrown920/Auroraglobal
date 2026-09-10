/**
 * Browser walk-through of /admin/social-studio as the signed-in QA admin.
 * Drives the real UI: brief → campaign → one visual → one Reel → calendar →
 * publish queue → copy/export/download, saving screenshots at desktop and
 * phone widths under /tmp/marketing-studio/.
 *
 * Default: a synthetic saved-campaign fixture; NO generation calls.
 * LIVE_CAMPAIGN=1 opts into a real paid planner call.
 * LIVE_RENDERS=1 ALSO requires LIVE_CAMPAIGN=1 and opts into image/video spend.
 * Real generations SPEND real Aura + provider budget — admin accounts are
 * NOT exempt on the studio render paths (reserve_credits has no admin bypass).
 * SKIP_RENDERS=1 always disables renders, but not an opted-in paid planner.
 *
 *   bun run scripts/verify-marketing-studio-ui.ts
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { getTestSession } from "./lib/get-test-session";
import { marketingStudioFixture } from "./lib/marketing-studio-fixture";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8080";
const OUT = "/tmp/marketing-studio";
const POSTS = 2;
const liveCampaign = process.env.LIVE_CAMPAIGN === "1";
const liveRenders = liveCampaign && process.env.LIVE_RENDERS === "1" && process.env.SKIP_RENDERS !== "1";
let reelOutcome: "not-tested" | "passed" | "blocked" = "not-tested";
const runtimeErrors: string[] = [];
mkdirSync(OUT, { recursive: true });

const { session } = await getTestSession();
const ref = new URL(process.env.SUPABASE_URL!).hostname.split(".")[0];
const storageKey = `sb-${ref}-auth-token`;
const payload = JSON.stringify(session);

function fail(msg: string): never {
  throw new Error(msg);
}

async function newPage(width: number, height: number, seedCampaign?: string | null): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true });
  await context.addInitScript(
    ([k, v, ck, cv]: Array<string | null>) => {
      window.localStorage.setItem(k!, v!);
      if (ck && cv) window.localStorage.setItem(ck, cv);
    },
    [storageKey, payload, seedCampaign ? "aurora.marketing_studio.campaign.v2" : null, seedCampaign ?? null],
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => { runtimeErrors.push(error.message); console.log("  [pageerror]", error.message); });
  if (!liveCampaign) {
    // This walk-through should never click generation controls. Fail closed if it does.
    await page.route("**/_serverFn/**", async (route) => {
      const encoded = new URL(route.request().url()).pathname.split("/").pop() ?? "";
      let rpcExport = "";
      try {
        rpcExport = JSON.parse(Buffer.from(decodeURIComponent(encoded), "base64").toString("utf8")).export ?? "";
      } catch { /* Unknown POST identifiers are blocked in fixture mode. */ }
      const generation = /^(generateMarketingCampaign|generatePerformanceShot|generateVideoFromImage)(_|$)/.test(rpcExport);
      if (route.request().method() === "POST" && (!rpcExport || generation)) {
        runtimeErrors.push("Unexpected server mutation in fixture-only verification");
        await route.abort();
      } else await route.continue();
    });
  }
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/hydrat|didn't match/i.test(msg.text())) console.log("  [console.error]", msg.text().slice(0, 200));
  });
  return page;
}

const browser = await chromium.launch();
try {
  console.log("── desktop 1440×900 ──");
  const page = await newPage(1440, 900);
  await page.goto(`${BASE}/admin/social-studio`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByRole("heading", { name: "Marketing Studio" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2_500);
  // Fresh run: make sure no stale campaign is loaded.
  const newButton = page.getByRole("button", { name: "New campaign" });
  if (await newButton.isVisible().catch(() => false)) {
    await newButton.click();
    await page.waitForTimeout(500);
  }
  await page.getByText("1 · Choose what Aurora is promoting").waitFor({ timeout: 20_000 });
  await page.screenshot({ path: `${OUT}/01-desktop-brief.png`, fullPage: true });

  if (liveCampaign) {
  // Brief: Video Agent, 2 posts over 2 days, feed + reel.
  await page.getByRole("button", { name: /Video Agent/ }).first().click();
  const carousel = page.getByRole("button", { name: /Carousel/ });
  if ((await carousel.getAttribute("aria-pressed")) === "true") await carousel.click();
  await page.getByLabel("Campaign days").fill("2");
  await page.getByLabel("Number of posts").fill(String(POSTS));
  await page.getByLabel("Creative direction (optional)").fill("Make post 1 a Reel and post 2 a feed post. Lead with the brief-to-shot transformation.");
  await page.getByRole("button", { name: `Build ${POSTS}-post campaign` }).click();
  console.log("  building campaign…");
  await page.getByText(`${POSTS} posts`, { exact: true }).waitFor({ timeout: 200_000 });
  } else {
    await page.evaluate((fixture) => {
      window.localStorage.setItem("aurora.marketing_studio.campaign.v2", JSON.stringify(fixture));
    }, marketingStudioFixture);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(`${POSTS} posts`, { exact: true }).waitFor({ timeout: 60_000 });
    console.log("  ✓ synthetic campaign loaded; generation not tested");
  }
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: `${OUT}/02-desktop-campaign.png`, fullPage: true });
  const cards = page.locator("article");
  const count = await cards.count();
  console.log(`  ✓ campaign ready with ${count} cards`);
  if (count !== POSTS) fail(`expected ${POSTS} cards, got ${count}`);

  // Copy post → clipboard.
  await cards.first().getByRole("button", { name: "Copy post" }).click();
  await page.getByText("Caption and hashtags copied").waitFor({ timeout: 10_000 });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  if (!clip.includes("#")) fail("clipboard copy did not include hashtags");
  console.log("  ✓ copy post → clipboard");

  // Export manifest → real download event.
  const [manifest] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  console.log(`  ✓ manifest download: ${manifest.suggestedFilename()}`);

   if (liveRenders) {
    // Visual on the first non-reel card (or any card).
    const feedCard = cards.filter({ hasNot: page.getByRole("button", { name: "Generate 5s Reel" }) }).first();
    const visualTarget = (await feedCard.count()) ? feedCard : cards.first();
    await visualTarget.getByRole("button", { name: /Generate (visual|slides)/ }).click();
    console.log("  generating visual…");
    await page.getByText(/visuals? ready/).waitFor({ timeout: 360_000 });
    const src = await visualTarget.locator("img").first().getAttribute("src");
    if (!src || src.startsWith("/")) fail(`visual did not replace the reference image (src=${src})`);
    console.log("  ✓ visual rendered");

    // Reel on a reel card if the plan produced one.
    const reelCard = cards.filter({ has: page.getByRole("button", { name: "Generate 5s Reel" }) }).first();
    if (await reelCard.count()) {
      await reelCard.getByRole("button", { name: "Generate 5s Reel" }).click();
      console.log("  generating reel (image + video)…");
      const success = page.getByText(/Reel (preview )?rendered/);
      const errorToast = page.locator("[data-sonner-toast][data-type='error']");
      await Promise.race([
        success.waitFor({ timeout: 600_000 }),
        errorToast.first().waitFor({ timeout: 600_000 }),
      ]);
      if (await success.isVisible().catch(() => false)) {
        const video = await reelCard.locator("video").getAttribute("src");
        if (!video) fail("reel card has no video element after render");
        reelOutcome = "passed";
        console.log("  ✓ reel rendered");
      } else {
        const text = (await errorToast.first().innerText()).replace(/\s+/g, " ").trim();
        console.log(`  ! reel blocked by provider/account error (surfaced to the operator as a toast): ${text}`);
        reelOutcome = "blocked";
        await page.screenshot({ path: `${OUT}/03b-desktop-reel-error.png` });
      }
    } else {
      console.log("  ! plan produced no Reel card — reel path not exercised in this run");
    }
    await page.screenshot({ path: `${OUT}/03-desktop-campaign-rendered.png`, fullPage: true });

    // Download assets → at least one download event.
    await page.getByRole("button", { name: "Publish queue" }).click();
    const [asset] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("button", { name: "Download assets" }).click(),
    ]);
    console.log(`  ✓ asset download: ${asset.suggestedFilename()}`);
    await page.getByText(/campaign assets? downloaded/).waitFor({ timeout: 60_000 });
  }

  // Review transitions: approve → schedule → published.
  await page.getByRole("button", { name: "Campaign", exact: true }).click();
  const firstTitle = (await cards.first().getByRole("heading", { level: 3 }).textContent())?.trim() ?? "";
  await page.getByLabel(`Workflow status for ${firstTitle}`).selectOption("approved");
  await cards.first().locator('input[type="date"]').fill("2026-09-15");
  if ((await page.getByLabel(`Workflow status for ${firstTitle}`).inputValue()) !== "approved") fail("date assignment unexpectedly changed the review status");
  await page.getByLabel(`Workflow status for ${firstTitle}`).selectOption("scheduled");
  await page.getByRole("button", { name: "Calendar" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/04-desktop-calendar.png`, fullPage: true });
  await page.getByRole("button", { name: "Publish queue" }).click();
  const status = page.getByLabel(`Publishing status for ${firstTitle}`);
  if ((await status.inputValue()) !== "scheduled") fail("explicit scheduled status was not retained");
  await status.selectOption("published");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/05-desktop-queue.png`, fullPage: true });
  console.log("  ✓ draft → approved → scheduled → published");

  // Persistence: reload keeps the campaign and the published state.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(`${POSTS} posts`, { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Publish queue" }).click();
  if ((await page.getByLabel(`Publishing status for ${firstTitle}`).inputValue()) !== "published") fail("status lost on reload");
  console.log("  ✓ campaign survives reload");
  const stored = await page.evaluate(() => window.localStorage.getItem("aurora.marketing_studio.campaign.v2"));
  await page.context().close();

  console.log("── phone 390×844 ──");
  let phone = await newPage(390, 844, stored);
  await phone.goto(`${BASE}/admin/social-studio`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await phone.getByText(`${POSTS} posts`, { exact: true }).waitFor({ timeout: 60_000 });
  await phone.waitForTimeout(1_500);
  await phone.screenshot({ path: `${OUT}/06-phone-campaign.png`, fullPage: true });
  await phone.getByRole("button", { name: "Calendar" }).click();
  await phone.waitForTimeout(400);
  await phone.screenshot({ path: `${OUT}/07-phone-calendar.png`, fullPage: true });
  await phone.getByRole("button", { name: "Publish queue" }).click();
  await phone.waitForTimeout(400);
  await phone.screenshot({ path: `${OUT}/08-phone-queue.png`, fullPage: true });
  await phone.context().close();

  // Narrow phones (320/360): the campaign grid must not overflow horizontally.
  for (const width of [360, 320]) {
    const narrow = await newPage(width, 780, stored);
    await narrow.goto(`${BASE}/admin/social-studio`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await narrow.getByText(`${POSTS} posts`, { exact: true }).waitFor({ timeout: 60_000 });
    await narrow.waitForTimeout(800);
    const overflow = await narrow.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`horizontal overflow of ${overflow}px at ${width}px wide`);
    await narrow.screenshot({ path: `${OUT}/10-phone-${width}-campaign.png`, fullPage: false });
    await narrow.context().close();
  }
  console.log("  ✓ no horizontal overflow at 360px / 320px");

  phone = await newPage(390, 844, stored);
  await phone.goto(`${BASE}/admin/social-studio`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await phone.getByText(`${POSTS} posts`, { exact: true }).waitFor({ timeout: 60_000 });
  await phone.getByRole("button", { name: "New campaign" }).click();
  await phone.getByText("1 · Choose what Aurora is promoting").waitFor({ timeout: 20_000 });
  await phone.screenshot({ path: `${OUT}/09-phone-brief.png`, fullPage: true });
  console.log("  ✓ phone views captured; New campaign resets to the brief");
  await phone.context().close();
  if (runtimeErrors.length) fail(`${runtimeErrors.length} browser runtime error(s)`);
  console.log(`── UI CHECKS PASS · planner: ${liveCampaign ? "live" : "NOT TESTED (fixture)"} · renders: ${liveRenders ? "live" : "NOT TESTED"} · Reel: ${reelOutcome.toUpperCase()} ──`);
  if (liveRenders && reelOutcome !== "passed") process.exitCode = 2;
} finally {
  await browser.close();
}
