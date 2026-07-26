import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- webauthn tables not yet in generated types.ts; cast until next type regen
const db = supabaseAdmin as any;

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

function getRP() {
  const siteUrl = (process.env.SITE_URL ?? "https://auroraperformancestudio.com").replace(/\/$/, "");
  const url = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
  return { rpName: "Aurora Studio", rpID: url.hostname, origin: url.origin };
}

function isAllowedOrigin(origin: string): boolean {
  const { origin: prodOrigin, rpID: prodRPID } = getRP();
  if (origin === prodOrigin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return true;
    if (parsed.hostname.endsWith(".replit.dev") || parsed.hostname.endsWith(".repl.co")) return true;
    if (parsed.hostname.endsWith(".replit.app")) return true;
    if (parsed.hostname === prodRPID) return true;
  } catch { /* fall through */ }
  return false;
}

async function storeChallenge(challenge: string, userId?: string): Promise<string> {
  const { data, error } = await db
    .from("webauthn_challenges")
    .insert({
      challenge,
      user_id: userId ?? null,
      expires_at: new Date(Date.now() + FIFTEEN_MIN_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Challenge store failed: ${error.message}`);
  return (data as { id: string }).id;
}

async function consumeChallenge(challengeId: string): Promise<string> {
  const { data, error } = await db
    .from("webauthn_challenges")
    .select("challenge, expires_at, used")
    .eq("id", challengeId)
    .single();
  if (error || !data) throw new Error("Challenge not found");
  const row = data as { challenge: string; expires_at: string; used: boolean };
  if (row.used) throw new Error("Challenge already used");
  if (new Date(row.expires_at) < new Date()) throw new Error("Challenge expired");

  await db.from("webauthn_challenges").update({ used: true }).eq("id", challengeId);
  return row.challenge;
}

// ─── Registration ────────────────────────────────────────────────────────────

export const beginPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { rpName, rpID } = getRP();

    const { data: existingKeys } = await db
      .from("user_passkeys")
      .select("credential_id")
      .eq("user_id", userId);

    const excludeCredentials = ((existingKeys ?? []) as Array<{ credential_id: string }>).map((k) => ({
      id: k.credential_id,
      transports: undefined as never,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: userId,
      userDisplayName: "Aurora Studio",
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials,
    });

    const challengeId = await storeChallenge(options.challenge, userId);
    return { options, challengeId };
  });

const CompleteRegisterSchema = z.object({
  challengeId: z.string().uuid(),
  credential: z.any(),
  origin: z.string().url(),
  deviceName: z.string().optional(),
});

export const completePasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof CompleteRegisterSchema>) => CompleteRegisterSchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    if (!isAllowedOrigin(input.origin)) throw new Error("Origin not allowed");

    const challenge = await consumeChallenge(input.challengeId);
    const rpID = new URL(input.origin).hostname;

    const verification = await verifyRegistrationResponse({
      response: input.credential as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: input.origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Passkey registration verification failed");
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    const { error } = await db.from("user_passkeys").insert({
      user_id: userId,
      credential_id: credentialID,
      public_key: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      transports: (input.credential as RegistrationResponseJSON).response?.transports ?? [],
      device_name: input.deviceName ?? null,
    });

    if (error) {
      if (error.code === "23505") return { ok: true, alreadyRegistered: true };
      throw new Error(`Failed to save passkey: ${error.message}`);
    }

    return { ok: true, alreadyRegistered: false };
  });

// ─── Authentication ──────────────────────────────────────────────────────────

const BeginAuthSchema = z.object({ rpID: z.string() });

export const beginPasskeyAuthentication = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof BeginAuthSchema>) => BeginAuthSchema.parse(d))
  .handler(async ({ data: input }) => {
    const options = await generateAuthenticationOptions({
      rpID: input.rpID,
      userVerification: "preferred",
      timeout: 60000,
    });

    const challengeId = await storeChallenge(options.challenge);
    return { options, challengeId };
  });

const CompleteAuthSchema = z.object({
  challengeId: z.string().uuid(),
  credential: z.any(),
  origin: z.string().url(),
});

export const completePasskeyAuthentication = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof CompleteAuthSchema>) => CompleteAuthSchema.parse(d))
  .handler(async ({ data: input }) => {
    if (!isAllowedOrigin(input.origin)) throw new Error("Origin not allowed");

    const credential = input.credential as AuthenticationResponseJSON;
    const rpID = new URL(input.origin).hostname;

    const { data: passkeyRow, error: findError } = await db
      .from("user_passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", credential.id)
      .single();

    if (findError || !passkeyRow) throw new Error("Passkey not recognised — try signing in with your email first");

    const row = passkeyRow as {
      id: string;
      user_id: string;
      credential_id: string;
      public_key: string;
      counter: number;
      transports: string[];
    };

    const challenge = await consumeChallenge(input.challengeId);
    const publicKeyBuffer = Buffer.from(row.public_key, "base64url");

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: input.origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: row.credential_id,
        credentialPublicKey: publicKeyBuffer,
        counter: row.counter,
        transports: row.transports as never,
      },
    });

    if (!verification.verified) throw new Error("Passkey verification failed");

    await db
      .from("user_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    if (!userRecord.user?.email) throw new Error("User account not found");

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userRecord.user.email,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      throw new Error("Could not create session token");
    }

    return { token_hash: linkData.properties.hashed_token };
  });

// ─── List / delete passkeys ──────────────────────────────────────────────────

export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await db
      .from("user_passkeys")
      .select("id, device_name, created_at, last_used_at, transports")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      device_name: string | null;
      created_at: string;
      last_used_at: string | null;
      transports: string[];
    }>;
  });

const DeletePasskeySchema = z.object({ id: z.string().uuid() });

export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof DeletePasskeySchema>) => DeletePasskeySchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    const { error } = await db
      .from("user_passkeys")
      .delete()
      .eq("id", input.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
