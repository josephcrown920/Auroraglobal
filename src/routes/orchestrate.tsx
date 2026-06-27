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

export const Route = createFileRoute("/orchestrate")({
  component: OrchestratePage,
});

type Modality = "image" | "video" | "text" | "audio";

type ModelOption = { key: string; label: string; free?: boolean };

const MODALITIES: { id: Modality; label: string; icon: typeof ImageIcon; cost: number }[] = [
  { id: "image", label: "Image", icon: ImageIcon, cost: 1 },
  { id: "video", label: "Video", icon: Video, cost: 5 },
  { id: "text", label: "Text", icon: Type, cost: 1 },
  { id: "audio", label: "Speech", icon: AudioLines, cost: 2 },
];

const MODELS: Record<Modality, ModelOption[]> = {
  image: [
    { key: "pollinations/flux", label: "Pollinations · FLUX", free: true },
    { key: "runware/flux-schnell", label: "Runware · FLUX schnell" },
    { key: "google/nano-banana", label: "Replicate · Nano Banana" },
    { key: "replicate/flux-schnell", label: "Replicate · FLUX schnell" },
  ],
  video: [
    { key: "runway/gen4-turbo", label: "Runway · Gen-4 Turbo" },
    { key: "runway/gen3a-turbo", label: "Runway · Gen-3 Alpha Turbo" },
    { key: "seedance-2.0-fast", label: "Replicate · Seedance Lite" },
    { key: "kling-3.0", label: "Replicate · Kling v2.1" },
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

  const [modality, setModality] = useState<Modality>("image");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS.image[0].key);
  const [imageUrl, setImageUrl] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: Modality;
    url: string;
    text: string | null;
    provider: string;
    latencyMs: number;
  } | null>(null);

  const recent = useQuery({
    queryKey: ["orchestrations", user?.id],
    queryFn: () => list({ data: undefined }),
    enabled: !!user,
  });

  const cost = MODALITIES.find((m) => m.id === modality)!.cost;

  const switchModality = (m: Modality) => {
    setModality(m);
    setModel(MODELS[m][0].key);
    setResult(null);
  };

  const onGenerate = async () => {
    if (!user) return toast.error("Please sign in to generate");
    if (!prompt.trim()) return toast.error("Enter a prompt first");
    if (modality === "video" && !imageUrl.trim()) {
      return toast.error("Runway video needs a start image URL");
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await run({
        data: {
          kind: modality,
          prompt: prompt.trim(),
          model,
          ...(modality === "video" && imageUrl.trim() ? { imageUrls: [imageUrl.trim()] } : {}),
          ...(modality === "audio" && voiceId.trim() ? { voiceId: voiceId.trim() } : {}),
        },
      });
      if (!res.ok) {
        toast.error(res.insufficient ? "Insufficient credits" : res.error);
        return;
      }
      setResult({
        kind: modality,
        url: res.url,
        text: res.text,
        provider: res.provider,
        latencyMs: res.latencyMs,
      });
      toast.success(`Generated via ${res.provider}`);
      recent.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
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
              {busy ? "Generating…" : `Generate · ${cost} credit${cost === 1 ? "" : "s"}`}
            </button>

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
            {result && (
              <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {result.provider} · {result.latencyMs}ms
                  </span>
                </div>
                {result.kind === "image" && (
                  <img src={result.url} alt="result" className="w-full rounded-lg" />
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
