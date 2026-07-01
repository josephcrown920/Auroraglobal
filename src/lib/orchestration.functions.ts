import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProviderHealthSnapshot, type GenerateKind } from "./orchestrator.server";
import { reserveOrchestrateRecord } from "./generate-core.server";
import { assertTrustedUrl } from "./url-guard";
import { providerHealth, providerStatus } from "./inference";
import { detectFeatures, computeCost, type Feature } from "./pricing";

// ─── Provider health (which keys are configured) ─────────────────────────────
// Mirrors the priority chains in src/lib/orchestrator.server.ts.

type ProviderRow = {
  id: string;
  name: string;
  kind: "image" | "video" | "lipsync" | "inference" | "text" | "audio";
  envKey: string;
  configured: boolean;
  free: boolean;
  notes?: string;
};

export const orchestrationHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin gate
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden");

    const has = (k: string) => Boolean(process.env[k]);
    const hasReplicate = has("LOVABLE_CONNECTOR_REPLICATE_API_KEY") || has("REPLICATE_API_KEY");

    const providers: ProviderRow[] = [
      // image — order = orchestrator PRIORITY (Lovable LAST)
      {
        id: "pollinations-image",
        name: "Pollinations",
        kind: "image",
        envKey: "",
        configured: true,
        free: true,
        notes: "flux (no key — first in image chain)",
      },
      {
        id: "gemini",
        name: "Gemini direct",
        kind: "image",
        envKey: "GEMINI_API_KEY",
        configured: has("GEMINI_API_KEY"),
        free: true,
        notes: "gemini-2.5-flash-image-preview (free tier)",
      },
      {
        id: "hf",
        name: "HuggingFace Inference",
        kind: "image",
        envKey: "HF_TOKEN",
        configured: has("HF_TOKEN"),
        free: true,
        notes: "flux-schnell · sdxl",
      },
      {
        id: "runware",
        name: "Runware",
        kind: "image",
        envKey: "RUNWARE_API_KEY",
        configured: has("RUNWARE_API_KEY"),
        free: false,
        notes: "flux-schnell (cheap hosted)",
      },
      {
        id: "byteplus-image",
        name: "ByteDance direct",
        kind: "image",
        envKey: "BYTEPLUS_API_KEY",
        configured: has("BYTEPLUS_API_KEY") || has("ARK_API_KEY"),
        free: false,
        notes: "Seedream (native ModelArk) — preferred over Replicate for Seed models",
      },
      {
        id: "replicate-image",
        name: "Replicate",
        kind: "image",
        envKey: "LOVABLE_CONNECTOR_REPLICATE_API_KEY",
        configured: hasReplicate,
        free: false,
        notes: "seedream-4 · flux-schnell",
      },
      {
        id: "lovable",
        name: "Lovable AI (last)",
        kind: "image",
        envKey: "LOVABLE_API_KEY",
        configured: has("LOVABLE_API_KEY"),
        free: false,
        notes: "fallback only — credits used last",
      },
      // video
      {
        id: "byteplus-video",
        name: "ByteDance direct",
        kind: "video",
        envKey: "BYTEPLUS_API_KEY",
        configured: has("BYTEPLUS_API_KEY") || has("ARK_API_KEY"),
        free: false,
        notes: "Seedance (native ModelArk) — preferred over Replicate for Seed models",
      },
      {
        id: "replicate-video",
        name: "Replicate",
        kind: "video",
        envKey: "LOVABLE_CONNECTOR_REPLICATE_API_KEY",
        configured: hasReplicate,
        free: false,
        notes: "kling-v2.1 · seedance-1-pro/lite",
      },
      {
        id: "kling-direct",
        name: "Kling direct",
        kind: "video",
        envKey: "KLING_ACCESS_KEY",
        configured: has("KLING_ACCESS_KEY") && has("KLING_SECRET_KEY"),
        free: false,
        notes: "JWT — explicit kling requests only",
      },
      {
        id: "runway",
        name: "Runway",
        kind: "video",
        envKey: "RUNWAY_API_KEY",
        configured: has("RUNWAY_API_KEY"),
        free: false,
        notes: "gen4-turbo · gen3a-turbo (image-to-video)",
      },
      {
        id: "fal-video",
        name: "fal.ai",
        kind: "video",
        envKey: "FAL_KEY",
        configured: has("FAL_KEY"),
        free: false,
        notes: "final fallback only",
      },
      // lipsync
      {
        id: "sync",
        name: "Sync.so",
        kind: "lipsync",
        envKey: "SYNC_API_KEY",
        configured: has("SYNC_API_KEY"),
        free: false,
        notes: "lipsync-2 (primary)",
      },
      {
        id: "replicate-lipsync",
        name: "Replicate",
        kind: "lipsync",
        envKey: "LOVABLE_CONNECTOR_REPLICATE_API_KEY",
        configured: hasReplicate,
        free: false,
        notes: "sync/lipsync-2 · cog-wav2lip (fallback)",
      },
      {
        id: "fal-lipsync",
        name: "fal.ai",
        kind: "lipsync",
        envKey: "FAL_KEY",
        configured: has("FAL_KEY"),
        free: false,
        notes: "final fallback only",
      },
      // text (AI router)
      {
        id: "pollinations",
        name: "Pollinations",
        kind: "text",
        envKey: "",
        configured: true,
        free: true,
        notes: "openai model (no key — first in text chain)",
      },
      {
        id: "groq",
        name: "Groq",
        kind: "text",
        envKey: "GROQ_API_KEY",
        configured: has("GROQ_API_KEY"),
        free: false,
        notes: "llama-3.3-70b-versatile",
      },
      {
        id: "gemini-text",
        name: "Gemini text",
        kind: "text",
        envKey: "GEMINI_API_KEY",
        configured: has("GEMINI_API_KEY"),
        free: false,
        notes: "gemini-2.0-flash",
      },
      {
        id: "mistral",
        name: "Mistral",
        kind: "text",
        envKey: "MISTRAL_API_KEY",
        configured: has("MISTRAL_API_KEY"),
        free: false,
        notes: "mistral-small-latest",
      },
      {
        id: "openai",
        name: "OpenAI direct",
        kind: "text",
        envKey: "OPENAI_API_KEY",
        configured: has("OPENAI_API_KEY"),
        free: false,
        notes: "gpt-4o-mini",
      },
      {
        id: "hf-text",
        name: "HuggingFace text",
        kind: "text",
        envKey: "HF_TOKEN",
        configured: has("HF_TOKEN"),
        free: false,
        notes: "Llama-3.1-8B-Instruct",
      },
      {
        id: "lovable-text",
        name: "Lovable AI Gateway",
        kind: "text",
        envKey: "LOVABLE_API_KEY",
        configured: has("LOVABLE_API_KEY"),
        free: false,
        notes: "fallback only — credits used last",
      },
      // audio / TTS
      {
        id: "elevenlabs",
        name: "ElevenLabs",
        kind: "audio",
        envKey: "ELEVENLABS_API_KEY",
        configured: has("ELEVENLABS_API_KEY"),
        free: false,
        notes: "eleven_multilingual_v2 (else GPU tts worker)",
      },
    ];

    // GPU workers (admin-registered) — always last in every chain
    const { data: workers } = await supabaseAdmin
      .from("gpu_workers")
      .select("id,name,status,capabilities,in_flight,max_concurrency,last_heartbeat,priority")
      .order("priority", { ascending: true });

    // Recent provider activity (last 200 calls, last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("provider_logs")
      .select("provider,endpoint,kind,status,latency_ms,cost_usd,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    // Aggregate stats per provider
    const stats: Record<string, { ok: number; err: number; avgMs: number; cost: number }> = {};
    for (const l of logs ?? []) {
      const s = (stats[l.provider] ??= { ok: 0, err: 0, avgMs: 0, cost: 0 });
      if (l.status === "ok") s.ok++;
      else s.err++;
      s.avgMs = (s.avgMs * (s.ok + s.err - 1) + (l.latency_ms ?? 0)) / (s.ok + s.err);
      s.cost += Number(l.cost_usd ?? 0);
    }

    const health = getProviderHealthSnapshot();
    const providersWithHealth = providers.map((p) => {
      // map dashboard id → orchestrator adapter name
      const adapterName =
        p.id === "gemini"
          ? "gemini"
          : p.id === "lovable"
            ? "lovable"
            : p.id === "hf"
              ? "huggingface"
              : p.id === "sync"
                ? "sync"
                : p.id === "kling-direct"
                  ? "kling"
                  : p.id === "pollinations-image"
                    ? "pollinations"
                    : p.id === "fal-video" || p.id === "fal-lipsync"
                      ? "fal"
                      : p.id.startsWith("byteplus")
                        ? "byteplus"
                        : p.id.startsWith("replicate")
                          ? "replicate"
                          : p.id;
      const h = health[adapterName];
      return {
        ...p,
        ready: p.configured && (h?.ready ?? true),
        failures: h?.failures ?? 0,
        cooldownMs: h?.cooldownMs ?? 0,
      };
    });

    const summary = {
      total: providers.length,
      configured: providers.filter((p) => p.configured).length,
      missing: providers.filter((p) => !p.configured).length,
      ready: providersWithHealth.filter((p) => p.ready).length,
      workers: workers?.length ?? 0,
      activeWorkers: workers?.filter((w) => w.status === "active").length ?? 0,
    };

    // Env-based pluggable GPU backends (standalone inference/ layer). Reports
    // which backends (runpod/huggingface/custom/vast/comfyui) are configured via
    // env, what they're missing, which tasks each can serve, and a live health
    // probe of the configured ones (unconfigured → no probe, no network call).
    const gpuStatus = providerStatus();
    const gpuHealthMap = await providerHealth();
    const gpuBackends = gpuStatus.map((b) => {
      const h = gpuHealthMap[b.id];
      const health: "online" | "offline" | "unconfigured" | "unknown" = !b.configured
        ? "unconfigured"
        : h == null
          ? "unknown"
          : h.ok
            ? "online"
            : "offline";
      return {
        ...b,
        health,
        healthDetail: h?.error ?? (typeof h?.status === "number" ? `HTTP ${h.status}` : undefined),
      };
    });

    return {
      providers: providersWithHealth,
      workers: workers ?? [],
      stats,
      summary,
      recent: (logs ?? []).slice(0, 50),
      gpuBackends,
    };
  });

// ─── AI Router: generate via the unified orchestrator ────────────────────────
// Authenticated entry point used by the /orchestrate page. Reuses the shared
// reserve → orchestrate → record → commit core so credits + provider fallback
// behave exactly like the public API.
const OrchestrateSchema = z.object({
  kind: z.enum(["image", "video", "text", "audio"]),
  prompt: z.string().max(4000).optional(),
  imageUrls: z.array(z.string().url()).max(6).optional(),
  duration: z.number().int().min(3).max(12).optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  model: z.string().max(120).optional(),
  voiceId: z.string().max(120).optional(),
  // Stacked-pricing override: force the exact set of billable features.
  features: z
    .array(z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]))
    .optional(),
});

// ─── AI Router: price quote (compute-only, no credits reserved) ───────────────
// Lets the UI / API consumers preview the itemized stacked cost before running.
// Uses the SAME pricing module as the charge path, so the preview always equals
// what orchestrateGenerate / the public API will actually reserve.
const QuoteSchema = z.object({
  kind: z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  // Keep the quote window identical to the executable charge path (OrchestrateSchema)
  // so a preview can never quote a length the generation would reject.
  duration: z.number().int().min(3).max(12).optional(),
  // Tiers the video/lip-sync base so the preview matches the model the user picks.
  model: z.string().max(120).optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  cameraMovement: z.string().max(60).optional(),
  features: z
    .array(z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]))
    .optional(),
});

export const quoteGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuoteSchema.parse(d))
  .handler(async ({ data }) => {
    const { features, primaryKind } = detectFeatures({
      kind: data.kind as Feature,
      audioUrl: data.audioUrl,
      videoUrl: data.videoUrl,
      cameraMovement: data.cameraMovement,
      features: data.features,
    });
    const quote = computeCost({
      features,
      resolution: data.resolution,
      durationSeconds: data.duration,
      model: data.model,
    });
    return { ...quote, features, primaryKind };
  });

export const orchestrateGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrchestrateSchema.parse(d))
  .handler(async ({ context, data }) => {
    // SSRF guard for any reference image URLs.
    for (const url of data.imageUrls ?? []) assertTrustedUrl(url);

    const kind = data.kind as GenerateKind;
    const { features } = detectFeatures({ kind: kind as Feature, features: data.features });
    const quote = computeCost({
      features,
      resolution: data.resolution,
      durationSeconds: data.duration,
      model: data.model,
    });
    const cost = quote.total;
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind,
      prompt: data.prompt,
      imageUrls: data.imageUrls,
      duration: data.duration,
      resolution: data.resolution,
      model: data.model,
      params: data.voiceId ? { voiceId: data.voiceId } : undefined,
      cost,
      reason: `orchestrate_${kind}`,
    });
    if (!outcome.ok) {
      return {
        ok: false as const,
        error: outcome.error,
        insufficient: outcome.insufficient ?? false,
      };
    }
    return {
      ok: true as const,
      generationId: outcome.generationId,
      url: outcome.url,
      text: outcome.text ?? null,
      provider: outcome.provider,
      endpoint: outcome.endpoint,
      latencyMs: outcome.latencyMs,
      costUsd: outcome.costUsd,
      creditsCost: cost,
      costBreakdown: quote.breakdown,
    };
  });

// ─── AI Router: list the caller's recent orchestrations ──────────────────────
export const listOrchestrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await supabaseAdmin
      .from("generations")
      .select(
        "id,kind,prompt,model,status,result_image_url,result_video_url,audio_url,result_text,credits_cost,created_at",
      )
      .eq("user_id", context.userId)
      .in("kind", ["image", "video", "text", "audio"])
      .order("created_at", { ascending: false })
      .limit(24);
    return { items: rows ?? [] };
  });
