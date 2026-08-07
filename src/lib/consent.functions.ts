import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { ConsentStatus } from "./consent";

type ProfilesUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/**
 * Returns the server-stored consent choice for the signed-in user, or null
 * if none has been saved yet (first-ever visit / pre-migration profiles).
 */
export const getServerConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsentStatus | null> => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("cookie_consent")
      .eq("user_id", context.userId)
      .maybeSingle();
    const val = (data as { cookie_consent: string | null } | null)?.cookie_consent;
    if (val === "accepted" || val === "declined") return val;
    return null;
  });

/**
 * Persists the consent choice server-side so it survives across devices.
 * Only the authenticated user's own profile row is updated.
 */
export const saveServerConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["accepted", "declined"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    // cookie_consent is not yet in the generated Supabase types (column added
    // by migration 20260807160000_profile_cookie_consent.sql). We extend the
    // known Update type locally and cast through it so no `any` is needed.
    type ProfilesUpdateWithConsent = ProfilesUpdate & {
      cookie_consent?: "accepted" | "declined" | null;
    };
    const payload: ProfilesUpdateWithConsent = { cookie_consent: data.status };
    await supabaseAdmin
      .from("profiles")
      .update(payload as unknown as ProfilesUpdate)
      .eq("user_id", context.userId);
    return { ok: true };
  });
