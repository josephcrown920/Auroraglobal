import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword, waitForAppHydration } from "./helpers/auth";

const MOBILE_VIEWPORT = { width: 430, height: 932 };
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("mobile.spec.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let testEmail = "";
let testPassword = "";
let testUserId = "";

async function expectNoHorizontalScroll(page: Page) {
  const { bodyWidth, documentWidth, viewportWidth } = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(Math.max(bodyWidth, documentWidth)).toBeLessThanOrEqual(viewportWidth);
}

async function expectUsableTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "Expected touch target to have a rendered bounding box").not.toBeNull();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(36);
}

test.describe("Mobile viewport (430px)", () => {
  test.beforeAll(async () => {
    testEmail = `mobile-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
    testPassword = `MobileE2e-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { display_name: "Mobile E2E" },
    });

    if (error || !data.user) {
      throw new Error(`Failed to provision mobile e2e user: ${error?.message}`);
    }

    testUserId = data.user.id;
  });

  test.afterAll(async () => {
    if (!testUserId) return;
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test("mobile home page keeps hero, navigation, and CTA usable", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppHydration(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const studioCta = page.getByRole("link", { name: /studio|start|generate|create/i }).first();
    await expect(studioCta).toBeVisible();
    await expectUsableTouchTarget(studioCta);

    const mobileMenu = page.getByRole("button", { name: /open navigation menu/i });
    await expect(mobileMenu).toBeVisible();
    await expectUsableTouchTarget(mobileMenu);
    await mobileMenu.click();
    await expect(page.getByRole("link", { name: /image & video studio/i })).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test("mobile Studio page keeps references, prompt, and generate controls usable", async ({
    page,
  }) => {
    await signInWithPassword(page, testEmail, testPassword);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    await waitForAppHydration(page);

    await expect(page.getByRole("heading", { name: /create\s+something\s+new/i })).toBeVisible();

    const referenceButton = page.getByRole("button", {
      name: /add a reference photo|edit reference photos/i,
    });
    await expect(referenceButton).toBeVisible();
    await expectUsableTouchTarget(referenceButton);
    await referenceButton.click();
    await expect(page.getByRole("dialog", { name: /studio settings/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /studio settings/i })).toBeHidden();

    const prompt = page.getByPlaceholder(/try describing the image/i);
    await expect(prompt).toBeVisible();
    await prompt.fill("mobile viewport smoke test portrait");

    const generateButton = page.getByRole("button", { name: "Generate" });
    await expect(generateButton).toBeVisible();
    await expectUsableTouchTarget(generateButton);

    await expectNoHorizontalScroll(page);
  });

  test("mobile Lipsync page keeps uploads, consent, and run action usable", async ({ page }) => {
    await signInWithPassword(page, testEmail, testPassword);
    await page.goto("/lipsync", { waitUntil: "domcontentloaded" });
    await waitForAppHydration(page);

    await expect(page.getByRole("heading", { name: /make any face/i })).toBeVisible();
    const singleRenderTab = page.getByRole("button", { name: "Single render" });
    await expect(singleRenderTab).toBeVisible();
    await expectUsableTouchTarget(singleRenderTab);

    await expect(page.getByText("Performance source")).toBeVisible();
    await expect(page.getByText("Vocal track")).toBeVisible();

    const consent = page.getByLabel(/i confirm i have the legal right/i);
    await expect(consent).toBeVisible();
    await consent.check();
    await expect(consent).toBeChecked();

    const runButton = page.getByRole("button", { name: /run lip sync/i });
    await expect(runButton).toBeVisible();
    await expectUsableTouchTarget(runButton);

    await expectNoHorizontalScroll(page);
  });

  test("mobile Canvas page keeps editor, toolbar, menu, and run action usable", async ({
    page,
  }) => {
    await signInWithPassword(page, testEmail, testPassword);
    await page.goto("/canvas", { waitUntil: "domcontentloaded" });
    await waitForAppHydration(page);

    await expect(page.locator("header").getByText("Canvas", { exact: true })).toBeVisible();
    await expect(page.locator(".react-flow")).toBeVisible();

    const addImageNodeButton = page.locator('button[title="Image"]').last();
    await expect(addImageNodeButton).toBeVisible();
    await expectUsableTouchTarget(addImageNodeButton);
    await addImageNodeButton.click();

    const menuButton = page.getByRole("button", { name: "Canvas menu" });
    await expect(menuButton).toBeVisible();
    await expectUsableTouchTarget(menuButton);
    await menuButton.click();
    await expect(page.getByRole("menuitem", { name: /go to studio/i })).toBeVisible();
    await page.keyboard.press("Escape");

    const runButtons = page.getByRole("button", { name: /^Run$/ });
    await expect(runButtons.first()).toBeVisible();
    await expectUsableTouchTarget(runButtons.first());

    await expectNoHorizontalScroll(page);
  });
});
