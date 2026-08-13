/**
 * E2E coverage for the admin Features panel (artist-only visibility gating).
 *
 * Scenarios exercised end-to-end in a real browser:
 *
 *  1. Admin opens /admin → Features tab → TikTok30 (Spin) toggle is OFF (hidden).
 *  2. Admin flips the toggle → toast "Now visible to regular users" appears,
 *     switch reflects the new state (aria-checked=true), and the
 *     FEATURE_VISIBILITY_REFRESH_EVENT is dispatched (send side of the
 *     no-reload refresh mechanism).
 *  3. Receive side: an ANONYMOUS visitor with the landing page already mounted
 *     sees the ViralEngine section appear when the refresh event fires after
 *     the flip — with zero document reloads (proven via a window marker).
 *     Admins can't prove this (showFeature() returns true for admins always),
 *     which is why this scenario signs out first.
 *  4. A regular (non-admin) user visiting /spin while it is HIDDEN is redirected
 *     to /studio (FeatureGuard does this); after the admin makes it visible, the
 *     same user can load /spin without being redirected; after reset they are
 *     redirected again.
 *  5. Admin resets to defaults in the browser → toast "…reset to artist-only
 *     defaults" appears and the switch goes back to OFF.
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

/** Must match FEATURE_VISIBILITY_REFRESH_EVENT in
 *  src/components/FeatureVisibilityProvider.tsx. Hardcoded (e2e files do not
 *  resolve the app's "@/" alias); if the constant is ever renamed both
 *  event-driven tests below fail loudly, pointing straight here. */
const REFRESH_EVENT = "aurora:feature-visibility-refresh";

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

  try {
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
  } catch (err) {
    // Partial provisioning: remove whatever was created so a failed setup
    // never leaks users/roles into the shared environment.
    await adminClient.from("user_roles").delete().eq("user_id", adminUserId);
    await adminClient.auth.admin.deleteUser(adminUserId).catch(() => {});
    throw err;
  }
});

test.afterAll(async () => {
  // Best-effort cleanup — do not throw if already gone.
  // NOTE: supabase-js query builders are thenables without .catch(); await them
  // directly (they resolve { error } rather than throwing).

  // Feature visibility is SHARED persistent state. Tests flip spin visible
  // mid-flow; if a run aborts there, regular users would keep seeing it.
  // Mirror resetFeatureVisibility() (writeOverrides({}) upsert) exactly so
  // teardown always restores artist-only defaults, whatever state we died in.
  await adminClient.from("app_settings").upsert(
    {
      key: "feature_visibility",
      value: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (adminUserId) {
    await adminClient.from("user_roles").delete().eq("user_id", adminUserId);
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
    const token = await getAccessToken(page);
    if (!token) {
      throw new Error("beforeEach: could not extract Supabase access token after admin sign-in");
    }
    // Fail loudly — a silent failed reset would make every assertion below lie.
    await featureVisibilityPost(page, token, { reset: true });
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

  test("admin flips TikTok30 visible → toast appears, toggle turns ON, refresh event fires", async ({ page }) => {
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

    // Install a listener BEFORE the flip so we can prove the admin panel
    // dispatches the refresh event (the send side of the live-update contract).
    await page.evaluate((evt) => {
      (window as unknown as Record<string, unknown>).__featRefreshCount = 0;
      window.addEventListener(evt, () => {
        const w = window as unknown as Record<string, number>;
        w.__featRefreshCount = (w.__featRefreshCount ?? 0) + 1;
      });
    }, REFRESH_EVENT);

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

    // The refresh event must have fired at least once (this is what lets an
    // already-mounted landing page update without a reload).
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as Record<string, number>).__featRefreshCount,
          ),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0);
  });

  test("already-mounted landing reveals the TikTok30 section via the refresh event with zero reloads", async ({
    page,
  }) => {
    // Capture the admin token first, then become an anonymous visitor —
    // showFeature() returns true unconditionally for admins, so only a
    // non-admin viewer can prove the section actually toggles.
    const adminToken = await getAccessToken(page);
    if (!adminToken) throw new Error("could not extract admin access token");
    await signOut(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Spin is hidden (beforeEach reset) → ViralEngine must be absent.
    // NOTE: "Go viral on TikTok" is NOT unique — HeroContactForm (ungated)
    // renders it too. "See your 50 posts." exists only in ViralEngine.tsx.
    const viralHeading = page.getByText("See your 50 posts.");
    await expect(viralHeading).toHaveCount(0);

    // Marker proves no document reload happens from here on.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__noReloadMarker = true;
    });

    // Admin flips spin visible via the API (explicit bearer token, so the
    // anonymous browser session is irrelevant).
    await featureVisibilityPost(page, adminToken, { key: "spin", visible: true });

    // Fire the same event the admin panel dispatches after a successful
    // mutation. FeatureVisibilityProvider listens for it and refetches.
    await page.evaluate((evt) => {
      window.dispatchEvent(new Event(evt));
    }, REFRESH_EVENT);

    // The lazily-loaded ViralEngine section must appear — no navigation,
    // no reload, purely the provider refetch + conditional render.
    await expect(viralHeading).toBeVisible({ timeout: 15_000 });

    // And the marker must have survived (i.e. genuinely zero reloads).
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__noReloadMarker,
      ),
    ).toBe(true);
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
  }) => {
    // Multi-phase test (two sign-ins + three navigations) — needs more headroom
    // than the default 60s. A second page in the same context CANNOT be used for
    // the regular user (context pages share localStorage → the admin session
    // would leak into the "regular" tab and /auth would redirect away).
    test.setTimeout(120_000);

    // Step 1: capture the admin bearer token, then flip spin visible via the
    // admin API. page.request sends the token explicitly, so these calls keep
    // working even after the browser tab signs out of the admin account.
    // (The browser toggle flow itself is covered by the previous tests.)
    const adminToken = await getAccessToken(page);
    if (!adminToken) throw new Error("could not extract admin access token");
    await featureVisibilityPost(page, adminToken, { key: "spin", visible: true });

    // Step 2: become the regular user in the same tab and verify /spin loads
    await signOut(page);
    await signIn(page, regularEmail);
    await page.goto("/spin");
    await page.waitForLoadState("networkidle");

    // Should NOT redirect — we must still be on /spin after hydration settles
    await expect(page).toHaveURL(/\/spin/, { timeout: 15_000 });

    // Step 3: reset to defaults via API (admin token still valid) → hidden again
    await featureVisibilityPost(page, adminToken, { reset: true });

    // Step 4: regular user navigates to /spin again → redirected to /studio
    await page.goto("/spin");
    await page.waitForURL(/\/studio/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/studio/);
  });

  test("admin Reset to defaults button hides TikTok30 again with a confirmation toast", async ({
    page,
  }) => {
    // Make spin visible first (via API) so the reset actually changes state.
    const adminToken = await getAccessToken(page);
    if (!adminToken) throw new Error("could not extract admin access token");
    await featureVisibilityPost(page, adminToken, { key: "spin", visible: true });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const featuresTab = page.getByRole("button", { name: "Features", exact: true });
    await featuresTab.waitFor({ state: "visible", timeout: 15_000 });
    await featuresTab.click();

    // Switch should show ON (visible) after the API flip
    const spinSwitch = page.getByRole("switch", { name: /TikTok30/i });
    await spinSwitch.waitFor({ state: "visible", timeout: 10_000 });
    await expect(spinSwitch).toHaveAttribute("aria-checked", "true");

    // Click "Reset to defaults" → toast + switch OFF
    const resetBtn = page.getByRole("button", { name: /reset to defaults/i });
    await resetBtn.waitFor({ state: "visible" });
    await resetBtn.click();
    await expect(
      page.getByText(/reset to artist-only defaults/i),
    ).toBeVisible({ timeout: 8_000 });
    await expect(spinSwitch).toHaveAttribute("aria-checked", "false", {
      timeout: 8_000,
    });
  });
});
