import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns true when userId has an "admin" row in user_roles.
 * Used by charge points to bypass credit deduction for admin accounts.
 * Server-only — never call from client code.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}
