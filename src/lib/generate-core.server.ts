// Shared synchronous render core: reserve credits → orchestrate → record the
// generation → commit (or release on failure). Single source of truth for the
// credit flow so the public /api/public/generate endpoint and the Aurora Agent
// per-shot renderer never drift apart.
//
// Task #214: the generation INSERT and the credit commit are now folded into a
// single Postgres function (finalize_sync_render). Postgres runs the whole body
// in one transaction, so any error anywhere rolls back both the generations row
// and the ledger entries — the result record and the credit ledger can never
// diverge due to a mid-finish crash. The prior pattern (insertGeneration then
// commit_reservation as two separate calls) had a crash window between them.
//
// Failure path: if finalize_sync_render returns an error, the Postgres
// transaction aborted — no generation was written and no reservation was
// committed. The catch block can therefore safely release the reservation and
// return the credits to the user.
//
// Supabase RPCs resolve with an `{ error }` object instead of throwing, so EVERY
// credit call (reserve / finalize / release) inspects `error` explicitly — a
// silently-ignored error would leak `credits_reserved` while reporting success.
// The credit + render surface is injectable (`deps`) so the whole flow is
// unit-testable without a live database or provider.
import { orchestrate, type GenerateKind } from "@/lib/orchestrator.server";
import { persistResultUrl, resultMediaTypeForKind } from "./result-store.server";

type RpcResult = { data: unknown; error: { message: string } | null };

export type RenderDeps = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  orchestrate: typeof orchestrate;
  /** Injectable result persistence (omit to use the real result-store implementation). */
  persistUrl?: typeof persistResultUrl;
  /** Injectable daily-budget guard (omit to use live Supabase; inject in tests). */
  dailyBudget?: import("./cost-guardrails.server").DailyBudgetDeps;
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
  /** Strict photo-edit mode — see GenerateRequest.editStrict in the orchestrator. */
  editStrict?: boolean;
  /** Pinned-only model routing — see GenerateRequest.pinnedModelOnly. A failed
   *  pinned render must fail (and refund), never fall back to another model. */
  pinnedModelOnly?: boolean;
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
  /** Aspect ratio forwarded to the provider (e.g. "16:9", "9:16", "1:1"). */
  aspectRatio?: string;
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
    persistUrl: persistResultUrl,
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
      editStrict: input.editStrict,
      pinnedModelOnly: input.pinnedModelOnly,
      params: input.params,
      comfyWorkflow: input.comfyWorkflow,
      comfyInputs: input.comfyInputs,
      segments: input.segments,
      aspectRatio: input.aspectRatio,
      userId: input.userId,
    });

    // Persist the provider URL into our own storage (compresses + re-hosts).
    // Falls back to the raw provider URL on error so a delivered render is
    // never lost; the raw URL is stored explicitly rather than silently.
    const mediaType = resultMediaTypeForKind(input.kind);
    const persistedUrl =
      mediaType && result.url
        ? (
            await (d.persistUrl ?? persistResultUrl)({
              userId: input.userId,
              refId: reservationRef,
              mediaType,
              url: result.url,
            })
          ).url
        : result.url;

    // Atomically record the succeeded generation and commit the credit
    // reservation in one Postgres transaction (finalize_sync_render).
    //
    // If this RPC returns an error, Postgres rolled back both the generations
    // INSERT and the commit_reservation ledger entries — nothing was written.
    // The catch block will then safely release the reservation so the user
    // gets their credits back. This closes the crash window that existed when
    // insertGeneration and commit_reservation were separate calls.
    const { data: genId, error: finalizeErr } = await d.rpc("finalize_sync_render", {
      _user_id: input.userId,
      _prompt: input.prompt ?? "",
      _kind: input.kind,
      _mode: input.mode ?? "performance",
      _input_images: input.imageUrls ?? [],
      _audio_url: input.kind === "audio" ? (persistedUrl ?? null) : (input.audioUrl ?? null),
      _model: result.provider,
      _result_image_url: input.kind === "image" ? (persistedUrl ?? null) : null,
      _result_video_url:
        input.kind === "video" ||
        input.kind === "lipsync" ||
        input.kind === "caption_burn" ||
        input.kind === "lyric_video"
          ? (persistedUrl ?? null)
          : null,
      _result_text: input.kind === "text" ? (result.text ?? null) : null,
      _credits_cost: input.cost,
      _session_id: input.sessionId ?? null,
      _agent_shot_id: input.agentShotId ?? null,
      _amount: reservedAmount,
      _reason: input.reason,
      _ref: reservationRef,
    });
    if (finalizeErr) {
      // The Postgres transaction aborted — the generation row was NOT written
      // and the reservation was NOT committed. Throw so the catch block releases
      // the reservation and the user gets their credits back.
      throw new Error(
        `Failed to record render result and commit credits (reservation ${reservationRef}): ${finalizeErr.message}`,
      );
    }
    // Both the generation write and the credit commit succeeded atomically.
    reservedAmount = 0;

    return {
      ok: true,
      generationId: genId as string,
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
