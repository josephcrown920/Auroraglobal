import { expect, type Page } from "@playwright/test";

const STUDIO_URL = /\/studio(?:[/?#]|$)/;

export async function waitForAppHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute(
    "data-aurora-hydrated",
    "true",
    { timeout: 30_000 },
  );
}

export async function signInWithPassword(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });

  const form = page.locator('form[data-auth-form="password"]');
  await expect(form).toHaveAttribute("data-hydrated", "true", {
    timeout: 30_000,
  });

  const emailInput = form.locator("#email");
  const passwordInput = form.locator("#password");
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);

  const signInButton = form.getByRole("button", {
    name: "Sign in",
    exact: true,
  });
  await signInButton.click();

  try {
    await page.waitForURL(STUDIO_URL, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
  } catch (error) {
    const visibleMessages = await page
      .locator('[data-sonner-toast], [role="alert"]')
      .allTextContents()
      .catch(() => []);
    throw new Error(
      `Sign-in did not reach /studio. Current URL: ${page.url()}. ` +
        `Visible messages: ${visibleMessages.join(" | ") || "none"}. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  await expect(page).toHaveURL(STUDIO_URL);
}