import { expect, test, type Page } from "@playwright/test";

// Representative public and gated routes. Each must render content or a stable
// auth fallback even when provider credentials are unavailable in pull requests.
const ROUTES = [
  "/",
  "/home",
  "/studio",
  "/motion",
  "/lipsync",
  "/spin",
  "/agent",
  "/video-editor",
  "/video-agent",
  "/editor",
  "/gallery",
  "/templates",
  "/marketplace",
  "/connect",
  "/contact",
  "/dashboard",
  "/account",
  "/billing",
  "/settings",
  "/admin",
  "/nexusarb",
  "/roadmap",
  "/guides",
  "/privacy",
  "/terms",
  "/canvas",
  "/scene-builder",
  "/scene-weaver",
  "/photo-edit",
  "/reshoot",
  "/workflows",
  "/jobs",
  "/partners",
  "/auth",
] as const;

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  return errors;
}

for (const route of ROUTES) {
  test(`route: ${route}`, async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    expect(
      errors,
      `console/page errors on ${route}: ${errors.join("\n")}`,
    ).toEqual([]);

    const body = await page.locator("body").innerHTML();
    expect(body.length, `body too small on ${route}`).toBeGreaterThan(30);
  });
}