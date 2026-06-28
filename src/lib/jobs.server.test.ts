import { beforeEach, describe, expect, it, mock } from "bun:test";

// The jobs worker loop (processOneJob/processBatch) backs the batch queue used by
// TikTok remixes, UGC campaigns, performance reskins and plain media jobs. It
// claims a job, runs the matching pipeline, then commits or releases the credit
// reservation and routes the result onto the generations row. We mock supabaseAdmin
// (claim queue + recorded RPCs/updates) and orchestrate so only the
// claim→run→commit/release/retry decision logic is exercised.

let claimQueue: Array<Record<string, unknown> | null> = [];
let orchestrateImpl: (req: unknown) => Promise<{
  url: string;
  provider: string;
  endpoint: string;
  latencyMs?: number;
  costUsd?: number;
  text?: string;
}> = async () => ({
  url: "https://out/img.png",
  provider: "pollinations",
  endpoint: "pollinations:flux",
  latencyMs: 1,
  costUsd: 0,
});

const calls = {
  rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  inserts: [] as Array<{ table: string; row: unknown }>,
};

function builder(table: string) {
  const resolve = () => ({ data: null, error: null });
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit", "contains", "is", "in"]) b[m] = () => b;
  b.update = (patch: Record<string, unknown>) => {
    calls.updates.push({ table, patch });
    return b;
  };
  b.insert = (row: unknown) => {
    calls.inserts.push({ table, row });
    return b;
  };
  b.maybeSingle = async () => resolve();
  b.single = async () => resolve();
  (b as { then: unknown }).then = (res: (v: unknown) => unknown) => res(resolve());
  return b;
}

const supabaseAdmin = {
  from: (t: string) => builder(t),
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.rpc.push({ name, args });
    if (name === "claim_next_job") return { data: claimQueue.shift() ?? null, error: null };
    return { data: true, error: null };
  },
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://pub/x" } }),
    }),
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));
mock.module("./hf.server", () => ({
  hfTextToSpeech: async () => ({ bytes: new Uint8Array(), contentType: "audio/flac" }),
}));

const { processOneJob: rawProcessOneJob, processBatch: rawProcessBatch } =
  await import("./jobs.server");

// orchestrate is dependency-injected (NOT module-mocked) so this file never
// registers a global mock for ./orchestrator.server — Bun's module mocks are
// process-global and would otherwise leak a stub into the real orchestrator tests.
const deps = { orchestrate: ((req: unknown) => orchestrateImpl(req)) as never };
const processOneJob = (workerId: string) => rawProcessOneJob(workerId, deps);
const processBatch = (workerId: string, limit?: number) => rawProcessBatch(workerId, limit, deps);

function job(over: Record<string, unknown> = {}) {
  return {
    id: "j1",
    user_id: "u1",
    kind: "image",
    payload: { kind: "image", prompt: "hi" },
    status: "running",
    attempts: 0,
    max_attempts: 3,
    credits_reserved: 5,
    generation_id: "g1",
    parent_job_id: null,
    ...over,
  };
}

beforeEach(() => {
  claimQueue = [];
  calls.rpc.length = 0;
  calls.updates.length = 0;
  calls.inserts.length = 0;
  orchestrateImpl = async () => ({
    url: "https://out/img.png",
    provider: "pollinations",
    endpoint: "pollinations:flux",
    latencyMs: 1,
    costUsd: 0,
  });
});

describe("processOneJob", () => {
  it("reports nothing processed when the queue is empty", async () => {
    claimQueue = [];
    expect(await processOneJob("w1")).toEqual({ processed: false });
  });

  it("commits the reservation and writes result_image_url on a successful image job", async () => {
    claimQueue = [job()];
    const r = await processOneJob("w1");
    expect(r).toMatchObject({ processed: true, status: "succeeded", jobId: "j1" });

    expect(calls.rpc.find((c) => c.name === "commit_reservation")?.args).toMatchObject({
      _user: "u1",
      _amount: 5,
      _ref: "j1",
    });
    expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeUndefined();

    const gen = calls.updates.find((u) => u.table === "generations");
    expect(gen?.patch).toMatchObject({
      status: "succeeded",
      result_image_url: "https://out/img.png",
    });
    expect(gen?.patch.result_video_url).toBeUndefined();
  });

  it("routes a video job's result to result_video_url", async () => {
    claimQueue = [job({ kind: "video", payload: { kind: "video", prompt: "x" } })];
    orchestrateImpl = async () => ({
      url: "https://out/clip.mp4",
      provider: "replicate",
      endpoint: "replicate:x",
      latencyMs: 1,
      costUsd: 0,
    });
    await processOneJob("w1");
    const gen = calls.updates.find((u) => u.table === "generations");
    expect(gen?.patch).toMatchObject({ result_video_url: "https://out/clip.mp4" });
    expect(gen?.patch.result_image_url).toBeUndefined();
  });

  it("schedules a retry (no release) when a job fails but attempts remain", async () => {
    claimQueue = [job({ attempts: 0, max_attempts: 3 })];
    orchestrateImpl = async () => {
      throw new Error("provider timeout");
    };
    const r = await processOneJob("w1");
    expect(r.status).toBe("retry");
    expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeUndefined();
    const jobUpd = calls.updates.find((u) => u.table === "jobs");
    expect(jobUpd?.patch.status).toBe("queued");
    expect(jobUpd?.patch.scheduled_at).toBeDefined();
  });

  it("releases the reservation and fails the job when retries are exhausted", async () => {
    claimQueue = [job({ attempts: 3, max_attempts: 3 })];
    orchestrateImpl = async () => {
      throw new Error("provider exploded");
    };
    const r = await processOneJob("w1");
    expect(r.status).toBe("failed");
    expect(calls.rpc.find((c) => c.name === "release_reservation")?.args).toMatchObject({
      _user: "u1",
      _amount: 5,
      _ref: "j1",
    });
    const gen = calls.updates.find((u) => u.table === "generations");
    expect(gen?.patch).toMatchObject({ status: "failed" });
  });

  it("does not retry non-retryable errors (insufficient_credits) and releases immediately", async () => {
    claimQueue = [job({ attempts: 0, max_attempts: 3 })];
    orchestrateImpl = async () => {
      throw new Error("insufficient_credits");
    };
    const r = await processOneJob("w1");
    expect(r.status).toBe("failed");
    expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeDefined();
  });

  it("skips commit when no credits were reserved", async () => {
    claimQueue = [job({ credits_reserved: 0 })];
    await processOneJob("w1");
    expect(calls.rpc.find((c) => c.name === "commit_reservation")).toBeUndefined();
  });
});

describe("processBatch", () => {
  it("drains queued jobs and stops at the first empty claim", async () => {
    claimQueue = [job({ id: "a" }), job({ id: "b" })];
    const results = await processBatch("w1", 5);
    expect(results.filter((r) => r.processed)).toHaveLength(2);
    expect(results[results.length - 1].processed).toBe(false);
  });

  it("respects the limit even when more jobs are queued", async () => {
    claimQueue = [job({ id: "a" }), job({ id: "b" }), job({ id: "c" })];
    const results = await processBatch("w1", 2);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.processed)).toBe(true);
  });
});
