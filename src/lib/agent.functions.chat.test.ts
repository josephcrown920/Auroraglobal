import { afterEach, describe, expect, it, mock } from "bun:test";
import { z } from "zod";
import { classifyRequest } from "./ai-router/classifier";
import { routedGenerate } from "./ai-router";
import type { RouterProvider } from "./ai-router/providers";
import { chatWithAuroraAgentCore, decodeAgentChatSkillMeta } from "./agent.functions";
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
    model: name,
    make: () => ((modelId: string) => ({ model: modelId, modelId, provider: name })) as never,
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
  afterEach(() => {
    mock.restore();
  });

  it("classifies a chat turn, selects its provider, and returns schema-shaped output", async () => {
    const classified = classifyRequest("Help me shape a cinematic music video treatment.");
    expect(classified).toBe("VIDEO_DIRECTION");

    const { context } = chatContext();
    const generate = mock(async () => ({
      output: {
        reply: "Start with a restrained dusk performance and one visual motif.",
        plan: null,
        memoryUpdate: null,
        skillCall: null,
      },
      provider: "modelark",
      model: "modelark-chat",
      category: "VIDEO_DIRECTION" as const,
      fallbackCount: 0,
      latencyMs: 1,
    }));
    const result = await chatWithAuroraAgentCore(
      context,
      { message: "Help me shape a cinematic music video treatment." },
      { generate: generate as never, loadSkills: async () => ({}) as never },
    );

    expect(result.provider).toBe("modelark");
    expect(result.model).toBe("modelark-chat");
    expect(
      ChatResultSchema.parse({
        reply: result.reply,
        plan: result.plan,
        memoryUpdate: null,
        skillCall: null,
      }),
    ).toEqual({
      reply: "Start with a restrained dusk performance and one visual motif.",
      plan: null,
      memoryUpdate: null,
      skillCall: null,
    });
  });

  it("preserves metadata when the constrained generator returns its free fallback", async () => {
    const { context } = chatContext();
    const generated = mock(async () => ({
      output: {
        reply: "The fallback director is ready.",
        plan: null,
        memoryUpdate: null,
        skillCall: null,
      },
      provider: "openrouter-free",
      model: "pool/served-model:free",
      category: "GENERAL_CHAT" as const,
      fallbackCount: 1,
      latencyMs: 1,
    }));
    const result = await chatWithAuroraAgentCore(
      context,
      { message: "What should I shoot first?" },
      { generate: generated as never, loadSkills: async () => ({}) as never },
    );

    expect(result.reply).toBe("The fallback director is ready.");
    expect(result.provider).toBe("openrouter-free");
    expect(result.model).toBe("pool/served-model:free");
    expect(generated).toHaveBeenCalledTimes(1);
  });

  it("reloads routing metadata without turning a skill-less row into a SkillMeta", () => {
    expect(decodeAgentChatSkillMeta({
      ai_routing: { provider: "modelark", model: "served-model" },
    })).toEqual({
      skillMeta: null,
      aiRouting: { provider: "modelark", model: "served-model" },
    });
    expect(decodeAgentChatSkillMeta({
      name: "web_search",
      icon: "🔍",
      label: "Web Search",
      summary: "Searched",
      durationMs: 12,
      ai_routing: { provider: "openrouter-free", model: "openrouter/free" },
    })).toEqual({
      skillMeta: {
        name: "web_search",
        icon: "🔍",
        label: "Web Search",
        summary: "Searched",
        durationMs: 12,
      },
      aiRouting: { provider: "openrouter-free", model: "openrouter/free" },
    });
  });

  it("runs the real chat server-function core with authenticated context, router classification, and persistence", async () => {
    type ChatDeps = NonNullable<Parameters<typeof chatWithAuroraAgentCore>[2]>;
    const generated = mock(async (args: Parameters<ChatDeps["generate"]>[0]) => ({
      output: {
        reply: "Open on a close, intimate performance and build outward from there.",
        plan: null,
        memoryUpdate: null,
        skillCall: null,
      },
      provider: "modelark",
      model: "mock-model",
      category: args.category ?? "VIDEO_DIRECTION",
      fallbackCount: 0,
      latencyMs: 1,
    })) as ChatDeps["generate"];
    const { context, inserts } = chatContext();

    const result = await chatWithAuroraAgentCore(context, {
      message: "Help me shape a cinematic music video treatment.",
      memory: "Brand voice: luxurious, restrained, and intimate.",
    }, {
      generate: generated,
      loadSkills: async () => ({}) as never,
    });

    expect(result).toEqual({
      reply: "Open on a close, intimate performance and build outward from there.",
      plan: null,
      memoryUpdated: false,
      skillInvoked: null,
      provider: "modelark",
      model: "mock-model",
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
    expect(inserts[0]?.[1]).toEqual(expect.objectContaining({
      skill_meta: { ai_routing: { provider: "modelark", model: "mock-model" } },
    }));
  });

  it("keeps the real chat server-function core available when its constrained generator returns a fallback", async () => {
    type ChatDeps = NonNullable<Parameters<typeof chatWithAuroraAgentCore>[2]>;
    const generated = mock(async (args: Parameters<ChatDeps["generate"]>[0]) => ({
      output: {
        reply: "The fallback director is ready.",
        plan: null,
        memoryUpdate: null,
        skillCall: null,
      },
      provider: args.routingMode === "modelark-free" ? "openrouter-free" : "none",
      model: "mock-model",
      category: "GENERAL_CHAT" as const,
      fallbackCount: 1,
      latencyMs: 1,
    })) as ChatDeps["generate"];
    const { context } = chatContext();

    const result = await chatWithAuroraAgentCore(
      context,
      { message: "Where do I begin?" },
      { generate: generated, loadSkills: async () => ({}) as never },
    );

    expect(result.reply).toBe("The fallback director is ready.");
    expect(result.provider).toBe("openrouter-free");
    expect(result.model).toBe("mock-model");
    expect(generated).toHaveBeenCalledTimes(1);
  });

  it("keeps both chat passes on the constrained free routing mode", async () => {
    const calls: Array<{ routingMode?: string }> = [];
    const { context } = chatContext();
    const firstTurn = {
      reply: "I checked the latest visual references.",
      plan: null,
      memoryUpdate: null,
      skillCall: { skill: "web_search" as const, args: { query: "cinematic lighting" } },
    };
    const secondTurn = {
      reply: "Use a cool key and a warm practical for contrast.",
      plan: null,
      memoryUpdate: null,
      skillCall: null,
    };
    type ChatDeps = NonNullable<Parameters<typeof chatWithAuroraAgentCore>[2]>;
    const generate = mock(async (args: Parameters<ChatDeps["generate"]>[0]) => {
      calls.push({ routingMode: args.routingMode });
      const output = calls.length === 1 ? firstTurn : secondTurn;
      return {
        output,
        provider: calls.length === 1 ? "modelark" : "openrouter-free",
        model: calls.length === 1 ? "modelark-test" : "openrouter/free",
        category: "GENERAL_CHAT" as const,
        fallbackCount: calls.length === 1 ? 0 : 1,
        latencyMs: 1,
      };
    }) as ChatDeps["generate"];
    const deps = {
      generate,
      loadSkills: async () => ({
        dispatchSkill: async () => ({
          ok: true,
          summary: "Searched lighting references",
          data: { bullets: ["Use motivated contrast."] },
        }),
        SKILL_REGISTRY: {
          web_search: { icon: "🔍", label: "Web Search" },
        },
      }),
    } as unknown as ChatDeps;

    const result = await chatWithAuroraAgentCore(context, { message: "Research cinematic lighting." }, deps);

    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.routingMode === "modelark-free")).toBe(true);
    expect(result.reply).toBe(secondTurn.reply);
    expect(result.provider).toBe("openrouter-free");
    expect(result.model).toBe("openrouter/free");
  });

  it("uses ModelArk first for the real Video Agent chat and keeps free OpenRouter as fallback", async () => {
    const providerRegistry = new Map([
      ["modelark", { ...provider("modelark"), model: "modelark-test" }],
      ["openrouter-free", { ...provider("openrouter-free"), model: "openrouter/free" }],
    ]);
    const generated = mock(async ({ model }: { model: { model: string } }) => ({
      experimental_output: {
        reply: `Planned by ${model.model}`,
        plan: null, memoryUpdate: null, skillCall: null,
      },
      response: { modelId: "test-provider/actual-model" },
    }));
    const { context } = chatContext();
    const result = await chatWithAuroraAgentCore(
      context,
      { message: "Plan a cinematic avatar video.", cinematicMode: true },
      {
        generate: ((args) =>
          routedGenerate(args, { providerRegistry, generateText: generated as never })) as never,
        loadSkills: async () => ({}) as never,
      },
    );
    expect(result.reply).toBe("Planned by modelark-test");
    expect(generated).toHaveBeenCalledTimes(1);
    const request = generated.mock.calls[0]?.[0] as { maxOutputTokens?: number } | undefined;
    expect(request?.maxOutputTokens).toBe(4096);
  });

  it("uses a working free fallback when ModelArk is unavailable", async () => {
    const providerRegistry = new Map([
      ["modelark", { ...provider("modelark"), model: "modelark-test" }],
      ["openrouter-free", { ...provider("openrouter-free"), model: "openrouter/free" }],
    ]);
    const generated = mock(async ({ model }: { model: { model: string } }) => {
      if (model.model === "modelark-test") throw new Error("model is not available");
      return { experimental_output: {
        reply: "Here is your video plan.", plan: null, memoryUpdate: null, skillCall: null,
      } };
    });
    const { context } = chatContext();
    const result = await chatWithAuroraAgentCore(
      context,
      { message: "Plan a cinematic video treatment.", cinematicMode: true },
      {
        generate: ((args) =>
          routedGenerate(args, { providerRegistry, generateText: generated as never })) as never,
        loadSkills: async () => ({}) as never,
      },
    );
    expect(result.reply).toBe("Here is your video plan.");
    expect(generated).toHaveBeenCalledTimes(2);
  });
});