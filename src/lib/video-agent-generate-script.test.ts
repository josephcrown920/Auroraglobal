import { describe, expect, it, mock } from "bun:test";
import type { routedGenerate } from "@/lib/ai-router";
import { generateVideoAgentScriptCore } from "@/routes/api/video-agent/generate-script";

describe("video-agent generate-script LLM routing", () => {
  it("uses the shared SCRIPT_WRITING router without selecting a model locally", async () => {
    const output = {
      title: "A Better Morning",
      scenes: [{
        index: 0,
        title: "First light",
        script: "The day begins with one deliberate choice.",
        description: "Warm dawn light crosses a quiet kitchen in a slow dolly shot.",
        duration: 8,
      }],
    };
    const generate = mock(async (args: Parameters<typeof routedGenerate>[0]) => {
      expect(args.category).toBe("SCRIPT_WRITING");
      expect(args.prompt).toContain("Number of scenes: 4");
      expect(args).not.toHaveProperty("model");
      expect(args).not.toHaveProperty("response_format");
      expect(args.schema.parse(output)).toEqual(output);
      return {
        output,
        provider: "openai",
        model: "router-selected-model",
        category: "SCRIPT_WRITING" as const,
        fallbackCount: 0,
        latencyMs: 1,
      };
    }) as typeof routedGenerate;

    const result = await generateVideoAgentScriptCore({
      prompt: "Show a calm morning routine",
      style: "cinematic",
      voice: "narrator-warm",
      targetDuration: 60,
    }, generate);

    expect(result).toEqual(output);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});