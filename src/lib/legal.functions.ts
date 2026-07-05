import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email().max(255),
        name: z.string().min(1).max(120).optional().nullable(),
        topic: z.enum(["general", "billing", "abuse", "privacy", "bug"]).default("general"),
        message: z.string().min(10).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      email: data.email,
      name: data.name ?? null,
      topic: data.topic,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordLegalAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        document: z.enum(["terms", "privacy", "cookies", "refunds", "acceptable-use"]),
        version: z.string().min(1).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("legal_acceptances")
      .upsert(
        { user_id: userId, document: data.document, version: data.version },
        { onConflict: "user_id,document,version" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
