// Claude-powered prompt expansion for Seedance video generation.
//
// Takes a product/subject description and returns an array of Seedance-ready
// video prompts, each with a distinct viral angle:
//   hook → testimonial → lifestyle → dramatic → POV
//
// Uses the Anthropic Messages API directly (not the OpenAI-compat layer) so
// we can leverage the native `x-api-key` auth header pattern.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLAUDE_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a viral video prompt engineer. Your job is to write cinematic, TikTok-ready Seedance video prompts.

Rules:
- Each prompt must be 1-2 sentences, vivid and specific.
- Each prompt must start with describing the SUBJECT's action/motion.
- Include camera movement (push-in / orbit / zoom / handheld shake).
- Include mood/lighting (golden hour / neon-lit / dramatic dark / clean studio).
- No text overlays. No brand logos.
- Keep each prompt under 80 words.
- Output ONLY a JSON array of strings — no explanation, no markdown fences.`;

const ANGLE_INSTRUCTIONS = [
  "Hook shot: first 3 seconds that stop the scroll — subject does something unexpected or impressive, tight close-up, fast zoom-in",
  "Testimonial: creator holds the product to camera with authentic excitement, eye-contact, handheld slight shake, bright window light",
  "Lifestyle: product/subject naturally integrated into a cinematic scene — cafe, rooftop, gym — slow push-in, golden hour",
  "Dramatic hero: subject/product in dramatic low-angle with studio or neon backlighting, slow orbit, cinematic dark mood",
  "POV unboxing / action: first-person perspective of using or unboxing the product, hands in frame, warm overhead light",
  "Street energy: walking shot with product, busy urban backdrop, handheld kinetic camera, natural ambient light",
];

async function callClaude(productDescription: string, count: number): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Anthropic API key not configured. Add ANTHROPIC_API_KEY to your secrets.");

  const angles = ANGLE_INSTRUCTIONS.slice(0, count);
  const userMsg = [
    `Product/Subject: "${productDescription}"`,
    "",
    `Generate exactly ${count} distinct Seedance video prompts, one for each angle below:`,
    ...angles.map((a, i) => `${i + 1}. ${a}`),
    "",
    `Output a JSON array with exactly ${count} strings.`,
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const json = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = json.content?.find((c) => c.type === "text")?.text ?? "";
  if (!text) throw new Error("Claude returned an empty response");

  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Claude didn't return a JSON array — try again.");

  let prompts: string[];
  try {
    prompts = JSON.parse(cleaned.slice(start, end + 1)) as string[];
  } catch {
    throw new Error("Failed to parse Claude's response as JSON. Try again.");
  }

  if (!Array.isArray(prompts) || prompts.length === 0) {
    throw new Error("Claude returned an empty list of prompts.");
  }

  return prompts.slice(0, count);
}

export const generateProductVideoHooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productDescription: z.string().min(3).max(500),
        count: z.number().int().min(1).max(6).default(5),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ prompts: string[] }> => {
    const prompts = await callClaude(data.productDescription, data.count);
    return { prompts };
  });
