import fs from "node:fs";
import { test, expect, type Page, type Browser, type BrowserContext } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { waitForAppHydration } from "./helpers/auth";

/**
 * Marketing Studio (/ugc) end-to-end verification — drives the REAL UI with a
 * real signed-in admin session through every generation path the page offers:
 *
 *   1. performance-shot still     (queued image job via generatePerformanceShot)
 *   2. animate the still          (queued video job via generateVideoFromImage)
 *   3. talking UGC ad + own voice (voice upload to the studio bucket, then the
 *                                 queued ugc_ad pipeline: script → voice →
 *                                 video → lip-sync via generateUGCAd)
 *   4. narrated product demo      (queued product_demo pipeline via HeyGen)
 *
 * These tests spend real provider credits and depend on provider account health
 * (xAI/HeyGen/fal balances), so the file is OPT-IN: the default e2e gate run
 * skips it entirely. Run it deliberately:
 *
 *   UGC_E2E=1 npx playwright test e2e/ugc-studio.e2e.ts --project=desktop
 *
 * For cheap recurring checks of the same QUEUED dispatch paths, use the admin
 * smoke suite (/admin/smoke) — steps 22 ("UGC talking ad (queued pipeline)")
 * and 23 ("Product demo (queued pipeline)") call the same _enqueueUGCAd /
 * _enqueueProductDemo helpers the UI's server fns use.
 *
 * Serial + no retries on purpose: a failing stage must not burn paid retries,
 * and serial mode skips the remaining stages when an earlier one fails.
 * Every run provisions a fresh QA admin and tears it down in afterAll
 * (role, fixtures, storage, auth user) so paid runs never accumulate
 * privileged funded accounts.
 */

// Paid, provider-dependent suite — opt in explicitly with UGC_E2E=1. Without it
// every test in this file is skipped and beforeAll never provisions anything.
test.skip(
  !process.env.UGC_E2E,
  "Set UGC_E2E=1 to run the paid Marketing Studio verification (spends provider credits).",
);

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error(
    "ugc-studio.e2e.ts requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY.",
  );
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const SESSION_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const TEST_PASSWORD = `UgcStudioE2e!${Math.random().toString(36).slice(2, 10)}`;
const VOICE_WAV_PATH = "/tmp/ugc-e2e-voice.wav";

let qaAdmin: { email: string; id: string; session: Session } | null = null;
const contexts: BrowserContext[] = [];

/** Minimal 2s mono 8kHz sine WAV — stands in for the creator's voice track. */
function writeSineWav(path: string, seconds = 2, freq = 440) {
  const rate = 8000;
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.sin((i / rate) * freq * 2 * Math.PI) * 12000), 44 + i * 2);
  }
  fs.writeFileSync(path, buf);
}

test.beforeAll(async () => {
  const email = `ugc-studio-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@aurora-sandbox-qa.com`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "UGC Studio E2E" },
  });
  if (error || !data.user) throw new Error(`Failed to create QA user: ${error?.message}`);
  // Track the id immediately so afterAll cleans up even if a later step fails.
  qaAdmin = { email, id: data.user.id, session: null as unknown as Session };
  const { error: roleErr } = await adminClient
    .from("user_roles")
    .insert({ user_id: data.user.id, role: "admin" });
  if (roleErr) throw new Error(`Failed to grant admin role: ${roleErr.message}`);
  // Top up the QA account: the 50-Aura signup grant covers two stills at most,
  // while the animate preview pass is 50, the talking ad 280 and the product
  // demo 320. This suite verifies the PIPELINE, not the balance check.
  const { error: creditErr } = await adminClient
    .from("profiles")
    .update({ credits: 10_000 })
    .eq("user_id", data.user.id);
  if (creditErr) throw new Error(`Failed to fund QA user: ${creditErr.message}`);
  const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInErr || !signIn.session) throw new Error(`QA sign-in failed: ${signInErr?.message}`);
  qaAdmin.session = signIn.session;
  writeSineWav(VOICE_WAV_PATH);
});

test.afterAll(async () => {
  // Close every browser context this suite opened (pages alone leak contexts).
  for (const c of contexts.splice(0)) await c.close().catch(() => {});
  const id = qaAdmin?.id;
  if (!id) return;
  // Storage fixtures staged during the run (avatars + uploaded voice track).
  try {
    for (const folder of ["ugc", "smoke"]) {
      const { data: files } = await adminClient.storage.from("studio").list(`${id}/${folder}`);
      if (files?.length) {
        await adminClient.storage
          .from("studio")
          .remove(files.map((f) => `${id}/${folder}/${f.name}`));
      }
    }
  } catch { /* best-effort fixture cleanup */ }
  // Drop the privilege grant first so a deletion failure never leaves an admin.
  try {
    await adminClient.from("user_roles").delete().eq("user_id", id);
  } catch { /* best-effort */ }
  let deleted = true;
  try {
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) deleted = false;
  } catch {
    deleted = false;
  }
  if (!deleted) {
    // FK references (jobs/generations/ledger rows this run created) can block
    // auth-user deletion — defund so no funded account lingers either way.
    try {
      await adminClient.from("profiles").update({ credits: 0 }).eq("user_id", id);
    } catch { /* best-effort */ }
  }
});

/** Open /ugc as the QA admin (localStorage session injection, no /auth dance). */
async function openUgcStudio(browser: Browser): Promise<Page> {
  if (!qaAdmin) throw new Error("QA admin was not provisioned");
  const context = await browser.newContext();
  contexts.push(context);
  await context.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: SESSION_STORAGE_KEY, session: qaAdmin.session },
  );
  const page = await context.newPage();
  await page.goto("/ugc", { waitUntil: "domcontentloaded" });
  await waitForAppHydration(page);
  // FeatureGuard passes only after the SERVER-verified admin check settles —
  // wait for the real page content, not the redirect spinner.
  await expect(
    page.getByRole("heading", { name: /pick an avatar\. ship ugc\./i }),
  ).toBeVisible({ timeout: 60_000 });
  return page;
}

async function fillProductPrompt(page: Page) {
  await page
    .getByPlaceholder(/glossy red lipstick/i)
    .fill("holding a glossy red lipstick label-out near her cheek, smiling at the camera");
}

test.describe.configure({ mode: "serial", retries: 0 });

test("ugc studio renders avatar picker, scene picker, and generator for an admin", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await openUgcStudio(browser);

  // Step 1: avatar gallery is selectable.
  const luna = page.getByRole("button", { name: /luna/i }).first();
  await luna.click();
  await expect(luna).toHaveAttribute("class", /border-primary/);

  // Step 2: scene presets are selectable.
  const cafe = page.getByRole("button", { name: /cafe lifestyle/i });
  await cafe.click();
  await expect(cafe).toHaveAttribute("aria-pressed", "true");

  // Step 3: the three generation CTAs are present and enabled for a signed-in user.
  await fillProductPrompt(page);
  await expect(page.getByRole("button", { name: /generate ugc shot/i })).toBeEnabled();
  await expect(page.getByRole("button", { name: /generate talking ad/i })).toBeEnabled();
  await page.close();
});

test("still generation completes and shows the result image", async ({ browser }) => {
  test.setTimeout(8 * 60_000);
  const page = await openUgcStudio(browser);
  await fillProductPrompt(page);

  await page.getByRole("button", { name: /generate ugc shot/i }).click();
  // The shot appears in the result panel once the queued image job finishes.
  await expect(page.getByRole("img", { name: "UGC result" })).toBeVisible({ timeout: 6 * 60_000 });
  await page.close();
});

test("animate turns the still into a video", async ({ browser }) => {
  test.setTimeout(14 * 60_000);
  const page = await openUgcStudio(browser);
  await fillProductPrompt(page);

  await page.getByRole("button", { name: /generate ugc shot/i }).click();
  await expect(page.getByRole("img", { name: "UGC result" })).toBeVisible({ timeout: 6 * 60_000 });

  await page.getByRole("button", { name: /animate ·/i }).click();
  // Result videos render with controls; preset-card loops never do.
  await expect(page.locator("video[controls]").first()).toBeVisible({ timeout: 8 * 60_000 });
  await page.close();
});

test("talking ad with an uploaded voice track completes end to end", async ({ browser }) => {
  test.setTimeout(12 * 60_000);
  const page = await openUgcStudio(browser);
  await fillProductPrompt(page);

  // Voice upload: the file input lives inside the "Add your voice track" label.
  // A successful storage upload is a precondition of the ad call itself, so a
  // storage/RLS break fails this test at the click, not silently later.
  await page.locator('input[accept^="audio"]').setInputFiles(VOICE_WAV_PATH);
  await expect(page.getByText("ugc-e2e-voice.wav")).toBeVisible();

  await page.getByRole("button", { name: /generate talking ad/i }).click();
  await expect(page.locator("video[controls]").first()).toBeVisible({ timeout: 10 * 60_000 });
  await page.close();
});

test("narrated product demo completes end to end", async ({ browser }) => {
  test.setTimeout(15 * 60_000);
  const page = await openUgcStudio(browser);

  // The demo form is conditionally rendered behind a disclosure toggle —
  // click it, then prove it actually expanded before touching the inputs.
  await page.getByRole("button", { name: /narrated product demo/i }).click();
  await expect(page.getByPlaceholder(/product name/i)).toBeVisible();
  await page.getByPlaceholder(/product name/i).fill("Aurora Smoke Widget");
  await page.getByPlaceholder(/feature 1 name/i).fill("Instant render");
  await page.getByRole("button", { name: /generate product demo/i }).click();
  await expect(page.locator("video[controls]").first()).toBeVisible({ timeout: 13 * 60_000 });
  await page.close();
});
