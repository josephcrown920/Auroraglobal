import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProviderHealthSnapshot, type GenerateKind } from "./orchestrator.server";
import { reserveOrchestrateRecord } from "./generate-core.server";
import { assertTrustedUrl } from "./url-guard";
import { providerHealth, providerStatus } from "./inference";
import { detectFeatures, computeCost, type Feature } from "./pricing";
import { assertDurationCap, assertHdEntitlement, assertDailyBudget } from "./cost-guardrails.server";

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

// ─── Billing bucket classification ────────────────────────────────────────
// Mirrors the orchestrator's own routing: "replit-*" adapters bill the
// owner's Replit AI Integrations credits, "runpod" is the self-hosted GPU
// worker pool (adapter name from orchestrator.server.ts's gpuWorker), and
// everything else is a paid external provider (Replicate, fal, ElevenLabs…).
type BillingBucket = "replit" | "gpu" | "paid";
function classifyBillingBucket(provider: string): BillingBucket {
  if (provider.startsWith("replit-") || provider.startsWith("replit/")) return "replit";
  if (provider === "runpod") return "gpu";
  return "paid";
}

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

    const hasReplitGemini =
      has("AI_INTEGRATIONS_GEMINI_API_KEY") && has("AI_INTEGRATIONS_GEMINI_BASE_URL");
    const hasReplitOpenAI =
      has("AI_INTEGRATIONS_OPENAI_API_KEY") && has("AI_INTEGRATIONS_OPENAI_BASE_URL");

    const providers: ProviderRow[] = [
      // image — order = orchestrator PRIORITY (Replit-first, Lovable LAST)
      {
        id: "replit-gemini-image",
        name: "Replit AI (Gemini image)",
        kind: "image",
        envKey: "AI_INTEGRATIONS_GEMINI_API_KEY",
        configured: hasReplitGemini,
        free: false,
        notes: "gemini-2.5-flash-image — billed to Replit credits (first in image chain)",
      },
      {
        id: "replit-openai-image",
        name: "Replit AI (GPT image)",
        kind: "image",
        envKey: "AI_INTEGRATIONS_OPENAI_API_KEY",
        configured: hasReplitOpenAI,
        free: false,
        notes: "gpt-image-1 — billed to Replit credits",
      },
      {
        id: "pollinations-image",
        name: "Pollinations",
        kind: "image",
        envKey: "",
        configured: true,
        free: true,
        notes: "turbo (no key — free image tier)",
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
        notes: "seedream-4",
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
        id: "xai",
        name: "xAI (Grok)",
        kind: "video",
        envKey: "XAI_API_KEY",
        configured: has("XAI_API_KEY"),
        free: false,
        notes: "Grok Imagine Video 1.5 — UGC fast path (script→talking-head, built-in lipsync)",
      },
      {
        id: "sora",
        name: "OpenAI Sora",
        kind: "video",
        envKey: "OPENAI_API_KEY",
        configured: has("OPENAI_API_KEY"),
        free: false,
        notes: "sora-2 · sora-2-pro — direct OpenAI API; async job queue",
      },
      {
        id: "ltx",
        name: "LTX Video (Lightricks)",
        kind: "video",
        envKey: "LTX_API_KEY",
        configured: has("LTX_API_KEY"),
        free: false,
        notes: "ltx-video — fast, affordable; add LTX_API_KEY to Secrets",
      },
      {
        id: "gemini-video",
        name: "Gemini (Veo 2)",
        kind: "video",
        envKey: "GEMINI_API_KEY",
        configured: has("GEMINI_API_KEY"),
        free: false,
        notes: "Veo 2 direct via Gemini API — no Replicate credits needed",
      },
      {
        id: "inference-sh-video",
        name: "inference.sh",
        kind: "video",
        envKey: "INFERENCE_SH_API_KEY",
        configured: has("INFERENCE_SH_API_KEY"),
        free: false,
        notes: "Requires INFERENCE_SH_APP_VIDEO env var pointing to your registered app",
      },
      {
        id: "byteplus-video",
        name: "ByteDance direct",
        kind: "video",
        envKey: "BYTEPLUS_API_KEY",
        configured: has("BYTEPLUS_API_KEY") || has("ARK_API_KEY"),
        free: false,
        notes: "Seedance (native ModelArk) — activate models in Ark Console first",
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
      // text (AI router) — Replit-first, mirrors PRIORITY.text
      {
        id: "replit-openai-text",
        name: "Replit AI (GPT text)",
        kind: "text",
        envKey: "AI_INTEGRATIONS_OPENAI_API_KEY",
        configured: hasReplitOpenAI,
        free: false,
        notes: "gpt-5-nano — billed to Replit credits (first in text chain)",
      },
      {
        id: "replit-gemini-text",
        name: "Replit AI (Gemini text)",
        kind: "text",
        envKey: "AI_INTEGRATIONS_GEMINI_API_KEY",
        configured: hasReplitGemini,
        free: false,
        notes: "gemini-2.5-flash — billed to Replit credits",
      },
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
        id: "anthropic",
        name: "Anthropic (Claude)",
        kind: "text",
        envKey: "ANTHROPIC_API_KEY",
        configured: has("ANTHROPIC_API_KEY"),
        free: false,
        notes: "claude-sonnet-4-5 · claude-haiku-4-5 (direct)",
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
      // audio / TTS — Replit-first, mirrors PRIORITY.audio
      {
        id: "replit-openai-audio",
        name: "Replit AI (TTS)",
        kind: "audio",
        envKey: "AI_INTEGRATIONS_OPENAI_API_KEY",
        configured: hasReplitOpenAI,
        free: false,
        notes: "gpt-audio-mini — billed to Replit credits (first in audio chain)",
      },
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

    // Aggregate stats per provider, and roll them up into Replit-credits vs.
    // self-hosted GPU vs. paid-external buckets so the owner can see at a
    // glance how much generation volume is running on their Replit credits.
    const stats: Record<string, { ok: number; err: number; avgMs: number; cost: number }> = {};
    const billingSummary: Record<BillingBucket, { ok: number; err: number; cost: number }> = {
      replit: { ok: 0, err: 0, cost: 0 },
      gpu: { ok: 0, err: 0, cost: 0 },
      paid: { ok: 0, err: 0, cost: 0 },
    };
    for (const l of logs ?? []) {
      const s = (stats[l.provider] ??= { ok: 0, err: 0, avgMs: 0, cost: 0 });
      if (l.status === "ok") s.ok++;
      else s.err++;
      s.avgMs = (s.avgMs * (s.ok + s.err - 1) + (l.latency_ms ?? 0)) / (s.ok + s.err);
      s.cost += Number(l.cost_usd ?? 0);

      const b = billingSummary[classifyBillingBucket(l.provider)];
      if (l.status === "ok") b.ok++;
      else b.err++;
      b.cost += Number(l.cost_usd ?? 0);
    }

    const health = getProviderHealthSnapshot();
    const providersWithHealth = providers.map((p) => {
      // map dashboard id → orchestrator adapter name
      const adapterName =
        p.id === "gemini"
          ? "gemini"
          : p.id === "lovable"
            ? "lovable"
            : p.id === "sync"
                ? "sync"
                : p.id === "kling-direct"
                  ? "kling"
                  : p.id === "pollinations-image"
                    ? "pollinations"
                    : p.id === "fal-video" || p.id === "fal-lipsync"
                      ? "fal"
                      : p.id === "xai"
                        ? "xai"
                        : p.id === "gemini-video"
                          ? "gemini-video"
                          : p.id === "inference-sh-video"
                            ? "inference-sh"
                            : p.id.startsWith("byteplus")
                              ? "byteplus"
                              : p.id.startsWith("replicate")
                                ? "replicate"
                                : p.id;
      const h = health[adapterName];
      return {
        ...p,
        billing: classifyBillingBucket(p.id),
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
      billingSummary,
    };
  });

// ─── Provider credit balances ────────────────────────────────────────────────
// Live balance / quota fetch for each paid AI provider.
// Providers without a public balance API return hasBalanceApi:false.

export type ProviderCreditRow = {
  id: string;
  name: string;
  configured: boolean;
  hasBalanceApi: boolean;
  balance: number | null;
  limitTotal: number | null;
  unit: string | null;
  status: "ok" | "low" | "empty" | "error" | "unconfigured" | "no-api";
  error?: string;
  dashboardUrl: string;
};

function creditStatus(
  balance: number | null,
  lowThreshold: number
): "ok" | "low" | "empty" {
  if (balance === null) return "ok";
  if (balance <= 0) return "empty";
  if (balance < lowThreshold) return "low";
  return "ok";
}

function noApiProvider(
  id: string,
  name: string,
  envKey: string | string[],
  dashboardUrl: string
): ProviderCreditRow {
  const configured = Array.isArray(envKey)
    ? envKey.some((k) => !!process.env[k])
    : !!process.env[envKey];
  return {
    id,
    name,
    configured,
    hasBalanceApi: false,
    balance: null,
    limitTotal: null,
    unit: null,
    status: configured ? "no-api" : "unconfigured",
    dashboardUrl,
  };
}

async function checkHeyGen(): Promise<ProviderCreditRow> {
  const key = process.env.HEYGEN_API_KEY;
  const base = {
    id: "heygen",
    name: "HeyGen",
    configured: !!key,
    hasBalanceApi: true,
    unit: "API credits",
    dashboardUrl: "https://app.heygen.com/settings?nav=Api",
  };
  if (!key) return { ...base, balance: null, limitTotal: null, status: "unconfigured" };
  try {
    const res = await fetch("https://api.heygen.com/v2/user/remaining_quota", {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ...base, balance: null, limitTotal: null, status: "error", error: `HTTP ${res.status}` };
    const j = await res.json() as { code?: number; data?: { remaining_quota?: number } };
    const balance = j.data?.remaining_quota ?? null;
    return { ...base, balance, limitTotal: null, status: balance !== null ? creditStatus(balance, 10) : "error" };
  } catch (err) {
    return { ...base, balance: null, limitTotal: null, status: "error", error: String(err) };
  }
}

async function checkOpenRouter(): Promise<ProviderCreditRow> {
  const key = process.env.OPENROUTER_API_KEY;
  const base = {
    id: "openrouter",
    name: "OpenRouter",
    configured: !!key,
    hasBalanceApi: true,
    unit: "$USD",
    dashboardUrl: "https://openrouter.ai/settings/credits",
  };
  if (!key) return { ...base, balance: null, limitTotal: null, status: "unconfigured" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ...base, balance: null, limitTotal: null, status: "error", error: `HTTP ${res.status}` };
    const j = await res.json() as { data?: { limit?: number | null; usage?: number } };
    const d = j.data;
    if (!d) return { ...base, balance: null, limitTotal: null, status: "error", error: "No data" };
    if (d.limit == null) return { ...base, balance: null, limitTotal: null, status: "ok" };
    const balance = d.limit - (d.usage ?? 0);
    return { ...base, balance, limitTotal: d.limit, status: creditStatus(balance, 5) };
  } catch (err) {
    return { ...base, balance: null, limitTotal: null, status: "error", error: String(err) };
  }
}

async function checkElevenLabs(): Promise<ProviderCreditRow> {
  const key = process.env.ELEVENLABS_API_KEY;
  const base = {
    id: "elevenlabs",
    name: "ElevenLabs",
    configured: !!key,
    hasBalanceApi: true,
    unit: "chars",
    dashboardUrl: "https://elevenlabs.io/subscription",
  };
  if (!key) return { ...base, balance: null, limitTotal: null, status: "unconfigured" };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ...base, balance: null, limitTotal: null, status: "error", error: `HTTP ${res.status}` };
    const j = await res.json() as { character_count?: number; character_limit?: number };
    const used = j.character_count ?? null;
    const limit = j.character_limit ?? null;
    const balance = used !== null && limit !== null ? limit - used : null;
    return { ...base, balance, limitTotal: limit, status: creditStatus(balance, 10_000) };
  } catch (err) {
    return { ...base, balance: null, limitTotal: null, status: "error", error: String(err) };
  }
}

async function checkReplicate(): Promise<ProviderCreditRow> {
  const key =
    process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY ?? process.env.REPLICATE_API_KEY;
  const base = {
    id: "replicate",
    name: "Replicate",
    configured: !!key,
    hasBalanceApi: false,
    unit: null,
    dashboardUrl: "https://replicate.com/account/billing",
  };
  if (!key) return { ...base, balance: null, limitTotal: null, status: "unconfigured" };
  try {
    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Token ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ...base, balance: null, limitTotal: null, status: "error", error: `HTTP ${res.status}` };
    return { ...base, balance: null, limitTotal: null, status: "no-api" };
  } catch (err) {
    return { ...base, balance: null, limitTotal: null, status: "error", error: String(err) };
  }
}

async function checkFal(): Promise<ProviderCreditRow> {
  const key = process.env.FAL_KEY;
  const base = {
    id: "fal",
    name: "fal.ai",
    configured: !!key,
    hasBalanceApi: false,
    unit: null,
    dashboardUrl: "https://fal.ai/dashboard/billing",
  };
  if (!key) return { ...base, balance: null, limitTotal: null, status: "unconfigured" };
  try {
    const res = await fetch("https://rest.alpha.fal.ai/auth/api-keys/current", {
      headers: { Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return {
      ...base,
      balance: null,
      limitTotal: null,
      status: res.ok ? "no-api" : "error",
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { ...base, balance: null, limitTotal: null, status: "error", error: String(err) };
  }
}

export const providerCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");

    const results = await Promise.allSettled([
      checkHeyGen(),
      checkOpenRouter(),
      checkElevenLabs(),
      checkReplicate(),
      checkFal(),
    ]);

    const settled = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === "fulfilled" ? r.value : fallback;

    const providers: ProviderCreditRow[] = [
      settled(results[0], noApiProvider("heygen", "HeyGen", "HEYGEN_API_KEY", "https://app.heygen.com/settings?nav=Api")),
      settled(results[1], noApiProvider("openrouter", "OpenRouter", "OPENROUTER_API_KEY", "https://openrouter.ai/settings/credits")),
      settled(results[2], noApiProvider("elevenlabs", "ElevenLabs", "ELEVENLABS_API_KEY", "https://elevenlabs.io/subscription")),
      settled(results[3], noApiProvider("replicate", "Replicate", ["REPLICATE_API_KEY", "LOVABLE_CONNECTOR_REPLICATE_API_KEY"], "https://replicate.com/account/billing")),
      settled(results[4], noApiProvider("fal", "fal.ai", "FAL_KEY", "https://fal.ai/dashboard/billing")),
      noApiProvider("anthropic", "Anthropic", "ANTHROPIC_API_KEY", "https://console.anthropic.com/billing"),
      noApiProvider("xai", "xAI (Grok)", "XAI_API_KEY", "https://console.x.ai"),
      noApiProvider("byteplus", "BytePlus", ["BYTEPLUS_API_KEY", "ARK_API_KEY"], "https://console.byteplus.com"),
      noApiProvider("runway", "Runway", "RUNWAY_API_KEY", "https://app.runwayml.com/account"),
      noApiProvider("gemini", "Gemini", "GEMINI_API_KEY", "https://aistudio.google.com"),
      noApiProvider("groq", "Groq", "GROQ_API_KEY", "https://console.groq.com/settings/billing"),
      noApiProvider("sync", "Sync.so", "SYNC_API_KEY", "https://app.sync.so/dashboard"),
      noApiProvider("huggingface", "HuggingFace", "HF_TOKEN", "https://huggingface.co/settings/tokens"),
    ];

    const alerts = providers.filter(
      (p) => p.status === "low" || p.status === "empty" || p.status === "error"
    );

    return {
      providers,
      checkedAt: new Date().toISOString(),
      alertCount: alerts.length,
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
  duration: z.number().int().min(3).max(15).optional(),
  resolution: z.enum(["480p", "720p", "1080p", "2160p"]).optional(),
  model: z.string().max(120).optional(),
  voiceId: z.string().max(120).optional(),
  // HeyGen Video Agent (task #274): portrait vs landscape avatar video. The
  // heygen adapter reads r.params.orientation; other providers ignore it.
  orientation: z.enum(["landscape", "portrait"]).optional(),
  // Preview pass: generate at 480p/5s before the full-quality render.
  previewOnly: z.boolean().optional(),
  // Preview-confirm gate (task #153): id of a succeeded preview generation the
  // caller owns. Without it, temporal kinds are forced into a preview pass.
  confirmPreviewId: z.string().uuid().optional(),
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
  resolution: z.enum(["480p", "720p", "1080p", "2160p"]).optional(),
  // Keep the quote window identical to the executable charge path (OrchestrateSchema)
  // so a preview can never quote a length the generation would reject.
  duration: z.number().int().min(3).max(15).optional(),
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

    // Duration cap: enforce per-plan max before reserving credits.
    // Throws a terminal "Unsupported duration…" error if the user's plan doesn't
    // allow this length — credits are never reserved and no provider is called.
    const isTemporalKind = kind === "video" || (kind as string) === "motion";
    if (isTemporalKind && data.duration && data.duration > 0) {
      await assertDurationCap(context.userId, data.duration);
    }

    // Preview mode: override to 480p/5s so the user can verify the scene cheaply
    // before committing to a full expensive render. Priced at 480p/5s cost.
    // The preview-confirm gate (task #153) makes this MANDATORY for temporal
    // kinds: without a valid confirmPreviewId the render is forced into a
    // preview pass even if the caller didn't ask for one. An invalid/expired
    // id throws (terminal) — it never silently up- or downgrades the render.
    let previewOnly = !!data.previewOnly && isTemporalKind;
    if (isTemporalKind && !previewOnly) {
      const { resolvePreviewGate } = await import("./cost-guardrails.server");
      const gate = await resolvePreviewGate({
        userId: context.userId,
        confirmPreviewId: data.confirmPreviewId,
      });
      if (!gate.confirmed) previewOnly = true;
    }
    const effDuration = previewOnly ? Math.min(data.duration ?? 5, 5) : data.duration;
    const effResolution: "480p" | "720p" | "1080p" | "2160p" | undefined = previewOnly
      ? "480p"
      : data.resolution;

    // HD/4K entitlement: 1080p and 2160p require Pro on full (non-preview) renders.
    await assertHdEntitlement(context.userId, data.resolution, previewOnly);

    const { features } = detectFeatures({ kind: kind as Feature, features: data.features });
    const quote = computeCost({
      features,
      resolution: effResolution,
      durationSeconds: effDuration,
      model: data.model,
    });
    const cost = quote.total;

    // Daily Aura cap: friendly early check before we reserve credits or call a
    // provider. The reserve_credits() RPC enforces this for real (race-free);
    // this just gives a clear error sooner for the common case.
    await assertDailyBudget(context.userId, cost);

    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind,
      prompt: data.prompt,
      imageUrls: data.imageUrls,
      duration: effDuration,
      resolution: effResolution,
      model: data.model,
      params:
        data.voiceId || data.orientation
          ? {
              ...(data.voiceId ? { voiceId: data.voiceId } : {}),
              ...(data.orientation ? { orientation: data.orientation } : {}),
            }
          : undefined,
      cost,
      reason: previewOnly ? `orchestrate_${kind}_preview` : `orchestrate_${kind}`,
      mode: previewOnly ? "preview" : undefined,
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
      ...(previewOnly ? { preview: true as const, previewGenerationId: outcome.generationId } : {}),
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
