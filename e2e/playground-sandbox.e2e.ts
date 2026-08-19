/**
 * Real-browser e2e coverage for the /editor playground sandbox (src/lib/playground/sandbox.ts).
 *
 * Why this exists: the 27 unit tests in src/lib/playground/sandbox.test.ts boot the worker
 * source against a mocked global in the Bun test realm. The `.constructor` intrinsic patch
 * in sandbox.ts is guarded by `self instanceof WorkerGlobalScope`, which is only ever true in
 * a real browser Worker — never in the unit-test mock. This file drives the actual /editor
 * page in a real headless Chromium worker to exercise that guarded code path.
 *
 * Test user: created fresh via the Supabase admin API (service-role key) in a `beforeAll`
 * hook, pre-confirmed so no email round-trip / rate limit is involved, and deleted in
 * `afterAll` so repeated runs never accumulate users.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "playground-sandbox.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to provision a test user."
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PASSWORD = "SandboxE2ePass!23";
let testEmail: string;
let testUserId: string;

test.beforeAll(async () => {
  testEmail = `sandbox-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Sandbox E2E" },
  });
  if (error || !data.user) {
    throw new Error(`Failed to provision e2e test user: ${error?.message}`);
  }
  testUserId = data.user.id;
});

test.afterAll(async () => {
  if (testUserId) {
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
});

const EDITOR_SELECTOR = "#playground-editor .monaco-editor";
const CONSOLE_SELECTOR = "#playground-console";

async function signIn(page: Page) {
  await signInWithPassword(page, testEmail, TEST_PASSWORD);
}

/**
 * Replace the Monaco editor's contents with `code` via clipboard paste rather than
 * character-by-character typing. Monaco auto-closes brackets/quotes as you type, which
 * corrupts scripts typed key-by-key; a single paste avoids that entirely.
 */
async function setEditorContent(page: Page, code: string) {
  const editor = page.locator(EDITOR_SELECTOR);
  await editor.click();
  const isMac = process.platform === "darwin";
  const selectAll = isMac ? "Meta+A" : "Control+A";
  await page.keyboard.press(selectAll);
  await page.keyboard.press("Backspace");

  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, code);
  const paste = isMac ? "Meta+V" : "Control+V";
  await page.keyboard.press(paste);

  await expect(editor).toContainText(code.trim().slice(0, 20));
}

async function runAndWaitForStatus(page: Page) {
  await page.getByRole("button", { name: "Run" }).click();
  const status = page.locator(`${CONSOLE_SELECTOR} p.text-emerald-300, ${CONSOLE_SELECTOR} p.text-rose-300`).last();
  await expect(status).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible({ timeout: 20_000 });
  return status.innerText();
}

test.describe("Playground sandbox (real browser)", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page);
    await page.goto("/editor");
    // /editor may briefly render its signed-out shell while the client session
    // hydrates; wait generously for the authenticated Run button, and if the page
    // genuinely landed signed-out (session lost in transit), sign in once more.
    try {
      await expect(page.getByRole("button", { name: "Run" })).toBeVisible({ timeout: 20_000 });
    } catch {
      await signIn(page);
      await page.goto("/editor");
      await expect(page.getByRole("button", { name: "Run" })).toBeVisible({ timeout: 20_000 });
    }
  });

  test("benign script streams console output and finishes", async ({ page }) => {
    await setEditorContent(
      page,
      [
        'console.log("hello from sandbox");',
        "for (let i = 0; i < 3; i++) { console.log(\"tick\", i); }",
        'console.log("done computing");',
      ].join("\n")
    );

    const finalStatus = await runAndWaitForStatus(page);

    await expect(page.locator(CONSOLE_SELECTOR)).toContainText("hello from sandbox");
    await expect(page.locator(CONSOLE_SELECTOR)).toContainText("done computing");
    expect(finalStatus).toContain("Script finished");
  });

  const blockedSnippets: Array<{ name: string; code: string; expect: RegExp }> = [
    {
      name: "self.fetch",
      code: 'console.log("start"); self.fetch("https://example.com");',
      expect: /Blocked:\s*'fetch'/,
    },
    {
      name: "Function-constructor via plain function",
      code: 'console.log("start"); (function(){}).constructor("return 1")();',
      expect: /Blocked:\s*'Function'/,
    },
    {
      name: "Function-constructor via async function",
      code: 'console.log("start"); (async function(){}).constructor("return 1")();',
      expect: /Blocked:\s*'Function'/,
    },
    {
      name: "Function-constructor via generator function",
      code: 'console.log("start"); (function*(){}).constructor("return 1")();',
      expect: /Blocked:\s*'Function'/,
    },
    {
      name: "self.eval",
      code: 'console.log("start"); self.eval("1+1");',
      expect: /Blocked:\s*'eval'/,
    },
    {
      name: "new self.Function",
      code: 'console.log("start"); new self.Function("return 1")();',
      expect: /Blocked:\s*'Function'/,
    },
    {
      name: "setTimeout with string code",
      code: 'console.log("start"); setTimeout("console.log(1)", 0);',
      expect: /Blocked:\s*'setTimeout with string code'/,
    },
    {
      name: "dynamic import",
      code: 'console.log("start"); const m = await import("data:text/javascript,console.log(1)");',
      expect: /Blocked:\s*'import'/,
    },
    {
      name: "Object.getPrototypeOf(self) chain access to fetch",
      code: 'console.log("start"); Object.getPrototypeOf(self).fetch.call(self, "https://example.com");',
      expect: /Blocked:\s*'fetch'/,
    },
  ];

  for (const snippet of blockedSnippets) {
    test(`blocks: ${snippet.name}`, async ({ page }) => {
      const requests: string[] = [];
      page.on("request", (req) => {
        if (req.url().includes("example.com")) requests.push(req.url());
      });

      await setEditorContent(page, snippet.code);
      const finalStatus = await runAndWaitForStatus(page);

      expect(finalStatus).not.toContain("Script finished");
      expect(finalStatus).toMatch(snippet.expect);
      expect(requests).toHaveLength(0);
    });
  }
});
