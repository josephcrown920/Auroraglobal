import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function main() {
  const { data, error } = await supabaseAdmin
    .from("provider_logs")
    .select("provider, endpoint, kind, status, error, latency_ms, created_at")
    .eq("kind", "image")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) { console.error(error); return; }
  for (const row of data ?? []) {
    console.log(JSON.stringify(row));
  }
}
main();
