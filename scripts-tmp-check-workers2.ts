import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function main() {
  const { count, error } = await supabaseAdmin
    .from("gpu_workers")
    .select("*", { count: "exact", head: true });
  console.log({ count, error });
}
main();
