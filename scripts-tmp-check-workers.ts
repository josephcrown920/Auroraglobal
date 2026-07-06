import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function main() {
  const { data, error } = await supabaseAdmin
    .from("gpu_workers")
    .select("id, name, endpoint_url, capabilities, models, status, priority, last_heartbeat, last_probe_at, last_probe_ok, last_probe_error, paused_reason, protocol, worker_role, in_flight, max_concurrency")
    .order("last_heartbeat", { ascending: false });
  if (error) { console.error(error); return; }
  for (const row of data ?? []) console.log(JSON.stringify(row));
}
main();
