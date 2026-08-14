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
  "aurora_batch_lipsync",
];

function toolByName(name: string) {
  const t = listTools().tools.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not in manifest`);
  return t;
}

describe("listTools manifest", () => {
  it("exposes exactly the 14 aurora_* tools", () => {
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

  it("tools/list is open (no auth) but shows the owner-filtered view", async () => {
    // Unauthenticated discovery must not leak owner-hidden features: ugc and
    // content-machine are artist-only defaults, so their tools are filtered out.
    const r = (await handleRpcMessage({ id: 3, method: "tools/list" }, NO_AUTH, ORIGIN)) as {
      result: { tools: { name: string }[] };
    };
    const names = r.result.tools.map((t) => t.name);
    expect(names).toHaveLength(TOOL_NAMES.length - 2);
    expect(names).not.toContain("aurora_generate_ugc_ad");
    expect(names).not.toContain("aurora_generate_campaign");
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

  describe("feature-visibility gating", () => {
    const ADMIN = { userId: "admin1", bearer: "aurk_admin", isAdmin: true };
    const depsHiding = (keys: string[]) => ({
      ...fakeDeps(),
      hiddenFeatureKeys: async () => keys,
    });

    it("tools/list hides gated tools for a regular authed caller but shows them to admins", async () => {
      const hidden = depsHiding(["ugc", "content-machine"]);
      const regular = (await handleRpcMessage({ id: 10, method: "tools/list" }, AUTH, ORIGIN, hidden)) as {
        result: { tools: { name: string }[] };
      };
      const names = regular.result.tools.map((t) => t.name);
      expect(names).not.toContain("aurora_generate_ugc_ad");
      expect(names).not.toContain("aurora_generate_campaign");
      expect(names).toContain("aurora_generate_video");

      const admin = (await handleRpcMessage({ id: 11, method: "tools/list" }, ADMIN, ORIGIN, hidden)) as {
        result: { tools: { name: string }[] };
      };
      expect(admin.result.tools).toHaveLength(TOOL_NAMES.length);
    });

    it("tools/list shows gated tools again when the owner resurfaces the feature", async () => {
      const visible = depsHiding([]);
      const r = (await handleRpcMessage({ id: 12, method: "tools/list" }, AUTH, ORIGIN, visible)) as {
        result: { tools: { name: string }[] };
      };
      expect(r.result.tools).toHaveLength(TOOL_NAMES.length);
    });

    it("tools/call on a hidden-feature tool fails EXPLICITLY and never dispatches", async () => {
      let dispatched = false;
      const deps = {
        ...fakeDeps(),
        hiddenFeatureKeys: async () => ["ugc"],
        getAvatarByName: async () => {
          dispatched = true;
          return null;
        },
      };
      const r = (await handleRpcMessage(
        { id: 13, method: "tools/call", params: { name: "aurora_generate_ugc_ad", arguments: { avatar_name: "x", product: "tea" } } },
        AUTH,
        ORIGIN,
        deps,
      )) as { result: { isError?: boolean; content: { text: string }[] } };
      expect(r.result.isError).toBe(true);
      const payload = JSON.parse(r.result.content[0].text);
      expect(payload.error).toMatch(/Feature unavailable/);
      expect(payload.feature).toBe("ugc");
      expect(dispatched).toBe(false); // explicit refusal BEFORE any dispatch/charge
    });

    it("tools/call on a hidden-feature tool still dispatches for an admin", async () => {
      const deps = depsHiding(["ugc"]);
      const r = (await handleRpcMessage(
        { id: 14, method: "tools/call", params: { name: "aurora_generate_ugc_ad", arguments: { avatar_name: "x", product: "tea" } } },
        ADMIN,
        ORIGIN,
        deps,
      )) as { result: { isError?: boolean; content: { text: string }[] } };
      // Gate passed → dispatch ran → avatar lookup is the tool's first step and
      // fakeDeps returns null, so the error is the tool's own, not the gate's.
      expect(JSON.parse(r.result.content[0].text).error).toMatch(/not found/);
    });

    it("tools/call refuses aurora_generate_campaign the same way (second mapped path)", async () => {
      const r = (await handleRpcMessage(
        { id: 16, method: "tools/call", params: { name: "aurora_generate_campaign", arguments: { avatar_name: "x", prompt_template: "p", count: 2 } } },
        AUTH,
        ORIGIN,
        depsHiding(["content-machine"]),
      )) as { result: { isError?: boolean; content: { text: string }[] } };
      expect(r.result.isError).toBe(true);
      const payload = JSON.parse(r.result.content[0].text);
      expect(payload.error).toMatch(/Feature unavailable/);
      expect(payload.feature).toBe("content-machine");
    });

    it("a throwing or missing visibility resolver fails CLOSED (seeded hidden defaults)", async () => {
      // Resolver throws → seeded artist-only defaults apply → ugc stays hidden.
      const throwing = { ...fakeDeps(), hiddenFeatureKeys: async () => { throw new Error("db down"); } };
      const r1 = (await handleRpcMessage({ id: 17, method: "tools/list" }, AUTH, ORIGIN, throwing)) as {
        result: { tools: { name: string }[] };
      };
      expect(r1.result.tools.map((t) => t.name)).not.toContain("aurora_generate_ugc_ad");
      // Resolver missing entirely (old-style deps) → same fail-safe defaults.
      const r2 = (await handleRpcMessage({ id: 18, method: "tools/list" }, AUTH, ORIGIN, fakeDeps())) as {
        result: { tools: { name: string }[] };
      };
      expect(r2.result.tools.map((t) => t.name)).not.toContain("aurora_generate_campaign");
      // But a throw can never block an ADMIN — isAdmin short-circuits first.
      const r3 = (await handleRpcMessage({ id: 19, method: "tools/list" }, ADMIN, ORIGIN, throwing)) as {
        result: { tools: { name: string }[] };
      };
      expect(r3.result.tools).toHaveLength(TOOL_NAMES.length);
    });

    it("tools/call on a non-gated tool is unaffected by hidden keys", async () => {
      const r = (await handleRpcMessage(
        { id: 15, method: "tools/call", params: { name: "aurora_list_avatars", arguments: {} } },
        AUTH,
        ORIGIN,
        depsHiding(["ugc", "content-machine"]),
      )) as { result: { isError?: boolean; content: { text: string }[] } };
      expect(r.result.isError).toBeFalsy();
      expect(JSON.parse(r.result.content[0].text)).toEqual({ avatars: [], total: 0 });
    });
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
