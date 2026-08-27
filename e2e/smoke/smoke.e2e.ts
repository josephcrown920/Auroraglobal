import { expect, type Page, test } from "@playwright/test";

// Representative route list — expand later if needed. These should all render
// a stable fallback or content even when auth/backend is unavailable.
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

function attachCollectors(page: Page) {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    errors.push(err.message);
  });

  return errors;
}

for (const route of ROUTES) {
  test(`route: ${route}`, async ({ page }) => {
    const errors = attachCollectors(page);

    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    expect(errors, `console/page errors on ${route}`).toEqual([]);

    const body = await page.locator("body").innerHTML();
    expect(body.length, `body too small on ${route}`).toBeGreaterThan(30);
  });
}
