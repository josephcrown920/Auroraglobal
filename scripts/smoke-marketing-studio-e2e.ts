/**
 * Aurora Marketing Studio smoke — REAL wire-format, REAL middleware.
 *
 * Calls the running dev server's `generateMarketingCampaign` server-function
 * endpoint exactly as the browser does, covering:
 *
 *   1. SESSION        — passwordless QA (admin) session.
 *   2. AUTH-NEGATIVE  — no bearer token → requireSupabaseAuth rejects.
 *   3. NON-ADMIN      — a throwaway signed-in user WITHOUT the admin role is
 *                       rejected by the server-side isAdmin check (the route
 *                       gate in the client is not the only protection).
 *   4. ADMIN          — the QA admin gets a campaign plan; every item is checked
 *                       against the brief (count, allowed formats, day range)
 *                       and the copy is checked for claims outside the approved
 *                       catalog facts (competitor/third-party names, invented
 *                       metrics, "free"/"unlimited" style promises).
 *
 * Cleanup: the throwaway non-admin user is always deleted.
 *
 * Run:  bun run scripts/smoke-marketing-studio-e2e.ts
 */

import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { getTestSession } from "./lib/get-test-session";
import { auditMarketingCampaignClaims } from "../src/lib/social-studio.claims";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8080";
const SERVER_FN_BASE = `${BASE}/_serverFn/`;

function fail(msg: string): never {
  throw new Error(msg);
}

async function discoverFnId(modulePath: string, exportName: string): Promise<string> {
  const res = await fetch(`${BASE}/${modulePath}`);
  if (!res.ok) fail(`dev server module fetch failed: ${res.status} — is the app running?`);
  const src = await res.text();
  for (const m of src.matchAll(/createClientRpc\("([^"]+)"\)/g)) {
    const decoded = JSON.parse(Buffer.from(m[1]!, "base64").toString("utf8")) as { export: string };
    if (decoded.export.replace(/_createServerFn_handler$/, "") === exportName) return m[1]!;
  }
  fail(`could not discover RPC id for ${exportName}`);
}

async function callServerFn(
  fnId: string,
  opts: { data?: unknown; accessToken?: string },
): Promise<unknown> {
  const seroval = await import("seroval");
  const { defaultSerovalPlugins } = await import("@tanstack/router-core");
  const headers: Record<string, string> = {
    "x-tsr-serverFn": "true",
    accept: "application/json",
    "content-type": "application/json",
  };
  if (opts.accessToken) headers["Authorization"] = `Bearer ${opts.accessToken}`;
  const body = JSON.stringify(
    await seroval.toJSONAsync({ data: opts.data }, { plugins: defaultSerovalPlugins }),
  );
  const res = await fetch(SERVER_FN_BASE + fnId, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(150_000),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    fail(`unexpected server-fn response: ${res.status} ${contentType}`);
  }
  const payload = (await res.json()) as Parameters<typeof seroval.fromCrossJSON>[0];
  const decoded = seroval.fromCrossJSON(payload, {
    refs: new Map(),
    plugins: defaultSerovalPlugins,
  }) as { result?: unknown; error?: unknown };
  if (decoded.error !== undefined && decoded.error !== null) {
    const err = decoded.error;
    throw err instanceof Error
      ? err
      : new Error(typeof err === "object" ? JSON.stringify(err) : String(err));
  }
  return decoded.result;
}

async function expectRejected(label: string, run: () => Promise<unknown>, pattern: RegExp) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) fail(`${label}: rejected with unexpected message: ${message}`);
    console.log(`  ✓ ${label} rejected: ${message}`);
    return;
  }
  fail(`${label}: expected rejection but call succeeded`);
}

/** Throwaway non-admin user + real session (magic-link exchange, no password). */
async function createNonAdminSession(): Promise<{ userId: string; accessToken: string }> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  const email = `marketing-smoke-${Date.now()}@aurora-internal.test`;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createErr || !created.user) fail(`createUser: ${createErr?.message}`);
  try {
  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link.properties?.hashed_token) fail(`generateLink: ${linkErr?.message}`);
  const anon = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sess, error: sessErr } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (sessErr || !sess.session) fail(`verifyOtp: ${sessErr?.message}`);
  return { userId: created.user.id, accessToken: sess.session.access_token };
  } catch (error) {
    const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    if (cleanupError) console.warn("  ! temporary-user cleanup failed after session setup failure");
    throw error;
  }
}

async function main() {
  console.log("── Marketing Studio smoke (real HTTP wire format) ──");
  const fnId = await discoverFnId("src/lib/social-studio.functions.ts", "generateMarketingCampaign");
  const brief = {
    featureId: "video-agent",
    goal: "feature_education",
    tone: "artist_first",
    channels: ["instagram_feed", "instagram_reel"],
    days: 3,
    postCount: 3,
    notes: "Smoke run — keep it short.",
  };

  console.log("1. SESSION");
  const { accessToken, userId } = await getTestSession();
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) fail("QA user is not an admin — cannot exercise the operator path");
  console.log("  ✓ QA admin session ready");

  console.log("2. AUTH-NEGATIVE");
  await expectRejected("no bearer", () => callServerFn(fnId, { data: brief }), /unauthori[sz]ed/i);

  console.log("3. NON-ADMIN");
  const temp = await createNonAdminSession();
  try {
    await expectRejected(
      "non-admin",
      () => callServerFn(fnId, { data: brief, accessToken: temp.accessToken }),
      /forbidden|operators only/i,
    );
  } finally {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(temp.userId);
    if (error) console.warn(`  ! temp user cleanup failed: ${error.message}`);
  }

  console.log("4. ADMIN");
  const result = (await callServerFn(fnId, { data: brief, accessToken })) as {
    campaign: {
      name: string;
      strategy: string;
      items: Array<{ day: number; format: string; title: string; caption: string; hashtags: string[]; cta: string; visualPrompt: string; reelPrompt?: string; slides: unknown[] }>;
    };
    provider: string;
    feature: { id: string; name: string };
  };
  const items = result.campaign.items;
  console.log(`  ✓ provider=${result.provider} items=${items.length} name="${result.campaign.name}"`);
  if (items.length !== brief.postCount) fail(`expected ${brief.postCount} items, got ${items.length}`);
  const allowed = new Set(["feed", "reel"]);
  for (const item of items) {
    if (!allowed.has(item.format)) fail(`item "${item.title}" uses disallowed format ${item.format}`);
    if (item.day < 1 || item.day > brief.days) fail(`item "${item.title}" scheduled on day ${item.day}`);
  }
  const audit = auditMarketingCampaignClaims(result.campaign);
  if (audit.length) {
    for (const issue of audit) console.error(`  ✗ ${issue}`);
    fail("campaign copy contains claims outside the approved catalog");
  }
  console.log("  ✓ all items respect the brief and pass the claim audit");
  for (const item of items) console.log(`    day ${item.day} · ${item.format} · ${item.title}`);
  console.log("── PASS ──");
}

main().catch((error) => {
  console.error("── FAIL ──", error instanceof Error ? error.message : error);
  process.exit(1);
});
