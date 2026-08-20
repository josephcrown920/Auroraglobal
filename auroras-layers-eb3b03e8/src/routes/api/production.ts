import { createFileRoute } from "@tanstack/react-router";
import { BRAIN_MODELS, DEFAULT_BRAIN_MODEL } from "@/lib/auroraModels";

type Msg = { role: "user" | "assistant" | "tool"; content: string };

const SYSTEM = `You are AURORA PRODUCTION AGENT — a tool-calling director inside Aurora Performance Studio,
a layer-based image studio for music artists (trap / hip-hop visual language).

You do not just describe shoots, you BUILD them by calling tools:
- build_storyboard: lay out an ordered shot sequence (beat + image prompt + motion direction per shot).
- render_layer: send one dense image prompt straight into the studio to render now.
- update_bible: write a trait into the artist's character bible (face, body, hair, wardrobe, jewelry, tattoo, voice).

Rules:
- When the user asks for a sequence, video, or "shoot", call build_storyboard with 3-6 shots.
- Prompts must preserve the subject's identity, skin tone, pose, framing and left-to-right order.
  Only change what was asked. Never flip the composition or recast anyone.
- Keep any spoken reply under 70 words. No markdown headings, no preamble.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "build_storyboard",
      description: "Create an ordered shot sequence in the studio storyboard.",
      parameters: {
        type: "object",
        properties: {
          shots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                beat: { type: "string", description: "Story beat for this shot" },
                prompt: { type: "string", description: "Dense image prompt for the frame" },
                motion: { type: "string", description: "Camera/subject motion direction" },
              },
              required: ["beat", "prompt", "motion"],
              additionalProperties: false,
            },
          },
        },
        required: ["shots"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_layer",
      description: "Render one layer edit in the studio immediately.",
      parameters: {
        type: "object",
        properties: { prompt: { type: "string" } },
        required: ["prompt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_bible",
      description: "Write or update one trait in the artist's character bible.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["face", "body", "hair", "wardrobe", "jewelry", "tattoo", "voice"],
          },
          label: { type: "string" },
          detail: { type: "string" },
        },
        required: ["kind", "label", "detail"],
        additionalProperties: false,
      },
    },
  },
];

export const Route = createFileRoute("/api/production")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, model: requested, context } = (await request.json()) as {
          messages: Msg[];
          model?: string;
          context?: string;
        };

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }

        const model = BRAIN_MODELS.some((m) => m.available && m.id === requested)
          ? requested
          : DEFAULT_BRAIN_MODEL;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            tools: TOOLS,
            tool_choice: "auto",
            messages: [
              { role: "system", content: SYSTEM },
              ...(context ? [{ role: "system", content: `STUDIO STATE:\n${context}` }] : []),
              ...messages.slice(-12).map((m) => ({ role: m.role === "tool" ? "assistant" : m.role, content: m.content })),
            ],
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Production agent unavailable", { status: upstream.status });
        }

        const json = (await upstream.json()) as {
          choices?: { message?: { content?: string; tool_calls?: { function: { name: string; arguments: string } }[] } }[];
        };
        const message = json.choices?.[0]?.message ?? {};
        const calls = (message.tool_calls ?? []).map((call) => {
          let args: unknown = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          return { name: call.function.name, args };
        });

        return new Response(JSON.stringify({ content: message.content ?? "", calls }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
