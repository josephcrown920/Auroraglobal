import { expect, test, type Page } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { waitForAppHydration } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "navigation-drawer.e2e.ts requires Supabase test credentials.",
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const SESSION_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const TEST_PASSWORD = "NavigationDrawerE2e!82";
let testEmail = "";
let testUserId = "";
let testSession: Session;

async function expectDrawerClosed(page: Page) {
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
}

test.beforeAll(async () => {
  testEmail = `navigation-drawer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Navigation Drawer E2E" },
  });
  if (error || !data.user) {
    throw new Error(`Failed to provision navigation drawer user: ${error?.message}`);
  }
  testUserId = data.user.id;

  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: testEmail,
    password: TEST_PASSWORD,
  });
  if (signInError || !signIn.session) {
    throw new Error(`Failed to sign in navigation drawer user: ${signInError?.message}`);
  }
  testSession = signIn.session;
});

test.afterAll(async () => {
  if (testUserId) await admin.auth.admin.deleteUser(testUserId).catch(() => {});
});

test("drawer is dismissible and session survives a reload", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("aurora_intro_seen", "1");
    localStorage.setItem("aurora.onboarding.done.v1", "skipped");
    localStorage.setItem("aurora.welcome_tour.done.v1", "1");
  });

  await page.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    { key: SESSION_STORAGE_KEY, session: testSession },
  );
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await waitForAppHydration(page);
  await expect(page.locator(".aurora-desktop-sidebar")).toHaveCount(0);

  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menu).toBeVisible();
  await expectDrawerClosed(page);

  await menu.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("navigation", { name: "All features" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expectDrawerClosed(page);

  await menu.click();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expectDrawerClosed(page);

  await menu.click();
  await drawer.getByRole("link", { name: "Colors Studio", exact: true }).click();
  await expect(page).toHaveURL(/\/colors$/);
  await expectDrawerClosed(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppHydration(page);
  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
});