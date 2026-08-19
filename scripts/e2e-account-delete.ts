// E2E test for POST /api/public/account-delete (hardened, exhaustive version)
// and the auth-gated /api/audio/upload route.
//
// Run: cd /home/runner/workspace && bun run scripts/e2e-account-delete.ts
// Requires: the dev server on http://127.0.0.1:8080 and SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY / INTER_APP_API_KEY in the env (falls back
// to .env). Creates two throwaway QA users against the LIVE dev database and
// cleans them up at the end.
//
// Proves: storage purge (all namespaces, nested, incl. an upload made through
// the real /api/audio/upload route), row deletion across EVERY user-owned
// table (incl. jobs, tiktok_remixes, child chains, render_jobs via boards),
// retention of payments + legal_acceptances, auth user removal, auth gating
// (401/400 on both routes), uid-scoped upload paths + signed URLs, and that a
// SECOND user's rows survive untouched. Also smokes the cron-driven
// /api/public/deletion-sweep durable-retry endpoint (auth + drain).
//
// Last verified green: 2026-08-16 against this workspace's live dev DB.
import { createClient } from "@supabase/supabase-js";

// ---- env ----
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
  try {
    const txt = await Bun.file("/home/runner/workspace/.env").text();
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*("?)(.*)\2\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[3];
    }
  } catch {}
}
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const INTERNAL = process.env.INTER_APP_API_KEY;
if (!URL || !SERVICE || !ANON || !INTERNAL) {
  console.error(
    "FATAL: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY / INTER_APP_API_KEY",
  );
  process.exit(1);
}
const API = "http://127.0.0.1:8080/api/public/account-delete";
const AUDIO_API = "http://127.0.0.1:8080/api/audio/upload";
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

let failures = 0;
const ok = (cond: boolean, label: string, extra?: unknown) => {
  if (cond) console.log(`  PASS  ${label}`);
  else {
    failures++;
    console.error(`  FAIL  ${label}`, extra ?? "");
  }
};

// Must mirror USER_TABLES_IN_DELETE_ORDER in account-delete.ts
const USER_TABLES = [
  "cm_batch_items","cm_batches","spin_variants","comfy_runs","kids_stories",
  "video_agent_messages","video_agent_submissions","video_agent_projects",
  "board_items","chat_threads","promo_code_redemptions","tiktok_remixes",
  "tiktok_posts","tiktok_accounts","generations","agent_chat_messages",
  "agent_sessions","cm_products","cm_templates","spin_jobs","boards","jobs",
  "worker_jobs","lipsync_jobs","ad_variations","affiliate_events","affiliates",
  "agent_user_memory","api_keys","aurora_templates","user_avatar_shots",
  "avatars","character_profiles","cli_device_codes","consent_logs",
  "contact_messages","edit_sessions","email_log","events","growth_tool_runs",
  "likeness_locks","provider_logs","storyboards","subscriptions",
  "user_passkeys","user_photo_avatars","user_roles","user_webhooks",
  "wardrobe_items","webauthn_challenges","workflows","credit_ledger","profiles",
];

const ts = Date.now();
const email = `qa-delete-${ts}@aurora-qa.test`;
const email2 = `qa-delete-${ts}-control@aurora-qa.test`;
const password = `Qa!${ts}xyz`;

async function countBy(table: string, col: string, val: string): Promise<number> {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true }).eq(col, val);
  if (error) {
    failures++;
    console.error(`  FAIL  count ${table}.${col}:`, error.message);
    return -1;
  }
  return count ?? 0;
}

async function seed(table: string, row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await sb.from(table).insert(row).select("id").maybeSingle();
  if (error) {
    failures++;
    console.error(`  FAIL  seed ${table}:`, error.message);
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

// ---- 1. create users ----
console.log("1. create QA users");
const { data: u1, error: e1 } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
const { data: u2, error: e2 } = await sb.auth.admin.createUser({ email: email2, password, email_confirm: true });
if (e1 || !u1.user || e2 || !u2.user) {
  console.error("FATAL: createUser failed", e1?.message, e2?.message);
  process.exit(1);
}
const uid = u1.user.id;
const uid2 = u2.user.id;
console.log("  user:", uid, "control:", uid2);

// profile trigger
for (let i = 0; i < 20; i++) {
  if ((await countBy("profiles", "user_id", uid)) > 0) break;
  await new Promise((r) => setTimeout(r, 500));
}
ok((await countBy("profiles", "user_id", uid)) === 1, "profile row created by trigger");

// ---- 2. seed storage ----
console.log("2. seed storage (all namespaces + nested)");
const bucket = sb.storage.from("studio");
const storagePaths = [
  `${uid}/uploads/a.txt`,
  `${uid}/spin/job1/frame.txt`,
  `${uid}/video-agent/p1/clip.txt`,
  `${uid}/nested/deep/x.txt`,
  `${uid}/avatars/photo.txt`,
  `tts/${uid}/v.txt`,
  `ffmpeg-free/${uid}/f.txt`,
];
for (const p of storagePaths) {
  const { error } = await bucket.upload(p, new Blob([`qa ${p}`], { type: "text/plain" }));
  ok(!error, `upload ${p}`, error?.message);
}

// ---- 3. seed rows ----
console.log("3. seed rows (reviewer tables + child chains + control user)");
await seed("jobs", { user_id: uid, kind: "image" });
await seed("tiktok_remixes", { user_id: uid, source_video_url: "https://example.com/v.mp4" });
await seed("generations", { user_id: uid, prompt: "qa seed" });
await seed("credit_ledger", { user_id: uid, delta: 1, reason: "qa-seed" });
const boardId = await seed("boards", { user_id: uid });
if (boardId) {
  await seed("board_items", { user_id: uid, board_id: boardId });
  await seed("render_jobs", { board_id: boardId, shot_id: "s1", model: "qa-model", prompt: "qa" });
}
const spinId = await seed("spin_jobs", { user_id: uid, prompt: "qa" });
if (spinId) await seed("spin_variants", { user_id: uid, job_id: spinId, idx: 0, label: "A" });
await seed("video_agent_projects", { user_id: uid, prompt: "qa" });
await seed("avatars", { user_id: uid, name: "QA", handle: `qa-${ts}` });
await seed("user_photo_avatars", { user_id: uid, name: "QA", storage_path: `${uid}/avatars/photo.txt` });
await seed("consent_logs", { user_id: uid, tool: "qa", policy_version: "v1" });
// retained tables
await seed("payments", { user_id: uid, reference: `qa-${ts}`, amount_kobo: 100 });
await seed("legal_acceptances", { user_id: uid, document: "privacy", version: "v1" });
// control user rows — must survive
await seed("jobs", { user_id: uid2, kind: "image" });
await seed("generations", { user_id: uid2, prompt: "control" });
await seed("tiktok_remixes", { user_id: uid2, source_video_url: "https://example.com/c.mp4" });

// ---- 4. auth gating ----
console.log("4. auth gating");
{
  const r = await fetch(API, { method: "POST", body: JSON.stringify({ confirm: "DELETE" }) });
  ok(r.status === 401, "no auth -> 401", r.status);
}
{
  const r = await fetch(API, {
    method: "POST",
    headers: { Authorization: "Bearer aurk_zzz" },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  ok(r.status === 401, "aurk_ key -> 401", r.status);
}
const { data: signin, error: signinErr } = await anon.auth.signInWithPassword({ email, password });
if (signinErr || !signin.session) {
  console.error("FATAL: sign-in failed", signinErr?.message);
  process.exit(1);
}
const token = signin.session.access_token;
{
  const r = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirm: "WRONG" }),
  });
  ok(r.status === 400, "wrong confirm -> 400", r.status);
}

// ---- 4b. /api/audio/upload: auth-gated, uid-scoped, signed URL ----
// The upload made here must then die with the account (asserted in step 8's
// storage checks via the <uid>/ namespace walk).
console.log("4b. audio upload route (auth + uid namespace + signed URL)");
{
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(64)], "qa.mp3", { type: "audio/mpeg" }));
  const r = await fetch(AUDIO_API, { method: "POST", body: fd });
  ok(r.status === 401, "audio upload without auth -> 401", r.status);
}
{
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(64)], "qa.mp3", { type: "audio/mpeg" }));
  const r = await fetch(AUDIO_API, {
    method: "POST",
    headers: { Authorization: "Bearer aurk_zzz" },
    body: fd,
  });
  ok(r.status === 401, "audio upload with aurk_ key -> 401", r.status);
}
{
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(64)], "qa.mp3", { type: "audio/mpeg" }));
  const r = await fetch(AUDIO_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const j = (await r.json().catch(() => null)) as { url?: string; path?: string } | null;
  ok(r.status === 200 && !!j?.path, "audio upload with auth -> 200", `${r.status} ${JSON.stringify(j)}`);
  ok(!!j?.path?.startsWith(`${uid}/mastering/`), "upload path is uid-scoped (<uid>/mastering/…)", j?.path);
  ok(!!j?.url && j.url.includes("/object/sign/"), "returned URL is signed (private bucket)", j?.url?.slice(0, 80));
}

// ---- 5. the deletion ----
console.log("5. delete account (may take a while — exhaustive purge)");
const t0 = Date.now();
const res = await fetch(API, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "DELETE" }),
});
const resBody = await res.text();
ok(res.status === 200, `delete -> 200 (${((Date.now() - t0) / 1000).toFixed(1)}s)`, `${res.status} ${resBody}`);

// ---- 6. assertions ----
console.log("6. verify every user-owned table is empty");
for (const t of USER_TABLES) {
  const remaining = ["payments", "legal_acceptances"].includes(t) ? null : await countBy(t, "user_id", uid);
  if (remaining !== null) ok(remaining === 0, `${t} empty`, remaining);
}
ok((await countBy("marketplace_template_runs", "runner_user_id", uid)) === 0, "marketplace_template_runs empty");
ok((await countBy("marketplace_templates", "creator_user_id", uid)) === 0, "marketplace_templates empty");
ok((await countBy("comfy_workflows", "owner_user_id", uid)) === 0, "comfy_workflows empty");
if (boardId) ok((await countBy("render_jobs", "board_id", boardId)) === 0, "render_jobs empty (via board)");

console.log("7. verify retention + control user untouched");
ok((await countBy("payments", "user_id", uid)) === 1, "payments RETAINED");
ok((await countBy("legal_acceptances", "user_id", uid)) === 1, "legal_acceptances RETAINED");
ok((await countBy("jobs", "user_id", uid2)) === 1, "control user jobs intact");
ok((await countBy("generations", "user_id", uid2)) === 1, "control user generations intact");
ok((await countBy("tiktok_remixes", "user_id", uid2)) === 1, "control user tiktok_remixes intact");

console.log("8. verify storage empty (incl. the /api/audio/upload file)");
for (const prefix of [uid, `${uid}/mastering`, `tts/${uid}`, `ffmpeg-free/${uid}`]) {
  const { data: entries, error } = await bucket.list(prefix, { limit: 10 });
  ok(!error && (entries ?? []).length === 0, `storage ${prefix} empty`, error?.message ?? entries?.map((e) => e.name));
}

console.log("9. verify auth user gone");
const { data: gone, error: goneErr } = await sb.auth.admin.getUserById(uid);
ok(!!goneErr || !gone?.user, "auth user deleted", gone?.user?.id);

// ---- 9b. deletion-sweep cron endpoint ----
console.log("9b. deletion-sweep endpoint (durable retry drain)");
{
  const r = await fetch("http://127.0.0.1:8080/api/public/deletion-sweep", { method: "POST" });
  ok(r.status === 401, "deletion-sweep without apikey -> 401", r.status);
}
{
  const r = await fetch("http://127.0.0.1:8080/api/public/deletion-sweep", {
    method: "POST",
    headers: { "x-aurora-internal-key": INTERNAL },
  });
  const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
  ok(
    r.status === 200 && j?.ok === true,
    "deletion-sweep with private internal key -> 200 ok",
    `${r.status} ${JSON.stringify(j)}`,
  );
}

// ---- cleanup ----
console.log("10. cleanup (retained QA rows + control user)");
await sb.from("payments").delete().eq("user_id", uid);
await sb.from("legal_acceptances").delete().eq("user_id", uid);
for (const t of ["jobs", "generations", "tiktok_remixes", "credit_ledger", "profiles"]) {
  await sb.from(t).delete().eq("user_id", uid2);
}
await sb.auth.admin.deleteUser(uid2).catch(() => {});

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
