import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function main() {
  const { data, error } = await supabaseAdmin
    .from("worker_register_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) { console.error(error); return; }
  for (const row of data ?? []) console.log(JSON.stringify(row));
}
main();
