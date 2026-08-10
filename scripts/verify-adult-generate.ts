// One-off verification: signed-in creator flow for /api/adult-admin/generate.
// 1. QA session (passwordless) → POST generate with the creator's Supabase JWT
//    + historyModelId/historyLookId.
// 2. Assert one authoritative generations row exists tagged
//    adult-school/<model>/<look> (no client insert anywhere).
// 3. Reload the gallery exactly as ModelStudio.loadHistory does (anon client
//    with the creator session) and assert the look label round-trips.
// Cleanup: generation row + persisted object removed, balance restored,
// run-created profile deleted if none existed.
import { getTestSession, getCredits, setCredits } from "./lib/get-test-session";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";

// Throw (never process.exit) so the finally-block cleanup always runs.
function fail(msg: string): never {
  throw new Error(`FAIL: ${msg}`);
}

async function main() {
  const { userId, accessToken } = await getTestSession();
  const original = await getCredits(userId);
  const profileExisted = original !== null;
  console.log(`QA user ${userId}, pre-run credits: ${original}`);
  if (original === null || original < 5) await setCredits(userId, 20);

  let genId: string | null = null;
  try {
    // Unauthorized probe (no token) must 401.
    const noAuth = await fetch(`${BASE}/api/adult-admin/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "image", prompt: "x" }),
    });
    if (noAuth.status !== 401) fail(`expected 401 without token, got ${noAuth.status}`);
    console.log("✓ no-token request rejected 401");

    // Garbage bearer must 401 (not fall through to admin).
    const badAuth = await fetch(`${BASE}/api/adult-admin/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer not-a-real-jwt" },
      body: JSON.stringify({ kind: "image", prompt: "x" }),
    });
    if (badAuth.status !== 401) fail(`expected 401 with garbage bearer, got ${badAuth.status}`);
    console.log("✓ garbage bearer rejected 401");

    // Real creator generate.
    const res = await fetch(`${BASE}/api/adult-admin/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        kind: "image",
        prompt: "studio portrait, soft light, verification shot",
        historyModelId: "yuki",
        historyLookId: "casual",
      }),
    });
    const out = (await res.json()) as { ok?: boolean; generationId?: string; url?: string; error?: string };
    if (!res.ok || !out.generationId || !out.url) fail(`generate failed: ${res.status} ${JSON.stringify(out)}`);
    genId = out.generationId;
    console.log(`✓ creator generate ok — generationId=${genId} url=${out.url.slice(0, 70)}…`);

    // Exactly ONE row, tagged.
    const { data: rows } = await supabaseAdmin
      .from("generations")
      .select("id, model, status, result_image_url, prompt")
      .eq("user_id", userId)
      .like("model", "adult-school/yuki%");
    if (!rows || rows.length !== 1) fail(`expected exactly 1 tagged row, got ${rows?.length ?? 0}`);
    const row = rows[0] as { model: string; status: string; result_image_url: string | null };
    if (row.model !== "adult-school/yuki/casual") fail(`bad model tag: ${row.model}`);
    if (row.status !== "succeeded" || !row.result_image_url) fail(`bad row state: ${JSON.stringify(row)}`);
    console.log("✓ single authoritative row tagged adult-school/yuki/casual, succeeded, with result URL");

    // Gallery reload path (same query ModelStudio.loadHistory runs, via RLS as the user).
    const { createClient } = await import("@supabase/supabase-js");
    const anonUrl = process.env.SUPABASE_URL ?? "";
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
    if (!anonUrl || !anonKey) fail("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing for RLS check");
    const anon = createClient(anonUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: hist, error: histErr } = await anon
      .from("generations")
      .select("id, prompt, model, status, result_image_url, created_at")
      .eq("user_id", userId)
      .like("model", "adult-school/yuki%")
      .order("created_at", { ascending: false })
      .limit(100);
    if (histErr) fail(`gallery reload query failed: ${histErr.message}`);
    if (!hist || hist.length !== 1) fail(`gallery reload expected 1 row, got ${hist?.length ?? 0}`);
    const lookId = String((hist[0] as { model: string }).model).split("/")[2];
    if (lookId !== "casual") fail(`gallery could not recover look id: got ${lookId}`);
    console.log("✓ gallery reload (RLS, user session) returns the row and recovers look id 'casual'");
    console.log("\nPASS — signed-in generate → server-tagged single row → gallery reload verified");
  } finally {
    if (genId) {
      const { data: g } = await supabaseAdmin
        .from("generations")
        .select("result_image_url")
        .eq("id", genId)
        .maybeSingle();
      const url = (g as { result_image_url?: string } | null)?.result_image_url ?? "";
      const m = url.match(/\/studio\/(.+)$/);
      if (m) {
        const { error } = await supabaseAdmin.storage.from("studio").remove([m[1]]);
        console.log(error ? `WARNING: object cleanup: ${error.message}` : `cleanup: removed ${m[1]}`);
      }
      await supabaseAdmin.from("generations").delete().eq("id", genId);
      console.log(`cleanup: generation row ${genId} deleted`);
    }
    if (profileExisted) {
      await setCredits(userId, original!);
      console.log(`cleanup: credits restored to ${original}`);
    } else {
      await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
      console.log("cleanup: run-created profile deleted");
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
