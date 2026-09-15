import { createHmac } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://aurora-prime.replit.app",
  "https://auroraperformancestudio.com",
]);

function allowedOrigins(): Set<string> {
  const configured = process.env.AURORA_EMBED_ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

/** Mint a short-lived token for the embedded Aurora Layers editor. */
export const getAuroraLayersEmbedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const secret = process.env.AURORA_EMBED_SSO_SECRET;
    if (!secret) {
      return { token: null, configured: false };
    }

    let origin: string;
    try {
      origin = new URL(data.origin).origin;
    } catch {
      throw new Error("Invalid Aurora Layers host origin");
    }

    if (!allowedOrigins().has(origin)) {
      throw new Error("Aurora Layers is not enabled for this host origin");
    }

    const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (error || !authUser.user) {
      throw new Error("User account not found");
    }

    const payload = {
      sub: authUser.user.id,
      email: authUser.user.email ?? "",
      aud: origin,
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    return {
      token: `${body}.${signature}`,
      configured: true,
    };
  });
