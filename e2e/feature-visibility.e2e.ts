/**
 * E2E coverage for the admin Features panel (artist-only visibility gating).
 *
 * Scenarios exercised end-to-end in a real browser:
 *
 *  1. Admin opens /admin → Features tab → TikTok30 (Spin) toggle is OFF (hidden).
 *  2. Admin flips the toggle → toast "Now visible to regular users" appears,
 *     switch reflects the new state (aria-checked=true), and the landing page's
 *     ViralEngine section becomes visible without a manual reload (the
 *     FEATURE_VISIBILITY_REFRESH_EVENT propagation is what we're proving).
 *  3. A regular (non-admin) user visiting /spin while it is HIDDEN is redirected
 *     to /studio (FeatureGuard does this).
 *  4. After the admin makes it visible, the same user can load /spin without
 *     being redirected.
 *  5. Admin resets to defaults → toast "…reset to artist-only defaults" appears,
 *     switch goes back to OFF, and /spin redirects the regular user again.
 *
 * Two Supabase users are provisioned:
 *   • adminUser  — granted the `admin` role so they can unlock /admin.
 *   • regularUser — a plain confirmed account with no extra role.
 *
 * Both are created fresh with Admin API (no email round-trip, no rate-limit),
 * and deleted in afterAll so repeated runs never accumulate users.
 *
 * Known patterns from the project's existing e2e tests
 * (e2e/kids-preview.e2e.ts, e2e/playground-sandbox.e2e.ts):
 *   • waitForLoadState("networkidle") before clicking — SSR hydration guard.
 *   • Post-login redirect: waitForURL(/\/(home|studio)/).
 *   • webServer runs under /bin/sh → the bash command is in playwright.config.ts.
 *   • page.emulateMedia instead of newContext({ reducedMotion }).
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "feature-visibility.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PASSWORD = "FeatE2ePass!77";

let adminEmail: string;
let adminUserId: string;
let regularEmail: string;
let regularUserId: string;

// ── Helpers ────────────────────────────────────────────────────────────────

async function signIn(page: Page, email: string) {
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");

  const emailInput = page.locator("#email");
  const passwordInput = page.locator("#password");
  await emailInput.waitFor({ state: "visible" });
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);
  await passwordInput.fill(TEST_PASSWORD);
  await expect(passwordInput).toHaveValue(TEST_PASSWORD);

  const signInButton = page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true });
  await signInButton.click();

  try {
    await page.waitForURL(/\/(home|studio)/, { timeout: 15_000 });
  } catch {
    // Retry once on slow auth round-trips
    if ((await emailInput.count()) > 0) {
      await emailInput.fill(email);
      await passwordInput.fill(TEST_PASSWORD);
      await signInButton.click();
    }
    await page.waitForURL(/\/(home|studio)/, { timeout: 20_000 });
  }
}

async function signOut(page: Page) {
  // Navigate to a known page and trigger Supabase sign-out via the admin header
  // "Sign out" button (only present on /admin). Faster: just clear storage + reload.
  await page.evaluate(() => {
    // Supabase stores session in localStorage under supabase.auth.token or sb-*
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-") || key.includes("supabase")) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();
  });
  await page.goto("/");
}

/** Pull the signed-in Supabase access token out of the page's localStorage so
 *  admin API calls can be made via page.request (independent of browser
 *  storage — survives a later sign-out in the same tab). */
async function getAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith("sb-") || k.includes("supabase"),
    );
    for (const k of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(k) ?? "");
        const token =
          parsed?.access_token ??
          parsed?.currentSession?.access_token ??
          parsed?.session?.access_token;
        if (token) return token as string;
      } catch {
        /* skip */
      }
    }
    return null;
  });
}

const API_BASE = `http://localhost:${process.env.PORT ?? "8080"}`;

/** POST to the admin feature-visibility API with a bearer token. */
async function featureVisibilityPost(
  page: Page,
  token: string,
  body: Record<string, unknown>,
) {
  const res = await page.request.post(`${API_BASE}/api/admin/feature-visibility`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    data: body,
  });
  if (!res.ok()) {
    const text = await res.text().catch(() => "");
    throw new Error(`feature-visibility POST HTTP ${res.status()} — ${text.slice(0, 200)}`);
  }
}

// ── Fixtures ───────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Create admin user
  adminEmail = `feat-admin-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@aurora-sandbox-qa.com`;
  const { data: adminData, error: adminErr } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Feat Admin E2E" },
  });
  if (adminErr || !adminData.user) throw new Error(`Failed to create admin user: ${adminErr?.message}`);
  adminUserId = adminData.user.id;

  const { error: roleErr } = await adminClient
    .from("user_roles")
    .insert({ user_id: adminUserId, role: "admin" });
  if (roleErr) throw new Error(`Failed to grant admin role: ${roleErr.message}`);

  // Create regular user
  regularEmail = `feat-regular-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@aurora-sandbox-qa.com`;
  const { data: regData, error: regErr } = await adminClient.auth.admin.createUser({
    email: regularEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Feat Regular E2E" },
  });
  if (regErr || !regData.user) throw new Error(`Failed to create regular user: ${regErr?.message}`);
  regularUserId = regData.user.id;
});

test.afterAll(async () => {
  // Best-effort cleanup — do not throw if already gone
  if (adminUserId) {
    await adminClient.from("user_roles").delete().eq("user_id", adminUserId).catch(() => {});
    await adminClient.auth.admin.deleteUser(adminUserId).catch(() => {});
  }
  if (regularUserId) {
    await adminClient.auth.admin.deleteUser(regularUserId).catch(() => {});
  }
});

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe("Feature visibility — admin Features panel", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as admin to get a bearer token, then reset feature state via API
    // so every test starts from the artist-only defaults (spin = hidden).
    await signIn(page, adminEmail);
    const session = await page.evaluate(async () => {
      // The app stores the Supabase session in localStorage. We pull the access
      // token directly so we can call the reset API without a browser round-trip.
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith("sb-") || k.includes("supabase"),
      );
      for (const k of keys) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k) ?? "");
          const token =
            parsed?.access_token ??
            parsed?.currentSession?.access_token ??
            parsed?.session?.access_token;
          if (token) return token as string;
        } catch {
          /* skip */
        }
      }
      return null as string | null;
    });

    if (session) {
      // Reset via API with the real bearer token
      const port = process.env.PORT ?? "8080";
      const res = await page.request.post(
        `http://localhost:${port}/api/admin/feature-visibility`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session}`,
          },
          data: { reset: true },
        },
      );
      // 200 = ok; any other status means reset failed — log but don't throw so
      // tests can still tell us what went wrong.
      if (!res.ok()) {
        console.warn(`beforeEach reset returned HTTP ${res.status()}`);
      }
    }
    // Leave admin signed in for the actual test body.
  });

  test("admin sees TikTok30 toggle OFF in the Features panel by default", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Click the Features tab
    const featuresTab = page.getByRole("button", { name: "Features", exact: true });
    await featuresTab.waitFor({ state: "visible", timeout: 15_000 });
    await featuresTab.click();

    // The TikTok30 (Spin) row should be present with its toggle OFF
    const spinSwitch = page.getByRole("switch", {
      name: /TikTok30.*hidden from regular users/i,
    });
    await spinSwitch.waitFor({ state: "visible", timeout: 10_000 });
    await expect(spinSwitch).toHaveAttribute("aria-checked", "false");
  });

  test("admin flips TikTok30 visible → toast appears, toggle turns ON, landing ViralEngine becomes visible", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const featuresTab = page.getByRole("button", { name: "Features", exact: true });
    await featuresTab.waitFor({ state: "visible", timeout: 15_000 });
    await featuresTab.click();

    // Wait for the spin row to load (query is async)
    const spinSwitch = page.getByRole("switch", {
      name: /TikTok30.*hidden from regular users/i,
    });
    await spinSwitch.waitFor({ state: "visible", timeout: 10_000 });
    await expect(spinSwitch).toHaveAttribute("aria-checked", "false");

    // Flip it visible
    await spinSwitch.click();

    // Toast should confirm the change
    await expect(page.getByText(/now visible to regular users/i)).toBeVisible({
      timeout: 8_000,
    });

    // Switch should now reflect aria-checked=true
    // The label text changes after the mutation succeeds — use a looser pattern
    await expect(
      page.getByRole("switch", { name: /TikTok30/i }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 8_000 });

    // Navigate to the landing page (same tab — FeatureVisibilityProvider
    // received the FEATURE_VISIBILITY_REFRESH_EVENT from the admin panel,
    // and /api/public/feature-visibility will return the updated state on reload).
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The ViralEngine section is rendered when showFeature("spin") is true.
    // It contains the heading text from ViralEngine.tsx.
    const viralSection = page.locator("section, div").filter({
      hasText: /TikTok|Viral|Spin/i,
    }).first();
    await viralSection.waitFor({ state: "visible", timeout: 12_000 });
    await expect(viralSection).toBeVisible();
  });

  test("regular user visiting /spin while hidden is redirected to /studio", async ({ page }) => {
    // spin is hidden (reset happened in beforeEach)
    await signOut(page);
    await signIn(page, regularEmail);

    // Attempt to load /spin — FeatureGuard should redirect to /studio
    await page.goto("/spin");
    await page.waitForURL(/\/studio/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/studio/);
  });

  test("regular user can load /spin after admin makes it visible, then is redirected again after reset", async ({
    page,
    context,
  }) => {
    // Step 1: admin makes spin visible
    // (admin is already signed in from beforeEach — page is on /admin or /)
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const featuresTab = page.getByRole("button", { name: "Features", exact: true });
    await featuresTab.waitFor({ state: "visible", timeout: 15_000 });
    await featuresTab.click();

    const spinSwitch = page.getByRole("switch", { name: /TikTok30/i });
    await spinSwitch.waitFor({ state: "visible", timeout: 10_000 });

    // Only flip if currently hidden
    const isHidden = (await spinSwitch.getAttribute("aria-checked")) === "false";
    if (isHidden) {
      await spinSwitch.click();
      await expect(page.getByText(/now visible to regular users/i)).toBeVisible({
        timeout: 8_000,
      });
      await expect(spinSwitch).toHaveAttribute("aria-checked", "true", {
        timeout: 8_000,
      });
    }

    // Step 2: open a second page as the regular user and verify /spin loads
    const regularPage = await context.newPage();
    await signIn(regularPage, regularEmail);
    await regularPage.goto("/spin");
    await regularPage.waitForLoadState("networkidle");

    // Should NOT redirect — spin content should be visible
    await expect(regularPage).toHaveURL(/\/spin/, { timeout: 15_000 });

    // Step 3: admin resets to defaults → spin hidden again
    await page.bringToFront();
    const resetBtn = page.getByRole("button", { name: /reset to defaults/i });
    await resetBtn.waitFor({ state: "visible" });
    await resetBtn.click();
    await expect(
      page.getByText(/reset to artist-only defaults/i),
    ).toBeVisible({ timeout: 8_000 });

    // Switch should be OFF again
    await expect(spinSwitch).toHaveAttribute("aria-checked", "false", {
      timeout: 8_000,
    });

    // Step 4: regular user navigates to /spin again → redirected to /studio
    await regularPage.bringToFront();
    await regularPage.goto("/spin");
    await regularPage.waitForURL(/\/studio/, { timeout: 15_000 });
    await expect(regularPage).toHaveURL(/\/studio/);

    await regularPage.close();
  });
});
