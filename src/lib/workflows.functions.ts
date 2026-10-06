import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("workflows")
      .select("id,name,description,is_public,updated_at,user_id,thumbnail_url,last_output_url,last_output_kind")
      .or(`user_id.eq.${context.userId},is_public.eq.true`)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { workflows: data ?? [] };
  });

/** Owner-only workflow list for library views, including graph for previews. */
export const listMyWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin.from("workflows")
      .select("id,name,description,graph,is_public,created_at,updated_at,user_id,thumbnail_url,last_output_url,last_output_kind")
      .eq("user_id", context.userId).order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { workflows: data ?? [] };
  });

export const getWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: wf, error } = await supabaseAdmin.from("workflows").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
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
      const { data: existing, error: existingError } = await supabaseAdmin.from("workflows").select("user_id").eq("id", data.id).single();
      if (existingError) throw new Error(existingError.message);
      if (!existing || existing.user_id !== context.userId) throw new Error("Forbidden");
      const { id, ...patch } = payload;
      const { error } = await supabaseAdmin.from("workflows").update(patch).eq("id", id!);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("workflows").insert({ ...payload, user_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row?.id };
  });

export const updateWorkflowOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    last_output_url: z.string().url().max(4096),
    last_output_kind: z.enum(["image", "video"]),
    thumbnail_url: z.string().url().max(4096).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing, error: lookupError } = await supabaseAdmin.from("workflows")
      .select("user_id").eq("id", data.id).single();
    if (lookupError) throw new Error(lookupError.message);
    if (!existing || existing.user_id !== context.userId) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("workflows").update({
      last_output_url: data.last_output_url,
      last_output_kind: data.last_output_kind,
      thumbnail_url: data.thumbnail_url ?? data.last_output_url,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("workflows").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
