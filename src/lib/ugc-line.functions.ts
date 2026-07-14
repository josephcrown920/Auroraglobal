import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getLLM() {
  if (process.env.GEMINI_API_KEY) {
    return createOpenAICompatible({
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: { Authorization: `Bearer ${process.env.GEMINI_API_KEY}` },
    })("gemini-2.0-flash");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return createOpenAICompatible({
      name: "anthropic",
      baseURL: "https://api.anthropic.com/v1",
      headers: { Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}` },
    })("claude-haiku-4-5");
  }
  if (process.env.OPENROUTER_API_KEY) {
    return createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    })("google/gemini-2.0-flash");
  }
  throw new Error("No LLM provider configured");
}

const ARC_POSITIONS = [
  "pain-point (open with the core frustration your audience feels — vivid and specific)",
  "discovery (the moment of finding this solution — surprise, relief, curiosity)",
  "transformation (concrete before/after — what changed, how quickly, be specific)",
  "social-proof (peer validation — a friend told me, I saw it everywhere, had to try it)",
  "fomo (scarcity or trend angle — everyone's switching, almost sold out, limited run)",
  "cta (direct conversion close — confident, clear, low-barrier)",
];

const LENGTH_GUIDE: Record<string, string> = {
  "15s": "25–35 words (fast hook + one punch + CTA)",
  "30s": "60–80 words (hook + expand + social proof + CTA)",
  "45s": "95–120 words (full story arc with a clear turning point)",
};

const UgcBriefSchema = z.object({
  hook: z.string(),
  angle: z.string(),
  arc_position: z.string(),
  script: z.string(),
  scene_direction: z.string(),
  on_screen_text: z.string(),
  cta: z.string(),
  caption: z.string(),
});

export type UgcBrief = z.infer<typeof UgcBriefSchema>;

export const generateUgcScriptArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        product: z.string().min(1).max(600),
        audience: z.string().min(1).max(300),
        niche: z.string().min(1).max(80),
        angles: z.array(z.string()).min(1).max(10),
        length: z.enum(["15s", "30s", "45s"]).default("30s"),
        count: z.number().int().min(1).max(15).default(6),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ briefs: UgcBrief[] }> => {
    const { product, audience, niche, angles, length, count } = data;
    const wordGuide = LENGTH_GUIDE[length] ?? LENGTH_GUIDE["30s"];

    const arcSlots = Array.from({ length: count }, (_, i) => ARC_POSITIONS[i % ARC_POSITIONS.length]);

    const prompt = `You write short-form UGC video ad briefs for AI avatar pipelines (HeyGen / similar).

Product: ${product}
Audience: ${audience}
Niche: ${niche}
Script word target: ${wordGuide}
Hook angle pool (rotate through): ${angles.join(", ")}

Generate exactly ${count} briefs. Each brief MUST occupy its assigned arc position — this creates a coordinated content line where every piece of content plays a different role in the buyer journey.

Arc position assignments (in order):
${arcSlots.map((pos, i) => `  Brief ${i + 1}: ${pos}`).join("\n")}

Rules:
- Each "hook" field must be a distinct opening line (≤ 12 words) that matches its arc position — no two hooks can sound alike
- Scripts sound like real people talking to camera — casual, specific, not ad copy
- scene_direction: one sentence on setting + framing + delivery energy
- on_screen_text: 2–5 word overlay (bold, punchy)
- cta: the spoken closing line (one sentence)
- caption: ≤ 18 words for the social post

Respond ONLY with a raw JSON array — no markdown fences, no preamble. Each element:
{ "hook": string, "angle": string, "arc_position": string, "script": string, "scene_direction": string, "on_screen_text": string, "cta": string, "caption": string }`;

    const model = getLLM();
    const { text } = await generateText({ model, messages: [{ role: "user", content: prompt }] });

    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    const raw: unknown[] = JSON.parse(cleaned);
    const briefs = raw.map((item) => UgcBriefSchema.parse(item));
    return { briefs };
  });

export const generateSceneVariationPrompts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        direction: z.string().min(1).max(400),
        count: z.number().int().min(1).max(30).default(6),
        inputType: z.enum(["person", "product"]),
        productName: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{ prompts: string[] }> => {
      const { direction, count, inputType, productName } = data;
      const model = getLLM();

      const isProduct = inputType === "product";
      const subject = isProduct
        ? `the product shown in the reference photo${productName ? ` (${productName})` : ""}`
        : "the person shown in the reference photo";
      const consistencyRule = isProduct
        ? "Keep the product visually identical in every shot — same shape, label, colours."
        : "Keep the person's face, body type, and identity completely consistent across all images.";

      const settingPool = [
        "cozy café window seat, morning light",
        "city sidewalk at golden hour",
        "minimalist bedroom, soft natural light",
        "rooftop terrace, blue-hour skyline",
        "clean white studio, soft-box lighting",
        "car interior, daytime natural light",
        "park bench, dappled afternoon shade",
        "kitchen counter, candid mid-action",
        "gym entrance, post-workout energy",
        "airport lounge, travel-day vibe",
        "outdoor market, warm afternoon sun",
        "modern office desk, side-lit window",
      ];

      const prompt = `Generate exactly ${count} distinct image-generation prompts for a UGC content batch.

Subject: ${subject}
Style / direction: ${direction}
Consistency rule: ${consistencyRule}

Use this setting pool for variety (cycle through): ${settingPool.slice(0, count + 2).join(" | ")}

Framing variety: alternate between close-up portrait, waist-up, and full-body shots.
Quality directive: photorealistic, natural phone-camera quality, candid feel.

Output ONLY a raw JSON array of ${count} strings — each string is one complete image generation prompt. No markdown, no preamble.`;

      const { text } = await generateText({ model, messages: [{ role: "user", content: prompt }] });

      const cleaned = text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      const prompts: string[] = JSON.parse(cleaned);
      return { prompts: prompts.slice(0, count) };
    },
  );

export const generateSceneImagesFromRef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        referenceBase64: z.string().min(1),
        referenceMimeType: z.string().min(1),
        prompts: z.array(z.string().min(1)).min(1).max(30),
        aspectRatio: z.string().default("4:5"),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{ results: { prompt: string; imageBase64: string | null; error: string | null }[] }> => {
      const { referenceBase64, referenceMimeType, prompts, aspectRatio } = data;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

      const CONCURRENCY = 4;
      const results: { prompt: string; imageBase64: string | null; error: string | null }[] = new Array(prompts.length);
      let cursor = 0;

      async function worker() {
        while (cursor < prompts.length) {
          const i = cursor++;
          const prompt = prompts[i];
          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    {
                      role: "user",
                      parts: [
                        { inline_data: { mime_type: referenceMimeType, data: referenceBase64 } },
                        {
                          text: `${prompt} Aspect ratio: ${aspectRatio}. Photorealistic, natural phone-camera quality.`,
                        },
                      ],
                    },
                  ],
                  generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
                }),
              },
            );

            const json = (await resp.json()) as {
              candidates?: { content: { parts: { inline_data?: { data: string } }[] } }[];
              error?: { message: string };
            };
            if (!resp.ok || json.error) throw new Error(json.error?.message ?? `Gemini error ${resp.status}`);

            const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inline_data);
            if (!part?.inline_data?.data) throw new Error("No image in response");

            results[i] = { prompt, imageBase64: part.inline_data.data, error: null };
          } catch (err) {
            results[i] = {
              prompt,
              imageBase64: null,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return { results };
    },
  );
