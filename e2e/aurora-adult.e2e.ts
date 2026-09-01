/**
 * Real-browser coverage for the separately registered Adult School artifact.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HAS_E2E_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const ADULT_URL = process.env.AURORA_ADULT_BASE_URL ?? "http://localhost:80/aurora-adult/";
const TEST_PASSWORD = "AdultSchoolE2ePass!23";
let admin: ReturnType<typeof createClient>;
let testEmail = "";
let testUserId = "";

test.describe("Adult School artifact", () => {
  test.skip(
    !HAS_E2E_SUPABASE,
    "requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; set them in the E2E workflow to run this suite",
  );

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    testEmail = `adult-school-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Adult School E2E" },
    });
    if (error || !data.user) {
      throw new Error(`Failed to provision Adult School e2e user: ${error?.message}`);
    }
    testUserId = data.user.id;

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: testUserId, role: "admin" });
    if (roleError) {
      await admin.auth.admin.deleteUser(testUserId).catch(() => {});
      throw new Error(`Failed to grant Adult School e2e admin role: ${roleError.message}`);
    }
  });

  test.afterAll(async () => {
    if (!testUserId) return;
    await admin.from("user_roles").delete().eq("user_id", testUserId);
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  });

  async function signInAtSharedProxy(page: Page) {
    await page.goto("http://localhost:80/auth", { waitUntil: "domcontentloaded" });
    const form = page.locator('form[data-auth-form="password"]');
    await expect(form).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
    await form.locator("#email").fill(testEmail);
    await form.locator("#password").fill(TEST_PASSWORD);
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/studio(?:[/?#]|$)/, { timeout: 30_000 });
  }

  async function openAdultSchool(page: Page) {
    await signInAtSharedProxy(page);
    await page.goto(ADULT_URL, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Eromify", { exact: true })).toBeVisible({ timeout: 30_000 });
  }

  test("loads without a JavaScript crash and its real image media resolves", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openAdultSchool(page);
    await expect(page.getByRole("heading", { name: /Your editorial/i })).toBeVisible();

    const media = page.locator("main img");
    const mediaCount = await media.count();
    expect(mediaCount).toBeGreaterThanOrEqual(10);

    for (let index = 0; index < mediaCount; index++) {
      const image = media.nth(index);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(
        () => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0),
        { timeout: 10_000, message: `Adult School image ${index + 1} did not load` },
      ).toBe(true);
    }

    expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("primary Enter studio CTA opens the age gate and authenticated enrollment flow", async ({ page }) => {
    await openAdultSchool(page);
    await page.getByRole("button", { name: "Enter studio", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: /You must be 18\+/i })).toBeVisible();
    await page.getByRole("button", { name: /I am 18 or older/i }).click();
    await expect(page.getByRole("heading", { name: /Choose a model/i })).toBeVisible();
  });
});
