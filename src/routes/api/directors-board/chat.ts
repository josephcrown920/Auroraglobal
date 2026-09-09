// POST /api/directors-board/chat
// Director AI chat — streams responses for the DirectorChat panel.
// Adapted from the directors-board zip: uses Aurora's AI gateway (OpenAI-compatible)
// instead of the Lovable AI Gateway.
import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, tool, type UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

function getProvider() {
  const base = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";
  const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
  return createOpenAICompatible({ name: "aurora-director", baseURL: base, apiKey: key });
}

type Body = { messages?: unknown; boardContext?: string };

export const Route = createFileRoute("/api/directors-board/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, boardContext } = (await request.json().catch(() => ({}))) as Body;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const provider = getProvider();
        const model = provider("gpt-4o-mini");
        const uiMessages = messages as UIMessage[];

        const result = streamText({
          model,
          system: `You are the Director, an AI collaborator helping the user build a music video storyboard.
You suggest shot ideas, wardrobe, camera language, and scene ordering.
When the user asks you to add or edit a shot, describe it clearly and use the propose_shot tool with concrete fields.
Keep replies concise and cinematic.

Current board context:
${boardContext ?? "(no shots yet)"}`,
          messages: await convertToModelMessages(uiMessages),
          tools: {
            propose_shot: tool({
              description:
                "Propose a new shot the user can accept into their storyboard. Use when the user asks for ideas or additions.",
              inputSchema: z.object({
                title: z.string(),
                shot_type: z.string(),
                frame: z.string(),
                wardrobe: z.string(),
                mood: z.string(),
                note: z.string(),
                scene: z.string(),
                image_prompt: z.string().describe("Prompt to generate a still for this shot."),
              }),
              // No server-side execute: the DirectorChat client reads tool call
              // input directly from the stream (p.type === "tool-propose_shot").
              execute: undefined,
            }),
          },
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
