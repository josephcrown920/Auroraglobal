import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  email: z.string().email().max(255),
  source: z.string().max(64).default("landing"),
  refCode: z.string().max(64).optional().nullable(),
  userAgent: z.string().max(512).optional().nullable(),
});

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("leads").insert({
      email: data.email.toLowerCase().trim(),
      source: data.source,
      ref_code: data.refCode ?? null,
      user_agent: data.userAgent ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
