/**
 * Real-browser e2e coverage for the animated cartoon previews on the Kids
 * Story Studio (/kids) — src/components/kids/CartoonPreview.tsx.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword, waitForAppHydration } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HAS_E2E_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const TEST_PASSWORD = "SandboxE2ePass!23";
let admin: ReturnType<typeof createClient>;
let testEmail = "";
let testUserId = "";

test.describe("Kids Story Studio cartoon previews", () => {
  test.skip(
    !HAS_E2E_SUPABASE,
    "requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; set them in the E2E workflow to run this suite",
  );

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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

    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: testUserId, role: "admin" });
    if (roleErr) {
      await admin.auth.admin.deleteUser(testUserId).catch(() => {});
      throw new Error(`Failed to grant admin role to e2e test user: ${roleErr.message}`);
    }
  });

  test.afterAll(async () => {
    if (!testUserId) return;
    await admin.from("user_roles").delete().eq("user_id", testUserId);
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  });

  test("character picker previews reach a playable state after a cold load", async ({ page }) => {
    await signInWithPassword(page, testEmail, TEST_PASSWORD);
    await page.goto("/kids");
    await waitForAppHydration(page);

    const firstCharacterButton = page.locator('button[aria-pressed]').first();
    await firstCharacterButton.waitFor({ state: "visible", timeout: 20_000 });
    await firstCharacterButton.scrollIntoViewIfNeeded();

    const video = page.locator("video").first();
    await video.waitFor({ state: "attached", timeout: 10_000 });

    await expect.poll(
      async () => video.evaluate((el: HTMLVideoElement) => el.readyState),
      { timeout: 15_000, message: "expected a preview <video> to reach HAVE_CURRENT_DATA" },
    ).toBeGreaterThanOrEqual(2);

    const showcasePanel = page.locator(".aurora-panel", { hasText: "See an example" });
    await showcasePanel.scrollIntoViewIfNeeded();
    const showcaseVideo = showcasePanel.locator("video").first();
    await showcaseVideo.waitFor({ state: "attached", timeout: 10_000 });
    await expect.poll(
      async () => showcaseVideo.evaluate((el: HTMLVideoElement) => el.readyState),
      { timeout: 15_000, message: "expected the showcase <video> to reach HAVE_CURRENT_DATA" },
    ).toBeGreaterThanOrEqual(2);
  });

  test.describe("reduced motion", () => {
    test("shows only the poster image, never a <video>", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await signInWithPassword(page, testEmail, TEST_PASSWORD);
      await page.goto("/kids");
      await waitForAppHydration(page);

      const firstCharacterButton = page.locator('button[aria-pressed]').first();
      await firstCharacterButton.waitFor({ state: "visible", timeout: 20_000 });
      await firstCharacterButton.scrollIntoViewIfNeeded();
      const characterPoster = firstCharacterButton.locator("img");
      await expect(characterPoster).toBeVisible();

      const showcasePanel = page.locator(".aurora-panel", { hasText: "See an example" });
      await showcasePanel.scrollIntoViewIfNeeded();
      const showcasePoster = showcasePanel.locator("img").first();
      await expect(showcasePoster).toBeVisible();

      await page.waitForTimeout(1500);
      await expect(page.locator("video")).toHaveCount(0);
      await expect(characterPoster).toBeVisible();
      await expect(showcasePoster).toBeVisible();
    });
  });
});
