import { describe, expect, it } from "bun:test";
import {
  listTools,
  zodToJsonSchema,
  callTool,
  handleRpcMessage,
  PROTOCOL_VERSION,
  SERVER_INFO,
} from "./server.server";
import { generateVideoSchema, type ToolDeps } from "./tools.server";
import { userIdForApiKey } from "@/lib/cli-device.server";

// These pin the framework-agnostic MCP core: the published tool manifest, the
// Zod→JSON-Schema projection Claude reads, dispatch, and the JSON-RPC handshake
// + auth gate. The HTTP route (api/mcp.ts) is a thin shell over handleRpcMessage,
// so exercising it here covers the wire contract without route machinery.

const TOOL_NAMES = [
  "aurora_generate_video",
  "aurora_bulk_generate",
  "aurora_image_to_video",
  "aurora_list_avatars",
  "aurora_get_job_status",
  "aurora_create_avatar",
  "aurora_animate_from_driving_video",
  "aurora_performance_reskin",
  "aurora_generate_ugc_ad",
  "aurora_generate_campaign",
  "aurora_submit_job",
  "aurora_list_jobs",
  "aurora_cancel_job",
];

function toolByName(name: string) {
  const t = listTools().tools.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not in manifest`);
  return t;
}

describe("listTools manifest", () => {
  it("exposes exactly the 13 aurora_* tools", () => {
    const names = listTools().tools.map((t) => t.name);
    expect(names.sort()).toEqual([...TOOL_NAMES].sort());
  });

  it("every tool has a non-empty description and an object input schema", () => {
    for (const t of listTools().tools) {
      expect(t.description.length).toBeGreaterThan(10);
      expect((t.inputSchema as { type: string }).type).toBe("object");
    }
  });

  it("marks required vs optional params correctly", () => {
    expect((toolByName("aurora_generate_video").inputSchema as { required?: string[] }).required).toEqual(["prompt"]);
    expect(
      (toolByName("aurora_bulk_generate").inputSchema as { required?: string[] }).required,
    ).toEqual(["avatar_name", "prompt_template", "count"]);
    // limit has a default → fully optional → no `required` key at all.
    expect((toolByName("aurora_list_avatars").inputSchema as { required?: string[] }).required).toBeUndefined();
  });
});

describe("zodToJsonSchema", () => {
  it("projects primitives, enums and required-ness from a Zod object", () => {
    const js = zodToJsonSchema(generateVideoSchema) as {
      type: string;
      properties: Record<string, { type: string; enum?: string[]; description?: string }>;
      required?: string[];
    };
    expect(js.type).toBe("object");
    expect(js.properties.prompt.type).toBe("string");
    expect(js.properties.prompt.description).toBeTruthy();
    expect(js.properties.duration.type).toBe("number");
    expect(js.properties.aspect_ratio.enum).toEqual(["9:16", "16:9", "1:1", "4:5"]);
    expect(js.required).toEqual(["prompt"]);
  });
});

describe("callTool dispatch", () => {
  it("returns an MCP error result for an unknown tool (no throw)", async () => {
    const res = await callTool("aurora_not_a_tool", {}, { userId: "u1", bearer: "aurk_x", origin: "https://app.test" });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text).error).toMatch(/Unknown tool/);
  });
});

// A deps fake good enough to prove the protocol layer threads injection through
// to the tool without hitting Supabase / the network.
function fakeDeps(): ToolDeps {
  return {
    rpc: async () => ({ data: { job_id: "j", generation_id: "g" }, error: null }),
    callGenerate: async () => ({ url: "https://cdn/x.mp4", provider: "replicate" }),
    getAvatarByName: async () => null,
    listAvatars: async () => [],
    createAvatar: async () => {
      throw new Error("unused");
    },
    hasActiveWorkerForKind: async () => true,
    getJobRow: async () => null,
    getGenerationRow: async () => null,
  };
}

describe("handleRpcMessage", () => {
  const ORIGIN = "https://app.test";
  const NO_AUTH = { userId: null, bearer: null };
  const AUTH = { userId: "u1", bearer: "aurk_x" };

  it("initialize returns protocol version + serverInfo + tools capability", async () => {
    const r = (await handleRpcMessage({ id: 1, method: "initialize", params: {} }, NO_AUTH, ORIGIN)) as {
      result: { protocolVersion: string; serverInfo: { name: string }; capabilities: { tools: object } };
    };
    expect(r.result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(r.result.serverInfo.name).toBe(SERVER_INFO.name);
    expect(r.result.capabilities.tools).toBeDefined();
  });

  it("ping returns an empty result", async () => {
    const r = (await handleRpcMessage({ id: 2, method: "ping" }, NO_AUTH, ORIGIN)) as { result: object };
    expect(r.result).toEqual({});
  });

  it("tools/list is open (no auth) and lists all 13 tools", async () => {
    const r = (await handleRpcMessage({ id: 3, method: "tools/list" }, NO_AUTH, ORIGIN)) as {
      result: { tools: unknown[] };
    };
    expect(r.result.tools).toHaveLength(13);
  });

  it("tools/call without a bearer is rejected with JSON-RPC -32001", async () => {
    const r = (await handleRpcMessage(
      { id: 4, method: "tools/call", params: { name: "aurora_list_avatars", arguments: {} } },
      NO_AUTH,
      ORIGIN,
    )) as { error: { code: number; message: string } };
    expect(r.error.code).toBe(-32001);
    expect(r.error.message).toMatch(/Unauthorized/);
  });

  it("tools/call with auth dispatches through injected deps", async () => {
    const r = (await handleRpcMessage(
      { id: 5, method: "tools/call", params: { name: "aurora_list_avatars", arguments: {} } },
      AUTH,
      ORIGIN,
      fakeDeps(),
    )) as { result: { content: { text: string }[]; isError?: boolean } };
    expect(r.result.isError).toBeFalsy();
    expect(JSON.parse(r.result.content[0].text)).toEqual({ avatars: [], total: 0 });
  });

  it("a failing tool surfaces as an MCP error result, not a transport error", async () => {
    const deps = { ...fakeDeps(), hasActiveWorkerForKind: async () => false };
    const r = (await handleRpcMessage(
      {
        id: 6,
        method: "tools/call",
        params: {
          name: "aurora_animate_from_driving_video",
          arguments: { image_url: "https://cdn/a.png", driving_video_url: "https://cdn/b.mp4" },
        },
      },
      AUTH,
      ORIGIN,
      deps,
    )) as { result: { isError?: boolean }; error?: unknown };
    expect(r.error).toBeUndefined();
    expect(r.result.isError).toBe(true);
  });

  it("notifications/initialized produces no response", async () => {
    expect(await handleRpcMessage({ method: "notifications/initialized" }, NO_AUTH, ORIGIN)).toBeNull();
  });

  it("an unknown method WITH an id returns -32601; without an id is a silent notification", async () => {
    const withId = (await handleRpcMessage({ id: 7, method: "does/notExist" }, NO_AUTH, ORIGIN)) as {
      error: { code: number };
    };
    expect(withId.error.code).toBe(-32601);
    expect(await handleRpcMessage({ method: "does/notExist" }, NO_AUTH, ORIGIN)).toBeNull();
  });
});

describe("userIdForApiKey", () => {
  it("rejects a token without the aurk_ prefix before any DB lookup", async () => {
    expect(await userIdForApiKey("not-an-aurora-key")).toBeNull();
  });
});
