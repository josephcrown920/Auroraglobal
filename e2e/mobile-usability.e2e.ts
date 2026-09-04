import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword, waitForAppHydration } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "mobile-usability.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PASSWORD = "MobileViewportE2e!82";
let testEmail = "";
let testUserId = "";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const pageWidth = Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          );
          return pageWidth <= window.innerWidth + 1;
        }),
      { message: `${new URL(page.url()).pathname} should fit the phone viewport` },
    )
    .toBe(true);
}

async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForAppHydration(page);
  await expectNoHorizontalOverflow(page);
}

test.beforeAll(async () => {
  testEmail = `mobile-viewport-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Mobile Viewport E2E" },
  });
  if (error || !data.user) {
    throw new Error(`Failed to provision mobile viewport user: ${error?.message}`);
  }
  testUserId = data.user.id;
});

test.afterAll(async () => {
  if (!testUserId) return;
  await admin.auth.admin.deleteUser(testUserId).catch(() => {});
});

test.describe("Phone viewport usability", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("aurora_intro_seen", "1");
      localStorage.setItem("aurora.onboarding.done.v1", "skipped");
      localStorage.setItem("aurora.welcome_tour.done.v1", "1");
    });
  });

  test("home and key creation pages keep their primary controls reachable", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await visit(page, "/");
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start creating", exact: true }).first(),
    ).toBeVisible();

    await signInWithPassword(page, testEmail, TEST_PASSWORD);
    await waitForAppHydration(page);
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByPlaceholder("Try describing the image you want to create"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a reference photo" })).toBeVisible();
    // The studio home renders two composers (hero + sticky bottom bar), each
    // with a Generate control — assert the primary one is reachable rather
    // than tripping strict mode on the pair.
    await expect(page.getByRole("button", { name: "Generate", exact: true }).first()).toBeVisible();

    await visit(page, "/lipsync");
    await expect(page.getByText("Performance source", { exact: true })).toBeVisible();
    await expect(page.getByText("Vocal track", { exact: true })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Run lip sync", exact: true })).toBeVisible();

    await visit(page, "/canvas");
    await expect(page.getByRole("link", { name: /Canvas/i })).toBeVisible();
    // Canvas has a toolbar Run and a prompt-bar Run; the primary one being
    // reachable is the phone-usability contract, not the count.
    await expect(page.getByRole("button", { name: "Run", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Canvas menu" })).toBeVisible();
  });
});