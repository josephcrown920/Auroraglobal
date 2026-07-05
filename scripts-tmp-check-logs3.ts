import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function main() {
  const { data, error } = await supabaseAdmin
    .from("provider_logs")
    .select("provider, endpoint, kind, status, error, latency_ms, created_at, ref_id")
    .eq("ref_id", process.argv[2])
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  for (const row of data ?? []) console.log(JSON.stringify(row));
}
main();
