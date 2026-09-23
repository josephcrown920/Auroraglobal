import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function authenticatedUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}
