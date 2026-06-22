import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProviderHealthSnapshot } from "./orchestrator.server";

// ─── Provider health (which keys are configured) ─────────────────────────────
// Mirrors the priority chains in src/lib/orchestrator.server.ts.

type ProviderRow = {
  id: string;
  name: string;
  kind: "image" | "video" | "lipsync" | "inference";
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
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden");

    const has = (k: string) => Boolean(process.env[k]);
    const hasReplicate = has("LOVABLE_CONNECTOR_REPLICATE_API_KEY") || has("REPLICATE_API_KEY");

    const providers: ProviderRow[] = [
      // image — order = orchestrator PRIORITY (Lovable LAST)
      { id: "gemini",          name: "Gemini direct",           kind: "image",     envKey: "GEMINI_API_KEY",                       configured: has("GEMINI_API_KEY"),            free: true,  notes: "gemini-2.5-flash-image-preview (free tier)" },
      { id: "replicate-image", name: "Replicate",               kind: "image",     envKey: "LOVABLE_CONNECTOR_REPLICATE_API_KEY",  configured: hasReplicate,                     free: false, notes: "seedream-4 · flux-schnell" },
      { id: "hf",              name: "HuggingFace Inference",   kind: "image",     envKey: "HF_TOKEN",                             configured: has("HF_TOKEN"),                  free: true,  notes: "flux-schnell · sdxl" },
      { id: "lovable",         name: "Lovable AI (last)",       kind: "image",     envKey: "LOVABLE_API_KEY",                      configured: has("LOVABLE_API_KEY"),           free: false, notes: "fallback only — credits used last" },
      // video
      { id: "replicate-video", name: "Replicate",               kind: "video",     envKey: "LOVABLE_CONNECTOR_REPLICATE_API_KEY",  configured: hasReplicate,                     free: false, notes: "kling-v2.1 · seedance-1-pro/lite" },
      { id: "kling-direct",    name: "Kling direct",            kind: "video",     envKey: "KLING_ACCESS_KEY",                     configured: has("KLING_ACCESS_KEY") && has("KLING_SECRET_KEY"), free: false, notes: "JWT — not yet wired into orchestrator" },
      { id: "fal-video",       name: "fal.ai",                  kind: "video",     envKey: "FAL_KEY",                              configured: has("FAL_KEY"),                   free: false, notes: "not yet wired into orchestrator" },
      // lipsync
      { id: "sync",            name: "Sync.so",                 kind: "lipsync",   envKey: "SYNC_API_KEY",                         configured: has("SYNC_API_KEY"),              free: false, notes: "lipsync-2 (primary)" },
      { id: "replicate-lipsync", name: "Replicate",             kind: "lipsync",   envKey: "LOVABLE_CONNECTOR_REPLICATE_API_KEY",  configured: hasReplicate,                     free: false, notes: "sync-1.6.0 · wav2lip (fallback)" },
      { id: "fal-lipsync",     name: "fal.ai",                  kind: "lipsync",   envKey: "FAL_KEY",                              configured: has("FAL_KEY"),                   free: false, notes: "not yet wired into orchestrator" },
      // inference (text)
      { id: "openrouter",      name: "OpenRouter",              kind: "inference", envKey: "OPENROUTER_API_KEY",                   configured: has("OPENROUTER_API_KEY"),        free: false, notes: "preferred text gateway (cheap)" },
      { id: "openai",          name: "OpenAI direct",           kind: "inference", envKey: "OPENAI_API_KEY",                       configured: has("OPENAI_API_KEY"),            free: false, notes: "gpt-4o · gpt-4o-mini" },
      { id: "lovable-text",    name: "Lovable AI Gateway",      kind: "inference", envKey: "LOVABLE_API_KEY",                      configured: has("LOVABLE_API_KEY"),           free: false, notes: "fallback only — credits used last" },
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
      const s = stats[l.provider] ??= { ok: 0, err: 0, avgMs: 0, cost: 0 };
      if (l.status === "ok") s.ok++; else s.err++;
      s.avgMs = (s.avgMs * (s.ok + s.err - 1) + (l.latency_ms ?? 0)) / (s.ok + s.err);
      s.cost += Number(l.cost_usd ?? 0);
    }

    const health = getProviderHealthSnapshot();
    const providersWithHealth = providers.map((p) => {
      // map dashboard id → orchestrator adapter name
      const adapterName =
        p.id === "gemini" ? "gemini" :
        p.id === "lovable" ? "lovable" :
        p.id === "hf" ? "huggingface" :
        p.id === "sync" ? "sync" :
        p.id === "kling-direct" ? "kling" :
        p.id === "fal-video" || p.id === "fal-lipsync" ? "fal" :
        p.id.startsWith("replicate") ? "replicate" :
        p.id;
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

    return { providers: providersWithHealth, workers: workers ?? [], stats, summary, recent: (logs ?? []).slice(0, 50) };
  });
