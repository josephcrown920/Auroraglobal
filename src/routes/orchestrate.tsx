import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  ImageIcon,
  Video,
  Type,
  AudioLines,
  Loader2,
  Download,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { orchestrateGenerate, listOrchestrations } from "@/lib/orchestration.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { handleGenerationError, friendlyGenerationMessage } from "@/lib/error-toasts";
import { detectFeatures, computeCost, type Feature, type Resolution } from "@/lib/pricing";
import { ResolutionPicker } from "@/components/ResolutionPicker";
import { useGenerationProgress } from "@/hooks/use-generation-progress";
import { GenerationProgress } from "@/components/ui/GenerationProgress";
import { GenerationErrorCard } from "@/components/ui/GenerationErrorCard";
import { BlurredPreview } from "@/components/ui/BlurredPreview";

export const Route = createFileRoute("/orchestrate")({
  component: OrchestratePage,
});

type Modality = "image" | "video" | "text" | "audio";

type ModelOption = { key: string; label: string; free?: boolean };

const MODALITIES: { id: Modality; label: string; icon: typeof ImageIcon }[] = [
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "video", label: "Video", icon: Video },
  { id: "text", label: "Text", icon: Type },
  { id: "audio", label: "Speech", icon: AudioLines },
];

const RESOLUTIONS: Resolution[] = ["480p", "720p", "1080p", "2160p"];
const DURATIONS = [5, 8, 10, 12];

const MODELS: Record<Modality, ModelOption[]> = {
  image: [
    { key: "pollinations/flux", label: "Pollinations · FLUX", free: true },
    { key: "runware/flux-schnell", label: "Runware · FLUX schnell" },
    { key: "google/nano-banana", label: "Replicate · Nano Banana" },
    { key: "replicate/flux-schnell", label: "Replicate · FLUX schnell" },
    { key: "piapi/midjourney-imagine", label: "PiAPI · Midjourney" },
  ],
  video: [
    { key: "runway/gen4-turbo", label: "Runway · Gen-4 Turbo" },
    { key: "runway/gen3a-turbo", label: "Runway · Gen-3 Alpha Turbo" },
    { key: "seedance-2.0-fast", label: "Replicate · Seedance Lite" },
    { key: "kling-3.0", label: "Replicate · Kling v2.1" },
    { key: "piapi/kling-video", label: "PiAPI · Kling" },
  ],
  text: [
    { key: "pollinations/openai", label: "Pollinations · OpenAI", free: true },
    { key: "groq/llama-3.3-70b", label: "Groq · Llama 3.3 70B" },
    { key: "gemini/gemini-2.0-flash", label: "Gemini · 2.0 Flash" },
    { key: "openai/gpt-4o-mini", label: "OpenAI · GPT-4o mini" },
    { key: "lovable/gemini-2.5-flash", label: "Lovable · Gemini 2.5 Flash" },
  ],
  audio: [{ key: "elevenlabs/tts", label: "ElevenLabs · Multilingual v2" }],
};

function OrchestratePage() {
  const { user } = useAuth();
  const run = useServerFn(orchestrateGenerate);
  const list = useServerFn(listOrchestrations);
  const profileFn = useServerFn(getMyProfile);

  const [modality, setModality] = useState<Modality>("image");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS.image[0].key);
  const [imageUrl, setImageUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [duration, setDuration] = useState(5);
  const [busy, setBusy] = useState(false);
  const [awaitingFullRender, setAwaitingFullRender] = useState(false);
  // Preview-confirm ticket: the preview's generation id, required by the
  // server gate (task #153) to unlock the full-quality render.
  const [previewTicket, setPreviewTicket] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    kind: Modality;
    url: string;
    text: string | null;
    provider: string;
    latencyMs: number;
  } | null>(null);

  // Synthetic mutation-like state so useGenerationProgress can track the async fn
  const [pendingState, setPendingState] = useState<"idle" | "pending" | "error" | "success">("idle");
  const orchestrateProgress = useGenerationProgress({
    isPending: pendingState === "pending",
    isError: pendingState === "error",
    isSuccess: pendingState === "success",
    estimatedMs: modality === "video" ? 30_000 : modality === "audio" ? 15_000 : 12_000,
    persistKey: "aurora.progress.orchestrate",
    labels: {
      queued: "Routing to the best provider…",
      processing: modality === "image" ? "Rendering your image…" : modality === "video" ? "Rendering your video…" : modality === "audio" ? "Synthesising audio…" : "Generating response…",
      finalizing: "Almost there…",
      done: "Done",
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const isPro = !!(profile?.is_pro || profile?.isAdmin);

  const recent = useQuery({
    queryKey: ["orchestrations", user?.id],
    queryFn: () => list({ data: undefined }),
    enabled: !!user,
  });

  // Resolution applies to image/video; length only to video. Price the live
  // preview with the SAME pricing module the server charges with, so the number
  // on the button is exactly what gets reserved.
  const usesResolution = modality === "image" || modality === "video";
  const usesDuration = modality === "video";
  const { features } = detectFeatures({ kind: modality as Feature });
  const quote = computeCost({
    features,
    resolution: usesResolution ? resolution : undefined,
    durationSeconds: usesDuration ? duration : undefined,
    // Switching models retiers the video base, so the previewed Aura updates live.
    model,
  });
  const cost = quote.total;

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

  const switchModality = (m: Modality) => {
    setModality(m);
    setModel(MODELS[m][0].key);
    setResult(null);
    setAwaitingFullRender(false);
    setPreviewTicket(null);
  };

  // Preview-first flow for video: first pass runs at 480p/5s cheaply,
  // then the user confirms before the full-quality render.
  const isPreviewPass = modality === "video" && !awaitingFullRender;

  const onGenerate = async () => {
    if (!user) return toast.error("Please sign in to generate");
    if (!prompt.trim()) return toast.error("Enter a prompt first");
    if (modality === "video" && !imageUrl.trim()) {
      return toast.error("Runway video needs a start image URL");
    }
    setBusy(true);
    setLastError(null);
    setResult(null);
    setPendingState("pending");
    try {
      const res = await run({
        data: {
          kind: modality,
          prompt: prompt.trim(),
          model,
          // Preview pass: first video generation runs cheap (480p/5s) so the
          // user can confirm the scene before paying for the full render.
          ...(usesResolution ? { resolution: isPreviewPass ? "480p" : resolution } : {}),
          ...(usesDuration ? { duration: isPreviewPass ? 5 : duration } : {}),
          ...(isPreviewPass ? { previewOnly: true } : {}),
          // Full-quality pass must present the preview's id or the server
          // gate forces it back down to a preview.
          ...(!isPreviewPass && previewTicket ? { confirmPreviewId: previewTicket } : {}),
          ...(modality === "video" && imageUrl.trim() ? { imageUrls: [imageUrl.trim()] } : {}),
          ...(modality === "audio" && voiceId.trim() ? { voiceId: voiceId.trim() } : {}),
        },
      });
      if (!res.ok) {
        const errMsg = res.insufficient ? "insufficient credits" : (res.error ?? "Generation failed");
        setLastError(friendlyGenerationMessage(errMsg));
        handleGenerationError(errMsg);
        setPendingState("error");
        return;
      }
      setResult({
        kind: modality,
        url: res.url,
        text: res.text,
        provider: res.provider,
        latencyMs: res.latencyMs,
      });
      setPendingState("success");
      if (isPreviewPass) {
        toast.success("Preview ready — looks good? Click Render Full Quality to continue.");
        setAwaitingFullRender(true);
        setPreviewTicket(res.generationId ?? null);
      } else {
        toast.success(`Generated via ${res.provider}`);
        setAwaitingFullRender(false);
        setPreviewTicket(null);
      }
      recent.refetch();
    } catch (e) {
      // A rejected/expired ticket is terminal — restart the preview flow so
      // the next click renders a fresh preview instead of re-failing forever.
      const emsg = e instanceof Error ? e.message : "";
      if (emsg.includes("Unsupported preview confirmation")) {
        setAwaitingFullRender(false);
        setPreviewTicket(null);
      }
      setLastError(friendlyGenerationMessage(e));
      handleGenerationError(e);
      setPendingState("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-fuchsia-400">
              <Sparkles className="h-4 w-4" />
              AI Router
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Orchestrate</h1>
            <p className="mt-1 text-sm text-neutral-400">
              One prompt, every modality — routed to the cheapest healthy provider with automatic
              fallback.
            </p>
          </div>
          <Link to="/dashboard" className="text-sm text-neutral-400 hover:text-neutral-100">
            Dashboard
          </Link>
        </header>

        {/* Modality tabs */}
        <div className="mb-6 grid grid-cols-4 gap-2">
          {MODALITIES.map((m) => {
            const Icon = m.icon;
            const active = m.id === modality;
            return (
              <button
                key={m.id}
                onClick={() => switchModality(m.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-4 text-sm transition ${
                  active
                    ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300"
                    : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          {/* Composer */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder={
                modality === "text"
                  ? "Ask anything…"
                  : modality === "audio"
                    ? "Text to speak aloud…"
                    : "Describe what to generate…"
              }
              className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none focus:border-fuchsia-500"
            />

            {modality === "video" && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Start image URL (required)
                </label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm outline-none focus:border-fuchsia-500"
                />
              </div>
            )}

            {modality === "audio" && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Voice ID (optional)
                </label>
                <input
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  placeholder="21m00Tcm4TlvDq8ikWAM"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm outline-none focus:border-fuchsia-500"
                />
              </div>
            )}

            {(usesResolution || usesDuration) && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {usesResolution && (
                  <ResolutionPicker
                    resolution={resolution}
                    onChange={setResolution}
                    isPro={isPro}
                    features={features}
                    durationSeconds={duration}
                    model={model}
                    className="col-span-full sm:col-span-1"
                  />
                )}
                {usesDuration && (
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Length
                    </label>
                    <div className="flex gap-2">
                      {DURATIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDuration(s)}
                          className={`flex-1 rounded-lg border px-2 py-2 text-xs transition ${
                            duration === s
                              ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300"
                              : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Itemized cost preview — same pricing module the server charges with */}
            <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Cost preview
              </div>
              <ul className="space-y-1 text-xs text-neutral-400">
                {quote.breakdown.map((b) => (
                  <li key={b.feature} className="flex items-center justify-between gap-2">
                    <span className="capitalize">
                      {b.feature}
                      {b.resolutionFactor !== 1 ? ` · ${resolution}` : ""}
                      {b.lengthFactor !== 1 ? ` · ${duration}s` : ""}
                    </span>
                    <span className="tabular-nums text-neutral-300">
                      {fmt(b.base)}
                      {b.resolutionFactor !== 1 ? ` × ${fmt(b.resolutionFactor)}` : ""}
                      {b.lengthFactor !== 1 ? ` × ${fmt(b.lengthFactor)}` : ""}
                      {" = "}
                      {fmt(b.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums text-fuchsia-300">{quote.total} Aura</span>
              </div>
            </div>

            <button
              onClick={onGenerate}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {busy
                ? "Generating…"
                : awaitingFullRender
                  ? `Render Full Quality · ${cost} Aura`
                  : isPreviewPass
                    ? "Preview · 480p · 5s"
                    : `Generate · ${cost} credit${cost === 1 ? "" : "s"}`}
            </button>

            {orchestrateProgress.isActive && (
              <div className="mt-4">
                <GenerationProgress
                  visible
                  progress={orchestrateProgress.progress}
                  label={orchestrateProgress.label}
                />
              </div>
            )}

            {pendingState === "error" && lastError && (
              <div className="mt-3">
                <GenerationErrorCard
                  visible
                  error={lastError}
                  onRetry={onGenerate}
                />
              </div>
            )}

            {!user && (
              <p className="mt-3 text-center text-xs text-neutral-500">
                You need to{" "}
                <Link to="/auth" className="underline">
                  sign in
                </Link>{" "}
                to run the router.
              </p>
            )}

            {/* Result */}
            {awaitingFullRender && !busy && (
              <button
                type="button"
                onClick={() => { setAwaitingFullRender(false); setResult(null); }}
                className="mt-2 w-full text-center text-xs text-neutral-500 transition hover:text-neutral-300"
              >
                Start over — discard preview
              </button>
            )}

            {result && (
              <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                {awaitingFullRender && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-400 w-fit">
                    Preview · 480p · 5s — click Render Full Quality when satisfied
                  </div>
                )}
                <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {result.provider} · {result.latencyMs}ms
                  </span>
                </div>
                {result.kind === "image" && (
                  <BlurredPreview src={result.url} alt="Generated image" aspectRatio="1/1" className="rounded-lg border-0" />
                )}
                {result.kind === "video" && (
                  <video src={result.url} controls className="w-full rounded-lg" />
                )}
                {result.kind === "audio" && <audio src={result.url} controls className="w-full" />}
                {result.kind === "text" && (
                  <p className="whitespace-pre-wrap text-sm text-neutral-200">{result.text}</p>
                )}
                {result.url && result.kind !== "text" && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300"
                  >
                    <Download className="h-3 w-3" /> Open
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Model picker */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Model
            </label>
            <div className="space-y-2">
              {MODELS[modality].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setModel(opt.key)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    model === opt.key
                      ? "border-fuchsia-500 bg-fuchsia-500/10"
                      : "border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.free && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                      FREE
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">
              If the chosen model's providers are down, the router automatically falls back to the
              next healthy option for this modality.
            </p>
          </div>
        </div>

        {/* Recent */}
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-300">
            Recent results <ArrowRight className="h-3.5 w-3.5 text-neutral-600" />
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {(recent.data?.items ?? []).map((g) => (
              <div
                key={g.id}
                className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
              >
                {g.result_image_url ? (
                  <img
                    src={g.result_image_url}
                    alt={g.prompt}
                    className="aspect-square w-full object-cover"
                  />
                ) : g.result_video_url ? (
                  <video src={g.result_video_url} className="aspect-square w-full object-cover" />
                ) : g.audio_url ? (
                  <div className="flex aspect-square w-full items-center justify-center bg-neutral-950">
                    <AudioLines className="h-8 w-8 text-neutral-600" />
                  </div>
                ) : (
                  <div className="aspect-square w-full overflow-y-auto bg-neutral-950 p-3 text-[11px] text-neutral-400">
                    {g.result_text}
                  </div>
                )}
                <div className="px-2 py-1.5 text-[10px] text-neutral-500">
                  {g.kind} · {g.model ?? "—"}
                </div>
              </div>
            ))}
            {!recent.data?.items?.length && (
              <p className="col-span-full text-sm text-neutral-600">No generations yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
