import { afterEach, describe, expect, it, mock } from "bun:test";
import { z } from "zod";
import { generateWithFallback } from "./llm-fallback.server";
import {
  resetProviderRegistry,
  setProviderRegistryForTest,
  type RouterProvider,
} from "./ai-router/providers";
import { resetHealthMap } from "./ai-router/health";

function provider(name: string): RouterProvider {
  return {
    name,
    displayName: name,
    enabled: true,
    model: `${name}-model`,
    make: () => ((model: string) => ({ model }) as never) as never,
  };
}

describe("generateWithFallback compatibility wrapper", () => {
  afterEach(() => {
    mock.restore();
    resetProviderRegistry();
    resetHealthMap();
  });

  it("uses the shared router and returns its provider metadata", async () => {
    setProviderRegistryForTest(new Map([["gemini", provider("gemini")]]));
    mock.module("ai", () => ({
      generateText: mock(async () => ({ experimental_output: { foo: "bar" } })),
      Output: { object: ({ schema }: { schema: unknown }) => schema },
    }));

    const result = await generateWithFallback({
      system: "system",
      prompt: "prompt",
      schema: z.object({ foo: z.string() }),
    });

    expect(result).toEqual({ provider: "gemini", output: { foo: "bar" } });
  });

  it("falls through immediately when a provider/model is unavailable", async () => {
    setProviderRegistryForTest(
      new Map([
        ["gemini", provider("gemini")],
        ["openai", provider("openai")],
      ]),
    );
    const generateText = mock(async ({ model }: { model: { model: string } }) => {
      if (model.model === "gemini-model") throw new Error("model does not exist");
      return { experimental_output: { foo: "fallback" } };
    });
    mock.module("ai", () => ({
      generateText,
      Output: { object: ({ schema }: { schema: unknown }) => schema },
    }));

    const result = await generateWithFallback({
      system: "system",
      prompt: "prompt",
      schema: z.object({ foo: z.string() }),
    });

    expect(result.provider).toBe("openai");
    expect(result.output).toEqual({ foo: "fallback" });
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});