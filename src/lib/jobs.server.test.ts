import { beforeEach, describe, expect, it, mock } from "bun:test";

// The jobs worker loop (processOneJob/processBatch) backs the batch queue used by
// TikTok remixes, UGC campaigns, performance reskins and plain media jobs. It
// claims a job, runs the matching pipeline, then commits or releases the credit
// reservation and routes the result onto the generations row. We mock supabaseAdmin
// (claim queue + recorded RPCs/updates) and orchestrate so only the
// claim→run→commit/release/retry decision logic is exercised.

let claimQueue: Array<Record<string, unknown> | null> = [];
// finishJob fences the completion on still owning the lock via a guarded UPDATE
// ... RETURNING. Flip this to false to simulate losing that CAS (the stale-sweep
// reclaim race) so the job-table update matches no row.
let jobsCasWins = true;
// Rows the failed-orphan sweep (sweepFailedJobs) reads back from a jobs SELECT,
// and the per-job requeue_failed_job RPC outcome it should observe.
let failedJobsRows: Array<Record<string, unknown>> = [];
let requeueOutcome = "requeued";
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
  upserts: [] as Array<{ table: string; row: unknown }>,
};

function builder(table: string) {
  // After an UPDATE, a chained `.select()` resolves to the affected rows. finishJob
  // relies on that to detect whether it won the ownership-fenced transition, so a
  // jobs UPDATE returns one row by default (won) and zero rows when jobsCasWins is
  // false (lost the lock). Reads (no UPDATE) keep the original {data:null} shape.
  let updated = false;
  const resolve = () =>
    updated
      ? { data: table === "jobs" && !jobsCasWins ? [] : [{ id: "x" }], error: null }
      : // A read on `jobs` is the failed-orphan sweep SELECT; everything else keeps
        // the original {data:null} read shape.
        { data: table === "jobs" ? failedJobsRows : null, error: null };
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "lt", "lte", "gt", "gte", "order", "limit", "contains", "is", "in"])
    b[m] = () => b;
  b.update = (patch: Record<string, unknown>) => {
    calls.updates.push({ table, patch });
    updated = true;
    return b;
  };
  b.insert = (row: unknown) => {
    calls.inserts.push({ table, row });
    return b;
  };
  b.upsert = (row: unknown) => {
    calls.upserts.push({ table, row });
    return Promise.resolve({ error: null });
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
    if (name === "requeue_failed_job") return { data: requeueOutcome, error: null };
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

const {
  processOneJob: rawProcessOneJob,
  processBatch: rawProcessBatch,
  classifyJobError,
  nextRetryAt,
  retryDecision,
  sweepStaleProcessingJobs,
  sweepFailedJobs,
  recordSchedulerHeartbeat,
  PERSISTENT_RETRY_MAX_ATTEMPTS,
  PERSISTENT_RETRY_MAX_AGE_MS,
} = await import("./jobs.server");

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
    created_at: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  claimQueue = [];
  jobsCasWins = true;
  failedJobsRows = [];
  requeueOutcome = "requeued";
  calls.rpc.length = 0;
  calls.updates.length = 0;
  calls.inserts.length = 0;
  calls.upserts.length = 0;
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

  it("does NOT commit when it has lost the lock to a stale-sweep reclaim", async () => {
    // The job finished, but the stale-sweep already requeued it and another worker
    // reclaimed it (locked_by changed) → the ownership-fenced finishJob CAS misses,
    // so this worker must not commit (the new owner will). Prevents a double charge.
    jobsCasWins = false;
    claimQueue = [job()];
    const r = await processOneJob("w1");
    expect(r.status).toBe("stale");
    expect(calls.rpc.find((c) => c.name === "commit_reservation")).toBeUndefined();
    // Must NOT write the generation succeeded either: the new owner may have
    // already terminally failed + released it, so a late success write would
    // expose a delivered render after a refund.
    expect(calls.updates.find((u) => u.table === "generations")).toBeUndefined();
  });

  it("does NOT release when it has lost the lock to a stale-sweep reclaim (terminal error)", async () => {
    // Same race on a terminal failure: only the worker that wins the CAS releases,
    // so a lost worker must never refund a reservation the new owner still holds.
    jobsCasWins = false;
    claimQueue = [job({ attempts: PERSISTENT_RETRY_MAX_ATTEMPTS })];
    orchestrateImpl = async () => {
      throw new Error("provider exploded");
    };
    const r = await processOneJob("w1");
    expect(r.status).toBe("stale");
    expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeUndefined();
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

  it("keeps retrying transient failures BEYOND the old max_attempts cap", async () => {
    // attempts:5 well past the legacy max_attempts:3 — under persistent retry this
    // must still re-queue (and never release) because it's transient & under ceiling.
    claimQueue = [job({ attempts: 5, max_attempts: 3 })];
    orchestrateImpl = async () => {
      throw new Error("provider exploded");
    };
    const r = await processOneJob("w1");
    expect(r.status).toBe("retry");
    expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeUndefined();
    const jobUpd = calls.updates.find((u) => u.table === "jobs");
    expect(jobUpd?.patch.status).toBe("queued");
    const gen = calls.updates.find((u) => u.table === "generations");
    expect(gen?.patch).toMatchObject({ status: "retrying" });
  });

  it("releases the reservation and fails once the attempt ceiling is reached", async () => {
    claimQueue = [job({ attempts: PERSISTENT_RETRY_MAX_ATTEMPTS, max_attempts: 3 })];
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
    expect(String(gen?.patch.error)).toContain("gave up after");
  });

  it("releases the reservation and fails once the retry age deadline elapses", async () => {
    claimQueue = [
      job({
        attempts: 2,
        created_at: new Date(Date.now() - PERSISTENT_RETRY_MAX_AGE_MS - 60_000).toISOString(),
      }),
    ];
    orchestrateImpl = async () => {
      throw new Error("still flaky");
    };
    const r = await processOneJob("w1");
    expect(r.status).toBe("failed");
    expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeDefined();
  });

  it("stops immediately and releases on terminal errors (variants)", async () => {
    for (const msg of ["Unauthorized", "HTTP 403 forbidden", "invalid input image"]) {
      calls.rpc.length = 0;
      calls.updates.length = 0;
      claimQueue = [job({ attempts: 0 })];
      orchestrateImpl = async () => {
        throw new Error(msg);
      };
      const r = await processOneJob("w1");
      expect(r.status).toBe("failed");
      expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeDefined();
    }
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

  it("marks the kids_stories row failed (owner-scoped) and releases exactly once with no assemble worker", async () => {
    // No GPU worker is registered (the gpu_workers read returns no rows), so
    // runKidsStory's assemble preflight fails terminally up front. Beyond the
    // usual release + generation-failed, the kids_stories row MUST be flipped to
    // failed so /kids stops spinning and shows the refunded state.
    claimQueue = [
      job({
        kind: "kids_story",
        credits_reserved: 12,
        payload: {
          storyId: "s1",
          topic: "the moon",
          contentType: "bedtime",
          ageRange: "3-5",
          lengthId: "short",
          characterName: "Fuzz",
        },
      }),
    ];

    const r = await processOneJob("w1");
    expect(r.status).toBe("failed");

    // Released exactly once (CAS-fenced), with the reserved amount.
    const releases = calls.rpc.filter((c) => c.name === "release_reservation");
    expect(releases).toHaveLength(1);
    expect(releases[0].args).toMatchObject({ _user: "u1", _amount: 12, _ref: "j1" });

    // The kids-story row is marked failed and scoped to its owner.
    const story = calls.updates.find((u) => u.table === "kids_stories");
    expect(story?.patch).toMatchObject({ status: "failed" });
    expect(String(story?.patch.error)).toMatch(/required/i);

    // The generation row is failed too.
    const gen = calls.updates.find((u) => u.table === "generations");
    expect(gen?.patch).toMatchObject({ status: "failed" });
  });

  it("does NOT touch the kids_stories row when it has lost the lock to a stale-sweep reclaim", async () => {
    // Lost the ownership CAS → another worker owns the job now; this worker must
    // not release, not write the generation, and not flip the story row.
    jobsCasWins = false;
    claimQueue = [
      job({
        kind: "kids_story",
        credits_reserved: 12,
        payload: { storyId: "s1", topic: "the moon", contentType: "bedtime", ageRange: "3-5", lengthId: "short", characterName: "Fuzz" },
      }),
    ];

    const r = await processOneJob("w1");
    expect(r.status).toBe("stale");
    expect(calls.rpc.find((c) => c.name === "release_reservation")).toBeUndefined();
    expect(calls.updates.find((u) => u.table === "kids_stories")).toBeUndefined();
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

describe("classifyJobError", () => {
  it("treats network/provider flakiness as transient", () => {
    for (const m of ["provider timeout", "ECONNRESET", "rate limited 429", "502 bad gateway", "fetch failed"]) {
      expect(classifyJobError(m)).toBe("transient");
    }
  });

  it("treats auth / validation / capability errors as terminal", () => {
    for (const m of [
      "insufficient_credits",
      "Unauthorized",
      "HTTP 401",
      "forbidden 403",
      "HTTP 400 bad request",
      "invalid input image",
      "ugc_ad requires productPrompt",
      "missing audio url",
      "unsupported kind",
      "no path for kind",
    ]) {
      expect(classifyJobError(m)).toBe("terminal");
    }
  });
});

describe("nextRetryAt", () => {
  it("grows exponentially then caps at 30m (+jitter)", () => {
    const now = 1_000_000_000_000;
    const delay = (attempts: number) => new Date(nextRetryAt(attempts, now)).getTime() - now;
    // attempt 1 ≈ base 30s window (+jitter), well under the cap
    expect(delay(1)).toBeGreaterThanOrEqual(30_000);
    expect(delay(1)).toBeLessThan(5 * 60_000);
    // far-out attempts saturate at the 30m cap (plus a little jitter)
    const big = delay(100);
    expect(big).toBeGreaterThanOrEqual(30 * 60_000);
    expect(big).toBeLessThanOrEqual(30 * 60_000 + 60_000);
  });
});

describe("retryDecision", () => {
  const fresh = new Date().toISOString();
  it("retries transient failures under the ceiling and age deadline", () => {
    const d = retryDecision({ attempts: 5, created_at: fresh }, "provider timeout");
    expect(d).toEqual({ retry: true, reason: "transient" });
  });
  it("gives up at the attempt ceiling", () => {
    const d = retryDecision({ attempts: PERSISTENT_RETRY_MAX_ATTEMPTS, created_at: fresh }, "provider timeout");
    expect(d).toEqual({ retry: false, reason: "max_attempts" });
  });
  it("gives up past the age deadline", () => {
    const old = new Date(Date.now() - PERSISTENT_RETRY_MAX_AGE_MS - 1000).toISOString();
    const d = retryDecision({ attempts: 1, created_at: old }, "provider timeout");
    expect(d).toEqual({ retry: false, reason: "max_age" });
  });
  it("never retries terminal errors regardless of attempts", () => {
    const d = retryDecision({ attempts: 0, created_at: fresh }, "unauthorized");
    expect(d).toEqual({ retry: false, reason: "terminal" });
  });
});

describe("sweepStaleProcessingJobs", () => {
  it("invokes the reset_stale_processing_jobs RPC with the configured window", async () => {
    await sweepStaleProcessingJobs(600);
    const call = calls.rpc.find((c) => c.name === "reset_stale_processing_jobs");
    expect(call?.args).toMatchObject({ _max_age_seconds: 600 });
  });
});

describe("sweepFailedJobs", () => {
  it("re-enqueues a failed job with a transient error via requeue_failed_job", async () => {
    failedJobsRows = [{ id: "f1", error: "provider timeout" }];
    const r = await sweepFailedJobs();
    expect(r).toEqual({ requeued: 1, skipped: 0 });
    const call = calls.rpc.find((c) => c.name === "requeue_failed_job");
    expect(call?.args).toMatchObject({ _job: "f1" });
  });

  it("treats a failed job with no error string as transient and re-enqueues it", async () => {
    failedJobsRows = [{ id: "f2", error: null }];
    const r = await sweepFailedJobs();
    expect(r.requeued).toBe(1);
    expect(calls.rpc.find((c) => c.name === "requeue_failed_job")).toBeDefined();
  });

  it("skips terminally-failed jobs WITHOUT calling requeue_failed_job", async () => {
    failedJobsRows = [{ id: "t1", error: "insufficient_credits" }];
    const r = await sweepFailedJobs();
    expect(r).toEqual({ requeued: 0, skipped: 1 });
    expect(calls.rpc.find((c) => c.name === "requeue_failed_job")).toBeUndefined();
  });

  it("counts an unaffordable re-reservation as skipped, not requeued", async () => {
    failedJobsRows = [{ id: "f3", error: "fetch failed" }];
    requeueOutcome = "insufficient_credits";
    const r = await sweepFailedJobs();
    expect(r).toEqual({ requeued: 0, skipped: 1 });
    // It still attempted the (atomic, credit-safe) re-reserve+requeue RPC.
    expect(calls.rpc.find((c) => c.name === "requeue_failed_job")).toBeDefined();
  });

  it("does nothing when there are no orphaned failures", async () => {
    failedJobsRows = [];
    const r = await sweepFailedJobs();
    expect(r).toEqual({ requeued: 0, skipped: 0 });
    expect(calls.rpc.find((c) => c.name === "requeue_failed_job")).toBeUndefined();
  });
});

describe("recordSchedulerHeartbeat", () => {
  it("upserts an ok heartbeat", async () => {
    await recordSchedulerHeartbeat("jobs_tick", true);
    const up = calls.upserts.find((u) => u.table === "scheduler_heartbeats");
    expect(up).toBeDefined();
    expect(up?.row).toMatchObject({ name: "jobs_tick" });
    expect((up?.row as Record<string, unknown>).last_ok_at).toBeDefined();
  });

  it("records the error on a failed heartbeat", async () => {
    await recordSchedulerHeartbeat("jobs_tick", false, "boom");
    const up = calls.upserts.find((u) => u.table === "scheduler_heartbeats");
    expect(up?.row).toMatchObject({ name: "jobs_tick", last_error: "boom" });
  });
});
