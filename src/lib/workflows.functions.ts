import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("workflows")
      .select("id,name,description,is_public,updated_at,user_id")
      .or(`user_id.eq.${context.userId},is_public.eq.true`)
      .order("updated_at", { ascending: false });
    return { workflows: data ?? [] };
  });

export const getWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: wf } = await supabaseAdmin.from("workflows").select("*").eq("id", data.id).single();
    if (!wf) throw new Error("Not found");
    if (wf.user_id !== context.userId && !wf.is_public) throw new Error("Forbidden");
    return wf;
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    graph: z.record(z.string(), z.unknown()),
    is_public: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, graph: data.graph as never };
    if (data.id) {
      const { data: existing } = await supabaseAdmin.from("workflows").select("user_id").eq("id", data.id).single();
      if (!existing || existing.user_id !== context.userId) throw new Error("Forbidden");
      const { id, ...patch } = payload;
      await supabaseAdmin.from("workflows").update(patch).eq("id", id!);
      return { id };
    }
    const { data: row } = await supabaseAdmin.from("workflows").insert({ ...payload, user_id: context.userId }).select("id").single();
    return { id: row?.id };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("workflows").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });
