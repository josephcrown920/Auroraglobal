import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("mobile-usability.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PASSWORD = "MobileUsabilityE2e!92";
let testEmail = "";
let testUserId = "";

test.beforeAll(async () => {
  testEmail = `mobile-usability-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Mobile Usability E2E" },
  });
  if (error || !data.user) {
    throw new Error(`Failed to provision mobile usability user: ${error?.message}`);
  }
  testUserId = data.user.id;
});

test.afterAll(async () => {
  if (testUserId) await admin.auth.admin.deleteUser(testUserId).catch(() => {});
});

async function expectNoHorizontalOverflow(page: Page, pageName: string) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `${pageName} overflows horizontally (${dimensions.scrollWidth}px content / ${dimensions.viewportWidth}px viewport)`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth);
}

async function expectUsable(locator: Locator, controlName: string) {
  await expect(locator, `${controlName} is missing`).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();

  expect(box, `${controlName} has no rendered bounds`).not.toBeNull();
  expect(viewport, "The mobile project must define a viewport").not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x + box.width, `${controlName} is outside the right edge`).toBeGreaterThan(0);
  expect(box.y + box.height, `${controlName} is above the viewport`).toBeGreaterThan(0);
  expect(box.x, `${controlName} is outside the left edge`).toBeLessThan(viewport.width);
  expect(box.y, `${controlName} is below the viewport`).toBeLessThan(viewport.height);
}

test.describe("Mobile usability", () => {
  test("home, Studio, Lip Sync, and Canvas retain their essential controls", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expectUsable(page.locator("nav"), "Home navigation");
    await expectUsable(
      page.getByRole("link", { name: "Start creating", exact: true }),
      "Home primary action",
    );
    await expectNoHorizontalOverflow(page, "Home");

    await signInWithPassword(page, testEmail, TEST_PASSWORD);

    await expectUsable(
      page.getByPlaceholder("Try describing the image you want to create"),
      "Studio prompt input",
    );
    await expectUsable(
      page.getByRole("button", { name: "Add a reference photo", exact: true }),
      "Studio upload control",
    );
    await expectUsable(
      page.getByRole("button", { name: "Generate", exact: true }).first(),
      "Studio Generate button",
    );
    await expectNoHorizontalOverflow(page, "Studio");

    await page.goto("/lipsync", { waitUntil: "domcontentloaded" });
    await expectUsable(
      page.getByText("Performance source", { exact: true }),
      "Lip Sync upload control",
    );
    await expectUsable(
      page.getByText("Vocal track", { exact: true }),
      "Lip Sync audio upload control",
    );
    await expectUsable(
      page.getByRole("button", { name: "Run lip sync", exact: true }),
      "Lip Sync primary action",
    );
    await expectNoHorizontalOverflow(page, "Lip Sync");

    await page.goto("/canvas", { waitUntil: "domcontentloaded" });
    await expectUsable(
      page.getByText("Drop your image here", { exact: true }),
      "Canvas upload control",
    );
    await expectUsable(page.locator("textarea").first(), "Canvas prompt input");
    await expectUsable(
      page.getByRole("button", { name: "Run", exact: true }).last(),
      "Canvas Run button",
    );
    await expectNoHorizontalOverflow(page, "Canvas");
  });
});
