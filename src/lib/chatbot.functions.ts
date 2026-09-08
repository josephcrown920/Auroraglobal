import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { routedGenerate } from "@/lib/ai-router";

const SYSTEM = `You are AURORA CONCIERGE — the friendly in-app assistant for Aurora Studio,
a premium AI creative platform (cinematic photos, video, lip-sync, UGC ads, virtual try-on,
visual campaigns). Speak warmly, briefly, and concretely. Address the user by their first
name when one is provided. If they ask "what can you do?", suggest Studio (image),
Canvas (node workflows), Lipsync, UGC, Colors, Gallery, Gifts. New users get 50 free Aura.
10 Aura ≈ 1 image; budget videos cost 100 (5s) or 200 (10s), premium models more; lip-sync starts at 30 Aura per 5s clip.
Commercial license is included on all paid plans. Never invent features that don't exist.
Keep replies under 120 words unless the user asks for more detail.
Active limited offer: first Aura pack purchase gives 25% extra Aura free — 24-hour countdown, code applied automatically at checkout. Mention this naturally when the user asks about pricing or credits.`;

const Msg = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const auroraChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      firstName: z.string().trim().max(60).optional(),
      messages: z.array(Msg).min(1).max(40),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const nameLine = data.firstName ? `\n\nThe user's first name is ${data.firstName}. Address them naturally.` : "";
    const history = data.messages.slice(0, -1);
    const prompt = data.messages.at(-1)?.content ?? "";

    try {
      const { output, provider, model } = await routedGenerate({
        system: SYSTEM + nameLine,
        prompt,
        conversationHistory: history,
        schema: z.object({ reply: z.string().min(1).max(4000) }),
        category: "CUSTOMER_SUPPORT",
      });
      return { reply: output.reply, provider, model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Concierge failed";
      if (msg.includes("429")) throw new Error("Concierge is rate-limited. Try again in a moment.");
      if (msg.includes("402")) throw new Error("Out of AI credits.");
      throw new Error(msg);
    }
  });
