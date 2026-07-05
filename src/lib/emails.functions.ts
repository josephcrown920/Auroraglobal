import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendLifecycleEmail, type LifecycleTemplate } from "./emails.server";

const TEMPLATES: LifecycleTemplate[] = [
  "signup_welcome",
  "onboarding_done",
  "password_reset_acknowledged",
];

export const triggerLifecycleEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      template: z.enum(TEMPLATES as [LifecycleTemplate, ...LifecycleTemplate[]]),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const email = profile?.email;
    if (!email) return { skipped: true, reason: "no_email" };
    const name = (profile?.display_name as string | undefined)?.split(" ")[0];
    return sendLifecycleEmail({
      userId,
      to: email,
      template: data.template,
      vars: name ? { name } : {},
    });
  });
