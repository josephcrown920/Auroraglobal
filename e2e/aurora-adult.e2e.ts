/**
 * Real-browser coverage for the separately registered Adult School artifact.
 *
 * This intentionally goes through the shared preview proxy at
 * /aurora-adult/ rather than hitting the artifact's Vite port directly. The
 * artifact's FeatureVisibilityGate uses root-relative API calls, and the
 * shared proxy is the production-shaped origin where those calls and the
 * Supabase session are valid.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "aurora-adult.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to provision a test user.",
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ADULT_URL =
  process.env.AURORA_ADULT_BASE_URL ?? "http://localhost:80/aurora-adult/";
const TEST_PASSWORD = "AdultSchoolE2ePass!23";
let testEmail: string;
let testUserId: string;

test.beforeAll(async () => {
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
  await expect(page.getByText("Eromify", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Adult School artifact", () => {
  test("loads without a JavaScript crash and its real image media resolves", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openAdultSchool(page);
    await expect(page.getByRole("heading", { name: /Your editorial/i })).toBeVisible();

    const media = page.locator("main img");
    const mediaCount = await media.count();
    expect(mediaCount).toBeGreaterThanOrEqual(10);

    // Lazy-loaded editorial images only load after they enter the viewport.
    for (let index = 0; index < mediaCount; index++) {
      const image = media.nth(index);
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(
          () =>
            image.evaluate(
              (element) =>
                (element as HTMLImageElement).complete &&
                (element as HTMLImageElement).naturalWidth > 0,
            ),
          { timeout: 10_000, message: `Adult School image ${index + 1} did not load` },
        )
        .toBe(true);
    }

    expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("primary Enter studio CTA opens the age gate and authenticated enrollment flow", async ({
    page,
  }) => {
    await openAdultSchool(page);
    await page.getByRole("button", { name: "Enter studio", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: /You must be 18\+/i })).toBeVisible();

    await page
      .getByRole("button", { name: /I am 18 or older/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /Choose a model/i }),
    ).toBeVisible();
  });
});