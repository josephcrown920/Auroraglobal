import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../scripts/load-test.js", import.meta.url), "utf8")
  .replace(/^import .+;\r?\n/gm, "")
  .replace("export default function (data)", "function defaultFlow(data)")
  .replace(/export (const|function) /g, "$1 ");

function harness(
  responses: Array<{ status: number; body?: unknown; throws?: boolean }>,
  overrides: Record<string, string> = {},
) {
  const metrics: Record<string, number[]> = {};
  const requests: string[] = [];
  class Metric {
    constructor(private name: string) { metrics[name] = []; }
    add(value: number | boolean) { metrics[this.name].push(Number(value)); }
  }
  const request = (url: string) => {
    requests.push(url);
    const response = responses.shift();
    if (!response || response.throws) throw new Error("request failed");
    return {
      status: response.status,
      timings: { duration: 1 },
      json: () => {
        if (response.body === undefined) throw new Error("invalid JSON");
        return response.body;
      },
    };
  };
  const env: Record<string, string> = {
    BASE_URL: "http://localhost:8080",
    APPROVED_FUNCTIONAL_BASE_URL: "http://localhost:8080",
    FUNCTIONAL_MODE: "true",
    ALLOW_BILLABLE_GENERATION: "true",
    AUTH_TOKENS: Array.from({ length: 110 }, (_, i) => `synthetic-test-token-${i}`).join(","),
    ...overrides,
  };
  const api = runInNewContext(`${source}\n({ setup, defaultFlow, options });`, {
    __ENV: env, __VU: 1, __ITER: 0,
    http: { get: request, post: request, expectedStatuses: (...statuses: number[]) => statuses },
    Counter: Metric, Rate: Metric, Trend: Metric,
    check: (r: unknown, checks: Record<string, (response: unknown) => boolean>) =>
      Object.values(checks).every((fn) => fn(r)),
    sleep: () => {},
  });
  return { api, metrics, requests, env };
}

describe("k6 logical-flow accounting", () => {
  it("requires an exact approved target before any network traffic", () => {
    const h = harness([]);
    delete h.env.APPROVED_FUNCTIONAL_BASE_URL;
    expect(() => h.api.setup()).toThrow("billable opt-in");
    expect(h.requests).toHaveLength(0);
  });

  it("requires distinct credentials for all 110 users", () => {
    const h = harness([], { AUTH_TOKENS: Array(110).fill("duplicate-synthetic-token").join(",") });
    expect(() => h.api.setup()).toThrow("110 distinct test tokens");
    expect(h.requests).toHaveLength(0);
    expect(h.api.options.scenarios.concurrent_users.vus).toBe(110);
    expect(h.api.options.thresholds.functional_completions).toEqual(["count==110"]);
    expect(h.api.options.thresholds.functional_succeeded).toEqual(["count>=105"]);
  });

  it("records a rejected submission as one failed flow, never success", () => {
    const h = harness([{ status: 200 }, { status: 429 }]);
    h.api.defaultFlow(h.api.setup());
    expect(h.metrics.functional_flow_success).toEqual([0]);
    expect(h.metrics.functional_completions).toEqual([0, 1]);
    expect(h.metrics.functional_succeeded).toEqual([0]);
    expect(h.requests).toHaveLength(2);
  });

  it("records malformed generation JSON as failure", () => {
    const h = harness([{ status: 200 }, { status: 200 }]);
    h.api.defaultFlow(h.api.setup());
    expect(h.metrics.functional_flow_success).toEqual([0]);
  });

  it("does not call failed terminal generations successful", () => {
    const h = harness([
      { status: 200 },
      { status: 200, body: { generationId: "test-id" } },
      { status: 200, body: { generation: { status: "failed" } } },
    ]);
    h.api.defaultFlow(h.api.setup());
    expect(h.metrics.functional_flow_success).toEqual([0]);
  });

  it("waits for terminal success and counts exactly one successful flow", () => {
    const h = harness([
      { status: 200 },
      { status: 200, body: { generationId: "test-id" } },
      { status: 200, body: { generation: { status: "processing" } } },
      { status: 200, body: { generation: { status: "succeeded" } } },
    ]);
    h.api.defaultFlow(h.api.setup());
    expect(h.metrics.functional_flow_success).toEqual([1]);
    expect(h.metrics.functional_submissions).toEqual([0, 1]);
    expect(h.metrics.functional_completions).toEqual([0, 1]);
    expect(h.metrics.functional_succeeded).toEqual([0, 1]);
  });

  it("counts thrown request errors as failures", () => {
    const h = harness([{ status: 0, throws: true }]);
    expect(() => h.api.defaultFlow(h.api.setup())).toThrow("request failed");
    expect(h.metrics.functional_flow_success).toEqual([0]);
  });
});