// Direct-invocation smoke: prove the NEW `editorial-cover` template (Task
// "make every advertised Viral Preset runnable") produces a real render
// through the exact production dispatch path.
//
//   1. Resolve the QA test user (same account the other smokes use).
//   2. Top up credits so the reserve can't fail on balance.
//   3. Stage a reference selfie the user OWNS (own studio folder → passes
//      assertOwnedReferenceImage exactly like a real upload).
//   4. Enqueue via _enqueuePerformanceShot with the template's REAL
//      imagePrompt/model from the manifest — the same call TemplateDrawer's
//      genFn lands on.
//   5. Drain the queue in-process via processBatch (what /api/public/jobs/tick
//      runs) and poll the generation row until it succeeds.
//
// Cost: 1 image render (cheapest possible template verification).
// Run:  bun run scripts/smoke-editorial-cover-template.ts

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { _enqueuePerformanceShot } from "../src/lib/studio.functions";
import { processBatch } from "../src/lib/jobs.server";
import { getStudioTemplate, TEMPLATE_DEFAULTS } from "../src/lib/template-studio";

const TEST_EMAIL = "qa-test@aurora-internal.test";
const TEMPLATE_ID = "editorial-cover";
const CREDITS_TO_GRANT = 500;

// Any small, readily available JPEG in the repo works as the "user selfie".
import { readFileSync } from "node:fs";
const SELFIE_PATH = "src/assets/josh/generated/still-04-cafe-selfie.jpg";

function log(msg: string) {
  console.log(msg);
}

async function main() {
  log("[editorial-cover-smoke] starting");

  const tpl = getStudioTemplate(TEMPLATE_ID);
  if (!tpl) throw new Error(`${TEMPLATE_ID} missing from manifest`);
  if (!tpl.imagePrompt) throw new Error(`${TEMPLATE_ID} has no imagePrompt`);
  if (tpl.kinds.join(",") !== "image") {
    throw new Error(`expected image-only template, got kinds=${tpl.kinds.join(",")}`);
  }

  // ── Test user ────────────────────────────────────────────────────────────
  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const user = listData.users.find((u) => u.email === TEST_EMAIL);
  if (!user) throw new Error(`test user ${TEST_EMAIL} not found`);
  const userId = user.id;
  log(`[editorial-cover-smoke] test user: ${userId}`);

  const { error: creditErr } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, credits: CREDITS_TO_GRANT }, { onConflict: "user_id" });
  if (creditErr) throw new Error(`credit grant: ${creditErr.message}`);

  // ── Owned reference image (same shape as a real drawer upload) ──────────
  const bytes = readFileSync(SELFIE_PATH);
  const refPath = `${userId}/templates/smoke-editorial-${Date.now()}.jpg`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("studio")
    .upload(refPath, bytes, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw new Error(`reference upload: ${upErr.message}`);
  const refUrl = supabaseAdmin.storage.from("studio").getPublicUrl(refPath).data.publicUrl;
  log(`[editorial-cover-smoke] staged owned reference`);

  // ── Enqueue through the production dispatch ──────────────────────────────
  const { jobId, generationId } = await _enqueuePerformanceShot(userId, {
    prompt: tpl.imagePrompt,
    imageUrls: [refUrl],
    model: tpl.imageModel ?? TEMPLATE_DEFAULTS.imageModel,
    motionVideoUrl: null,
  });
  log(`[editorial-cover-smoke] enqueued job=${jobId} generation=${generationId}`);

  // ── Drain + poll ─────────────────────────────────────────────────────────
  const deadline = Date.now() + 5 * 60 * 1000;
  let lastStatus = "";
  while (Date.now() < deadline) {
    // Drive the queue exactly like the tick endpoint does.
    try {
      await processBatch(`smoke:${crypto.randomUUID().slice(0, 8)}`, 2);
    } catch (e) {
      log(`[editorial-cover-smoke] processBatch error (continuing): ${(e as Error).message}`);
    }
    const { data: gen } = await supabaseAdmin
      .from("generations")
      .select("status, result_image_url, error, model")
      .eq("id", generationId)
      .maybeSingle();
    if (!gen) throw new Error("generation row vanished");
    if (gen.status !== lastStatus) {
      lastStatus = gen.status ?? "";
      log(`[editorial-cover-smoke] status=${gen.status} model=${gen.model ?? "-"}`);
    }
    if (gen.status === "succeeded" || gen.status === "complete" || gen.status === "completed") {
      if (!gen.result_image_url) throw new Error("succeeded but no result_image_url");
      log(`[editorial-cover-smoke] PASS — result: ${gen.result_image_url}`);
      log(`[editorial-cover-smoke] served by model: ${gen.model}`);
      return;
    }
    if (gen.status === "failed" || gen.status === "error") {
      throw new Error(`generation failed: ${gen.error ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("timed out after 5 minutes");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`[editorial-cover-smoke] FAIL — ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
