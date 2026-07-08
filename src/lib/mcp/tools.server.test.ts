import { describe, expect, it } from "bun:test";
import {
  buildBulkImagePayload,
  requireAvatarReference,
  generateVideoTool,
  imageToVideoTool,
  bulkGenerateTool,
  animateFromDrivingVideoTool,
  performanceReskinTool,
  generateUgcAdTool,
  generateCampaignTool,
  listAvatarsTool,
  getJobStatusTool,
  createAvatarTool,
  submitJobTool,
  listJobsTool,
  cancelJobTool,
  type ToolCtx,
  type ToolDeps,
} from "./tools.server";
import { COST_UGC_AD, COST_CAMPAIGN_ITEM } from "@/lib/ugc.server";
import { computeCost } from "@/lib/pricing";
import type { Avatar, ToolResult } from "./types";

// These guard the "one avatar, many shots" identity contract for the MCP path.
// The regression we are protecting against: a bulk/video generation that drops the
// avatar's reference image and renders from the trigger word alone → every shot is
// a different random face. requireAvatarReference + buildBulkImagePayload are the
// single source of truth for that contract, so testing them pins the behavior.

const TRUSTED_HOST = "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/";
const TRUSTED_REF = `${TRUSTED_HOST}josh-front.jpeg`;

describe("requireAvatarReference", () => {
  it("returns the avatar's reference image when it is present and trusted", () => {
    expect(requireAvatarReference({ name: "Josh", preview_url: TRUSTED_REF })).toBe(TRUSTED_REF);
  });

  it("throws a clear, caller-facing error when the avatar has no reference image", () => {
    for (const preview_url of [null, undefined, ""]) {
      expect(() => requireAvatarReference({ name: "Josh", preview_url })).toThrow(
        /Josh.*no reference image.*image_urls/,
      );
    }
  });

  it("rejects an untrusted reference host (SSRF guard), never letting it through", () => {
    expect(() =>
      requireAvatarReference({ name: "Josh", preview_url: "https://evil.example.com/josh.png" }),
    ).toThrow(/host not allowed/);
  });
});

describe("buildBulkImagePayload", () => {
  it("locks identity: payload carries the reference image and the image-input model", () => {
    const payload = buildBulkImagePayload("josh sipping coffee, golden hour", TRUSTED_REF);
    expect(payload).toEqual({
      kind: "image",
      model: "google/gemini-3.1-flash-image-preview",
      prompt: "josh sipping coffee, golden hour",
      imageUrls: [TRUSTED_REF],
    });
  });

  it("never produces a text-only payload (imageUrls must be non-empty)", () => {
    const payload = buildBulkImagePayload("any prompt", TRUSTED_REF);
    expect(payload.imageUrls).toHaveLength(1);
    expect(payload.imageUrls[0]).toBe(TRUSTED_REF);
  });
});

// ─── Credit / dispatch contract (injected fakes — no Supabase, no network) ─────
// Each tool's billing path is pinned here: the exact _kind + _amount it reserves,
// that preconditions (missing avatar, missing reference, no GPU worker) fail
// BEFORE any reservation, that sync tools go through exactly one callGenerate, and
// that an insufficient balance surfaces as "Not enough Aura".

const CTX: ToolCtx = { userId: "user-1", bearer: "aurk_test", origin: "https://app.test" };

function makeAvatar(over: Partial<Avatar> = {}): Avatar {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "user-1",
    name: "Josh",
    handle: "josh",
    lora_id: null,
    sync_lora_id: null,
    trigger_word: null,
    style: null,
    preview_url: TRUSTED_REF,
    training_status: "completed",
    training_submitted_at: null,
    training_completed_at: null,
    training_error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

type RpcCall = { name: string; args: Record<string, unknown> };

function makeDeps(over: Partial<ToolDeps> = {}) {
  const rpcCalls: RpcCall[] = [];
  const generateCalls: Record<string, unknown>[] = [];
  const enqueueCalls: Array<{ userId: string; input: unknown }> = [];
  const cancelCalls: Array<{ userId: string; jobId: string }> = [];
  const deps: ToolDeps = {
    rpc: async (name, args) => {
      rpcCalls.push({ name, args });
      return { data: { job_id: `job-${rpcCalls.length}`, generation_id: `gen-${rpcCalls.length}` }, error: null };
    },
    callGenerate: async (_ctx, body) => {
      generateCalls.push(body);
      return { url: "https://cdn.example/out.mp4", provider: "replicate" };
    },
    getAvatarByName: async () => null,
    listAvatars: async () => [],
    createAvatar: async () => makeAvatar(),
    hasActiveWorkerForKind: async () => true,
    getJobRow: async () => null,
    getGenerationRow: async () => null,
    enqueueJob: async (userId, input) => {
      enqueueCalls.push({ userId, input });
      return { jobId: "job-q1", generationId: "gen-q1", preview: false };
    },
    listJobs: async () => [],
    cancelJob: async (userId, jobId) => {
      cancelCalls.push({ userId, jobId });
      return { ok: true as const };
    },
    ...over,
  };
  return { deps, rpcCalls, generateCalls, enqueueCalls, cancelCalls };
}

function parse(r: ToolResult) {
  return JSON.parse(r.content[0].text) as Record<string, unknown>;
}

const reserveCalls = (rpcCalls: RpcCall[]) => rpcCalls.filter((c) => c.name === "create_generation_and_reserve");

describe("generateVideoTool (synchronous, kind=video)", () => {
  it("renders via exactly one callGenerate and reserves nothing through rpc", async () => {
    const { deps, rpcCalls, generateCalls } = makeDeps();
    const res = await generateVideoTool({ prompt: "a cat dancing" }, CTX, deps);
    expect(res.isError).toBeFalsy();
    expect(generateCalls).toHaveLength(1);
    expect(generateCalls[0].kind).toBe("video");
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
  });

  it("locks identity: an avatar with a reference drives the shot via imageUrls", async () => {
    const { deps, generateCalls } = makeDeps({
      getAvatarByName: async () => makeAvatar({ trigger_word: "joshlora" }),
    });
    await generateVideoTool({ prompt: "rooftop golden hour", avatar_name: "Josh" }, CTX, deps);
    expect(generateCalls[0].imageUrls).toEqual([TRUSTED_REF]);
  });

  it("fails before generating when the named avatar does not exist", async () => {
    const { deps, generateCalls } = makeDeps({ getAvatarByName: async () => null });
    const res = await generateVideoTool({ prompt: "x", avatar_name: "Ghost" }, CTX, deps);
    expect(res.isError).toBe(true);
    expect(generateCalls).toHaveLength(0);
  });

  it("fails before generating when the avatar has no reference image", async () => {
    const { deps, generateCalls } = makeDeps({
      getAvatarByName: async () => makeAvatar({ preview_url: null }),
    });
    const res = await generateVideoTool({ prompt: "x", avatar_name: "Josh" }, CTX, deps);
    expect(res.isError).toBe(true);
    expect(generateCalls).toHaveLength(0);
  });
});

describe("imageToVideoTool (synchronous, kind=video)", () => {
  it("animates via one callGenerate carrying the source image", async () => {
    const { deps, rpcCalls, generateCalls } = makeDeps();
    const res = await imageToVideoTool(
      { image_url: "https://cdn.example/in.png", prompt: "slow zoom" },
      CTX,
      deps,
    );
    expect(res.isError).toBeFalsy();
    expect(generateCalls).toHaveLength(1);
    expect(generateCalls[0].kind).toBe("video");
    expect(generateCalls[0].imageUrls).toEqual(["https://cdn.example/in.png"]);
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
  });
});

describe("bulkGenerateTool (queued, 1 credit per image)", () => {
  it("reserves _kind=image _amount=1 once per requested image", async () => {
    const { deps, rpcCalls } = makeDeps({ getAvatarByName: async () => makeAvatar() });
    const res = await bulkGenerateTool(
      { avatar_name: "Josh", prompt_template: "coffee shop", count: 3 },
      CTX,
      deps,
    );
    const reserves = reserveCalls(rpcCalls);
    expect(reserves).toHaveLength(3);
    for (const c of reserves) {
      expect(c.args._kind).toBe("image");
      expect(c.args._amount).toBe(1);
    }
    expect(parse(res).total_credits).toBe(3);
  });

  it("does not reserve when the avatar is missing or has no reference", async () => {
    const missing = makeDeps({ getAvatarByName: async () => null });
    const r1 = await bulkGenerateTool({ avatar_name: "Ghost", prompt_template: "x", count: 5 }, CTX, missing.deps);
    expect(r1.isError).toBe(true);
    expect(reserveCalls(missing.rpcCalls)).toHaveLength(0);

    const noRef = makeDeps({ getAvatarByName: async () => makeAvatar({ preview_url: null }) });
    const r2 = await bulkGenerateTool({ avatar_name: "Josh", prompt_template: "x", count: 5 }, CTX, noRef.deps);
    expect(r2.isError).toBe(true);
    expect(reserveCalls(noRef.rpcCalls)).toHaveLength(0);
  });

  it("stops early with a 'Not enough Aura' warning on insufficient credits", async () => {
    const { deps } = makeDeps({
      getAvatarByName: async () => makeAvatar(),
      rpc: async () => ({ data: null, error: { message: "insufficient_credits" } }),
    });
    const res = await bulkGenerateTool({ avatar_name: "Josh", prompt_template: "x", count: 4 }, CTX, deps);
    expect(parse(res).warning).toMatch(/Not enough Aura/);
    expect(parse(res).total_jobs).toBe(0);
  });
});

describe("animateFromDrivingVideoTool (motion, priced via computeCost)", () => {
  const ARGS = {
    image_url: `${TRUSTED_HOST}ref.png`,
    driving_video_url: `${TRUSTED_HOST}drive.mp4`,
  };

  it("reserves _kind=motion at the Transfer Motion price (30) when a motion worker is online", async () => {
    const { deps, rpcCalls } = makeDeps({ hasActiveWorkerForKind: async () => true });
    const res = await animateFromDrivingVideoTool(ARGS, CTX, deps);
    // Must equal the in-app Transfer Motion price at the 5s/720p reference.
    expect(parse(res).credits).toBe(computeCost({ features: ["motion"] }).total);
    expect(parse(res).credits).toBe(30);
    const reserves = reserveCalls(rpcCalls);
    expect(reserves).toHaveLength(1);
    expect(reserves[0].args._kind).toBe("motion");
    expect(reserves[0].args._amount).toBe(30);
  });

  it("fails BEFORE reserving when no motion-capable worker is connected", async () => {
    const { deps, rpcCalls } = makeDeps({ hasActiveWorkerForKind: async () => false });
    const res = await animateFromDrivingVideoTool(ARGS, CTX, deps);
    expect(res.isError).toBe(true);
    expect(parse(res).error).toMatch(/motion-capable GPU backend/);
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
  });

  it("surfaces 'Not enough Aura' on insufficient credits", async () => {
    const { deps } = makeDeps({
      hasActiveWorkerForKind: async () => true,
      rpc: async () => ({ data: null, error: { message: "insufficient_credits" } }),
    });
    const res = await animateFromDrivingVideoTool(ARGS, CTX, deps);
    expect(res.isError).toBe(true);
    expect(parse(res).error).toBe("Not enough Aura");
  });
});

describe("performanceReskinTool (performance_reskin, priced via computeCost)", () => {
  const ARGS = {
    performance_video_url: `${TRUSTED_HOST}perf.mp4`,
    avatar_image_url: `${TRUSTED_HOST}avatar.png`,
  };

  it("reserves _kind=performance_reskin at the Performance Shot price (40) when a motion worker is online", async () => {
    const { deps, rpcCalls } = makeDeps({ hasActiveWorkerForKind: async () => true });
    const res = await performanceReskinTool(ARGS, CTX, deps);
    // Must equal the in-app Performance Shot price (video + motion, 5s/720p).
    expect(parse(res).credits).toBe(computeCost({ features: ["video", "motion"] }).total);
    expect(parse(res).credits).toBe(40);
    const reserves = reserveCalls(rpcCalls);
    expect(reserves).toHaveLength(1);
    expect(reserves[0].args._kind).toBe("performance_reskin");
    expect(reserves[0].args._amount).toBe(40);
  });

  it("fails BEFORE reserving when no motion-capable worker is connected", async () => {
    const { deps, rpcCalls } = makeDeps({ hasActiveWorkerForKind: async () => false });
    const res = await performanceReskinTool(ARGS, CTX, deps);
    expect(res.isError).toBe(true);
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
  });
});

describe("generateUgcAdTool (ugc_ad, COST_UGC_AD credits)", () => {
  it("reserves _kind=ugc_ad _amount=COST_UGC_AD for an avatar with a reference", async () => {
    const { deps, rpcCalls } = makeDeps({ getAvatarByName: async () => makeAvatar() });
    const res = await generateUgcAdTool({ avatar_name: "Josh", product: "unboxing a serum" }, CTX, deps);
    expect(parse(res).credits).toBe(COST_UGC_AD);
    const reserves = reserveCalls(rpcCalls);
    expect(reserves).toHaveLength(1);
    expect(reserves[0].args._kind).toBe("ugc_ad");
    expect(reserves[0].args._amount).toBe(COST_UGC_AD);
  });

  it("does not reserve when the avatar is missing or has no reference", async () => {
    const missing = makeDeps({ getAvatarByName: async () => null });
    const r1 = await generateUgcAdTool({ avatar_name: "Ghost", product: "x x" }, CTX, missing.deps);
    expect(r1.isError).toBe(true);
    expect(reserveCalls(missing.rpcCalls)).toHaveLength(0);

    const noRef = makeDeps({ getAvatarByName: async () => makeAvatar({ preview_url: null }) });
    const r2 = await generateUgcAdTool({ avatar_name: "Josh", product: "x x" }, CTX, noRef.deps);
    expect(r2.isError).toBe(true);
    expect(reserveCalls(noRef.rpcCalls)).toHaveLength(0);
  });
});

describe("generateCampaignTool (ugc_campaign_item, COST_CAMPAIGN_ITEM per set)", () => {
  it("reserves _kind=ugc_campaign_item _amount=COST_CAMPAIGN_ITEM once per set", async () => {
    const { deps, rpcCalls } = makeDeps({ getAvatarByName: async () => makeAvatar() });
    const res = await generateCampaignTool(
      { avatar_name: "Josh", prompt_template: "city nights", count: 2 },
      CTX,
      deps,
    );
    const reserves = reserveCalls(rpcCalls);
    expect(reserves).toHaveLength(2);
    for (const c of reserves) {
      expect(c.args._kind).toBe("ugc_campaign_item");
      expect(c.args._amount).toBe(COST_CAMPAIGN_ITEM);
    }
    expect(parse(res).total_credits).toBe(2 * COST_CAMPAIGN_ITEM);
  });

  it("stops early with a 'Not enough Aura' warning on insufficient credits", async () => {
    const { deps } = makeDeps({
      getAvatarByName: async () => makeAvatar(),
      rpc: async () => ({ data: null, error: { message: "insufficient_credits" } }),
    });
    const res = await generateCampaignTool(
      { avatar_name: "Josh", prompt_template: "x x", count: 3 },
      CTX,
      deps,
    );
    expect(parse(res).warning).toMatch(/Not enough Aura/);
  });
});

describe("read-only tools reserve nothing", () => {
  it("listAvatarsTool neither reserves nor generates", async () => {
    const { deps, rpcCalls, generateCalls } = makeDeps({
      listAvatars: async () => [makeAvatar()],
    });
    const res = await listAvatarsTool({ limit: 20 }, CTX, deps);
    expect(parse(res).total).toBe(1);
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
    expect(generateCalls).toHaveLength(0);
  });

  it("getJobStatusTool validates the id and reserves nothing", async () => {
    const bad = makeDeps();
    const r1 = await getJobStatusTool({ job_id: "not-a-uuid" }, CTX, bad.deps);
    expect(r1.isError).toBe(true);

    const good = makeDeps({
      getJobRow: async (id) => ({ id, status: "completed", result: { url: "https://cdn/x.mp4" }, error: null, generation_id: null, kind: "image" }),
    });
    const r2 = await getJobStatusTool({ job_id: "11111111-1111-1111-1111-111111111111" }, CTX, good.deps);
    expect(r2.isError).toBeFalsy();
    expect(parse(r2).status).toBe("completed");
    expect(reserveCalls(good.rpcCalls)).toHaveLength(0);
    expect(good.generateCalls).toHaveLength(0);
  });

  it("createAvatarTool creates a persona without reserving credits", async () => {
    const { deps, rpcCalls, generateCalls } = makeDeps({
      createAvatar: async () => makeAvatar({ name: "Nova", handle: "nova" }),
    });
    const res = await createAvatarTool({ name: "Nova" }, CTX, deps);
    expect(res.isError).toBeFalsy();
    expect(parse(res).name).toBe("Nova");
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
    expect(generateCalls).toHaveLength(0);
  });
});

// ─── Job queue tools (mirror of the /editor playground + CLI jobs API) ─────────
// Billing lives in the shared jobs.functions.ts core (enqueueJobForUser), so the
// contract pinned here is delegation: the tool passes the caller's userId + a
// correctly mapped input to deps.enqueueJob and never reserves through rpc itself.

describe("submitJobTool (delegates to shared enqueue core)", () => {
  it("maps snake_case args onto the enqueue input and returns the job id", async () => {
    const { deps, rpcCalls, enqueueCalls } = makeDeps();
    const res = await submitJobTool(
      {
        kind: "image",
        prompt: "a neon skyline",
        image_urls: [`${TRUSTED_HOST}ref.png`],
        model: "google/nano-banana",
      },
      CTX,
      deps,
    );
    expect(res.isError).toBeFalsy();
    expect(enqueueCalls).toHaveLength(1);
    expect(enqueueCalls[0].userId).toBe(CTX.userId);
    expect(enqueueCalls[0].input).toEqual({
      kind: "image",
      prompt: "a neon skyline",
      imageUrls: [`${TRUSTED_HOST}ref.png`],
      audioUrl: undefined,
      videoUrl: undefined,
      duration: undefined,
      resolution: undefined,
      model: "google/nano-banana",
      confirmPreviewId: undefined,
    });
    expect(parse(res).job_id).toBe("job-q1");
    // Billing is inside the shared core — the tool must not reserve directly.
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
  });

  it("surfaces the preview note when the core downgrades to a preview render", async () => {
    const { deps } = makeDeps({
      enqueueJob: async () => ({ jobId: "j1", generationId: "g1", preview: true }),
    });
    const res = await submitJobTool({ kind: "video", prompt: "x" }, CTX, deps);
    const out = parse(res);
    expect(out.preview).toBe(true);
    expect(out.note).toMatch(/480p/);
  });

  it("surfaces core errors (e.g. Not enough Aura) as tool errors", async () => {
    const { deps } = makeDeps({
      enqueueJob: async () => {
        throw new Error("Not enough Aura");
      },
    });
    const res = await submitJobTool({ kind: "image", prompt: "x" }, CTX, deps);
    expect(res.isError).toBe(true);
    expect(parse(res).error).toBe("Not enough Aura");
  });
});

describe("listJobsTool (read-only)", () => {
  const row = (over: Partial<import("./tools.server").JobListRow> = {}) => ({
    id: "11111111-1111-1111-1111-111111111111",
    kind: "image",
    status: "succeeded",
    attempts: 1,
    error: null,
    generation_id: "gen-1",
    parent_job_id: null,
    created_at: "2026-07-01T00:00:00Z",
    finished_at: "2026-07-01T00:01:00Z",
    result: { url: "https://cdn.example/out.png" },
    ...over,
  });

  it("returns mapped jobs with the output URL and reserves nothing", async () => {
    const { deps, rpcCalls, generateCalls } = makeDeps({
      listJobs: async () => [row(), row({ id: "22222222-2222-2222-2222-222222222222", status: "queued", result: null })],
    });
    const res = await listJobsTool({ limit: 20 }, CTX, deps);
    const out = parse(res) as { jobs: Array<Record<string, unknown>>; total: number };
    expect(out.total).toBe(2);
    expect(out.jobs[0].output_url).toBe("https://cdn.example/out.png");
    expect(out.jobs[1].output_url).toBeNull();
    expect(reserveCalls(rpcCalls)).toHaveLength(0);
    expect(generateCalls).toHaveLength(0);
  });

  it("filters by status and honours the limit", async () => {
    const { deps } = makeDeps({
      listJobs: async () => [
        row({ id: "11111111-1111-1111-1111-111111111111", status: "queued" }),
        row({ id: "22222222-2222-2222-2222-222222222222", status: "failed" }),
        row({ id: "33333333-3333-3333-3333-333333333333", status: "queued" }),
      ],
    });
    const res = await listJobsTool({ status: "queued", limit: 1 }, CTX, deps);
    const out = parse(res) as { jobs: Array<{ job_id: string; status: string }>; total: number };
    expect(out.total).toBe(1);
    expect(out.jobs[0].status).toBe("queued");
  });
});

describe("cancelJobTool", () => {
  it("delegates to the shared cancel core with the caller's userId", async () => {
    const { deps, cancelCalls } = makeDeps();
    const res = await cancelJobTool({ job_id: "11111111-1111-1111-1111-111111111111" }, CTX, deps);
    expect(res.isError).toBeFalsy();
    expect(cancelCalls).toEqual([
      { userId: CTX.userId, jobId: "11111111-1111-1111-1111-111111111111" },
    ]);
    expect(parse(res).status).toBe("cancelled");
  });

  it("surfaces 'Cannot cancel' / 'Not found' errors from the core", async () => {
    for (const msg of ["Not found", "Cannot cancel a processing job"]) {
      const { deps } = makeDeps({
        cancelJob: async () => {
          throw new Error(msg);
        },
      });
      const res = await cancelJobTool({ job_id: "11111111-1111-1111-1111-111111111111" }, CTX, deps);
      expect(res.isError).toBe(true);
      expect(parse(res).error).toBe(msg);
    }
  });
});
