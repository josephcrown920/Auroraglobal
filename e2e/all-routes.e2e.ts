/**
 * All-routes smoke suite — the app's stability floor.
 *
 * Visits EVERY UI route (auto-discovered from src/routes — see
 * e2e/helpers/route-manifest.ts) twice: once anonymously, once signed in as
 * an admin user. Each visit must produce a real page: no HTTP 5xx, no blank
 * screen, no global error boundary, no uncaught page errors, no fatal chunk/
 * hook failures. Redirect routes must land where they promise. Dynamic routes
 * are visited via curated samples, including intentionally-bogus params that
 * must render their graceful fallback instead of crashing.
 *
 * If you add a page and it cannot pass this suite, the page is not done.
 */
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword } from "./helpers/auth";
import { buildRouteVisits, type RouteVisit } from "./helpers/route-manifest";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("all-routes.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PASSWORD = "AllRoutesE2e!71";
let testEmail = "";
let testUserId = "";

const VISITS = buildRouteVisits();

const FATAL_CONSOLE_PATTERN =
  /Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk .* failed|Invalid hook call|Minified React error|client\.tsx.*504/i;

test.beforeAll(async () => {
  testEmail = `all-routes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "All Routes E2E" },
  });
  if (error || !data.user) {
    throw new Error(`Failed to provision all-routes user: ${error?.message}`);
  }
  testUserId = data.user.id;

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: testUserId, role: "admin" });
  if (roleError) {
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
    throw new Error(`Failed to grant all-routes admin role: ${roleError.message}`);
  }
});

test.afterAll(async () => {
  if (!testUserId) return;
  await admin.from("user_roles").delete().eq("user_id", testUserId);
  await admin.auth.admin.deleteUser(testUserId).catch(() => {});
});

async function verifyVisit(
  page: Page,
  visit: RouteVisit,
  opts: { signedIn: boolean },
  collect: { pageErrors: string[]; fatalConsole: string[] },
): Promise<string[]> {
  const failures: string[] = [];
  collect.pageErrors.length = 0;
  collect.fatalConsole.length = 0;

  const response = await page.goto(visit.url, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  const status = response?.status() ?? 0;
  if (status >= 500) {
    return [`HTTP ${status}`];
  }

  await page.waitForFunction(() => document.body.innerText.trim().length > 40, undefined, {
    timeout: 30_000,
  });
  await page.waitForTimeout(400);

  const pathname = new URL(page.url()).pathname;
  if (visit.redirectTo && pathname !== visit.redirectTo) {
    failures.push(`expected redirect to ${visit.redirectTo}, landed on ${pathname}`);
  }

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("Something went wrong")) {
    failures.push("rendered the global error boundary");
  }
  if (visit.expectText && !visit.expectText.test(bodyText)) {
    failures.push(`missing expected graceful state ${visit.expectText}`);
  }
  if (opts.signedIn && visit.url !== "/auth" && pathname === "/auth") {
    failures.push("signed-in visit bounced to /auth");
  }
  if (collect.pageErrors.length > 0) {
    failures.push(`page errors — ${collect.pageErrors.join(" | ")}`);
  }
  if (collect.fatalConsole.length > 0) {
    failures.push(`fatal console errors — ${collect.fatalConsole.join(" | ")}`);
  }
  return failures;
}

async function runPass(page: Page, opts: { signedIn: boolean }) {
  const collect = { pageErrors: [] as string[], fatalConsole: [] as string[] };
  page.on("pageerror", (error) => collect.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && FATAL_CONSOLE_PATTERN.test(message.text())) {
      collect.fatalConsole.push(message.text());
    }
  });

  const failures: string[] = [];
  for (const visit of VISITS) {
    try {
      const visitFailures = await verifyVisit(page, visit, opts, collect);
      for (const failure of visitFailures) failures.push(`${visit.url}: ${failure}`);
    } catch (error) {
      failures.push(`${visit.url}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (failures.some((f) => f.startsWith(`${visit.url}: `))) {
      if (page.isClosed()) {
        failures.push(`${visit.url}: browser page closed unexpectedly`);
        break;
      }
      await test
        .info()
        .attach(`all-routes${visit.url.replaceAll("/", "-") || "-root"}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        })
        .catch(() => {});
    }
  }

  expect(failures, failures.join("\n")).toEqual([]);
}

test.describe("All routes render safely", () => {
  test("manifest discovers the full route surface", () => {
    // Sanity floor so a derivation bug can't silently shrink coverage.
    expect(VISITS.length).toBeGreaterThan(80);
  });

  test("every route renders for anonymous visitors", async ({ page }) => {
    test.setTimeout(Math.max(300_000, VISITS.length * 12_000));
    await runPass(page, { signedIn: false });
  });

  test("every route renders for a signed-in admin", async ({ page }) => {
    test.setTimeout(Math.max(300_000, VISITS.length * 12_000));
    await signInWithPassword(page, testEmail, TEST_PASSWORD);
    await runPass(page, { signedIn: true });
  });
});
