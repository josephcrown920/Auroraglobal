// Smoke test: one real (credit-spending) generation per feature — Colors
// Performance Studio, Motion Control (pose staging), Multi-Angle Reshoot.
// All three run through reserveOrchestrateRecord (Reshoot's real production
// path) using each feature's prompt + model, charged to the QA test user.
// NOTE: Colors/Motion production traffic actually flows through
// generatePerformanceShot (deduct_credits + user-scoped storage); this script
// smoke-tests the orchestrator/provider/credit RPCs, not those handlers.
// Run: CONFIRM_SPEND=1 bun run scripts/e2e-feature-generations.ts
import { readFileSync } from "node:fs";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { isFreeGpuOnlyMode } from "../src/lib/app-settings.server";
import { reserveOrchestrateRecord } from "../src/lib/generate-core.server";
import { buildCompositorPrompt } from "../src/lib/colors.presets";
import { RESHOOT_ANGLES, RESHOOT_MODEL, buildAnglePrompt } from "../src/lib/reshoot-angles";

const TEST_EMAIL = "qa-test@aurora-internal.test";
const IDENTITY_MODEL = "google/gemini-3.1-flash-image-preview";

async function main() {
  // ── Preflight ──────────────────────────────────────────────────────────────
  if (process.env.CONFIRM_SPEND !== "1") {
    throw new Error(
      "This script spends real credits / paid-provider money. Re-run with CONFIRM_SPEND=1 to proceed.",
    );
  }
  const freeOnly = await isFreeGpuOnlyMode();
  if (freeOnly) {
    throw new Error(
      "Free-GPU-only mode is ON — every paid provider would fail pre-dispatch. Aborting instead of burning reservations.",
    );
  }
  console.log("[preflight] free-GPU-only mode: off");

  const { data: users, error: uErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (uErr) throw new Error(`listUsers: ${uErr.message}`);
  const user = users.users.find((u) => u.email === TEST_EMAIL);
  if (!user) throw new Error(`test user ${TEST_EMAIL} not found`);
  const userId = user.id;
  console.log(`[preflight] test user: ${userId}`);

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("credits").eq("user_id", userId).maybeSingle();
  console.log(`[preflight] credits: ${profile?.credits ?? "unknown"}`);

  // ── Upload reference photo into the user's own studio folder ──────────────
  const bytes = readFileSync("public/josh/josh-pink-mic-portrait.jpg");
  const refPath = `${userId}/uploads/e2e-ref-${Date.now()}.jpg`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("studio")
    .upload(refPath, bytes, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw new Error(`ref upload: ${upErr.message}`);
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("studio").createSignedUrl(refPath, 60 * 60);
  if (signErr || !signed?.signedUrl) throw new Error(`sign: ${signErr?.message}`);
  const refUrl = signed.signedUrl;
  console.log(`[preflight] reference uploaded: ${refPath}`);

  // ── 1. Colors Performance Studio ───────────────────────────────────────────
  const colorsPrompt = buildCompositorPrompt("crimson-red", "performance", {
    hasOutfitRef: false,
    hasSceneRef: false,
  });
  console.log("\n[1/3] Colors Performance Studio — generating…");
  const colors = await reserveOrchestrateRecord({
    userId,
    kind: "image",
    prompt: colorsPrompt,
    model: IDENTITY_MODEL,
    imageUrls: [refUrl],
    cost: 1,
    reason: "image_generation",
  });
  console.log(colors.ok
    ? `[1/3] ✅ Colors OK → ${colors.url}\n      generationId: ${colors.generationId}`
    : `[1/3] ❌ Colors FAILED → ${colors.error}`);

  // ── 2. Motion Control — pose staging ──────────────────────────────────────
  const posePrompt =
    "Cinematic portrait of the subject. Pose: powerful performance stance, one hand raised, " +
    "leaning into a vintage mic. Preserve exact facial likeness, hair, skin tone. " +
    "Soft cinematic lighting, shallow depth of field, ARRI look, 4K.\n\n" +
    "Reference images (in order):\nImage 1: Identity (face / skin / hair)";
  console.log("\n[2/3] Motion Control (pose staging) — generating…");
  const motion = await reserveOrchestrateRecord({
    userId,
    kind: "image",
    prompt: posePrompt,
    model: IDENTITY_MODEL,
    imageUrls: [refUrl],
    cost: 1,
    reason: "image_generation",
  });
  console.log(motion.ok
    ? `[2/3] ✅ Motion OK → ${motion.url}\n      generationId: ${motion.generationId}`
    : `[2/3] ❌ Motion FAILED → ${motion.error}`);

  // ── 3. Multi-Angle Reshoot — one angle (low angle) ─────────────────────────
  const angle = RESHOOT_ANGLES.find((a) => a.id === "lowangle") ?? RESHOOT_ANGLES[0];
  console.log(`\n[3/3] Multi-Angle Reshoot (${angle.label}) — generating…`);
  const reshoot = await reserveOrchestrateRecord({
    userId,
    kind: "image",
    prompt: `[Reshoot / ${angle.label}] ${buildAnglePrompt(angle, null)}`,
    model: RESHOOT_MODEL,
    imageUrls: [refUrl],
    cost: 1,
    reason: "reshoot_angle",
  });
  console.log(reshoot.ok
    ? `[3/3] ✅ Reshoot OK → ${reshoot.url}\n      generationId: ${reshoot.generationId}`
    : `[3/3] ❌ Reshoot FAILED → ${reshoot.error}`);

  const okCount = [colors, motion, reshoot].filter((r) => r.ok).length;
  console.log(`\n[done] ${okCount}/3 generations succeeded`);
  const { data: after } = await supabaseAdmin
    .from("profiles").select("credits").eq("user_id", userId).maybeSingle();
  console.log(`[done] credits after: ${after?.credits ?? "unknown"}`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
