// Shared synchronous render core: reserve credits → orchestrate → record the
// generation → commit (or release on failure). Single source of truth for the
// credit flow so the public /api/public/generate endpoint and the Aurora Agent
// per-shot renderer never drift apart.
//
// Supabase RPCs resolve with an `{ error }` object instead of throwing, so EVERY
// credit call (reserve / commit / release) inspects `error` explicitly — a
// silently-ignored commit or release would leak `credits_reserved` while
// reporting success. The credit + render surface is injectable (`deps`) so the
// whole flow is unit-testable without a live database or provider.
import { orchestrate, type GenerateKind } from "@/lib/orchestrator.server";
import type { Database } from "@/integrations/supabase/types";
import { persistResultUrl, resultMediaTypeForKind } from "./result-store.server";

type GenerationInsert = Database["public"]["Tables"]["generations"]["Insert"];

type RpcResult = { data: unknown; error: { message: string } | null };

export type RenderDeps = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  orchestrate: typeof orchestrate;
  insertGeneration: (row: GenerationInsert) => Promise<{ id: string }>;
};

export type RenderInput = {
  userId: string;
  kind: GenerateKind;
  cost: number;
  /** Credit-ledger reason; also used to label the release on failure. */
  reason: string;
  prompt?: string;
  imageUrls?: string[];
  audioUrl?: string;
  videoUrl?: string;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p" | "2160p";
  model?: string;
  params?: Record<string, unknown>;
  comfyWorkflow?: unknown;
  comfyInputs?: Record<string, unknown>;
  /** generations.mode for the recorded row (default "performance"; previews pass "preview"). */
  mode?: string;
  /** Optional Aurora Agent linkage so per-shot renders are queryable relationally. */
  sessionId?: string;
  agentShotId?: string;
  /** Caption segments for `caption_burn` requests. */
  segments?: Array<{ start: number; end: number; text: string }>;
};

export type RenderOutcome =
  | {
      ok: true;
      generationId: string;
      url: string;
      /** Populated for the `text` modality (no URL output). */
      text?: string;
      provider: string;
      endpoint: string;
      latencyMs: number;
      costUsd: number;
    }
  | { ok: false; error: string; insufficient?: boolean };

async function buildDefaultDeps(): Promise<RenderDeps> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as { rpc: RenderDeps["rpc"] };
  return {
    rpc: (name, args) => client.rpc(name, args),
    orchestrate,
    insertGeneration: async (row) => {
      const { data, error } = await supabaseAdmin
        .from("generations")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: data.id };
    },
  };
}

export async function reserveOrchestrateRecord(
  input: RenderInput,
  deps?: RenderDeps,
): Promise<RenderOutcome> {
  const d = deps ?? (await buildDefaultDeps());
  const reservationRef = crypto.randomUUID();
  let reservedAmount = 0;

  try {
    const { data: reserved, error: resErr } = await d.rpc("reserve_credits", {
      _user: input.userId,
      _amount: input.cost,
      _reason: input.reason,
      _ref: reservationRef,
    });
    if (resErr) throw new Error(resErr.message);
    if (!reserved) return { ok: false, error: "Insufficient credits", insufficient: true };
    reservedAmount = input.cost;

    const result = await d.orchestrate({
      kind: input.kind,
      prompt: input.prompt,
      imageUrls: input.imageUrls,
      audioUrl: input.audioUrl,
      videoUrl: input.videoUrl,
      duration: input.duration,
      resolution: input.resolution,
      model: input.model,
      params: input.params,
      comfyWorkflow: input.comfyWorkflow,
      comfyInputs: input.comfyInputs,
      segments: input.segments,
      userId: input.userId,
    });

    // Persist the provider URL into our own storage (compresses + re-hosts).
    // Falls back to the raw provider URL on error so a delivered render is
    // never lost; the raw URL is stored explicitly rather than silently.
    const mediaType = resultMediaTypeForKind(input.kind);
    const persistedUrl =
      mediaType && result.url
        ? (
            await persistResultUrl({
              userId: input.userId,
              refId: reservationRef,
              mediaType,
              url: result.url,
            })
          ).url
        : result.url;

    const gen = await d.insertGeneration({
      user_id: input.userId,
      prompt: input.prompt ?? "",
      kind: input.kind,
      mode: input.mode ?? "performance",
      status: "succeeded",
      input_images: input.imageUrls ?? [],
      // For the `audio` modality there is no input audio — store the generated
      // mp3 here; for lipsync this stays the driving (input) audio.
      audio_url: input.kind === "audio" ? persistedUrl : (input.audioUrl ?? null),
      model: result.provider,
      result_image_url: input.kind === "image" ? persistedUrl : null,
      result_video_url: input.kind === "video" || input.kind === "lipsync" || input.kind === "caption_burn" ? persistedUrl : null,
      result_text: input.kind === "text" ? (result.text ?? null) : null,
      credits_cost: input.cost,
      session_id: input.sessionId ?? null,
      agent_shot_id: input.agentShotId ?? null,
    });

    // Finalize the spend. A failed commit leaves credits_reserved stuck, so surface
    // it explicitly (the render itself already succeeded and was recorded).
    const { error: commitErr } = await d.rpc("commit_reservation", {
      _user: input.userId,
      _amount: reservedAmount,
      _reason: input.reason,
      _ref: reservationRef,
    });
    if (commitErr) {
      // The render and the generations row already succeeded; only the reserved-counter
      // cleanup failed. Releasing here would REFUND a delivered render, so mark there is
      // nothing to release and surface the error for manual credits_reserved reconciliation.
      reservedAmount = 0;
      throw new Error(
        `Render succeeded but the credit commit failed (reservation ${reservationRef}): ${commitErr.message}`,
      );
    }
    reservedAmount = 0;

    return {
      ok: true,
      generationId: gen.id,
      url: result.url,
      text: result.text,
      provider: result.provider,
      endpoint: result.endpoint,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
    };
  } catch (e) {
    if (reservedAmount > 0) {
      const { error: relErr } = await d.rpc("release_reservation", {
        _user: input.userId,
        _amount: reservedAmount,
        _reason: `release_${input.reason}`,
        _ref: reservationRef,
      });
      // Never swallow a release failure — that is a real credit leak. Surface both
      // the original error and the leak so it can be reconciled.
      if (relErr) {
        const original = e instanceof Error ? e.message : String(e);
        throw new Error(
          `${original}; additionally failed to release reservation ${reservationRef}: ${relErr.message}`,
        );
      }
    }
    throw e;
  }
}
