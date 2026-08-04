/**
 * Live-DB round-trip for video_agent_projects — proves the live table matches
 * the code contract (columns the runner + server fns read/write) without
 * spending any provider credit. Cleans up after itself.
 *
 * Run: bun run scripts/va-live-roundtrip.ts
 */
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

const db = supabaseAdmin as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      eq: (col: string, v: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    insert: (row: Record<string, unknown>) => {
      select: (c: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, v: string) => {
        eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    delete: () => {
      eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const { data: profiles, error: pErr } = await db.from("profiles").select("user_id").limit(1);
if (pErr || !profiles?.length) fail(`no profile row available: ${pErr?.message}`);
const userId = profiles[0].user_id as string;

const scenes = [
  { id: "sc1", index: 0, title: "Open", script: "Test narration.", description: "A sunrise", duration: 5, frame: null },
];

// 1. INSERT (what createVideoAgentProject writes)
const { data: created, error: iErr } = await db
  .from("video_agent_projects")
  .insert({
    user_id: userId,
    title: "LIVE-ROUNDTRIP-TEST",
    prompt: "live schema round-trip — safe to delete",
    style: "cinematic",
    voice: "narrator-warm",
    target_duration: 30,
    scenes,
    status: "draft",
    status_message: "Draft",
  })
  .select("id, user_id, title, scenes, status, status_message, created_at, updated_at")
  .single();
if (iErr || !created) fail(`insert: ${iErr?.message}`);
const id = created.id as string;
console.log(`insert ok — id=${id}`);
if (!Array.isArray(created.scenes)) fail("scenes did not round-trip as jsonb array");

// 2. UPDATE through every status the runner writes (processing → succeeded → failed)
for (const patch of [
  { status: "queued", status_message: "Waiting for a render slot…" },
  { status: "processing", status_message: "Rendered scene 1 of 1…", thumbnail_url: "https://example.com/t.png" },
  { status: "succeeded", status_message: "Final MP4 ready", export_url: "https://example.com/v.mp4", error: null },
  { status: "failed", status_message: "Render could not be completed — your Aura was released", error: "test error" },
]) {
  const { error } = await db.from("video_agent_projects").update(patch).eq("id", id).eq("user_id", userId);
  if (error) fail(`update ${patch.status}: ${error.message}`);
}
console.log("all runner status transitions ok");

// 3. READ back (what getVideoAgentProject maps)
const { data: read, error: rErr } = await db
  .from("video_agent_projects")
  .select("id, title, prompt, style, voice, target_duration, scenes, status, status_message, error, export_url, thumbnail_url, updated_at")
  .eq("id", id)
  .maybeSingle();
if (rErr || !read) fail(`read: ${rErr?.message}`);
if (read.status !== "failed") fail(`status did not persist (got ${read.status})`);
if (read.export_url !== "https://example.com/v.mp4") fail("export_url did not persist");
console.log("read-back ok — all mapped columns present");

// 4. Cleanup
const { error: dErr } = await db.from("video_agent_projects").delete().eq("id", id);
if (dErr) fail(`cleanup: ${dErr.message}`);
console.log("cleanup ok");
console.log("PASS: live video_agent_projects contract verified");
