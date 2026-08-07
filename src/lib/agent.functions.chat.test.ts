import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { z } from "zod";
import { generateText } from "ai";
import { routedGenerate } from "./ai-router";
import { classifyRequest } from "./ai-router/classifier";
import { resetHealthMap } from "./ai-router/health";
import { resetProviderRegistry, setProviderRegistryForTest, type RouterProvider } from "./ai-router/providers";
import { ChatTurnSchema } from "./agent.schema";

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
      if (model.model === "gemini-test-model") throw new Error("first provider unavailable");
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
});