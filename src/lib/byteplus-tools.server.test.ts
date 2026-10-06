import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  bytePlusDolaResponse,
  bytePlusSkylarkEmbedding,
} from "./byteplus-tools.server";
import { BytePlusError } from "./byteplus.server";

const realFetch = globalThis.fetch;
const savedKey = process.env.BYTEPLUS_API_KEY;
const savedArkKey = process.env.ARK_API_KEY;

function response(body: string, status = 200, headers?: Record<string, string>): Response {
  return new Response(body, { status, headers });
}

describe("byteplus-tools.server", () => {
  beforeEach(() => {
    process.env.BYTEPLUS_API_KEY = "test-secret";
    delete process.env.ARK_API_KEY;
    delete process.env.BYTEPLUS_BASE_URL;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (savedKey === undefined) delete process.env.BYTEPLUS_API_KEY;
    else process.env.BYTEPLUS_API_KEY = savedKey;
    if (savedArkKey === undefined) delete process.env.ARK_API_KEY;
    else process.env.ARK_API_KEY = savedArkKey;
  });

  it("uses the exact Dola Responses schema with tools disabled by default", async () => {
    let requestBody: Record<string, unknown> = {};
    globalThis.fetch = mock(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return response(
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"{\\"ok\\":"}\n\n' +
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"true}"}\n\n' +
          'event: response.completed\ndata: {"type":"response.completed","response":{"id":"r1"}}\n\n',
        200,
        { "content-type": "text/event-stream" },
      );
    }) as typeof fetch;

    const result = await bytePlusDolaResponse({ text: "Make a plan" });
    expect(requestBody.model).toBe("dola-seed-2-1-turbo-260628");
    expect(requestBody.stream).toBe(true);
    expect(requestBody.tools).toBeUndefined();
    expect(requestBody.input).toEqual([
      { role: "user", content: [{ type: "input_text", text: "Make a plan" }] },
    ]);
    expect(result.outputText).toBe('{"ok":true}');
    expect(result.id).toBe("r1");
  });

  it("only enables the fixed DeepWiki MCP tool for a canonical public repo", async () => {
    let requestBody: Record<string, unknown> = {};
    globalThis.fetch = mock(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return response('data: {"type":"response.completed","response":{}}\n\n');
    }) as typeof fetch;

    await bytePlusDolaResponse({ text: "Summarize architecture", publicRepo: "facebook/react" });
    expect(requestBody.tools).toEqual([
      {
        type: "mcp",
        server_label: "deepwiki",
        server_url: "https://mcp.deepwiki.com/mcp",
        require_approval: "never",
      },
    ]);
    await expect(
      bytePlusDolaResponse({ text: "x", publicRepo: "https://example.com/private" }),
    ).rejects.toThrow(/public GitHub owner\/repository/);
  });

  it("retries Dola once with ARK_API_KEY after a rejected legacy BytePlus key", async () => {
    process.env.BYTEPLUS_API_KEY = "legacy-key";
    process.env.ARK_API_KEY = "working-ark-key";
    const authorizationHeaders: string[] = [];
    globalThis.fetch = mock(async (_input, init) => {
      authorizationHeaders.push(new Headers(init?.headers).get("authorization") ?? "");
      if (authorizationHeaders.length === 1) {
        return response(JSON.stringify({ error: { code: "AuthenticationError" } }), 401);
      }
      return response('data: {"type":"response.output_text.delta","delta":"ok"}\n\n');
    }) as typeof fetch;

    const result = await bytePlusDolaResponse({ text: "Make a plan" });
    expect(result.outputText).toBe("ok");
    expect(authorizationHeaders).toEqual([
      "Bearer legacy-key",
      "Bearer working-ark-key",
    ]);
  });

  it("posts a joint text and image input to Skylark and validates its vector", async () => {
    let url = "";
    let requestBody: Record<string, unknown> = {};
    globalThis.fetch = mock(async (input, init) => {
      url = String(input);
      requestBody = JSON.parse(String(init?.body));
      return response(JSON.stringify({ data: [{ embedding: [0.1, -0.2, 0.3] }], usage: {} }));
    }) as typeof fetch;

    const result = await bytePlusSkylarkEmbedding({
      text: "red shoe",
      imageUrl: "https://images.example.com/shoe.jpg",
    });
    expect(url).toEndWith("/embeddings/multimodal");
    expect(requestBody).toEqual({
      model: "skylark-embedding-vision-250615",
      input: [
        { type: "text", text: "red shoe" },
        {
          type: "image_url",
          image_url: { url: "https://images.example.com/shoe.jpg" },
        },
      ],
    });
    expect(result).toMatchObject({ embedding: [0.1, -0.2, 0.3], dimensions: 3 });
  });

  it("rejects private image hosts and overlong input before fetch", async () => {
    const fetchMock = mock(async () => response("{}"));
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(
      bytePlusSkylarkEmbedding({ text: "x", imageUrl: "https://127.0.0.1/a.png" }),
    ).rejects.toThrow(/public host/);
    await expect(bytePlusDolaResponse({ text: "x".repeat(12_001) })).rejects.toThrow(/limit/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sanitizes provider errors instead of exposing response text or URLs", async () => {
    globalThis.fetch = mock(async () =>
      response(
        JSON.stringify({
          error: {
            code: "AuthenticationError",
            message: "secret token at https://private.example/a",
          },
        }),
        401,
      ),
    ) as typeof fetch;
    const error = (await bytePlusDolaResponse({ text: "x" }).catch((value) => value)) as BytePlusError;
    expect(error.message).toBe("BytePlus responses request failed (401, AuthenticationError)");
    expect(error.message).not.toContain("https://");
    expect(error.status).toBe(401);
  });
});