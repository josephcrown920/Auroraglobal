/**
 * get-test-session
 *
 * Returns a valid Supabase access_token + userId for the QA test user
 * (qa-test@aurora-internal.test) without handling any password.
 *
 * Mechanism:
 *   1. supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email })
 *      returns a hashed_token in the response (no URL navigation needed).
 *   2. We exchange it via an anon-key client calling verifyOtp({ token_hash,
 *      type: "magiclink" }) which returns a real session.
 *   3. We hand back only the access_token — a standard Supabase JWT accepted
 *      by requireSupabaseAuth, identical to what a real browser session sends.
 *
 * No password is stored in code. No production credentials are exposed.
 * The token expires after Supabase's configured JWT lifetime (default 1 h).
 *
 * Usage (from another smoke script):
 *   import { getTestSession } from "./lib/get-test-session";
 *   const { accessToken, userId } = await getTestSession();
 *   // Pass as:  Authorization: Bearer <accessToken>
 */

import { createClient, type Session } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";

export const TEST_EMAIL = "qa-test@aurora-internal.test";

export interface TestSession {
  /** Bearer token for Authorization headers (requireSupabaseAuth). */
  accessToken: string;
  /** QA test user's Supabase auth id. */
  userId: string;
  /**
   * The COMPLETE Supabase session (access_token, refresh_token, expires_at,
   * user, …). Browser verification runs need this whole object — Supabase JS
   * `setSession()` / the localStorage entry require refresh_token and user
   * fields, not just the access_token.
   */
  session: Session;
}

export async function getTestSession(): Promise<TestSession> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set");
  }

  // 1. Resolve the QA user's ID.
  const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  const qaUser = userList.users.find((u) => u.email === TEST_EMAIL);
  if (!qaUser) {
    throw new Error(
      `QA test user <${TEST_EMAIL}> not found in Supabase Auth.\n` +
        "Create it once via Supabase Dashboard → Authentication → Add User " +
        "(no password required — magic-link only).",
    );
  }

  // 2. Generate a magic-link. The response embeds a hashed_token we can
  //    exchange server-side without following the URL or reading any email.
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(
      `generateLink failed: ${linkErr?.message ?? "no hashed_token in response"}`,
    );
  }
  const hashedToken = linkData.properties.hashed_token;

  // 3. Exchange the hashed_token for a real session via the anon-key client.
  //    This is the same exchange a real browser does when the user clicks the
  //    link — except we skip the network round-trip and do it directly.
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionData, error: sessionErr } = await anonClient.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (sessionErr || !sessionData?.session?.access_token) {
    throw new Error(
      `verifyOtp failed: ${sessionErr?.message ?? "no session in response"}`,
    );
  }

  return {
    accessToken: sessionData.session.access_token,
    userId: qaUser.id,
    session: sessionData.session,
  };
}

/**
 * Reads the QA user's current credit balance (null if no profile row).
 * Use with `setCredits` to save/restore the exact balance around a smoke run.
 */
export async function getCredits(userId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`read credits: ${error.message}`);
  return (data as { credits?: number } | null)?.credits ?? null;
}

/** Sets the QA user's credit balance to an exact value. */
export async function setCredits(userId: string, credits: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, credits }, { onConflict: "user_id" });
  if (error) throw new Error(`set credits: ${error.message}`);
}
