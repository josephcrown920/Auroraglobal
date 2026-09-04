import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { z } from "zod";
import { generateText } from "ai";
import { routedGenerate } from "./ai-router";
import { classifyRequest } from "./ai-router/classifier";
import { resetHealthMap } from "./ai-router/health";
import { resetProviderRegistry, setProviderRegistryForTest, type RouterProvider } from "./ai-router/providers";
import { ChatTurnSchema } from "./agent.schema";
import { chatWithAuroraAgentCore } from "./agent.functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ChatResultSchema = z.object({
  reply: z.string(),
  plan: z.null(),
  memoryUpdate: z.null(),
  skillCall: z.null(),
});

function provider(name: string): RouterProvider {
  return {
    name,
    displayName: name,
    enabled: true,
    model: `${name}-test-model`,
    make: () => ((model: string) => ({ model }) as never) as never,
  };
}

function chatContext() {
  const inserts: unknown[][] = [];
  const memory = {
    select: () => memory,
    eq: () => memory,
    maybeSingle: async () => ({
      data: {
        memory: "I make moody performance videos.",
        structured_memory: { recurring_characters: ["Nova"] },
      },
    }),
  };
  const history = {
    select: () => history,
    eq: () => history,
    order: () => history,
    limit: async () => ({ data: [{ role: "user", content: "I want something intimate." }], error: null }),
    insert: async (rows: unknown[]) => {
      inserts.push(rows);
      return { error: null };
    },
  };
  return {
    context: {
      userId: "test-user",
      supabase: {
        from: (table: string) => (table === "agent_user_memory" ? memory : history),
      } as unknown as SupabaseClient<Database>,
    },
    inserts,
  };
}

describe("Aurora chat router integration", () => {
  beforeEach(() => {
    resetHealthMap();
  });

  afterEach(() => {
    mock.restore();
    resetProviderRegistry();
    resetHealthMap();
  });

  it("classifies a chat turn, selects its provider, and returns schema-shaped output", async () => {
    const classified = classifyRequest("Help me shape a cinematic music video treatment.");
    expect(classified).toBe("VIDEO_DIRECTION");

    setProviderRegistryForTest(new Map([["claude", provider("claude")]]));
    mock.module("ai", () => ({
      generateText: mock(async () => ({
        experimental_output: {
          reply: "Start with a restrained dusk performance and one visual motif.",
          plan: null,
          memoryUpdate: null,
          skillCall: null,
        },
      })),
      Output: { object: ({ schema }: { schema: unknown }) => schema },
    }));

    const result = await routedGenerate({
      system: "Aurora chat director",
      prompt: "Help me shape a cinematic music video treatment.",
      schema: ChatTurnSchema,
    });

    expect(result.category).toBe("VIDEO_DIRECTION");
    expect(result.provider).toBe("claude");
    expect(result.fallbackCount).toBe(0);
    expect(ChatResultSchema.parse(result.output)).toEqual({
      reply: "Start with a restrained dusk performance and one visual motif.",
      plan: null,
      memoryUpdate: null,
      skillCall: null,
    });
  });

  it("falls back to the next chat provider when the first one throws", async () => {
    setProviderRegistryForTest(new Map([
      ["gemini", provider("gemini")],
      ["grok", provider("grok")],
    ]));

    const generated = mock(async ({ model }: { model: { model: string } }) => {
      if (model.model === "gemini-test-model")
        throw new Error("first provider unavailable");
      return {
        experimental_output: {
          reply: "The fallback director is ready.",
          plan: null,
          memoryUpdate: null,
          skillCall: null,
        },
      };
    });
    mock.module("ai", () => ({
      generateText: generated,
      Output: { object: ({ schema }: { schema: unknown }) => schema },
    }));

    const result = await routedGenerate({
      system: "Aurora chat director",
      prompt: "What should I shoot first?",
      schema: ChatTurnSchema,
      category: "GENERAL_CHAT",
    });

    expect(result.provider).toBe("grok");
    expect(result.fallbackCount).toBe(1);
    expect(ChatResultSchema.parse(result.output).reply).toBe("The fallback director is ready.");
    expect(generated).toHaveBeenCalledTimes(3);
  });

  it("runs the real chat server-function core with authenticated context, router classification, and persistence", async () => {
    setProviderRegistryForTest(new Map([["claude", provider("claude")]]));
    const generated = mock(async () => ({
      experimental_output: {
        reply: "Open on a close, intimate performance and build outward from there.",
        plan: null,
        memoryUpdate: null,
        skillCall: null,
      },
    }));
    mock.module("ai", () => ({
      generateText: generated,
      Output: { object: ({ schema }: { schema: unknown }) => schema },
    }));
    const { context, inserts } = chatContext();

    const result = await chatWithAuroraAgentCore(context, {
      message: "Help me shape a cinematic music video treatment.",
      memory: "Brand voice: luxurious, restrained, and intimate.",
    });

    expect(result).toEqual({
      reply: "Open on a close, intimate performance and build outward from there.",
      plan: null,
      memoryUpdated: false,
      skillInvoked: null,
    });
    expect(generated).toHaveBeenCalled();
    const firstRequest = generated.mock.calls[0]?.[0] as { system?: string } | undefined;
    expect(firstRequest?.system).toContain("DIRECTOR MEMORY — USER-SUPPLIED CREATIVE CONTEXT");
    expect(firstRequest?.system).toContain("Brand voice: luxurious, restrained, and intimate.");
    expect(firstRequest?.system).toContain("STRUCTURED BRAND PROFILE");
    expect(firstRequest?.system).toContain("Nova");
    expect(firstRequest?.system).not.toContain("I make moody performance videos.");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual([
      { user_id: "test-user", role: "user", content: "Help me shape a cinematic music video treatment." },
      expect.objectContaining({ user_id: "test-user", role: "assistant", content: result.reply }),
    ]);
  });

  it("keeps the real chat server-function core available when its first provider fails", async () => {
    setProviderRegistryForTest(new Map([
      ["claude", provider("claude")],
      ["gemini", provider("gemini")],
    ]));
    const generated = mock(async ({ model }: { model: { model: string } }) => {
      if (model.model === "claude-test-model") throw new Error("first provider unavailable");
      return {
        experimental_output: {
          reply: "The fallback director is ready.",
          plan: null,
          memoryUpdate: null,
          skillCall: null,
        },
      };
    });
    mock.module("ai", () => ({
      generateText: generated,
      Output: { object: ({ schema }: { schema: unknown }) => schema },
    }));
    const { context } = chatContext();

    const result = await chatWithAuroraAgentCore(context, { message: "Where do I begin?" });

    expect(result.reply).toBe("The fallback director is ready.");
    expect(generated).toHaveBeenCalledTimes(3);
  });
});