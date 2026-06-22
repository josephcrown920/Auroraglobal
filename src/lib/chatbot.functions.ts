import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const SYSTEM = `You are AURORA CONCIERGE — the friendly in-app assistant for Aurora Studio,
a premium AI creative platform (cinematic photos, video, lip-sync, UGC ads, virtual try-on,
visual campaigns). Speak warmly, briefly, and concretely. Address the user by their first
name when one is provided. If they ask "what can you do?", suggest Studio (image),
Canvas (node workflows), Lipsync, UGC, Colors, Gallery, Gifts. New users get 5 free credits.
1 credit ≈ 1 image; videos cost 5 (5s) or 10 (10s); lip-sync is 1 credit/second.
Commercial license is included on all paid plans. Never invent features that don't exist.
Keep replies under 120 words unless the user asks for more detail.`;

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const auroraChat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      firstName: z.string().trim().max(60).optional(),
      messages: z.array(Msg).min(1).max(40),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Aurora concierge is offline (no API key)");

    const gateway = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const nameLine = data.firstName ? `\n\nThe user's first name is ${data.firstName}. Address them naturally.` : "";

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system: SYSTEM + nameLine,
        messages: data.messages,
      });
      return { reply: text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Concierge failed";
      if (msg.includes("429")) throw new Error("Concierge is rate-limited. Try again in a moment.");
      if (msg.includes("402")) throw new Error("Out of AI credits.");
      throw new Error(msg);
    }
  });
