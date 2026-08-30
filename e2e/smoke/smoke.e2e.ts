import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const SMOKE_ROUTES = ["/", "/auth", "/tools", "/templates"];

const FATAL_CONSOLE_PATTERN =
  /Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk .* failed|Invalid hook call|Minified React error|client\.tsx.*504/i;

async function expectRouteToRender(page: Page, route: string) {
  const pageErrors: string[] = [];
  const fatalConsoleErrors: string[] = [];
  const onPageError = (error: Error) => pageErrors.push(error.message);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error" && FATAL_CONSOLE_PATTERN.test(message.text())) {
      fatalConsoleErrors.push(message.text());
    }
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    const response = await page.goto(route, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    expect(response?.status(), `${route} returned an unsuccessful response`).toBeLessThan(500);
    await page.waitForFunction(() => document.body.innerText.trim().length > 40, undefined, {
      timeout: 20_000,
    });
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    expect(pageErrors, `${route} raised an uncaught page error`).toEqual([]);
    expect(fatalConsoleErrors, `${route} raised a fatal console error`).toEqual([]);
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
  }
}

test.describe("Public smoke", () => {
  for (const route of SMOKE_ROUTES) {
    test(`${route} renders without a fatal error`, async ({ page }) => {
      await expectRouteToRender(page, route);
    });
  }
});
