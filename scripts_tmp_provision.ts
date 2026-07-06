import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `growth-zip-e2e-${Date.now()}@aurora-sandbox-qa.com`;
const password = "GrowthZipE2e!23";

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: "Growth ZIP E2E" },
});
if (error || !data.user) {
  console.error("createUser failed:", error?.message);
  process.exit(1);
}
const userId = data.user.id;

// Give plenty of Aura credits + pro plan for the image-generation flow.
const { error: updErr } = await admin
  .from("profiles")
  .update({ plan: "pro", credits: 500 })
  .eq("user_id", userId);
if (updErr) {
  console.error("profile update failed:", updErr.message);
  process.exit(1);
}

console.log(JSON.stringify({ email, password, userId }));
