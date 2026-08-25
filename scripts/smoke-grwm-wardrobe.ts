/**
 * Live GRWM wardrobe enqueue integration smoke.
 *
 * Verifies the authenticated browser/server-function path:
 * upload -> addWardrobeItem -> listWardrobeItems -> signed URL fetch ->
 * startTiktokRemix(style=grwm) -> queued job payload contains the outfit.
 *
 * This attempts cancellation through the production job-cancellation path before
 * provider dispatch. It verifies wardrobe persistence, authenticated transport,
 * ownership guards, credit reservation/release, and queue payload wiring. A
 * worker can still win the queue CAS first, so the script refuses to run without
 * CONFIRM_SPEND=1 acknowledging possible paid provider dispatch.
 *
 * The run uses a fresh ephemeral auth user. All temporary auth/database/storage
 * state is removed in finally, so repeated runs cannot poison the shared QA user.
 *
 * Run with:
 *   CONFIRM_SPEND=1 bun run scripts/smoke-grwm-wardrobe.ts
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { extractStudioPath } from "../src/lib/tiktok-remix.functions";
import { COST_TIKTOK_REMIX_CUT } from "../src/lib/pricing";
import { cancelJobForUser } from "../src/lib/jobs.functions";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8080";
const SERVER_FN_BASE = `${BASE}/_serverFn/`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createEphemeralSession(): Promise<{ accessToken: string; userId: string }> {
  const email = `qa-grwm-${crypto.randomUUID()}@aurora-internal.test`;
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  assert(!createError && created.user, `ephemeral auth user creation failed: ${createError?.message}`);

  try {
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    assert(
      !linkError && link.properties?.hashed_token,
      `ephemeral magic-link creation failed: ${linkError?.message}`,
    );

    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    assert(supabaseUrl && anonKey, "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set");
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    assert(
      !verifyError && verified.session?.access_token,
      `ephemeral magic-link verification failed: ${verifyError?.message}`,
    );
    return { accessToken: verified.session.access_token, userId: created.user.id };
  } catch (error) {
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    if (deleteError) {
      throw new Error(
        `${
          error instanceof Error ? error.message : String(error)
        }; ephemeral auth-user cleanup also failed: ${deleteError.message}`,
      );
    }
    throw error;
  }
}

async function settleSmokeJob(userId: string, jobId: string): Promise<string> {
  try {
    await cancelJobForUser(userId, jobId);
    return "cancelled";
  } catch (cancelError) {
    // If a worker won the same queued CAS, never delete or mutate underneath
    // it. A valid source MP4 is used so the normal finalizer can settle safely.
    for (let attempt = 0; attempt < 180; attempt++) {
      const { data: job, error } = await supabaseAdmin
        .from("jobs")
        .select("status")
        .eq("id", jobId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`job settlement lookup failed: ${error.message}`);
      if (!job) throw cancelError;
      const status = (job as { status: string }).status;
      if (["succeeded", "failed", "cancelled"].includes(status)) return status;
      await Bun.sleep(2_000);
    }
    throw new Error(
      `smoke job could not be cancelled and did not settle within six minutes: ${
        cancelError instanceof Error ? cancelError.message : String(cancelError)
      }`,
    );
  }
}

async function listStudioObjectsRecursively(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await supabaseAdmin.storage
      .from("studio")
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list studio/${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null && entry.metadata === null) {
        paths.push(...(await listStudioObjectsRecursively(path)));
      } else {
        paths.push(path);
      }
    }
    if ((data?.length ?? 0) < limit) break;
  }
  return paths;
}

async function discoverFnIds(modulePath: string, required: string[]): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}${modulePath}`, { signal: AbortSignal.timeout(30_000) });
  assert(res.ok, `module fetch failed for ${modulePath}: ${res.status}`);
  const source = await res.text();
  const ids: Record<string, string> = {};
  for (const match of source.matchAll(/createClientRpc\("([^"]+)"\)/g)) {
    const decoded = JSON.parse(Buffer.from(match[1]!, "base64").toString("utf8")) as {
      export: string;
    };
    ids[decoded.export.replace(/_createServerFn_handler$/, "")] = match[1]!;
  }
  for (const name of required) assert(ids[name], `missing server function ${name}`);
  return ids;
}

async function callServerFn(
  fnId: string,
  opts: { method: "GET" | "POST"; data?: unknown; accessToken: string },
): Promise<unknown> {
  const seroval = await import("seroval");
  const { defaultSerovalPlugins } = await import(
    "../node_modules/@tanstack/react-router/node_modules/@tanstack/router-core/dist/esm/index.js"
  );
  const headers: Record<string, string> = {
    "x-tsr-serverFn": "true",
    accept: "application/json",
    Authorization: `Bearer ${opts.accessToken}`,
  };
  let url = SERVER_FN_BASE + fnId;
  let body: string | undefined;
  if (opts.data !== undefined) {
    const encoded = JSON.stringify(
      await seroval.toJSONAsync({ data: opts.data }, { plugins: defaultSerovalPlugins }),
    );
    if (opts.method === "GET") url += `?payload=${encodeURIComponent(encoded)}`;
    else {
      body = encoded;
      headers["content-type"] = "application/json";
    }
  }
  const res = await fetch(url, {
    method: opts.method,
    headers,
    body,
    signal: AbortSignal.timeout(120_000),
  });
  assert(res.headers.get("content-type")?.includes("application/json"), `non-JSON response ${res.status}`);
  const payload = (await res.json()) as Parameters<typeof seroval.fromCrossJSON>[0];
  const decoded = seroval.fromCrossJSON(payload, {
    refs: new Map(),
    plugins: defaultSerovalPlugins,
  }) as { result?: unknown; error?: unknown };
  if (decoded.error) {
    throw decoded.error instanceof Error
      ? decoded.error
      : new Error(typeof decoded.error === "object" ? JSON.stringify(decoded.error) : String(decoded.error));
  }
  return decoded.result;
}

async function main() {
  assert(
    process.env.CONFIRM_SPEND === "1",
    "Refusing to enqueue a real worker job without explicit spend opt-in. Run with CONFIRM_SPEND=1.",
  );
  const wardrobeFns = await discoverFnIds("/src/lib/wardrobe.functions.ts", [
    "addWardrobeItem",
    "listWardrobeItems",
  ]);
  const remixFns = await discoverFnIds("/src/lib/tiktok-remix.functions.ts", ["startTiktokRemix"]);
  const { accessToken, userId } = await createEphemeralSession();
  const nonce = crypto.randomUUID();
  const outfitPath = `${userId}/wardrobe/smoke-${nonce}.jpg`;
  const sourcePath = `${userId}/uploads/grwm-smoke-${nonce}.mp4`;
  let wardrobeId: string | null = null;
  let remixId: string | null = null;
  let jobIds: string[] = [];

  try {
    const outfitBytes = await readFile("public/josh/josh-pink-mic-portrait.jpg");
    const { error: outfitUploadError } = await supabaseAdmin.storage
      .from("studio")
      .upload(outfitPath, outfitBytes, { contentType: "image/jpeg", upsert: false });
    assert(!outfitUploadError, `outfit upload failed: ${outfitUploadError?.message}`);

    const sourceBytes = await readFile("public/viral-presets/preview-2.mp4");
    const { error: sourceUploadError } = await supabaseAdmin.storage
      .from("studio")
      .upload(sourcePath, sourceBytes, {
        contentType: "video/mp4",
        upsert: false,
      });
    assert(!sourceUploadError, `source upload failed: ${sourceUploadError?.message}`);

    const added = (await callServerFn(wardrobeFns.addWardrobeItem!, {
      method: "POST",
      data: { storagePath: outfitPath, label: `GRWM smoke ${nonce}` },
      accessToken,
    })) as { id: string };
    wardrobeId = added.id;
    assert(wardrobeId, "addWardrobeItem returned no id");

    const listed = (await callServerFn(wardrobeFns.listWardrobeItems!, {
      method: "GET",
      accessToken,
    })) as Array<{ id: string; storage_path: string; url: string }>;
    const item = listed.find((candidate) => candidate.id === wardrobeId);
    assert(item, "listWardrobeItems omitted the inserted item");
    assert(item.storage_path === outfitPath, "listed storage path changed");
    assert(extractStudioPath(item.url) === outfitPath, "signed outfit URL does not point to wardrobe object");
    const signedFetch = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
    assert(signedFetch.ok, `signed outfit URL did not resolve: ${signedFetch.status}`);

    const { error: fundError } = await supabaseAdmin
      .from("profiles")
      .upsert({ user_id: userId, credits: COST_TIKTOK_REMIX_CUT + 10 }, { onConflict: "user_id" });
    assert(!fundError, `ephemeral smoke profile funding failed: ${fundError?.message}`);

    const { data: sourceSigned, error: sourceSignError } = await supabaseAdmin.storage
      .from("studio")
      .createSignedUrl(sourcePath, 60 * 60);
    assert(!sourceSignError && sourceSigned?.signedUrl, `source signing failed: ${sourceSignError?.message}`);

    const started = (await callServerFn(remixFns.startTiktokRemix!, {
      method: "POST",
      data: {
        sourceVideoUrl: sourceSigned.signedUrl,
        outfitImageUrl: item.url,
        style: "grwm",
        count: 1,
        duration: 3,
        basePrompt: "GRWM wardrobe smoke verification",
      },
      accessToken,
    })) as { remixId: string; enqueued: number; failed: Array<{ error: string }> };
    remixId = started.remixId;
    assert(
      started.enqueued === 1,
      `expected one queued cut, got ${started.enqueued}: ${started.failed[0]?.error ?? "unknown enqueue error"}`,
    );

    const { data: remix, error: remixError } = await supabaseAdmin
      .from("tiktok_remixes")
      .select("child_job_ids")
      .eq("id", remixId)
      .single();
    assert(!remixError && remix, `remix lookup failed: ${remixError?.message}`);
    jobIds = ((remix as { child_job_ids?: string[] }).child_job_ids ?? []).filter(Boolean);
    assert(jobIds.length === 1, `expected one child job id, got ${jobIds.length}`);

    // Cancel first. The production helper CAS-gates queued -> cancelled and
    // releases the exact reservation before this smoke inspects/deletes rows.
    const settledStatus = await settleSmokeJob(userId, jobIds[0]!);

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("payload, status")
      .eq("id", jobIds[0]!)
      .single();
    assert(!jobError && job, `job lookup failed: ${jobError?.message}`);
    assert(
      (job as { status: string }).status === settledStatus,
      "smoke job status changed after safe settlement",
    );
    const payload = (job as { payload?: { sourceImageUrl?: string } }).payload;
    assert(payload?.sourceImageUrl, "queued GRWM payload omitted sourceImageUrl");
    assert(
      extractStudioPath(payload.sourceImageUrl) === outfitPath,
      "queued GRWM payload does not reference the selected wardrobe object",
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credits, credits_reserved")
      .eq("user_id", userId)
      .single();
    assert(!profileError && profile, `smoke profile verification failed: ${profileError?.message}`);
    const expectedCredits = settledStatus === "succeeded" ? 10 : COST_TIKTOK_REMIX_CUT + 10;
    assert((profile as { credits: number }).credits === expectedCredits, "job settlement left the wrong Aura balance");
    assert(
      (profile as { credits_reserved: number }).credits_reserved === 0,
      "job cancellation left reserved Aura behind",
    );

    console.log("PASS upload -> add -> list -> signed URL -> GRWM queue payload -> safe settlement");
    console.log(`PASS wardrobe object path: ${outfitPath}`);
    console.log(`PASS job status: ${settledStatus}; reserved Aura: 0`);
  } finally {
    const cleanupErrors: string[] = [];
    let terminalStateConfirmed = true;
    const recordCleanupError = (label: string, error: unknown) => {
      cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    };
    const checkCleanup = async (
      label: string,
      operation: () => PromiseLike<{ error: { message: string } | null }>,
    ) => {
      try {
        const { error } = await operation();
        if (error) cleanupErrors.push(`${label}: ${error.message}`);
      } catch (error) {
        recordCleanupError(label, error);
      }
    };

    const jobs = await supabaseAdmin
      .from("jobs")
      .select("id, status")
      .eq("user_id", userId);
    if (jobs.error) {
      terminalStateConfirmed = false;
      recordCleanupError("list smoke jobs", jobs.error);
    } else {
      for (const job of jobs.data ?? []) {
        const status = (job as { status: string }).status;
        if (!["succeeded", "failed", "cancelled"].includes(status)) {
          try {
            await settleSmokeJob(userId, (job as { id: string }).id);
          } catch (error) {
            terminalStateConfirmed = false;
            recordCleanupError(`settle smoke job ${(job as { id: string }).id}`, error);
          }
        }
      }
    }

    const terminalCheck = await supabaseAdmin
      .from("jobs")
      .select("id, status")
      .eq("user_id", userId);
    if (terminalCheck.error) {
      terminalStateConfirmed = false;
      recordCleanupError("confirm terminal smoke jobs", terminalCheck.error);
    }
    const nonterminalJobs = (terminalCheck.data ?? []).filter(
      (job) => !["succeeded", "failed", "cancelled"].includes((job as { status: string }).status),
    );
    if (nonterminalJobs.length > 0) terminalStateConfirmed = false;

    if (!terminalStateConfirmed) {
      const preservedJobs = nonterminalJobs.length
        ? nonterminalJobs
            .map((job) => `${(job as { id: string }).id}:${(job as { status: string }).status}`)
            .join(", ")
        : "status unavailable; inspect all jobs for this user";
      throw new Error(
        `GRWM smoke could not confirm terminal jobs. No records or media were deleted so normal finalization can recover safely. ` +
          `Preserved user ${userId}; jobs ${preservedJobs}.\n- ${cleanupErrors.join("\n- ")}`,
      );
    }

    await checkCleanup("delete smoke jobs", () =>
      supabaseAdmin.from("jobs").delete().eq("user_id", userId),
    );
    await checkCleanup("delete smoke generations", () =>
      supabaseAdmin.from("generations").delete().eq("user_id", userId),
    );
    await checkCleanup("delete smoke remix", () =>
      supabaseAdmin.from("tiktok_remixes").delete().eq("user_id", userId),
    );
    await checkCleanup("delete smoke wardrobe", () =>
      supabaseAdmin.from("wardrobe_items").delete().eq("user_id", userId),
    );
    try {
      const objectPaths = await listStudioObjectsRecursively(userId);
      for (let index = 0; index < objectPaths.length; index += 100) {
        const { error } = await supabaseAdmin.storage
          .from("studio")
          .remove(objectPaths.slice(index, index + 100));
        if (error) cleanupErrors.push(`delete smoke storage objects: ${error.message}`);
      }
      const residualPaths = await listStudioObjectsRecursively(userId);
      if (residualPaths.length > 0) {
        cleanupErrors.push(`delete smoke storage objects: ${residualPaths.length} object(s) remain`);
      }
    } catch (error) {
      recordCleanupError("clean smoke storage prefix", error);
    }
    await checkCleanup("delete smoke ledger", () =>
      supabaseAdmin.from("credit_ledger").delete().eq("user_id", userId),
    );
    await checkCleanup("delete smoke profile", () =>
      supabaseAdmin.from("profiles").delete().eq("user_id", userId),
    );
    await checkCleanup("delete smoke auth user", () =>
      supabaseAdmin.auth.admin.deleteUser(userId),
    );

    if (cleanupErrors.length) {
      throw new Error(`GRWM smoke cleanup failed:\n- ${cleanupErrors.join("\n- ")}`);
    }
  }
}

await main();