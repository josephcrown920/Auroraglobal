"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// site_map_items is intentionally kept out of generated database types until the next schema sync.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

export type SiteMapKind = "public" | "admin" | "internal" | "archived";
export type SiteMapItem = {
  id: string;
  title: string;
  path: string;
  kind: SiteMapKind;
  description: string;
  flow_order: number;
  archived_at: string | null;
  updated_at: string;
};

const DEFAULT_ITEMS: Omit<SiteMapItem, "id" | "archived_at" | "updated_at">[] = [
  { title: "Landing", path: "/", kind: "public", description: "Public introduction and creator entry point.", flow_order: 10 },
  { title: "Tools", path: "/tools", kind: "public", description: "Creator tools directory.", flow_order: 20 },
  { title: "Pricing", path: "/pricing", kind: "public", description: "Aura and subscription plans.", flow_order: 30 },
  { title: "Studio", path: "/studio", kind: "internal", description: "Signed-in creation workspace.", flow_order: 40 },
  { title: "Perform Anywhere", path: "/motion", kind: "internal", description: "Performance Builder workspace.", flow_order: 50 },
  { title: "Talking Avatar Studio", path: "/avatar", kind: "internal", description: "Photo avatar and script tools.", flow_order: 60 },
  { title: "Aurora Video Agent", path: "/video-agent", kind: "internal", description: "Creator video planning and production workspace.", flow_order: 70 },
  { title: "Admin Overview", path: "/admin", kind: "admin", description: "Operator dashboard and controls.", flow_order: 80 },
  { title: "Site Images", path: "/admin/site-images", kind: "admin", description: "Landing image swap controls.", flow_order: 90 },
  { title: "Adult Center", path: "/adult", kind: "admin", description: "Private 18+ identity-locked editorial studio.", flow_order: 100 },
];

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — admin only");
}

function missingTable(error: { code?: string; message?: string }) {
  return error.code === "PGRST205" || /site_map_items/i.test(error.message ?? "");
}

export const getSiteMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await db
      .from("site_map_items")
      .select("id, title, path, kind, description, flow_order, archived_at, updated_at")
      .order("flow_order");
    if (error) {
      if (missingTable(error)) return DEFAULT_ITEMS.map((item, index) => ({
        ...item, id: `default-${index}`, archived_at: null, updated_at: "",
      })) as SiteMapItem[];
      throw new Error(error.message);
    }
    return (data ?? []) as SiteMapItem[];
  });

export const seedSiteMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: existing, error: existingError } = await db.from("site_map_items").select("id").limit(1);
    if (existingError) throw new Error(existingError.message);
    if ((existing ?? []).length > 0) return { ok: true, seeded: false };
    const { error } = await db.from("site_map_items").insert(DEFAULT_ITEMS);
    if (error) throw new Error(error.message);
    return { ok: true, seeded: true };
  });

export const updateSiteMapItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(100),
    path: z.string().trim().min(1).max(240),
    description: z.string().trim().max(400),
  }).parse(value))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await db.from("site_map_items")
      .update({ title: data.title, path: data.path, description: data.description, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderSiteMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(value))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const updatedAt = new Date().toISOString();
    const results = await Promise.all(data.ids.map((id, index) =>
      db.from("site_map_items").update({ flow_order: (index + 1) * 10, updated_at: updatedAt }).eq("id", id),
    ));
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
    return { ok: true };
  });

export const setSiteMapArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(value))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await db.from("site_map_items").update({
      kind: data.archived ? "archived" : "internal",
      archived_at: data.archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSiteMapItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ id: z.string().uuid() }).parse(value))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await db.from("site_map_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });