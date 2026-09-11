import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const FUNCTIONAL_MODE = __ENV.FUNCTIONAL_MODE === "true";
const AUTH_TOKENS = (__ENV.AUTH_TOKENS || __ENV.AUTH_TOKEN || "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean);
const JOB_ID = __ENV.JOB_ID || "00000000-0000-0000-0000-000000000000";
const ALLOW_BILLABLE_GENERATION = __ENV.ALLOW_BILLABLE_GENERATION === "true";
const VUS = 110;
// Keep credentials out of source and reports. Inject this JSON through Secrets.
const AUTH_USERS = JSON.parse(__ENV.LOAD_TEST_USERS_JSON || "[]");
const SUPABASE_URL = (__ENV.LOAD_TEST_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = __ENV.LOAD_TEST_SUPABASE_PUBLISHABLE_KEY || "";

const flowErrors = new Rate("aurora_flow_errors");
const functionalSuccess = new Rate("functional_flow_success");
const functionalSubmissions = new Counter("functional_submissions");
const functionalCompletions = new Counter("functional_completions");
const functionalSucceeded = new Counter("functional_succeeded");
const authLatency = new Trend("auth_latency", true);
const safeRejections = new Counter("aurora_safe_rejections");
const generateLatency = new Trend("generate_latency", true);
const balanceLatency = new Trend("balance_latency", true);
const jobStatusLatency = new Trend("job_status_latency", true);
const workerHealthLatency = new Trend("worker_health_latency", true);
const webhookLatency = new Trend("webhook_latency", true);
const safeStatuses = http.expectedStatuses(401, 429);

export const options = {
  scenarios: {
    concurrent_users: FUNCTIONAL_MODE ? {
      // Each VU owns one entire flow. Ramp-down cannot silently kill polling.
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: 1,
      maxDuration: "12m",
      gracefulStop: "30s",
    } : {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 50 },
        { duration: "20s", target: 110 },
        { duration: "30s", target: 110 },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  summaryTrendStats: ["min", "med", "avg", "max", "p(95)", "p(99)"],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    aurora_flow_errors: ["rate<0.05"],
    http_req_duration: ["p(95)<2000", "p(99)<4000"],
    ...(FUNCTIONAL_MODE
      ? {
          functional_flow_success: ["rate>0.95"],
          functional_submissions: [`count==${VUS}`],
          functional_completions: [`count==${VUS}`],
          functional_succeeded: ["count>=105"],
        }
      : {}),
  },
};

export function setup() {
  if (!FUNCTIONAL_MODE) return { functional: false };
  if (!ALLOW_BILLABLE_GENERATION || __ENV.APPROVED_FUNCTIONAL_BASE_URL !== BASE_URL) {
    throw new Error(
      "Functional mode requires billable opt-in and APPROVED_FUNCTIONAL_BASE_URL matching BASE_URL. Maximum 110 generations.",
    );
  }
  if (AUTH_USERS.length) {
    if (
      AUTH_USERS.length !== VUS || !SUPABASE_URL || !SUPABASE_KEY
      || AUTH_USERS.some((user) => !user.email || !user.password)
      || new Set(AUTH_USERS.map((user) => user.email)).size !== VUS
    ) throw new Error("Provide 110 distinct test users and the test Supabase URL/publishable key.");
  } else if (AUTH_TOKENS.length !== VUS || new Set(AUTH_TOKENS).size !== VUS) {
    throw new Error("Provide 110 distinct test tokens, or LOAD_TEST_USERS_JSON for the full sign-in flow.");
  }
  // Initialize counters even if every request fails, so thresholds still fail.
  functionalSubmissions.add(0);
  functionalCompletions.add(0);
  functionalSucceeded.add(0);
  return { functional: true, runId: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
}

function mark(response, expectedStatuses, latencyMetric) {
  latencyMetric.add(response.timings.duration);
  const accepted = expectedStatuses.includes(response.status);
  flowErrors.add(!accepted);
  check(response, { [`expected HTTP ${expectedStatuses.join("/")}`]: () => accepted });
}

export default function (data) {
  if (data.functional) {
    functionalFlow(data.runId);
  } else {
    safeProductionFlow();
  }
}

function safeProductionFlow() {
  const generation = http.post(
    `${BASE_URL}/api/public/generate`,
    JSON.stringify({
      kind: "text",
      prompt: "Aurora concurrency probe",
      idempotencyKey: `load-safe-${__VU}-${__ITER}`,
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "generate" },
      responseCallback: safeStatuses,
    },
  );
  mark(generation, [401, 429], generateLatency);
  if (generation.status === 401 || generation.status === 429) safeRejections.add(1);

  if (__ITER % 5 === 0) {
    const generationAlias = http.post(
      `${BASE_URL}/api/generate`,
      JSON.stringify({ kind: "text", prompt: "Aurora compatibility probe" }),
      {
        headers: { "Content-Type": "application/json" },
        tags: { endpoint: "generate_compatibility" },
        responseCallback: safeStatuses,
      },
    );
    mark(generationAlias, [401, 429], generateLatency);
  }

  const jobStatus = http.get(`${BASE_URL}/api/jobs/${JOB_ID}/status`, {
    tags: { endpoint: "job_status" },
    responseCallback: safeStatuses,
  });
  mark(jobStatus, [401, 429], jobStatusLatency);

  // The public health snapshot is a safe GET. The real worker sweep is a
  // separate authenticated POST, so this does not probe or mutate the pool.
  const workerHealth = http.get(`${BASE_URL}/api/public/workers/health`, {
    tags: { endpoint: "worker_health" },
    responseCallback: http.expectedStatuses(200, 429),
  });
  mark(workerHealth, [200, 429], workerHealthLatency);

  // An unsigned inert event is rejected before JSON dispatch or DB writes.
  const webhook = http.post(
    `${BASE_URL}/api/public/paystack-webhook`,
    JSON.stringify({ event: "aurora.load_test", data: {} }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "paystack_webhook" },
      responseCallback: safeStatuses,
    },
  );
  mark(webhook, [401, 429], webhookLatency);
  sleep(0.25);
}

const FUNCTIONAL_DEADLINE_MS = 10 * 60_000;

function recordFunctionalTerminal(succeeded) {
  functionalSuccess.add(succeeded);
  flowErrors.add(!succeeded);
  functionalCompletions.add(1);
  if (succeeded) functionalSucceeded.add(1);
}

function json(response) {
  try { return response.json(); } catch { return null; }
}

function functionalFlow(runId) {
  let succeeded = false;
  try {
    succeeded = runAuthenticatedFlow(runId);
  } finally {
    // One outcome per logical flow, including thrown parsing/request errors.
    // Forced interruptions are caught by the exact completion-count threshold.
    recordFunctionalTerminal(succeeded);
  }
}

function runAuthenticatedFlow(runId) {
  let token = AUTH_TOKENS[__VU - 1];
  if (AUTH_USERS.length) {
    const auth = http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      JSON.stringify(AUTH_USERS[__VU - 1]), {
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        tags: { endpoint: "sign_in", name: "sign_in" }, timeout: "30s",
      });
    authLatency.add(auth.timings.duration);
    token = json(auth)?.access_token;
    if (!check(auth, { "sign-in succeeded": () => auth.status === 200 && Boolean(token) })) return false;
  }
  const headers = { Authorization: `Bearer ${token}` };
    const balance = http.get(`${BASE_URL}/api/balance`, {
      headers,
      tags: { endpoint: "balance" },
      timeout: "30s",
    });
    balanceLatency.add(balance.timings.duration);
    const balanceOk = check(balance, { "balance returned": (r) => r.status === 200 });
    if (!balanceOk) {
      return false;
    }

    functionalSubmissions.add(1);
    const functionalStartedAt = Date.now();
    const generation = http.post(
      `${BASE_URL}/api/generate`,
      JSON.stringify({
        kind: "text",
        prompt: "Reply with exactly: Aurora load test",
        idempotencyKey: `load-functional-${runId}-${__VU}`,
      }),
      {
        headers: { ...headers, "Content-Type": "application/json" },
        tags: { endpoint: "generate" },
        timeout: "120s",
      },
    );
    generateLatency.add(generation.timings.duration);
    const generationId = json(generation)?.generationId;
    const generationOk = check(generation, {
      "generation started": () => generation.status === 200 && Boolean(generationId),
    });
    if (!generationOk) {
      return false;
    }

  while (Date.now() - functionalStartedAt < FUNCTIONAL_DEADLINE_MS) {
    const status = http.get(`${BASE_URL}/api/jobs/${generationId}/status`, {
      headers,
      tags: { endpoint: "job_status", name: "/api/jobs/:id/status" },
      timeout: "30s",
    });
    jobStatusLatency.add(status.timings.duration);
    const generationStatus = json(status)?.generation?.status;
    if (!check(status, {
      "generation status returned": () =>
        status.status === 200 && Boolean(generationStatus),
    })) return false;
    if (generationStatus === "succeeded") {
      return true;
    } else if (!["pending", "queued", "processing", "running"].includes(generationStatus)) return false;
    sleep(1);
  }
  return false;
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    [__ENV.SUMMARY_EXPORT || "load-test-summary.json"]: JSON.stringify(data, null, 2),
  };
}