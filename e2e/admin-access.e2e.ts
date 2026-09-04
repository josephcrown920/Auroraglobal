/**
 * E2E coverage for Admin role isolation — the Admin console must be invisible
 * and unreachable for every non-admin account, whatever the client stores.
 *
 * Accounts provisioned fresh via the Supabase Admin API (deleted in afterAll):
 *   • admin    — holds the `admin` role in user_roles.
 *   • regular  — plain confirmed account.
 *   • partner  — plain account enrolled as an Aurora Partner through the real
 *                /partners page (creates its affiliates row).
 *   • referred — plain account that signed up through the partner's referral
 *                link (localStorage `aurora_ref` → ReferralAttacher attaches it).
 *
 * Scenarios:
 *   1. Regular / partner / referred users see NO Admin entry in the sidebar or
 *      the mobile navigation sheet, even with a fabricated
 *      sessionStorage.aurora_admin_token planted.
 *   2. Direct /admin and /admin/ledger navigation by those users (with or
 *      without the fabricated token) never paints admin chrome and lands on
 *      /studio; the fabricated token is never trusted.
 *   3. A signed-out visitor on /admin is sent to /auth with next=/admin.
 *   4. The verified admin sees the Admin entry, and /admin, /admin/ledger and
 *      /admin/orchestration each render their own page (the layout's Outlet).
 *   5. Mid-session sign-in: an admin who signs in through the SPA form with
 *      next=/admin lands on the admin overview (the admin check re-runs on
 *      auth change); a regular user doing the same is bounced to /studio.
 *   6. Privileged server functions enforce admin authorization themselves: the
 *      exact RPC requests the overview issues for GitHub-sync and generation
 *      health are replayed with a regular bearer and with no bearer → denied.
 *
 * Sessions are injected via localStorage (sb-<ref>-auth-token) with
 * addInitScript so each scenario starts from a clean, known state.
 */

import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { waitForAppHydration } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error(
    "admin-access.e2e.ts requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY.",
  );
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const SESSION_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const TEST_PASSWORD = "AdminAccessE2e!41";
const STUDIO_URL = /\/studio(?:[/?#]|$)/;

type Account = { email: string; id: string; session: Session };
const accounts: Partial<Record<"admin" | "regular" | "partner" | "referred", Account>> = {};
const createdIds: string[] = [];

async function provision(tag: string, role?: "admin"): Promise<Account> {
  const email = `admin-access-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@aurora-sandbox-qa.com`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `Admin Access ${tag}` },
  });
  if (error || !data.user) throw new Error(`Failed to create ${tag} user: ${error?.message}`);
  createdIds.push(data.user.id);
  if (role) {
    const { error: roleErr } = await adminClient.from("user_roles").insert({ user_id: data.user.id, role });
    if (roleErr) throw new Error(`Failed to grant ${role} role: ${roleErr.message}`);
  }
  const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInErr || !signIn.session) throw new Error(`Failed to sign in ${tag}: ${signInErr?.message}`);
  return { email, id: data.user.id, session: signIn.session };
}

type ClientState = { session?: Session; fabricatedAdminToken?: boolean; ref?: string };

async function openAs(browser: Browser, state: ClientState): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ key, session, fabricated, ref }) => {
      if (session) localStorage.setItem(key, JSON.stringify(session));
      if (fabricated) sessionStorage.setItem("aurora_admin_token", "fabricated-by-e2e");
      if (ref) localStorage.setItem("aurora_ref", ref);
    },
    { key: SESSION_STORAGE_KEY, session: state.session ?? null, fabricated: !!state.fabricatedAdminToken, ref: state.ref ?? null },
  );
  const page = await context.newPage();
  return { context, page };
}

async function gotoHydrated(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForAppHydration(page);
}

/** Admin nav entry count across the desktop sidebar + (opened) mobile sheet. */
async function adminNavEntries(page: Page): Promise<number> {
  // Let the server-verified admin check settle before counting.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const menu = page.locator('button[aria-label="Open navigation menu"]').first();
  if (await menu.isVisible().catch(() => false)) {
    // Bounded: an overlay (consent banner, onboarding) may intercept the click;
    // the desktop sidebar is counted either way.
    await menu.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  return page.locator('a[href="/admin"]').count();
}

const ADMIN_CHROME = /Owner credentials required|Admin access required|Admin overview|Credit Ledger/;

async function expectBouncedToStudio(page: Page) {
  await expect(page).toHaveURL(STUDIO_URL, { timeout: 30_000 });
  await expect(page.locator("body")).not.toContainText(ADMIN_CHROME);
}

// ── Fixtures ───────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  try {
    accounts.admin = await provision("admin", "admin");
    accounts.regular = await provision("regular");
    accounts.partner = await provision("partner");
    accounts.referred = await provision("referred");
  } catch (err) {
    for (const id of createdIds) {
      await adminClient.from("user_roles").delete().eq("user_id", id);
      await adminClient.auth.admin.deleteUser(id).catch(() => {});
    }
    throw err;
  }
});

test.afterAll(async () => {
  for (const id of createdIds) {
    await adminClient.from("user_roles").delete().eq("user_id", id);
    await adminClient.from("affiliates").delete().eq("user_id", id);
    await adminClient.auth.admin.deleteUser(id).catch(() => {});
  }
});

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

test("partner enrolment and referral signup create non-admin accounts that never see Admin", async ({ browser }) => {
  test.setTimeout(180_000);
  // Partner: the real /partners page creates the affiliates row.
  const partner = await openAs(browser, { session: accounts.partner!.session });
  await gotoHydrated(partner.page, "/partners");
  await expect
    .poll(async () => {
      const { data } = await adminClient.from("affiliates").select("code").eq("user_id", accounts.partner!.id).maybeSingle();
      return data?.code ?? null;
    }, { timeout: 30_000 })
    .not.toBeNull();
  const { data: aff } = await adminClient.from("affiliates").select("code").eq("user_id", accounts.partner!.id).single();
  expect(await adminNavEntries(partner.page)).toBe(0);
  await partner.context.close();

  // Referred: lands with the partner's code stored → ReferralAttacher attaches it.
  const referred = await openAs(browser, { session: accounts.referred!.session, ref: aff!.code });
  await gotoHydrated(referred.page, "/studio");
  await expect
    .poll(async () => {
      const { data } = await adminClient.from("profiles").select("referred_by_code").eq("user_id", accounts.referred!.id).maybeSingle();
      return data?.referred_by_code ?? null;
    }, { timeout: 30_000 })
    .toBe(aff!.code);
  expect(await adminNavEntries(referred.page)).toBe(0);
  await referred.context.close();
});

test("regular users get no Admin nav entry — even with a fabricated admin token planted", async ({ browser }) => {
  test.setTimeout(120_000);
  for (const fabricated of [false, true]) {
    const { context, page } = await openAs(browser, { session: accounts.regular!.session, fabricatedAdminToken: fabricated });
    await gotoHydrated(page, "/studio");
    expect(await adminNavEntries(page), `fabricated=${fabricated}`).toBe(0);
    await context.close();
  }
});

test("direct /admin URLs bounce non-admins to /studio without painting admin chrome", async ({ browser }) => {
  test.setTimeout(180_000);
  const cases: Array<{ who: "regular" | "partner" | "referred"; fabricated: boolean; path: string }> = [
    { who: "regular", fabricated: false, path: "/admin" },
    { who: "regular", fabricated: true, path: "/admin" },
    { who: "regular", fabricated: true, path: "/admin/ledger" },
    { who: "partner", fabricated: false, path: "/admin/orchestration" },
    { who: "referred", fabricated: false, path: "/admin" },
  ];
  for (const c of cases) {
    const { context, page } = await openAs(browser, { session: accounts[c.who]!.session, fabricatedAdminToken: c.fabricated });
    await page.goto(c.path, { waitUntil: "domcontentloaded" });
    await expectBouncedToStudio(page);
    await context.close();
  }
});

test("signed-out visitors on /admin are sent to sign in and come back to /admin", async ({ browser }) => {
  const { context, page } = await openAs(browser, { fabricatedAdminToken: true });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/auth\?next=%2Fadmin/, { timeout: 30_000 });
  await expect(page.locator("body")).not.toContainText(ADMIN_CHROME);
  await context.close();
});

test("the verified admin sees the Admin entry and every admin page renders its own content", async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, page } = await openAs(browser, { session: accounts.admin!.session });
  await gotoHydrated(page, "/studio");
  expect(await adminNavEntries(page)).toBeGreaterThan(0);

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/admin(?:[/?#]|$)/);

  // Child pages must render their OWN content (the layout's Outlet), not the overview.
  await page.goto("/admin/ledger", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Credit Ledger" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Admin overview" })).toHaveCount(0);

  await page.goto("/admin/orchestration", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Orchestration/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Admin overview" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/orchestration/);
  await context.close();
});

test("mid-session sign-in re-runs the admin check: admin reaches /admin, regular user is bounced", async ({ browser }) => {
  test.setTimeout(180_000);
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("/auth?next=%2Fadmin", { waitUntil: "domcontentloaded" });
  const form = adminPage.locator('form[data-auth-form="password"]');
  await expect(form).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
  await form.locator("#email").fill(accounts.admin!.email);
  await form.locator("#password").fill(TEST_PASSWORD);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(adminPage).toHaveURL(/\/admin(?:[/?#]|$)/, { timeout: 30_000 });
  await expect(adminPage.getByRole("heading", { name: "Admin overview" })).toBeVisible({ timeout: 30_000 });
  await adminCtx.close();

  const regCtx = await browser.newContext();
  const regPage = await regCtx.newPage();
  await regPage.goto("/auth?next=%2Fadmin", { waitUntil: "domcontentloaded" });
  const regForm = regPage.locator('form[data-auth-form="password"]');
  await expect(regForm).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
  await regForm.locator("#email").fill(accounts.regular!.email);
  await regForm.locator("#password").fill(TEST_PASSWORD);
  await regForm.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectBouncedToStudio(regPage);
  await regCtx.close();
});

test("hidden owner entrance offers the passcode form to a signed-in non-admin but grants nothing by itself", async ({ browser }) => {
  test.setTimeout(150_000);
  const { context, page } = await openAs(browser, { session: accounts.regular!.session });
  await gotoHydrated(page, "/studio");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // Real entrance: triple-click the bottom-right 24×24 px corner (AdminHotkey
  // listens for 3 window clicks there within 800 ms). The clicks are
  // dispatched inside the page in one go so a slow CDP round-trip under load
  // can't spread them past the 800 ms window and turn this into a flake.
  await page.evaluate(() => {
    const x = window.innerWidth - 4;
    const y = window.innerHeight - 4;
    const target = document.elementFromPoint(x, y) ?? document.body;
    for (let i = 0; i < 3; i++) {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
    }
  });
  await expect(page).toHaveURL(/\/admin(?:[/?#]|$)/, { timeout: 30_000 });

  // The passcode form is shown instead of the /studio redirect — and nothing else.
  const form = page.locator("form").filter({ hasText: "Owner credentials required." });
  await expect(form).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Admin overview" })).toHaveCount(0);

  // Wrong credentials: still locked, still on /admin, no admin chrome.
  await form.getByPlaceholder("Username").fill("nobody");
  await form.getByPlaceholder("Passcode").fill("definitely-wrong");
  await form.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: /Invalid credentials|not configured/ })).toBeVisible({ timeout: 30_000 });
  await expect(form).toBeVisible();
  await expect(page).toHaveURL(/\/admin(?:[/?#]|$)/);
  await expect(page.getByRole("heading", { name: "Admin overview" })).toHaveCount(0);

  // A reload without the entrance marker being re-requested must still not
  // trust anything stored by the failed attempt: the marker survives the
  // session only until a verified answer, so the form (not chrome) shows again.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("form").filter({ hasText: "Owner credentials required." })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Admin overview" })).toHaveCount(0);

  // Correct owner credentials (only when this environment has them): the
  // boundary must accept the server-verified unlock WITHOUT the redirect race
  // — the form disappears and we stay on /admin.
  const ownerUser = process.env.ADMIN_USERNAME;
  const ownerPass = process.env.ADMIN_PASSCODE;
  if (ownerUser && ownerPass) {
    const again = page.locator("form").filter({ hasText: "Owner credentials required." });
    await again.getByPlaceholder("Username").fill(ownerUser);
    await again.getByPlaceholder("Passcode").fill(ownerPass);
    await again.getByRole("button", { name: "Unlock" }).click();
    await expect(again).toHaveCount(0, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin(?:[/?#]|$)/);
    await expect(page.locator('[data-admin-boundary="pending"]')).toHaveCount(0);
    await expect(page.locator("body")).toContainText(/Admin overview|Admin access required/, { timeout: 30_000 });
  } else {
    test.info().annotations.push({ type: "note", description: "ADMIN_USERNAME/ADMIN_PASSCODE not set — successful-unlock half skipped." });
  }
  await context.close();
});

test("privileged health server functions reject non-admin callers when invoked directly", async ({ browser }) => {
  test.setTimeout(120_000);
  // Capture the real RPC requests the admin overview issues.
  const { context, page } = await openAs(browser, { session: accounts.admin!.session });
  const captured = new Map<string, { url: string; headers: Record<string, string> }>();
  page.on("response", async (res) => {
    if (!res.url().includes("/_serverFn/")) return;
    const text = await res.text().catch(() => "");
    const entry = { url: res.url(), headers: res.request().headers() };
    if (/daemon_stalled/.test(text)) captured.set("github-sync-health", entry);
    else if (/consecutive_ok/.test(text)) captured.set("generation-health", entry);
  });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect.poll(() => captured.size, { timeout: 30_000 }).toBe(2);
  await context.close();

  const successKey: Record<string, string> = { "github-sync-health": "daemon_stalled", "generation-health": "consecutive_ok" };
  for (const [name, entry] of captured) {
    const baseHeaders = Object.fromEntries(
      Object.entries(entry.headers).filter(([k]) => !/^(cookie|authorization|host|content-length)$/i.test(k)),
    );
    const replay = async (token: string | null) => {
      const res = await fetch(entry.url, {
        headers: token ? { ...baseHeaders, authorization: `Bearer ${token}` } : baseHeaders,
      });
      return res.text();
    };
    expect(await replay(accounts.regular!.session.access_token), `${name} regular bearer`).toContain("Admin access required");
    expect(await replay(null), `${name} no bearer`).toContain("Unauthorized");
    const adminBody = await replay(accounts.admin!.session.access_token);
    expect(adminBody, `${name} admin bearer`).not.toContain("$TSR/Error");
    expect(adminBody, `${name} admin bearer payload`).toContain(successKey[name]);
  }
});
