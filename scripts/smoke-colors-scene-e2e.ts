/**
 * Colors Show + Scene Builder end-to-end smoke test.
 *
 * This deliberately calls the running TanStack Start server-function endpoints
 * over HTTP, using the same seroval wire format as a browser. It covers:
 *
 *   1. Authenticated Colors Show Wide Shot
 *   2. Authenticated Colors Show Beauty Close-Up
 *   3. Authenticated Scene Builder Base Scene
 *   4. Authenticated Scene Builder Wide re-angle (enqueue + worker)
 *   5. Authenticated Scene Builder Close-Up re-angle (enqueue + worker)
 *
 * Every generated image is checked in generations.result_image_url. Synchronous
 * renders must leave the profile's credits_reserved at zero and add both a
 * reserve and commit ledger entry. Re-angle jobs must finish through
 * finalize_job, leaving the job succeeded and the profile reservation cleared;
 * jobs.credits_reserved is retained as the historical settlement amount.
 *
 * The script spends real Aura/provider credits. Run only with:
 *
 *   CONFIRM_SPEND=1 SMOKE_BASE_URL=http://localhost:8082 \
 *     bun run scripts/smoke-colors-scene-e2e.ts
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { isFreeGpuOnlyMode } from "../src/lib/app-settings.server";
import {
  COLORS_SHOW_COST_PER_SHOT,
} from "../src/lib/colors-show.templates";
import {
  SCENE_BUILDER_COST_BASE,
  SCENE_BUILDER_COST_REANGLE,
  buildBaseScenePrompt,
  buildReAnglePrompt,
  RE_ANGLE_CHIPS,
} from "../src/lib/scene-builder.templates";
import { processOneJob } from "../src/lib/jobs.server";
import { getTestSession, getCredits } from "./lib/get-test-session";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8080";
const SERVER_FN_BASE = `${BASE}/_serverFn/`;
const REF_PHOTO_PATH = "public/josh/josh-pink-mic-portrait.jpg";
const MODEL = "google/gemini-3.1-flash-image-preview";
const TOTAL_COST =
  COLORS_SHOW_COST_PER_SHOT * 2 +
  SCENE_BUILDER_COST_BASE +
  SCENE_BUILDER_COST_REANGLE * 2;

type FnIdMap = Record<string, string>;
type GenerationRow = {
  id: string;
  user_id: string;
  status: string;
  result_image_url: string | null;
  credits_cost: number;
  error: string | null;
};
type JobRow = {
  id: string;
  generation_id: string;
  user_id: string;
  status: string;
  credits_reserved: number;
  error: string | null;
};

function fail(message: string): never {
  throw new Error(`[FAIL] ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function log(message: string) {
  console.log(`[colors-scene-e2e] ${message}`);
}

async function discoverFnIds(
  modulePath: string,
  required: readonly string[],
): Promise<FnIdMap> {
  const response = await fetch(`${BASE}${modulePath}`);
  if (!response.ok) {
    fail(`could not fetch ${modulePath}: HTTP ${response.status}`);
  }
  const source = await response.text();
  const ids: FnIdMap = {};
  for (const match of source.matchAll(/createClientRpc\("([^"]+)"\)/g)) {
    const decoded = JSON.parse(
      Buffer.from(match[1]!, "base64").toString("utf8"),
    ) as { export: string };
    ids[decoded.export.replace(/_createServerFn_handler$/, "")] = match[1]!;
  }
  for (const name of required) {
    if (!ids[name]) fail(`could not discover ${name} in ${modulePath}`);
  }
  return ids;
}

/**
 * Same payload framing used by TanStack Start's serverFnFetcher. Keeping this
 * in the smoke means auth middleware and input validation are exercised too,
 * not only the lower-level render implementation.
 */
async function callServerFn(
  fnId: string,
  opts: { method: "GET" | "POST"; data?: unknown; accessToken: string },
): Promise<unknown> {
  const seroval = await import("seroval");
  const { defaultSerovalPlugins } = await import("@tanstack/router-core");
  const headers: Record<string, string> = {
    "x-tsr-serverFn": "true",
    accept: "application/json",
    Authorization: `Bearer ${opts.accessToken}`,
  };
  let url = SERVER_FN_BASE + fnId;
  let body: string | undefined;
  if (opts.data !== undefined) {
    const payload = JSON.stringify(
      await seroval.toJSONAsync(
        { data: opts.data },
        { plugins: defaultSerovalPlugins },
      ),
    );
    if (opts.method === "GET") {
      url += `?payload=${encodeURIComponent(payload)}`;
    } else {
      body = payload;
      headers["content-type"] = "application/json";
    }
  }

  const response = await fetch(url, {
    method: opts.method,
    headers,
    body,
    signal: AbortSignal.timeout(180_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    fail(`server function returned ${response.status} ${contentType}`);
  }
  const decoded = seroval.fromCrossJSON(
    (await response.json()) as Parameters<typeof seroval.fromCrossJSON>[0],
    { refs: new Map(), plugins: defaultSerovalPlugins },
  ) as { result?: unknown; error?: unknown };
  if (decoded.error !== undefined && decoded.error !== null) {
    throw decoded.error instanceof Error
      ? decoded.error
      : new Error(
          typeof decoded.error === "object"
            ? JSON.stringify(decoded.error)
            : String(decoded.error),
        );
  }
  return decoded.result;
}

async function uploadReference(userId: string): Promise<{
  path: string;
  url: string;
}> {
  const bytes = await readFile(REF_PHOTO_PATH);
  const path = `${userId}/uploads/colors-scene-e2e-${randomUUID()}.jpg`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) fail(`reference upload failed: ${uploadError.message}`);
  const { data, error: signError } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60);
  if (signError || !data?.signedUrl) {
    fail(`reference signing failed: ${signError?.message ?? "no signed URL"}`);
  }
  return { path, url: data.signedUrl };
}

async function readGeneration(id: string): Promise<GenerationRow> {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, status, result_image_url, credits_cost, error")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(`generation ${id} lookup failed: ${error.message}`);
  assert(data, `generation ${id} was not written`);
  return data as GenerationRow;
}

async function readJob(id: string): Promise<JobRow> {
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("id, generation_id, user_id, status, credits_reserved, error")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(`job ${id} lookup failed: ${error.message}`);
  assert(data, `job ${id} was not written`);
  return data as JobRow;
}

async function processExpectedJob(
  jobId: string,
  generationId: string,
): Promise<{ job: JobRow; generation: GenerationRow }> {
  const workerId = `colors-scene-e2e-${randomUUID().slice(0, 8)}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const before = await readJob(jobId);
    if (before.status === "succeeded") {
      const generation = await readGeneration(generationId);
      return { job: before, generation };
    }
    if (before.status === "failed") {
      fail(`job ${jobId} failed: ${before.error ?? "unknown error"}`);
    }

    const result = await processOneJob(workerId);
    if (result.processed && result.jobId !== jobId) {
      log(`worker claimed another queued job (${result.jobId}); checking ours again`);
    }
    const after = await readJob(jobId);
    if (after.status === "succeeded") {
      const generation = await readGeneration(generationId);
      return { job: after, generation };
    }
    if (after.status === "failed") {
      fail(`job ${jobId} failed: ${after.error ?? result.error ?? "unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  const finalJob = await readJob(jobId);
  fail(`job ${jobId} did not finish (status=${finalJob.status})`);
}

async function assertSynchronousSuccess(
  label: string,
  outcome: unknown,
  userId: string,
): Promise<GenerationRow> {
  const result = outcome as {
    ok?: boolean;
    url?: string;
    generationId?: string;
    error?: string;
  };
  assert(result.ok === true, `${label} returned ${result.error ?? "ok=false"}`);
  assert(result.generationId, `${label} did not return a generationId`);
  assert(result.url?.startsWith("http"), `${label} did not return an HTTP URL`);
  const generation = await readGeneration(result.generationId);
  assert(generation.user_id === userId, `${label} row belongs to another user`);
  assert(
    generation.status === "succeeded",
    `${label} status is ${generation.status}, expected succeeded`,
  );
  assert(
    typeof generation.result_image_url === "string" &&
      generation.result_image_url.startsWith("http"),
    `${label} result_image_url is not set`,
  );
  assert(
    generation.result_image_url === result.url,
    `${label} returned URL does not match generations.result_image_url`,
  );
  return generation;
}

async function assertLedger(
  userId: string,
  startedAt: string,
  expectedReasons: readonly string[],
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("credit_ledger")
    .select("delta, reason")
    .eq("user_id", userId)
    .gte("created_at", startedAt);
  if (error) fail(`credit ledger lookup failed: ${error.message}`);
  const entries = (data ?? []) as Array<{ delta: number; reason: string }>;
  for (const reason of expectedReasons) {
    assert(
      entries.some((entry) => entry.reason === reason),
      `missing ledger entry ${reason}`,
    );
  }
  assert(
    !entries.some((entry) => entry.reason.startsWith("release:")),
    "a reservation was released instead of committed",
  );
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("credits_reserved")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) fail(`profile lookup failed: ${profileError.message}`);
  assert(
    profile?.credits_reserved === 0,
    `credits_reserved must return to zero (got ${profile?.credits_reserved})`,
  );
}

async function main() {
  if (process.env.CONFIRM_SPEND !== "1") {
    fail(
      "This smoke spends real Aura/provider credits. Re-run with CONFIRM_SPEND=1.",
    );
  }
  if (await isFreeGpuOnlyMode()) {
    fail(
      "Free-GPU-only mode is enabled; paid image providers are blocked before dispatch.",
    );
  }

  const [colorsFnIds, sceneFnIds, studioFnIds] = await Promise.all([
    discoverFnIds("/src/lib/colors-show.functions.ts", [
      "generateColorsShowShot",
    ]),
    discoverFnIds("/src/lib/scene-builder.functions.ts", ["generateBaseScene"]),
    discoverFnIds("/src/lib/studio.functions.ts", ["generatePerformanceShot"]),
  ]);
  const { userId, accessToken } = await getTestSession();
  const originalCredits = await getCredits(userId);
  assert(
    originalCredits !== null && originalCredits >= TOTAL_COST,
    `QA user needs at least ${TOTAL_COST} Aura (has ${originalCredits ?? "none"})`,
  );
  const startedAt = new Date().toISOString();
  const reference = await uploadReference(userId);
  log(`QA session ready; reference uploaded to the user's studio folder`);

  try {
    const call = (
      fnId: string,
      data: unknown,
    ) => callServerFn(fnId, { method: "POST", data, accessToken });

    log("1/5 Colors Show Wide Full Body — generating");
    const wide = await call(colorsFnIds.generateColorsShowShot!, {
      selfieUrl: reference.url,
      colorName: "deep royal blue",
      outfit: "a tailored black satin suit with a white shirt",
      shotType: "wide",
    });
    const wideGeneration = await assertSynchronousSuccess(
      "Colors Show Wide Full Body",
      wide,
      userId,
    );
    log(`1/5 passed (${wideGeneration.id})`);

    log("2/5 Colors Show Beauty Close-Up — generating");
    const closeup = await call(colorsFnIds.generateColorsShowShot!, {
      selfieUrl: reference.url,
      colorName: "deep royal blue",
      outfit: "a tailored black satin suit with a white shirt",
      shotType: "closeup",
    });
    const closeupGeneration = await assertSynchronousSuccess(
      "Colors Show Beauty Close-Up",
      closeup,
      userId,
    );
    log(`2/5 passed (${closeupGeneration.id})`);

    log("3/5 Scene Builder Base Scene — generating");
    const base = await call(sceneFnIds.generateBaseScene!, {
      referenceUrls: [reference.url],
      compositorPrompt: buildBaseScenePrompt(
        "a black satin suit",
        "a cinematic blue cyclorama studio",
        "a vintage silver microphone",
      ),
    });
    const baseGeneration = await assertSynchronousSuccess(
      "Scene Builder Base Scene",
      base,
      userId,
    );
    log(`3/5 passed (${baseGeneration.id})`);

    const baseResult = base as { url: string };
    const angleInputs = [
      RE_ANGLE_CHIPS.find((chip) => chip.id === "wide")!,
      RE_ANGLE_CHIPS.find((chip) => chip.id === "closeup")!,
    ];
    const angleResults: Array<{ jobId: string; generationId: string }> = [];
    for (let index = 0; index < angleInputs.length; index++) {
      const angle = angleInputs[index]!;
      log(`${index + 4}/5 Scene Builder ${angle.label} — enqueueing`);
      const queued = (await call(studioFnIds.generatePerformanceShot!, {
        prompt: `[Scene Builder / ${angle.label}]\n\n${buildReAnglePrompt(angle.cameraPrompt)}`,
        imageUrls: [baseResult.url],
        motionVideoUrl: null,
        model: MODEL,
      })) as { jobId?: string; generationId?: string };
      assert(queued.jobId, `Scene Builder ${angle.label} did not return a jobId`);
      assert(
        queued.generationId,
        `Scene Builder ${angle.label} did not return a generationId`,
      );
      const processed = await processExpectedJob(
        queued.jobId,
        queued.generationId,
      );
      assert(
        processed.job.user_id === userId,
        `Scene Builder ${angle.label} job belongs to another user`,
      );
      assert(
        processed.generation.status === "succeeded",
        `Scene Builder ${angle.label} generation did not succeed`,
      );
      assert(
        typeof processed.generation.result_image_url === "string" &&
          processed.generation.result_image_url.startsWith("http"),
        `Scene Builder ${angle.label} result_image_url is not set`,
      );
      angleResults.push({
        jobId: queued.jobId,
        generationId: queued.generationId,
      });
      log(`${index + 4}/5 passed (${processed.generation.id})`);
    }

    await assertLedger(userId, startedAt, [
      "reserve:colors_show",
      "commit:colors_show",
      "reserve:scene_builder_base",
      "commit:scene_builder_base",
      "reserve:job_image",
      "commit:job_image",
    ]);

    const { data: afterProfile, error: afterError } = await supabaseAdmin
      .from("profiles")
      .select("credits, credits_reserved")
      .eq("user_id", userId)
      .maybeSingle();
    if (afterError) fail(`final profile lookup failed: ${afterError.message}`);
    assert(afterProfile, "final profile row is missing");
    assert(
      afterProfile.credits === originalCredits - TOTAL_COST,
      `expected ${TOTAL_COST} Aura charged; balance moved from ${originalCredits} to ${afterProfile.credits}`,
    );
    assert(
      afterProfile.credits_reserved === 0,
      `final credits_reserved must be zero (got ${afterProfile.credits_reserved})`,
    );

    log(
      `ALL CHECKS PASSED — 5 images generated, ${TOTAL_COST} Aura committed, no release entries`,
    );
    log(
      `generation IDs: ${[
        wideGeneration.id,
        closeupGeneration.id,
        baseGeneration.id,
        ...angleResults.map((angle) => angle.generationId),
      ].join(", ")}`,
    );
  } finally {
    await supabaseAdmin.storage.from("studio").remove([reference.path]);
  }
}

main().catch((error) => {
  console.error(
    "[colors-scene-e2e] FAILED:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});