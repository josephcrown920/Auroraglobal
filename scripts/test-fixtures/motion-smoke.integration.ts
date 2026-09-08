import { mock } from "bun:test";

type Row = Record<string, unknown>;

const gpuWorkers: Row[] = [];
const registerAttempts: Row[] = [];
let nextWorkerId = 1;

function makeQuery(table: string) {
  let operation: "select" | "insert" | "update" = "select";
  let payload: Row | null = null;
  const filters: Array<(row: Row) => boolean> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {
    select: () => query,
    insert: (value: Row) => {
      operation = "insert";
      payload = value;
      return query;
    },
    update: (value: Row) => {
      operation = "update";
      payload = value;
      return query;
    },
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    contains: (column: string, values: unknown[]) => {
      filters.push((row) => {
        const actual = row[column];
        return Array.isArray(actual) && values.every((value) => actual.includes(value));
      });
      return query;
    },
    order: () => query,
    limit: () => query,
    single: () => query,
    maybeSingle: () => query,
    then: (resolve: (value: unknown) => unknown) => {
      if (table === "worker_register_attempts" && operation === "insert") {
        registerAttempts.push({ ...payload });
        return resolve({ data: null, error: null });
      }
      if (table !== "gpu_workers") return resolve({ data: null, error: null });
      if (operation === "insert") {
        const row = { id: `motion-worker-${nextWorkerId++}`, ...payload };
        gpuWorkers.push(row);
        return resolve({ data: { id: row.id }, error: null });
      }
      if (operation === "update") {
        for (const row of gpuWorkers.filter((candidate) => filters.every((f) => f(candidate)))) {
          Object.assign(row, payload);
        }
        return resolve({ data: null, error: null });
      }
      return resolve({
        data: gpuWorkers.filter((row) => filters.every((filter) => filter(row))),
        error: null,
      });
    },
  };
  return query;
}

const supabaseAdmin = {
  from: (table: string) => makeQuery(table),
  rpc: async (fn: string, args: { _worker?: string }) => {
    const worker = gpuWorkers.find((row) => row.id === args._worker);
    if (!worker) return { data: null, error: null };
    if (fn === "gpu_worker_inflight_inc") {
      const current = Number(worker.in_flight ?? 0);
      const maximum = Number(worker.max_concurrency ?? 1);
      if (current >= maximum) return { data: null, error: null };
      worker.in_flight = current + 1;
      return { data: worker.in_flight, error: null };
    }
    if (fn === "gpu_worker_inflight_dec") {
      worker.in_flight = Math.max(0, Number(worker.in_flight ?? 0) - 1);
    }
    return { data: worker.in_flight ?? null, error: null };
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: "" }, error: null }),
    }),
  },
};

// This fixture runs in its own process because Bun module mocks are global.
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));
mock.module("@/lib/replicate.server", () => ({
  getReplicateKey: () => undefined,
  replicateProgressPct: () => null,
  replicateRun: async () => {
    throw new Error("paid Replicate fallback must not run");
  },
  pickReplicateUrl: () => "",
  fetchToBytes: async () => {
    throw new Error("paid Replicate fallback must not run");
  },
}));
mock.module("@/lib/sync.server", () => ({
  syncLipsync: async () => {
    throw new Error("paid Sync fallback must not run");
  },
}));
mock.module("@/lib/hf.server", () => ({
  hfTextToSpeech: async () => {
    throw new Error("hosted fallback must not run");
  },
  hfTextToImage: async () => {
    throw new Error("hosted fallback must not run");
  },
  HF_ROUTER_BASE: "https://router.huggingface.co/v1",
}));

const REGISTER_SECRET = "fixture-register-secret";
const WORKER_BEARER = "fixture-worker-bearer";
const IMAGE_URL = "https://assets.example.test/reference.png";
const VIDEO_URL = "https://assets.example.test/driving.mp4";
const OUTPUT_URL = "https://worker.example.test/output/motion.mp4";

let mode: "success" | "missing-output" = "success";
let statusPolls = 0;
let capturedInput: Row | null = null;
let bearerHeaders: string[] = [];

const workerServer = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    bearerHeaders.push(request.headers.get("authorization") ?? "");
    if (request.headers.get("authorization") !== `Bearer ${WORKER_BEARER}`) {
      return Response.json({ error: "wrong worker bearer" }, { status: 401 });
    }
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/run") {
      const body = (await request.json()) as { input?: Row };
      capturedInput = body.input ?? null;
      statusPolls = 0;
      return Response.json({ id: "runpod-motion-job-1", status: "IN_QUEUE" });
    }
    if (url.pathname === "/status/runpod-motion-job-1") {
      statusPolls++;
      if (mode === "success" && statusPolls === 1) {
        return Response.json({ id: "runpod-motion-job-1", status: "IN_PROGRESS" });
      }
      return mode === "success"
        ? Response.json({ id: "runpod-motion-job-1", status: "COMPLETED", output: { url: OUTPUT_URL } })
        : Response.json({ id: "runpod-motion-job-1", status: "COMPLETED" });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  },
});

// Fail closed on any unexpected outbound request, even if a future routing
// change accidentally tries a paid provider. Only our local worker is allowed.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== workerServer.url.origin) {
    throw new Error(`Unexpected outbound request to ${url.origin}`);
  }
  return realFetch(input, init);
}) as typeof fetch;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  process.env.AURORA_REGISTER_SECRET = REGISTER_SECRET;
  const { Route } = await import("@/routes/api/public/workers/register");
  const { runMotionSmokeStep } = await import("@/lib/motion-smoke.server");
  const post = (apikey: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Route.options as any).server.handlers.POST({
      request: new Request("https://aurora.test/api/public/workers/register", {
        method: "POST",
        headers: { "content-type": "application/json", apikey },
        body: JSON.stringify({
          name: "fixture-runpod-motion",
          endpoint_url: workerServer.url.origin,
          protocol: "runpod",
          capabilities: ["motion"],
          auth_token: WORKER_BEARER,
          max_concurrency: 1,
        }),
      }),
    }) as Promise<Response>;

  // The worker bearer cannot authenticate the separate registration endpoint.
  const rejected = await post(WORKER_BEARER);
  check(rejected.status === 401, "worker bearer unexpectedly passed registration auth");
  check(gpuWorkers.length === 0, "unauthorized registration created a worker");

  const registered = await post(REGISTER_SECRET);
  check(registered.status === 200, `real registration route returned ${registered.status}`);
  check(gpuWorkers.length === 1, "real registration route did not insert one worker");
  check(gpuWorkers[0].status === "pending_approval", "new worker bypassed pending approval");
  check(gpuWorkers[0].auth_token === WORKER_BEARER, "worker bearer was not persisted");

  // A real freshly registered worker cannot serve until an admin approves it.
  const pending = await runMotionSmokeStep("fixture-user", "pending-ref", IMAGE_URL, VIDEO_URL);
  check(pending.status === "skip", "pending registration was dispatch eligible");

  Object.assign(gpuWorkers[0], {
    status: "active",
    in_flight: 0,
    priority: 0,
    last_heartbeat: new Date().toISOString(),
    runpod_sync: false,
  });

  // Conversely, the registration key cannot authenticate to the worker.
  gpuWorkers[0].auth_token = REGISTER_SECRET;
  const registerKeyDispatch = await runMotionSmokeStep(
    "fixture-user",
    "register-key-ref",
    IMAGE_URL,
    VIDEO_URL,
  );
  check(registerKeyDispatch.status === "fail", "registration key unexpectedly authenticated worker dispatch");
  check(bearerHeaders.includes(`Bearer ${REGISTER_SECRET}`), "registration key auth assertion did not reach worker");

  gpuWorkers[0].auth_token = WORKER_BEARER;
  bearerHeaders = [];
  const passed = await runMotionSmokeStep("fixture-user", "fixture-ref", IMAGE_URL, VIDEO_URL);
  check(passed.status === "pass", `async RunPod smoke failed: ${passed.error ?? "unknown"}`);
  check(passed.output_url === OUTPUT_URL, "async RunPod output URL was not returned");
  check(statusPolls === 2, `expected IN_PROGRESS then COMPLETED polling, got ${statusPolls} polls`);
  check(bearerHeaders.every((header) => header === `Bearer ${WORKER_BEARER}`), "worker bearer header mismatch");
  check(capturedInput?.kind === "motion", "motion kind missing from RunPod input");
  check(capturedInput?.model === "mimic-motion", "MimicMotion model missing from RunPod input");
  check(capturedInput?.video_url === VIDEO_URL, "driving video URL missing from RunPod input");
  check(
    Array.isArray(capturedInput?.image_urls) && capturedInput.image_urls[0] === IMAGE_URL,
    "reference image URL missing from RunPod input",
  );
  const params = capturedInput?.params as Row | undefined;
  check(params?.motion_type === "faithful", "snake_case motion_type missing");
  check(params?.camera_movement === "static", "snake_case camera_movement missing");
  check(!("motionType" in (params ?? {})), "camelCase motionType leaked onto worker wire");
  check(typeof capturedInput?.workflow === "object", "ComfyUI workflow missing from motion payload");
  check(typeof capturedInput?.workflow_inputs === "object", "ComfyUI workflow inputs missing from motion payload");

  gpuWorkers[0].status = "paused";
  const offline = await runMotionSmokeStep("fixture-user", "offline-ref", IMAGE_URL, VIDEO_URL);
  check(offline.status === "skip", "offline motion worker did not skip");
  gpuWorkers[0].status = "active";

  gpuWorkers[0].auth_token = "wrong-worker-bearer";
  bearerHeaders = [];
  const wrongAuth = await runMotionSmokeStep("fixture-user", "auth-ref", IMAGE_URL, VIDEO_URL);
  check(wrongAuth.status === "fail", "wrong worker authentication did not fail");
  check(bearerHeaders.includes("Bearer wrong-worker-bearer"), "stored worker bearer was not dispatched");

  gpuWorkers[0].auth_token = WORKER_BEARER;
  mode = "missing-output";
  const missingOutput = await runMotionSmokeStep("fixture-user", "missing-ref", IMAGE_URL, VIDEO_URL);
  check(missingOutput.status === "fail", "COMPLETED RunPod job without output did not fail");
  check(/no url/i.test(missingOutput.error ?? ""), `unexpected missing-output error: ${missingOutput.error}`);

  console.log(JSON.stringify({
    ok: true,
    registrationAttempts: registerAttempts.length,
    asyncStatusPollsCovered: true,
  }));
} finally {
  globalThis.fetch = realFetch;
  workerServer.stop(true);
  delete process.env.AURORA_REGISTER_SECRET;
}
