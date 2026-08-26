import { test, expect } from "@playwright/test";

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
];

// Small helper to attach error collection to page.
function attachCollectors(page) {
  const errors = [] as string[];
  page.on("console", (msg) => {
    try {
      if (msg.type() === "error") errors.push(String(msg.text()));
    } catch (e) {
      errors.push("console collector failure");
    }
  });
  page.on("pageerror", (err) => {
    try {
      errors.push(err?.message ?? String(err));
    } catch (e) {
      errors.push("pageerror collector failure");
    }
  });
  return errors;
}

for (const route of ROUTES) {
  test(`route: ${route}`, async ({ page }) => {
    const errors = attachCollectors(page);
    // Navigate relative to baseURL in playwright config (http://localhost:<PORT>)
    await page.goto(route, { waitUntil: "domcontentloaded" });

    // Small grace period so client scripts and lazy chunks can execute.
    await page.waitForTimeout(800);

    // Ensure there are no uncaught console errors or page exceptions.
    expect(errors.length, `console/page errors on ${route}: ${errors.join("\n")}`).toBe(
      0
    );

    // Ensure the page isn't blank.
    const body = await page.locator("body").innerHTML();
    expect(body.length, `body too small on ${route}`).toBeGreaterThan(30);
  });
}
