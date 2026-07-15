import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  guidedWorkflowContentSchema,
  type GuidedWorkflowContent,
  type GuidedWorkflowRow,
} from "./guided-workflows.schema";
import { DEFAULT_GUIDED_WORKFLOWS } from "./guided-workflows.seed";

// `guided_workflows` is not in the generated Supabase types yet (same
// situation as `scheduler_heartbeats` / avatars — see admin.functions.ts), so
// queries go through an untyped handle and rows are validated with zod on the
// way out.
type DbRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  icon: string;
  source_credit: string;
  steps: unknown;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function table() {
  return (supabaseAdmin as unknown as {
    from: (t: string) => ReturnType<typeof supabaseAdmin.from>;
  }).from("guided_workflows");
}

function rowToWorkflow(row: DbRow): GuidedWorkflowRow {
  const content = guidedWorkflowContentSchema.parse({
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    icon: row.icon,
    sourceCredit: row.source_credit,
    steps: row.steps,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
  });
  return {
    ...content,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contentToDb(content: GuidedWorkflowContent) {
  return {
    slug: content.slug,
    title: content.title,
    tagline: content.tagline,
    description: content.description,
    category: content.category,
    icon: content.icon,
    source_credit: content.sourceCredit,
    steps: content.steps,
    is_published: content.isPublished,
    sort_order: content.sortOrder,
    updated_at: new Date().toISOString(),
  };
}

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

// ─── Public (gallery + runner) ───────────────────────────────────────────────

/** Seed all published defaults into the DB (ON CONFLICT slug → skip). */
async function autoSeedDefaults() {
  for (const wf of DEFAULT_GUIDED_WORKFLOWS) {
    if (!wf.isPublished) continue;
    const content = guidedWorkflowContentSchema.parse(wf);
    await table().upsert(contentToDb(content), { onConflict: "slug", ignoreDuplicates: true });
  }
}

export const listPublishedGuidedWorkflows = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await table()
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as DbRow[];
    if (rows.length === 0) {
      await autoSeedDefaults();
      const { data: seeded } = await table()
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return { workflows: ((seeded ?? []) as DbRow[]).map(rowToWorkflow) };
    }

    return { workflows: rows.map(rowToWorkflow) };
  },
);

export const getGuidedWorkflow = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await table()
      .select("*")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) {
      const def = DEFAULT_GUIDED_WORKFLOWS.find(
        (w) => w.slug === data.slug && w.isPublished,
      );
      if (!def) throw new Error("Workflow not found");
      const content = guidedWorkflowContentSchema.parse(def);
      await table()
        .upsert(contentToDb(content), { onConflict: "slug", ignoreDuplicates: true })
        .then(() => null)
        .catch(() => null);
      return {
        workflow: {
          ...content,
          id: def.slug,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } satisfies GuidedWorkflowRow,
      };
    }

    return { workflow: rowToWorkflow(row as DbRow) };
  });

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

export const adminListGuidedWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await table()
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { workflows: ((data ?? []) as DbRow[]).map(rowToWorkflow) };
  });

export const adminSaveGuidedWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        /** Present when editing an existing row; absent when creating. */
        id: z.string().uuid().optional().nullable(),
        content: guidedWorkflowContentSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.id) {
      const { data: row, error } = await table()
        .update(contentToDb(data.content))
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { workflow: rowToWorkflow(row as DbRow) };
    }

    const { data: row, error } = await table()
      .insert(contentToDb(data.content))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { workflow: rowToWorkflow(row as DbRow) };
  });

export const adminDeleteGuidedWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await table().delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Upserts the curated default workflows (by slug). Existing rows with a
 * default slug are overwritten with the canonical content; custom workflows
 * with other slugs are untouched.
 */
export const adminSeedGuidedWorkflows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    let upserted = 0;
    for (const wf of DEFAULT_GUIDED_WORKFLOWS) {
      const content = guidedWorkflowContentSchema.parse(wf);
      const { error } = await table().upsert(
        { ...contentToDb(content) },
        { onConflict: "slug" },
      );
      if (error) throw new Error(`${wf.slug}: ${error.message}`);
      upserted++;
    }
    return { ok: true, upserted };
  });
