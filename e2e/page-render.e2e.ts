import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HAS_E2E_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const TEST_PASSWORD = "PageRenderE2e!48";
let admin: ReturnType<typeof createClient>;
let testEmail = "";
let testUserId = "";

const PUBLIC_ROUTES = [
  "/",
  "/auth",
  "/tools",
  "/partners",
  "/editor",
  "/music-video",
  "/templates",
];

const STUDIO_NAV_ROUTES = [
  "/motion",
  "/colors",
  "/lipsync",
  "/director-room",
  "/studio",
  "/likeness",
  "/directors-board",
  "/scene-builder",
  "/agent",
  "/music-video",
  "/puremix",
];

const DIRECTOR_ROOM_PANELS = [
  { hash: "wardrobe", heading: "Keep your cast consistent across frames", rail: "Wardrobe" },
  { hash: "scenes", heading: "Block each moment", rail: "Scenes" },
  { hash: "layers", heading: "Build the shot stack", rail: "Layers" },
  { hash: "storyboard", heading: "Turn the plan into a cut", rail: "Storyboard" },
  { hash: "moodboard", heading: "The visual language of this shoot", rail: "Moodboard" },
  { hash: "flows", heading: "Map the production flow", rail: "Flows" },
] as const;

const FATAL_CONSOLE_PATTERN =
  /Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk .* failed|Invalid hook call|Minified React error|client\.tsx.*504/i;

test.describe("Page rendering", () => {
  test.skip(
    !HAS_E2E_SUPABASE,
    "signed-in page-render checks require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; set them in the E2E workflow to run this suite",
  );

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    testEmail = `page-render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Page Render E2E" },
    });
    if (error || !data.user) {
      throw new Error(`Failed to provision page-render user: ${error?.message}`);
    }
    testUserId = data.user.id;

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: testUserId, role: "admin" });
    if (roleError) {
      await admin.auth.admin.deleteUser(testUserId).catch(() => {});
      throw new Error(`Failed to grant page-render admin role: ${roleError.message}`);
    }
  });

  test.afterAll(async () => {
    if (!testUserId) return;
    await admin.from("user_roles").delete().eq("user_id", testUserId);
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  });

  async function verifyRoutesRender(page: Page, routes: string[], requireSignedIn: boolean) {
    const failures: string[] = [];
    let currentRoute = "";
    let pageErrors: string[] = [];
    let fatalConsoleErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error" && FATAL_CONSOLE_PATTERN.test(message.text())) {
        fatalConsoleErrors.push(message.text());
      }
    });

    for (const route of routes) {
      currentRoute = route;
      pageErrors = [];
      fatalConsoleErrors = [];

      try {
        const response = await page.goto(route, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        const status = response?.status() ?? 0;
        if (status >= 500) {
          failures.push(`${currentRoute}: HTTP ${status}`);
          continue;
        }

        await page.waitForFunction(
          () => document.body.innerText.trim().length > 40,
          undefined,
          { timeout: 20_000 },
        );
        await page.waitForTimeout(500);

        const bodyText = await page.locator("body").innerText();
        if (bodyText.includes("Something went wrong")) {
          failures.push(`${currentRoute}: rendered the global error boundary`);
        }
        if (requireSignedIn && new URL(page.url()).pathname === "/auth") {
          failures.push(`${currentRoute}: unexpectedly returned to /auth`);
        }
        if (pageErrors.length > 0) {
          failures.push(`${currentRoute}: page errors — ${pageErrors.join(" | ")}`);
        }
        if (fatalConsoleErrors.length > 0) {
          failures.push(`${currentRoute}: fatal console errors — ${fatalConsoleErrors.join(" | ")}`);
        }
      } catch (error) {
        failures.push(`${currentRoute}: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (failures.some((failure) => failure.startsWith(`${currentRoute}:`))) {
        if (!page.isClosed()) {
          await test.info().attach(
            `page-render-${currentRoute.replaceAll("/", "-") || "root"}`,
            {
              body: await page.screenshot({ fullPage: true }),
              contentType: "image/png",
            },
          ).catch(() => {});
        } else {
          failures.push(`${currentRoute}: browser page closed unexpectedly`);
          break;
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  }

  test("public navigation pages render without fatal errors", async ({ page }) => {
    test.setTimeout(150_000);
    await verifyRoutesRender(page, PUBLIC_ROUTES, false);
  });

  test("signed-in Studio pages render end to end", async ({ page }) => {
    test.setTimeout(180_000);
    await signInWithPassword(page, testEmail, TEST_PASSWORD);
    await verifyRoutesRender(page, STUDIO_NAV_ROUTES, true);
  });

  test("Director’s Room deep links and rail selections stay in sync", async ({ page }) => {
    test.setTimeout(120_000);
    await signInWithPassword(page, testEmail, TEST_PASSWORD);
    for (const panel of DIRECTOR_ROOM_PANELS) {
      await page.goto(`/director-room#${panel.hash}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: panel.heading, exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: panel.rail, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
    }
    for (const panel of DIRECTOR_ROOM_PANELS) {
      await page.goto("/director-room#scenes", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: panel.rail, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/director-room#${panel.hash}$`));
      await expect(page.getByRole("heading", { name: panel.heading, exact: true })).toBeVisible();
    }
  });
});
