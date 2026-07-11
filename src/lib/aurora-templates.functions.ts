// Aurora Templates (Task #275): a saved HeyGen template setup (template_id +
// fixed variables + a designated "character" variable slot) that can be
// re-rendered many times with a different character each run — mass content
// production of the same scene/story without rebuilding it per generation.
//
// Backend-only for now (no picker UI yet). Every render — single or batch —
// goes through `reserveOrchestrateRecord` INDIVIDUALLY: one credit
// reservation per video, committed on success and released on failure,
// exactly like every other orchestrator charge point. Batch items share
// nothing but a fan-out loop (Promise.allSettled, same shape as Batch Lip
// Sync): one item failing or running out of credits never blocks or refunds
// the others.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reserveOrchestrateRecord, type RenderDeps } from "@/lib/generate-core.server";
import { assertDailyBudget } from "@/lib/cost-guardrails.server";
import { computeCost } from "@/lib/pricing";
import {
  HeyGenTemplateCharacterVariableSchema,
  HeyGenTemplateVariablesSchema,
  mergeCharacterVariable,
  type HeyGenTemplateVariables,
  type HeyGenTemplateCharacterVariable,
} from "@/lib/heygen.server";

// Priced through the shared price list (never a literal): video @ ultra tier
// for the reference clip. Resolution/length multipliers don't apply — a
// template render's length is fixed by the template itself.
export const AURORA_TEMPLATE_MODEL = "heygen/template";
const AURORA_TEMPLATE_COST = computeCost({
  features: ["video"],
  model: AURORA_TEMPLATE_MODEL,
}).total;

export type AuroraTemplateRow = {
  id: string;
  user_id: string;
  name: string;
  heygen_template_id: string;
  fixed_variables: HeyGenTemplateVariables;
  character_variable_key: string;
  created_at: string;
  updated_at: string;
};

// `aurora_templates` is not in the generated Supabase types yet — narrow-cast
// just this table (same pattern as owner_withdrawals in admin.functions.ts).
type TemplateFilter = {
  eq: (col: string, val: string) => TemplateFilter;
  order: (
    col: string,
    opts: { ascending: boolean },
  ) => Promise<{ data: AuroraTemplateRow[] | null; error: { message: string } | null }>;
  maybeSingle: () => Promise<{ data: AuroraTemplateRow | null; error: { message: string } | null }>;
};
type TemplateDeleteChain = {
  eq: (col: string, val: string) => TemplateDeleteChain & Promise<{ error: { message: string } | null }>;
};
const templatesTable = supabaseAdmin as unknown as {
  from: (t: "aurora_templates") => {
    select: (c: string) => TemplateFilter;
    insert: (row: {
      user_id: string;
      name: string;
      heygen_template_id: string;
      fixed_variables: HeyGenTemplateVariables;
      character_variable_key: string;
    }) => {
      select: (c: string) => {
        single: () => Promise<{ data: AuroraTemplateRow | null; error: { message: string } | null }>;
      };
    };
    delete: () => TemplateDeleteChain;
  };
};

async function loadOwnedTemplate(userId: string, id: string): Promise<AuroraTemplateRow> {
  const { data, error } = await templatesTable
    .from("aurora_templates")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Aurora Template not found");
  return data;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  heygenTemplateId: z.string().min(1).max(128),
  fixedVariables: HeyGenTemplateVariablesSchema,
  characterVariableKey: z.string().min(1).max(128),
});

export const createAuroraTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ context, data }) => {
    // The character slot must exist in the stored variables (it's the one
    // being swapped per run) — reject a dangling key at save time, not at
    // the first failed generation.
    if (!(data.characterVariableKey in data.fixedVariables)) {
      throw new Error(
        `characterVariableKey "${data.characterVariableKey}" is not present in fixedVariables`,
      );
    }
    // …and the slot must actually BE a character variable: swapping a
    // text/image slot with a character payload would produce a template
    // render that fails (or renders wrong) at HeyGen, after credits moved.
    if (data.fixedVariables[data.characterVariableKey].type !== "character") {
      throw new Error(
        `characterVariableKey "${data.characterVariableKey}" must point at a "character" variable, ` +
          `got "${data.fixedVariables[data.characterVariableKey].type}"`,
      );
    }
    const { data: row, error } = await templatesTable
      .from("aurora_templates")
      .insert({
        user_id: context.userId,
        name: data.name,
        heygen_template_id: data.heygenTemplateId,
        fixed_variables: data.fixedVariables,
        character_variable_key: data.characterVariableKey,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row!;
  });

export const listAuroraTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await templatesTable
      .from("aurora_templates")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteAuroraTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await templatesTable
      .from("aurora_templates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Generation ──────────────────────────────────────────────────────────────

export type AuroraTemplateRenderResult =
  | { ok: true; generationId: string; url: string }
  | { ok: false; error: string; insufficient?: boolean };

/** One render = one independent credit reservation + one HeyGen dispatch.
 *  Exported (with injectable deps) so the per-item credit flow is unit-testable
 *  without a live database or a real HeyGen spend. */
export async function renderOneCharacter(
  tpl: AuroraTemplateRow,
  userId: string,
  character: HeyGenTemplateCharacterVariable,
  opts: { orientation?: "landscape" | "portrait"; title?: string },
  deps?: RenderDeps,
): Promise<AuroraTemplateRenderResult> {
  // Friendly early-check before attempting a HeyGen API call — gives the user
  // a clear message if their daily cap is already at its limit. The
  // reserve_credits() RPC enforces this for real (race-free).
  await assertDailyBudget(userId, AURORA_TEMPLATE_COST, deps?.dailyBudget);

  const variables = mergeCharacterVariable(
    tpl.fixed_variables,
    tpl.character_variable_key,
    character,
  );
  const outcome = await reserveOrchestrateRecord({
    userId,
    kind: "video",
    cost: AURORA_TEMPLATE_COST,
    reason: "aurora_template",
    prompt: `Aurora Template: ${tpl.name}`,
    model: AURORA_TEMPLATE_MODEL,
    // A template render is THE product — never substitute a generic video
    // model on failure; fail and refund instead.
    pinnedModelOnly: true,
    params: {
      templateId: tpl.heygen_template_id,
      variables,
      ...(opts.orientation ? { orientation: opts.orientation } : {}),
      ...(opts.title ? { title: opts.title } : {}),
    },
  }, deps);
  if (!outcome.ok) {
    return { ok: false, error: outcome.error, insufficient: outcome.insufficient };
  }
  return { ok: true, generationId: outcome.generationId, url: outcome.url };
}

const RenderOptionsSchema = z.object({
  orientation: z.enum(["landscape", "portrait"]).optional(),
  title: z.string().max(120).optional(),
});

/** Single generation from an Aurora Template with one character value. */
export const generateAuroraTemplateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        auroraTemplateId: z.string().uuid(),
        // Character swaps ONLY — any other variable type belongs in the
        // template's stored fixed variables, not the per-run input.
        character: HeyGenTemplateCharacterVariableSchema,
      })
      .merge(RenderOptionsSchema)
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tpl = await loadOwnedTemplate(context.userId, data.auroraTemplateId);
    return renderOneCharacter(tpl, context.userId, data.character, data);
  });

/**
 * Batch/mass production: one Aurora Template + N character values → N videos
 * with identical fixed variables. Fan-out via Promise.allSettled so results
 * come back per-item; each item reserves, commits, and (on failure) releases
 * its own credits — there is no shared reservation to leak or double-refund.
 */
export const generateAuroraTemplateBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        auroraTemplateId: z.string().uuid(),
        characters: z.array(HeyGenTemplateCharacterVariableSchema).min(1).max(10),
      })
      .merge(RenderOptionsSchema)
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tpl = await loadOwnedTemplate(context.userId, data.auroraTemplateId);
    return renderAuroraTemplateCharacters(tpl, context.userId, data.characters, data);
  });

/** Shared fan-out core (exported for tests — deps flow to every item). */
export async function renderAuroraTemplateCharacters(
  tpl: AuroraTemplateRow,
  userId: string,
  characters: HeyGenTemplateCharacterVariable[],
  opts: { orientation?: "landscape" | "portrait"; title?: string },
  deps?: RenderDeps,
): Promise<{
  templateId: string;
  total: number;
  succeeded: number;
  results: AuroraTemplateRenderResult[];
}> {
  const settled = await Promise.allSettled(
    characters.map((c) => renderOneCharacter(tpl, userId, c, opts, deps)),
  );
  const results: AuroraTemplateRenderResult[] = settled.map((s) =>
    s.status === "fulfilled"
      ? s.value
      : {
          ok: false,
          error: s.reason instanceof Error ? s.reason.message : String(s.reason),
        },
  );
  return {
    templateId: tpl.id,
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    results,
  };
}
