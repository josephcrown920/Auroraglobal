// Request-schema tests for the Vast API client: verifies the wire format we
// send matches Vast's documented contract (Docker-flag env string, no `price`
// on on-demand creates) by capturing the real request bodies via a fetch stub.
import { describe, expect, test } from "bun:test";
import { buildEnvString, createVastClient, VastApiError } from "./vast-api.server";

process.env.VASTAI_API_KEY ||= "test-key";

function fetchStub(response: unknown) {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  const impl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(response), { status: 200 });
  }) as typeof fetch;
  return { impl, requests };
}

describe("buildEnvString", () => {
  test("serializes env + ports as Docker flags with quoted values", () => {
    const s = buildEnvString({ AURORA_URL: "https://x.example", AURORA_TASKS: "lipsync,assemble" }, [8000]);
    expect(s).toBe("-e AURORA_URL='https://x.example' -e AURORA_TASKS='lipsync,assemble' -p 8000:8000");
  });

  test("escapes single quotes in values so secrets survive intact", () => {
    const s = buildEnvString({ SECRET: "a'b" }, []);
    expect(s).toBe(`-e SECRET='a'\\''b'`);
  });

  test("rejects invalid env names and ports", () => {
    expect(() => buildEnvString({ "-p 8000:8000": "1" }, [])).toThrow(VastApiError);
    expect(() => buildEnvString({ OK: "v" }, [70000])).toThrow(VastApiError);
  });
});

describe("createInstance request schema", () => {
  test("sends env as a Docker-flag string and NO price field (on-demand)", async () => {
    const { impl, requests } = fetchStub({ success: true, new_contract: 4242 });
    const client = createVastClient(impl);
    const { instanceId } = await client.createInstance(111, {
      image: "img",
      env: { AURORA_URL: "https://x.example" },
      ports: [8000],
      onstartCmd: "run",
      diskGb: 40,
      label: "aurora-1",
    });
    expect(instanceId).toBe(4242);
    const body = requests[0].body as Record<string, unknown>;
    expect(requests[0].url).toContain("/asks/111/");
    expect(typeof body.env).toBe("string");
    expect(body.env).toBe("-e AURORA_URL='https://x.example' -p 8000:8000");
    expect("price" in body).toBe(false);
    expect(body.onstart).toBe("run");
    expect(body.runtype).toBe("ssh");
  });
});

describe("searchOffers request schema", () => {
  test("queries on-demand rentable offers under the ceiling", async () => {
    const { impl, requests } = fetchStub({ offers: [] });
    const client = createVastClient(impl);
    await client.searchOffers({ maxHourlyUsd: 0.35, minGpuRamGb: 16 });
    const body = requests[0].body as Record<string, unknown>;
    expect(body.type).toBe("on-demand");
    expect(body.dph_total).toEqual({ lte: 0.35 });
    expect(body.rentable).toEqual({ eq: true });
  });
});
