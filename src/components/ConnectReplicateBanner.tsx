import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { providerStatus } from "@/lib/provider-status.functions";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { useState } from "react";

/**
 * Banner that appears when neither Ark nor Replicate is linked. Ark is the
 * primary provider for Seedance video; Replicate remains a fallback for other
 * video models and image/video workflows.
 *
 * Other providers (Gemini direct, OpenRouter, HF, Sync.so, Lovable) are
 * tried first so credits aren't burned, but Replicate unlocks the full
 * pipeline.
 */
export function ConnectReplicateBanner() {
  const fetchStatus = useServerFn(providerStatus);
  const { data } = useQuery({
    queryKey: ["provider-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });
  const [dismissed, setDismissed] = useState(false);

  if (!data || data.ark || data.replicate || dismissed) return null;

  // Show which fallbacks ARE active so the user knows they're not blocked.
  const active = [
    data.gemini && "Gemini",
    data.ark && "Ark",
    data.openrouter && "OpenRouter",
    data.fal && "fal.ai",
    data.huggingface && "HuggingFace",
    data.sync && "Sync.so",
    data.lovable && "Lovable AI",
  ].filter(Boolean) as string[];

  return (
    <div className="relative z-20 mx-auto max-w-7xl px-4 md:px-10 pt-3">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-100 p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 mt-0.5 text-amber-400" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-amber-200">Video provider not linked</div>
          <p className="text-amber-100/80 mt-1">
            Motion uses Ark when its API key is configured. The app currently has
            {active.length > 0 ? ` ${active.join(" · ")} ` : " no configured video providers "}
            available, and Replicate remains an optional fallback.
          </p>
          <a
            href="https://docs.lovable.dev/integrations/connectors"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-mono uppercase tracking-wider text-amber-300 hover:text-amber-200"
          >
            How to connect Replicate <ExternalLink className="size-3" />
          </a>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-300/60 hover:text-amber-200"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
