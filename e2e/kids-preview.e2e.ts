/**
 * Real-browser e2e coverage for the animated cartoon previews on the Kids
 * Story Studio (/kids) — src/components/kids/CartoonPreview.tsx.
 *
 * Why this exists: CartoonPreview's lazy-mount (IntersectionObserver) and
 * reduced-motion gate are client-only effects. A unit test can assert the
 * component *would* render a <video>, but only a real browser can confirm
 * the MP4 asset actually resolves, decodes, and reaches a playable
 * `readyState` after a cold load — which is what "previews survive an app
 * restart" really means in practice (stale/renamed asset paths, wrong MIME
 * type, or a broken Vite asset import would all pass unit tests but fail
 * here).
 *
 * Test user: created fresh via the Supabase admin API (service-role key) in
 * a `beforeAll` hook, pre-confirmed so no email round-trip / rate limit is
 * involved, and deleted in `afterAll` so repeated runs never accumulate
 * users. Same pattern as e2e/playground-sandbox.e2e.ts.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "kids-preview.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to provision a test user."
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PASSWORD = "SandboxE2ePass!23";
let testEmail: string;
let testUserId: string;

test.beforeAll(async () => {
  testEmail = `kids-preview-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Kids Preview E2E" },
  });
  if (error || !data.user) {
    throw new Error(`Failed to provision e2e test user: ${error?.message}`);
  }
  testUserId = data.user.id;

  // Artist-only mode hides Kids Story Studio from regular users (the /kids
  // FeatureGuard redirects them to /studio), so this preview test signs in
  // as an ADMIN — per-user role grant, so global visibility state stays
  // untouched for everyone else while the previews are exercised.
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: testUserId, role: "admin" });
  if (roleErr) {
    throw new Error(`Failed to grant admin role to e2e test user: ${roleErr.message}`);
  }
});

test.afterAll(async () => {
  if (testUserId) {
    // Supabase query builders report failures via `{ error }`, not a rejected
    // promise — best-effort cleanup, ignore the result either way.
    await admin.from("user_roles").delete().eq("user_id", testUserId);
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
});

async function signIn(page: Page) {
  await page.goto("/auth");
  // Wait for the SSR page to finish hydrating before interacting. Clicking too early
  // hits a server-rendered button with no React submit handler attached yet, which
  // falls through to a native HTML form GET submission (full page reload) instead of
  // the SPA sign-in flow.
  await page.waitForLoadState("networkidle");
  const emailInput = page.locator("#email");
  const passwordInput = page.locator("#password");
  await emailInput.waitFor({ state: "visible" });
  await emailInput.fill(testEmail);
  await expect(emailInput).toHaveValue(testEmail);
  await passwordInput.fill(TEST_PASSWORD);
  await expect(passwordInput).toHaveValue(TEST_PASSWORD);

  // Scope to the form's submit button — the auth page also has a "Sign in" tab
  // toggle button at the top, which causes a strict-mode violation if we use
  // page.getByRole() without narrowing to the form.
  const signInButton = page.locator("form").getByRole("button", { name: "Sign in", exact: true });
  await signInButton.click();
  try {
    // Post-login redirect goes to /home (or ?next= param); /studio is a sub-route.
    await page.waitForURL(/\/(home|studio)/, { timeout: 15_000 });
  } catch {
    // Occasional slow auth round-trip — retry once rather than fail the whole test.
    if ((await emailInput.count()) > 0) {
      await emailInput.fill(testEmail);
      await passwordInput.fill(TEST_PASSWORD);
    }
    await signInButton.click();
    await page.waitForURL(/\/(home|studio)/, { timeout: 20_000 });
  }
}

test.describe("Kids Story Studio cartoon previews", () => {
  test("character picker previews reach a playable state after a cold load", async ({ page }) => {
    await signIn(page);
    await page.goto("/kids");
    await page.waitForLoadState("networkidle");

    // The character picker grid renders once getKidsOptions() resolves — wait for at
    // least one preset character button before scrolling to it.
    const firstCharacterButton = page.locator('button[aria-pressed]').first();
    await firstCharacterButton.waitFor({ state: "visible", timeout: 20_000 });
    await firstCharacterButton.scrollIntoViewIfNeeded();

    // Scrolling into view triggers CartoonPreview's IntersectionObserver, which mounts
    // the <video>. Give it a moment to attach and start loading the MP4 asset.
    const video = page.locator("video").first();
    await video.waitFor({ state: "attached", timeout: 10_000 });

    await expect
      .poll(
        async () =>
          video.evaluate((el: HTMLVideoElement) => el.readyState),
        { timeout: 15_000, message: "expected a preview <video> to reach HAVE_CURRENT_DATA" }
      )
      .toBeGreaterThanOrEqual(2);

    // The showcase section ("See an example") further down the page uses the same
    // CartoonPreview component with different assets — confirm it mounts too. Scope
    // the locator to the panel containing that heading so this genuinely checks the
    // showcase video, not another character-grid preview that happens to be the
    // Nth <video> on the page.
    const showcasePanel = page.locator(".aurora-panel", { hasText: "See an example" });
    await showcasePanel.scrollIntoViewIfNeeded();
    const showcaseVideo = showcasePanel.locator("video").first();
    await showcaseVideo.waitFor({ state: "attached", timeout: 10_000 });
    await expect
      .poll(
        async () =>
          showcaseVideo.evaluate((el: HTMLVideoElement) => el.readyState),
        { timeout: 15_000, message: "expected the showcase <video> to reach HAVE_CURRENT_DATA" }
      )
      .toBeGreaterThanOrEqual(2);
  });

  // Use the built-in page fixture + page.emulateMedia rather than a manual
  // browser.newContext({ reducedMotion }) — the manual context pattern produced
  // corrupt trace artifacts under trace: "retain-on-failure", and the context-level
  // reducedMotion option is not honored by this Chrome-for-Testing build (verified:
  // matchMedia still reported no-preference). page.emulateMedia works reliably.
  test.describe("reduced motion", () => {
    test("shows only the poster image, never a <video>", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await signIn(page);
      await page.goto("/kids");
      await page.waitForLoadState("networkidle");

      const firstCharacterButton = page.locator('button[aria-pressed]').first();
      await firstCharacterButton.waitFor({ state: "visible", timeout: 20_000 });
      await firstCharacterButton.scrollIntoViewIfNeeded();
      // CartoonPreview's poster <img> is always rendered as the base layer, with
      // reduced motion the video is never added on top of it — assert on the poster
      // that lives inside this specific character card, not just "some image exists
      // on the page" (which the header logo etc. would also satisfy).
      const characterPoster = firstCharacterButton.locator("img");
      await expect(characterPoster).toBeVisible();

      const showcasePanel = page.locator(".aurora-panel", { hasText: "See an example" });
      await showcasePanel.scrollIntoViewIfNeeded();
      const showcasePoster = showcasePanel.locator("img").first();
      await expect(showcasePoster).toBeVisible();

      // Give the IntersectionObserver + mount effects a beat to run, then assert no
      // <video> was ever mounted anywhere on the page — reduced motion must keep the
      // posters above as the only visual, never swap in the looping clip.
      await page.waitForTimeout(1500);
      await expect(page.locator("video")).toHaveCount(0);
      await expect(characterPoster).toBeVisible();
      await expect(showcasePoster).toBeVisible();
    });
  });
});
