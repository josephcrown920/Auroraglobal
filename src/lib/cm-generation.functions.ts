import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  COST_PER_VIDEO,
  MAX_BATCH_VIDEOS,
  batchItemCount,
  buildContentMachinePayload,
  type CMProductCore,
  type CMTemplateCore,
} from "@/lib/cm.server";

/**
 * AI UGC Content Machine (/content-machine) — server functions.
 *
 * The Content Machine reuses Aurora's existing UGC ad pipeline. A "batch" fans out
 * into N INDEPENDENT `ugc_ad` jobs (see runUGCAd in jobs.server.ts). Each video is
 * reserved separately through create_generation_and_reserve for a flat
 * COST_PER_VIDEO, so there is no double-charge and a failed render is refunded by
 * the existing job lifecycle. Videos are FACELESS — no avatar is attached.
 *
 * The cm_* tables are not in the generated Supabase types until codegen re-runs, so
 * a loosely-typed admin handle is used and every query is scoped to the authed
 * user_id (the same approach kids-generation.functions.ts / avatars.server.ts use).
 */

type LooseResult = { data: unknown; error: { message: string } | null };
interface AnyTable {
  select(cols?: string): AnyTable;
  insert(row: Record<string, unknown> | Record<string, unknown>[]): AnyTable;
  update(patch: Record<string, unknown>): AnyTable;
  delete(): AnyTable;
  upsert(row: Record<string, unknown>, opts?: Record<string, unknown>): AnyTable;
  eq(col: string, val: unknown): AnyTable;
  neq(col: string, val: unknown): AnyTable;
  in(col: string, vals: unknown[]): AnyTable;
  or(filter: string): AnyTable;
  order(col: string, opts?: Record<string, unknown>): AnyTable;
  limit(n: number): AnyTable;
  maybeSingle(): Promise<LooseResult>;
  single(): Promise<LooseResult>;
  then<T>(onfulfilled?: ((value: LooseResult) => T | PromiseLike<T>) | null): Promise<T>;
}

function db() {
  return supabaseAdmin as unknown as {
    from: (t: string) => AnyTable;
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

// ─── Shared row → DTO mappers ─────────────────────────────────────────────────

type ProductDTO = {
  id: string;
  name: string;
  description: string | null;
  brandVoice: string | null;
  audience: string | null;
  cta: string | null;
  link: string | null;
  photos: string[];
  createdAt: string | null;
};

function toProduct(r: Record<string, unknown>): ProductDTO {
  return {
    id: r.id as string,
    name: (r.name as string) ?? "",
    description: (r.description as string | null) ?? null,
    brandVoice: (r.brand_voice as string | null) ?? null,
    audience: (r.audience as string | null) ?? null,
    cta: (r.cta as string | null) ?? null,
    link: (r.link as string | null) ?? null,
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    createdAt: (r.created_at as string | null) ?? null,
  };
}

type TemplateDTO = {
  id: string;
  name: string;
  description: string | null;
  sceneHint: string;
  motionHint: string | null;
  scriptFormula: string | null;
  aspect: string;
  duration: number;
  icon: string | null;
  isSystem: boolean;
};

function toTemplate(r: Record<string, unknown>): TemplateDTO {
  return {
    id: r.id as string,
    name: (r.name as string) ?? "",
    description: (r.description as string | null) ?? null,
    sceneHint: (r.scene_hint as string) ?? "",
    motionHint: (r.motion_hint as string | null) ?? null,
    scriptFormula: (r.script_formula as string | null) ?? null,
    aspect: (r.aspect as string | null) ?? "9:16",
    duration: (r.duration as number | null) ?? 8,
    icon: (r.icon as string | null) ?? null,
    isSystem: Boolean(r.is_system),
  };
}

type DerivedStatus = "succeeded" | "failed" | "processing";
function deriveStatus(genStatus: string | null | undefined): DerivedStatus {
  if (genStatus === "succeeded") return "succeeded";
  if (genStatus === "failed") return "failed";
  return "processing";
}

// ─── Products CRUD ────────────────────────────────────────────────────────────

const SaveProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  brandVoice: z.string().max(600).optional().nullable(),
  audience: z.string().max(600).optional().nullable(),
  cta: z.string().max(300).optional().nullable(),
  link: z.string().url().max(600).optional().nullable().or(z.literal("")),
  photos: z.array(z.string().url()).max(12).optional(),
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveProductSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const row = {
      user_id: userId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      brand_voice: data.brandVoice?.trim() || null,
      audience: data.audience?.trim() || null,
      cta: data.cta?.trim() || null,
      link: data.link?.trim() || null,
      photos: data.photos ?? [],
    };

    if (data.id) {
      const { data: updated, error } = await db()
        .from("cm_products")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("Product not found");
      return toProduct(updated as Record<string, unknown>);
    }

    const { data: created, error } = await db()
      .from("cm_products")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toProduct(created as Record<string, unknown>);
  });

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await db()
      .from("cm_products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data as Record<string, unknown>[]) ?? []).map(toProduct);
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await db()
      .from("cm_products")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Templates ────────────────────────────────────────────────────────────────

const SaveTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional().nullable(),
  sceneHint: z.string().min(2).max(1000),
  motionHint: z.string().max(600).optional().nullable(),
  scriptFormula: z.string().max(600).optional().nullable(),
  aspect: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  duration: z.number().int().min(3).max(12).default(8),
  icon: z.string().max(40).optional().nullable(),
});

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await db()
      .from("cm_templates")
      .select("*")
      .or(`is_system.eq.true,user_id.eq.${userId}`)
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data as Record<string, unknown>[]) ?? []).map(toTemplate);
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const row = {
      user_id: userId,
      is_system: false,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      scene_hint: data.sceneHint.trim(),
      motion_hint: data.motionHint?.trim() || null,
      script_formula: data.scriptFormula?.trim() || null,
      aspect: data.aspect,
      duration: data.duration,
      icon: data.icon?.trim() || null,
    };

    if (data.id) {
      // Only the owner's own non-system templates are editable.
      const { data: updated, error } = await db()
        .from("cm_templates")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", userId)
        .eq("is_system", false)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("Template not found");
      return toTemplate(updated as Record<string, unknown>);
    }

    const { data: created, error } = await db()
      .from("cm_templates")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toTemplate(created as Record<string, unknown>);
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await db()
      .from("cm_templates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("is_system", false);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Batch generation ─────────────────────────────────────────────────────────

const StartBatchSchema = z.object({
  productId: z.string().uuid(),
  templateIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH_VIDEOS),
  countPerTemplate: z.number().int().min(1).max(MAX_BATCH_VIDEOS),
});

export const startBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartBatchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const templateIds = Array.from(new Set(data.templateIds));

    // 1. Load + authorize the product.
    const { data: productRow, error: pErr } = await db()
      .from("cm_products")
      .select("*")
      .eq("id", data.productId)
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!productRow) throw new Error("Product not found");
    const product = toProduct(productRow as Record<string, unknown>);

    // 2. Load + authorize the templates (system or owned).
    const { data: tplRows, error: tErr } = await db()
      .from("cm_templates")
      .select("*")
      .in("id", templateIds)
      .or(`is_system.eq.true,user_id.eq.${userId}`);
    if (tErr) throw new Error(tErr.message);
    const templates = ((tplRows as Record<string, unknown>[]) ?? []).map(toTemplate);
    if (templates.length !== templateIds.length) {
      throw new Error("One or more templates were not found");
    }
    // Preserve the caller's template order.
    const byId = new Map(templates.map((t) => [t.id, t]));
    const orderedTemplates = templateIds.map((id) => byId.get(id)!).filter(Boolean);

    // 3. Size + cap the batch.
    const totalItems = batchItemCount(orderedTemplates.length, data.countPerTemplate);
    if (totalItems < 1) throw new Error("Choose at least one template and one video");
    if (totalItems > MAX_BATCH_VIDEOS) {
      throw new Error(`A batch can generate at most ${MAX_BATCH_VIDEOS} videos`);
    }

    // 4. Create the batch row up front so items can link to it.
    const { data: batchRow, error: bErr } = await db()
      .from("cm_batches")
      .insert({
        user_id: userId,
        product_id: product.id,
        product_name: product.name,
        template_ids: templateIds,
        count_per_template: data.countPerTemplate,
        total_items: totalItems,
        credits_reserved: 0,
        status: "queued",
      })
      .select("id")
      .single();
    if (bErr || !(batchRow as { id?: string })?.id) throw new Error(bErr?.message ?? "Could not create batch");
    const batchId = (batchRow as { id: string }).id;

    // 5. Reserve + enqueue one independent ugc_ad job per video. Stop immediately
    //    on the first insufficient-credits failure (partial batch is fine).
    let queued = 0;
    let reserved = 0;
    let seq = 0;
    let stopReason: string | null = null;

    const productCore: CMProductCore = {
      name: product.name,
      description: product.description,
      brandVoice: product.brandVoice,
      audience: product.audience,
      cta: product.cta,
    };

    outer: for (const tpl of orderedTemplates) {
      const templateCore: CMTemplateCore = {
        name: tpl.name,
        sceneHint: tpl.sceneHint,
        motionHint: tpl.motionHint,
        scriptFormula: tpl.scriptFormula,
        aspect: tpl.aspect,
        duration: tpl.duration,
      };
      const payload = buildContentMachinePayload({ product: productCore, template: templateCore });
      const prompt = `Content Machine: ${product.name} — ${tpl.name}`;

      for (let c = 0; c < data.countPerTemplate; c++) {
        const { data: rows, error } = await db().rpc("create_generation_and_reserve", {
          _user: userId,
          _kind: "ugc_ad",
          _prompt: prompt,
          _amount: COST_PER_VIDEO,
          _payload: payload,
        });
        if (error) {
          stopReason = /insufficient_credits/i.test(error.message)
            ? "Not enough Aura"
            : error.message;
          break outer;
        }
        const r = (Array.isArray(rows) ? rows[0] : rows) as {
          job_id: string;
          generation_id: string;
        };
        await db()
          .from("cm_batch_items")
          .insert({
            batch_id: batchId,
            user_id: userId,
            template_id: tpl.id,
            template_name: tpl.name,
            generation_id: r.generation_id,
            job_id: r.job_id,
            seq,
            credits_reserved: COST_PER_VIDEO,
          });
        queued += 1;
        reserved += COST_PER_VIDEO;
        seq += 1;
      }
    }

    // 6. Nothing queued (out of Aura on the very first item) → drop the empty batch.
    if (queued === 0) {
      await db().from("cm_batches").delete().eq("id", batchId).eq("user_id", userId);
      throw new Error(stopReason ?? "Could not queue any videos");
    }

    const partial = queued < totalItems;
    const note = partial
      ? `Queued ${queued} of ${totalItems} videos${
          stopReason === "Not enough Aura" ? " — add Aura to generate the rest." : "."
        }`
      : null;
    await db()
      .from("cm_batches")
      .update({
        credits_reserved: reserved,
        status: partial ? "partial_queued" : "queued",
        note,
      })
      .eq("id", batchId)
      .eq("user_id", userId);

    return {
      batchId,
      queued,
      total: totalItems,
      creditsReserved: reserved,
      status: partial ? ("partial_queued" as const) : ("queued" as const),
      note,
    };
  });

// ─── Status (per batch) ───────────────────────────────────────────────────────

export type BatchItemState = {
  id: string;
  seq: number;
  templateName: string | null;
  generationId: string | null;
  status: DerivedStatus;
  imageUrl: string | null;
  videoUrl: string | null;
  error: string | null;
};

export const getBatchStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ batchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: batch, error: bErr } = await db()
      .from("cm_batches")
      .select("*")
      .eq("id", data.batchId)
      .eq("user_id", userId)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!batch) throw new Error("Batch not found");

    const { data: itemRows, error: iErr } = await db()
      .from("cm_batch_items")
      .select("*")
      .eq("batch_id", data.batchId)
      .eq("user_id", userId)
      .order("seq", { ascending: true });
    if (iErr) throw new Error(iErr.message);
    type BatchItemRow = { id: string; seq: number; template_name: string | null; generation_id: string | null };
    type GenRow = { id: string; status: string | null; result_image_url: string | null; result_video_url: string | null; error: string | null };
    const items = (itemRows as BatchItemRow[]) ?? [];

    const genIds = items.map((i) => i.generation_id).filter(Boolean) as string[];
    const genMap = new Map<string, GenRow>();
    if (genIds.length) {
      const { data: gens, error: gErr } = await db()
        .from("generations")
        .select("id, status, result_image_url, result_video_url, error")
        .in("id", genIds);
      if (gErr) throw new Error(gErr.message);
      for (const g of (gens as GenRow[]) ?? []) genMap.set(g.id, g);
    }

    const states: BatchItemState[] = items.map((i) => {
      const g = i.generation_id ? genMap.get(i.generation_id as string) : null;
      return {
        id: i.id as string,
        seq: (i.seq as number) ?? 0,
        templateName: (i.template_name as string | null) ?? null,
        generationId: (i.generation_id as string | null) ?? null,
        status: deriveStatus(g?.status),
        imageUrl: (g?.result_image_url as string | null) ?? null,
        videoUrl: (g?.result_video_url as string | null) ?? null,
        error: (g?.error as string | null) ?? null,
      };
    });

    const generated = states.filter((s) => s.status === "succeeded").length;
    const failed = states.filter((s) => s.status === "failed").length;
    const processing = states.filter((s) => s.status === "processing").length;

    const b = batch as Record<string, unknown>;
    return {
      id: b.id as string,
      productName: (b.product_name as string | null) ?? null,
      status: (b.status as string) ?? "queued",
      note: (b.note as string | null) ?? null,
      totalItems: (b.total_items as number) ?? states.length,
      creditsReserved: (b.credits_reserved as number) ?? 0,
      creditsSpent: generated * COST_PER_VIDEO,
      counts: { generated, processing, failed, total: states.length },
      items: states,
      createdAt: (b.created_at as string | null) ?? null,
    };
  });

// ─── Bootstrap (products + templates + batches + analytics) ──────────────────

export const getContentMachineData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const [productsRes, templatesRes, batchesRes, itemsRes] = await Promise.all([
      db().from("cm_products").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      db()
        .from("cm_templates")
        .select("*")
        .or(`is_system.eq.true,user_id.eq.${userId}`)
        .order("is_system", { ascending: false })
        .order("created_at", { ascending: false }),
      db().from("cm_batches").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(24),
      db()
        .from("cm_batch_items")
        .select("id, batch_id, generation_id, credits_reserved")
        .eq("user_id", userId)
        .limit(1000),
    ]);
    for (const r of [productsRes, templatesRes, batchesRes, itemsRes]) {
      if (r.error) throw new Error(r.error.message);
    }

    type CmBatchItem = { batch_id: string; generation_id: string | null; credits_reserved: number };
    type CmGenStatusRow = { id: string; status: string | null };
    const products = ((productsRes.data as Record<string, unknown>[]) ?? []).map(toProduct);
    const templates = ((templatesRes.data as Record<string, unknown>[]) ?? []).map(toTemplate);
    const batchRows = (batchesRes.data as Record<string, unknown>[]) ?? [];
    const items = (itemsRes.data as CmBatchItem[]) ?? [];

    // Resolve generation status for every linked item in one query.
    const genIds = items.map((i) => i.generation_id).filter(Boolean) as string[];
    const statusById = new Map<string, DerivedStatus>();
    if (genIds.length) {
      const { data: gens, error: gErr } = await db()
        .from("generations")
        .select("id, status")
        .in("id", genIds);
      if (gErr) throw new Error(gErr.message);
      for (const g of (gens as CmGenStatusRow[]) ?? []) {
        statusById.set(g.id, deriveStatus(g.status));
      }
    }

    const itemsByBatch = new Map<string, CmBatchItem[]>();
    for (const it of items) {
      const arr = itemsByBatch.get(it.batch_id) ?? [];
      arr.push(it);
      itemsByBatch.set(it.batch_id, arr);
    }

    const countFor = (list: CmBatchItem[]) => {
      let generated = 0,
        failed = 0,
        processing = 0;
      for (const it of list) {
        const s = it.generation_id ? statusById.get(it.generation_id as string) ?? "processing" : "processing";
        if (s === "succeeded") generated += 1;
        else if (s === "failed") failed += 1;
        else processing += 1;
      }
      return { generated, failed, processing, total: list.length };
    };

    const batches = batchRows.map((b) => {
      const counts = countFor(itemsByBatch.get(b.id as string) ?? []);
      return {
        id: b.id as string,
        productName: (b.product_name as string | null) ?? null,
        status: (b.status as string) ?? "queued",
        note: (b.note as string | null) ?? null,
        totalItems: (b.total_items as number) ?? 0,
        creditsReserved: (b.credits_reserved as number) ?? 0,
        creditsSpent: counts.generated * COST_PER_VIDEO,
        counts,
        createdAt: (b.created_at as string | null) ?? null,
      };
    });

    // App-wide funnel across every video the user has produced.
    const allCounts = countFor(items);
    const analytics = {
      products: products.length,
      templates: templates.length,
      batches: batchRows.length,
      videos: items.length,
      generated: allCounts.generated,
      processing: allCounts.processing,
      failed: allCounts.failed,
      creditsSpent: allCounts.generated * COST_PER_VIDEO,
      creditsReserved: items.reduce((sum, i) => sum + ((i.credits_reserved as number) ?? 0), 0),
    };

    return { products, templates, batches, analytics };
  });
