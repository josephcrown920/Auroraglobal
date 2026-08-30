import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInWithPassword } from "./helpers/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "soul-journey.e2e.ts requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_PASSWORD = "SoulJourneyE2e!48";
const TRAINING_PHOTO_COUNT = 10;

let testEmail = "";
let testUserId = "";
let createdSoulId = "";
let uploadedTrainingPaths: string[] = [];

async function latestSoulForTestUser() {
  const { data, error } = await admin
    .from("souls")
    .select("id,name,status,fal_training_id")
    .eq("user_id", testUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to read created soul: ${error.message}`);
  if (!data) throw new Error("Soul was not created.");
  createdSoulId = data.id;
  return data;
}

function trainingPhoto(index: number) {
  return {
    name: `soul-training-${index}.jpg`,
    mimeType: "image/jpeg",
    buffer: Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      index, 0x00, 0xff, 0xd9,
    ]),
  };
}

test.beforeAll(async () => {
  testEmail = `soul-journey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@aurora-sandbox-qa.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Soul Journey E2E" },
  });
  if (error || !data.user) {
    throw new Error(`Failed to provision soul journey user: ${error?.message}`);
  }
  testUserId = data.user.id;

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: testUserId, role: "admin" });
  if (roleError) {
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
    throw new Error(`Failed to grant soul journey admin role: ${roleError.message}`);
  }
});

test.afterAll(async () => {
  if (createdSoulId && uploadedTrainingPaths.length === 0) {
    const { data } = await admin
      .from("souls")
      .select("training_image_paths")
      .eq("id", createdSoulId)
      .maybeSingle();
    uploadedTrainingPaths = data?.training_image_paths ?? [];
  }
  if (uploadedTrainingPaths.length > 0) {
    await admin.storage.from("soul-training").remove(uploadedTrainingPaths).catch(() => {});
  }
  if (testUserId) {
    await admin.from("soul_reference_assets").delete().eq("user_id", testUserId);
    await admin.from("souls").delete().eq("user_id", testUserId);
    await admin.from("user_roles").delete().eq("user_id", testUserId);
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
});

test.describe("Aurora Soul real user journey", () => {
  test("signs in, trains a Soul, generates an image, and exposes a download", async ({ page }) => {
    test.setTimeout(180_000);

    await signInWithPassword(page, testEmail, TEST_PASSWORD);

    await page.goto("/soul", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Your character\./ })).toBeVisible();

    const soulName = `Journey Soul ${Date.now()}`;
    await page.getByLabel("Name a new character").fill(soulName);
    await page.getByRole("button", { name: /New Soul/ }).click();
    await expect(page.getByText(soulName)).toBeVisible({ timeout: 30_000 });

    const soul = await latestSoulForTestUser();
    await page.goto(`/soul/train?soulId=${soul.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: soulName })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(
      Array.from({ length: TRAINING_PHOTO_COUNT }, (_, i) => trainingPhoto(i)),
    );
    await expect(page.getByText("10 / 10+ training photos uploaded")).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: "Start training" }).click();
    await expect(page).toHaveURL(/\/soul(?:[?#]|$)/, { timeout: 30_000 });

    const trainingSoul = await latestSoulForTestUser();
    const { data: uploadData } = await admin
      .from("souls")
      .select("training_image_paths")
      .eq("id", soul.id)
      .maybeSingle();
    uploadedTrainingPaths = uploadData?.training_image_paths ?? [];
    expect(trainingSoul.status).toBe("training");
    expect(trainingSoul.fal_training_id).toBeTruthy();

    const { error: readyError } = await admin
      .from("souls")
      .update({
        status: "ready",
        progress: 100,
        lora_url: "https://example.test/aurora-soul-e2e-lora.safetensors",
        error_message: null,
      })
      .eq("id", soul.id)
      .eq("user_id", testUserId);
    if (readyError) throw new Error(`Failed to mark Soul ready: ${readyError.message}`);

    await page.goto(`/soul/generate?soulId=${soul.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Describe the scene")).toBeVisible();
    await page
      .getByPlaceholder(/walking through a neon-lit city street/i)
      .fill("portrait in cinematic neon rain, identity locked");
    await page.getByRole("button", { name: /Generate \(/ }).click();

    const result = page.getByAltText("Generated Soul image 1");
    await expect(result).toBeVisible({ timeout: 30_000 });

    const downloadLink = page.getByRole("link", {
      name: "Download generated Soul image 1",
    });
    await expect(downloadLink).toHaveAttribute("download", "aurora-soul-1.png");
    await expect(downloadLink).toHaveAttribute("href", /data:image\/svg\+xml/);
  });
});
