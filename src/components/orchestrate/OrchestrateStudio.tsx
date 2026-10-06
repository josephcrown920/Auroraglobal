import { authNextSearch } from "@/lib/auth-return-path";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  ImageIcon,
  Video,
  Type,
  AudioLines,
  Loader2,
  Download,
  ArrowRight,
  Wand2,
  Trash2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { orchestrateGenerate, listOrchestrations } from "@/lib/orchestration.functions";
import { deleteGeneration } from "@/lib/gallery.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { handleGenerationError, friendlyGenerationMessage } from "@/lib/error-toasts";
import { detectFeatures, computeCost, type Feature, type Resolution } from "@/lib/pricing";
import { VIDEO_AGENT_MODEL_KEY, VIDEO_AGENT_HELPER_TEXT } from "@/lib/video-agent-prompt";
import { enhanceVideoAgentPrompt } from "@/lib/video-agent.functions";
import { ResolutionPicker } from "@/components/ResolutionPicker";
import { PlanLimitNotice } from "@/components/PlanLimitNotice";
import { DURATION_CAPS, evaluatePlanLimits, type PlanLimitWarning } from "@/lib/billing.plans";
import { useGenerationProgress } from "@/hooks/use-generation-progress";
import { GenerationProgress } from "@/components/ui/GenerationProgress";
import { GenerationErrorCard } from "@/components/ui/GenerationErrorCard";
import { BlurredPreview } from "@/components/ui/BlurredPreview";


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

// "auto" is a UI-only sentinel: it means "don't pin a model" so the request
// rides the orchestrator's full video fallback chain (which handles plain
// text-to-video). It must be stripped before hitting pricing or the server.
const AUTO_MODEL = "auto";
// Runway is image-to-video only — it animates a start frame and rejects bare
// text prompts. Every other video option (and Auto) supports text-to-video,
// with the start image being an optional upgrade to image-to-video.
const IMAGE_REQUIRED_VIDEO_MODELS = new Set(["runway/gen4-turbo", "runway/gen3a-turbo"]);

// Curated ElevenLabs premade voices — stable IDs available on every ElevenLabs
// account, so picking one always resolves to a real voice instead of a raw
// text field where a typo/garbage id would 400 at generation time.
const VOICE_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", description: "Calm, narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella", description: "Warm, friendly" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", description: "Deep, confident" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", description: "Casual, energetic" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", description: "Clear, authoritative" },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli", description: "Bright, youthful" },
];

const MODELS: Record<Modality, ModelOption[]> = {
  image: [
    { key: "fal-ai/seedream-4", label: "Seedream 4" },
    { key: "fal-ai/seedream-5", label: "Seedream 5" },
    { key: "google/nano-banana", label: "Nano Banana" },
    { key: "google/gemini-3-pro-image-preview", label: "Nano Banana Pro" },
  ],
  video: [
    { key: "auto", label: "Auto · best available" },
    { key: VIDEO_AGENT_MODEL_KEY, label: "HeyGen · Video Agent" },
    { key: "xai/grok-imagine-video-1.5", label: "xAI · Grok Imagine" },
    { key: "seedance-2.0-fast", label: "Replicate · Seedance Lite" },
    { key: "kling-3.0", label: "Replicate · Kling v2.1" },
    { key: "runway/gen4-turbo", label: "Runway · Gen-4 Turbo" },
    { key: "runway/gen3a-turbo", label: "Runway · Gen-3 Alpha Turbo" },
  ],
  text: [
    { key: "pollinations/openai", label: "Pollinations · OpenAI", free: true },
    { key: "groq/llama-3.3-70b", label: "Groq · GPT-OSS 120B" },
    { key: "gemini/gemini-2.0-flash", label: "Gemini · 2.0 Flash" },
    { key: "openai/gpt-4o-mini", label: "OpenAI · GPT-4o mini" },
    { key: "anthropic/claude-sonnet-4-5", label: "Claude · Sonnet 4.5" },
    { key: "anthropic/claude-haiku-4-5", label: "Claude · Haiku 4.5" },
    { key: "lovable/gemini-2.5-flash", label: "Lovable · Gemini 2.5 Flash" },
  ],
  audio: [{ key: "elevenlabs/tts", label: "ElevenLabs · Multilingual v2" }],
};

export function OrchestrateStudio({
  initialModel,
  lockedModel = false,
}: {
  initialModel?: string;
  lockedModel?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const run = useServerFn(orchestrateGenerate);
  const list = useServerFn(listOrchestrations);
  const profileFn = useServerFn(getMyProfile);
  const enhanceFn = useServerFn(enhanceVideoAgentPrompt);
  const orcDelFn = useServerFn(deleteGeneration);
  const orcDelMut = useMutation({
    mutationFn: async (id: string) => orcDelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["orchestrations"] });
      qc.invalidateQueries({ queryKey: ["gallery"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const [modality, setModality] = useState<Modality>(initialModel === VIDEO_AGENT_MODEL_KEY ? "video" : "image");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(initialModel ?? MODELS.image[0].key);
  const [imageUrl, setImageUrl] = useState("");
  // Optional uploaded start image (image-to-video): kept as a File until
  // generation time, then uploaded to the studio bucket for a signed URL —
  // same pattern as /lipsync and /ugc uploads.
  const [startImageFile, setStartImageFile] = useState<File | null>(null);
  const [startImagePreview, setStartImagePreview] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState(VOICE_OPTIONS[0].id);
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [duration, setDuration] = useState(5);
  // Default: 1:1 for image, 16:9 for video (matches provider defaults).
  const [aspectRatio, setAspectRatio] = useState<string>(
    initialModel === VIDEO_AGENT_MODEL_KEY ? "16:9" : "1:1",
  );
  const [busy, setBusy] = useState(false);
  const [awaitingFullRender, setAwaitingFullRender] = useState(false);
  // Preview-confirm ticket: the preview's generation id, required by the
  // server gate (task #153) to unlock the full-quality render.
  const [previewTicket, setPreviewTicket] = useState<string | null>(null);
  const [hdDialogOpen, setHdDialogOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    kind: Modality;
    url: string;
    text: string | null;
    provider: string;
    latencyMs: number;
    /** Aspect ratio that was selected when this generation completed. Preserved
     *  so the preview frame matches the output even if the picker changes later. */
    aspectRatio: string;
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

  // Derived early so resolution/duration guards can reference it below.
  const isVideoAgent = model === VIDEO_AGENT_MODEL_KEY;

  // Resolution applies to image/video; length only to video. Price the live
  // preview with the SAME pricing module the server charges with, so the number
  // on the button is exactly what gets reserved.
  // HeyGen Video Agent uses a fixed avatar-video pipeline — it ignores
  // resolution/duration params and controls output length from the script.
  const usesResolution = (modality === "image" || modality === "video") && !isVideoAgent;
  const usesDuration = modality === "video" && !isVideoAgent;
  // "auto" is a UI-only sentinel — pricing and the server must never see it.
  const effectiveModel = model === AUTO_MODEL ? undefined : model;
  const { features } = detectFeatures({ kind: modality as Feature });
  const quote = computeCost({
    features,
    resolution: usesResolution ? resolution : undefined,
    durationSeconds: usesDuration ? duration : undefined,
    // Switching models retiers the video base, so the previewed Aura updates live.
    model: effectiveModel,
  });
  const cost = quote.total;

  // Live server round-trip for the full-quality render: the number above is
  // computed client-side from the same pricing module the server uses, but a
  // client bundle can go stale or drift. Once the preview resolves and the
  // "Render Full Quality" button is about to be shown, fetch a fresh quote
  // from GET /api/estimate so the displayed price can never disagree with
  // what the server will actually charge.
  const [serverEstimate, setServerEstimate] = useState<{
    credits: number | null;
    blocked: { message: string } | null;
    warnings?: PlanLimitWarning[];
    quoteToken?: string;
  } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  useEffect(() => {
    if (!awaitingFullRender) {
      setServerEstimate(null);
      return;
    }
    let cancelled = false;
    setEstimateLoading(true);
    // Clear the previous estimate SYNCHRONOUSLY when any quote input changes:
    // the old response carries a signed quoteToken (and price) for the OLD
    // resolution/duration — submitting it against the new selection could
    // charge parameters the displayed price never described.
    setServerEstimate(null);
    const params = new URLSearchParams({ kind: modality });
    if (effectiveModel) params.set("model", effectiveModel);
    if (usesResolution) params.set("resolution", resolution);
    if (usesDuration) params.set("duration", String(duration));
    // Present the preview ticket so the server prices the FULL-QUALITY render.
    // Without it the estimate route applies the mandatory preview cap and
    // would return the 480p/≤5s preview price here — understating what the
    // confirmed render will actually charge. (resolvePreviewGate is a pure
    // read: presenting the ticket for a quote does not consume it.)
    if (previewTicket) params.set("confirmPreviewId", previewTicket);
    (async () => {
      // Pass the caller's auth token so the server can apply the same
      // tier-aware guardrails (duration cap, HD entitlement) that
      // orchestrateGenerate enforces — otherwise a Free-plan user could see a
      // valid-looking quote for a length/resolution their plan can't render.
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/estimate?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = typeof body?.error === "string" ? body.error : "";
        // A rejected/expired preview ticket is terminal — restart the preview
        // flow (same recovery as doGenerate's catch) instead of pinning a
        // disabled button to a stale ticket.
        if (errMsg.includes("Unsupported preview confirmation")) {
          if (!cancelled) {
            setAwaitingFullRender(false);
            setPreviewTicket(null);
          }
          return null;
        }
        // Structured 400 (e.g. duration over the plan cap): surface the exact
        // blocker instead of silently falling back to the client-side price —
        // otherwise the user clicks into a guaranteed server-side rejection.
        if (body && (body.blocked || body.error)) {
          return {
            credits: null,
            blocked: body.blocked ?? { message: errMsg || "This request isn't allowed on your plan." },
            warnings: Array.isArray(body.warnings) ? (body.warnings as PlanLimitWarning[]) : [],
          };
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return body;
    })()
      .then((data: { credits: number | null; blocked: { message: string } | null; warnings?: PlanLimitWarning[]; quoteToken?: string } | null) => {
        if (!cancelled && data) setServerEstimate(data);
      })
      .catch(() => {
        // Non-fatal: keep showing the client-computed number if the round-trip fails.
        if (!cancelled) setServerEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setEstimateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [awaitingFullRender, modality, effectiveModel, resolution, duration, usesResolution, usesDuration, previewTicket]);
  // Prefer the server-confirmed number once it lands; it's what will actually be charged.
  const displayCost = serverEstimate?.credits ?? cost;

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

  // Video Agent (HeyGen) specific state — portrait orientation and
  // translation-ready (direct-to-camera) mode that affects the Enhance pass.
  const [vaPortrait, setVaPortrait] = useState(false);
  const [vaDirectToCamera, setVaDirectToCamera] = useState(false);
  const [vaEnhancing, setVaEnhancing] = useState(false);

  const [downloading, setDownloading] = useState(false);
  // Studio-hosted results (e.g. ElevenLabs TTS output) sit on a cross-origin
  // bucket URL, so a plain <a download> is silently ignored by the browser —
  // it just opens the file instead of saving it. Fetch the bytes ourselves
  // and trigger the save via a blob URL so "Download" reliably saves to disk.
  const downloadResult = async (url: string, kind: Modality) => {
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const ext = kind === "audio" ? "mp3" : kind === "video" ? "mp4" : "png";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `aurora-${kind}-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't download this file");
    } finally {
      setDownloading(false);
    }
  };

  const switchModality = (m: Modality) => {
    setModality(m);
    setModel(MODELS[m][0].key);
    setResult(null);
    setAwaitingFullRender(false);
    setPreviewTicket(null);
    // Reset aspect ratio to the sensible default for the new modality.
    setAspectRatio(m === "image" ? "1:1" : "16:9");
  };

  const onStartImage = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      return toast.error("Please upload a JPG, PNG, or WebP image");
    }
    if (f.size > 20 * 1024 * 1024) return toast.error("Image must be under 20MB");
    setStartImageFile(f);
    if (startImagePreview) URL.revokeObjectURL(startImagePreview);
    setStartImagePreview(URL.createObjectURL(f));
    // The uploaded file supersedes any pasted URL.
    setImageUrl("");
  };

  const clearStartImage = () => {
    setStartImageFile(null);
    if (startImagePreview) URL.revokeObjectURL(startImagePreview);
    setStartImagePreview(null);
  };

  const uploadStartImage = async (file: File): Promise<string> => {
    const { supabase } = await import("@/integrations/supabase/client");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/orchestrate/${Date.now()}-start.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(`Image upload failed: ${error.message}`);
    const { data: signed, error: signErr } = await supabase.storage
      .from("studio")
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Image URL failed: ${signErr?.message ?? "no url"}`);
    }
    return signed.signedUrl;
  };

  // Runway models animate a start frame and can't run text-only; everything
  // else (including Auto) does plain text-to-video with the image optional.
  const startImageRequired = modality === "video" && IMAGE_REQUIRED_VIDEO_MODELS.has(model);

  // Preview-first flow for video: first pass runs at 480p/5s cheaply,
  // then the user confirms before the full-quality render.
  // Video Agent bypasses this — HeyGen always renders a full avatar video.
  const isPreviewPass = modality === "video" && !awaitingFullRender && !isVideoAgent;

  const isHdResolution = resolution === "1080p" || resolution === "2160p";

  // Pre-click plan-limit warnings: instant and client-side, built from the
  // same shared helpers (billing.plans) the server guards throw with. A
  // duration over the plan cap blocks even the preview click (the guard runs
  // before the preview gate); HD/4K on Free only blocks the full-quality pass.
  const planTier = isPro ? ("pro" as const) : ("free" as const);
  const planWarnings = evaluatePlanLimits({
    tier: planTier,
    kind: modality,
    durationSeconds: usesDuration ? duration : undefined,
    resolution: usesResolution ? resolution : undefined,
    nextRenderIsPreview: isPreviewPass,
  });
  // Server-confirmed warnings the client-side pass missed (e.g. the profile
  // query still loading, or an admin whose plan isn't actually pro) — deduped
  // by code so the same limit never renders twice.
  const serverOnlyWarnings = (serverEstimate?.warnings ?? []).filter(
    (sw) => !planWarnings.some((pw) => pw.code === sw.code),
  );
  const planBlocked =
    planWarnings.some((w) => w.blocksNextRender) ||
    serverOnlyWarnings.some((w) => w.blocksNextRender);

  // Enhance the user's raw idea into a polished first-person spoken script via
  // an LLM pass. The enhanced result replaces the textarea content so the user
  // can review and tweak before submitting.
  const doEnhance = async () => {
    if (!user) return toast.error("Please sign in first");
    if (!prompt.trim()) return toast.error("Enter a prompt idea first");
    setVaEnhancing(true);
    try {
      const res = await enhanceFn({
        data: {
          prompt: prompt.trim(),
          // Use a 30-second target as a sensible default when the duration
          // picker is hidden (HeyGen controls actual length from script).
          targetSeconds: 30,
          directToCamera: vaDirectToCamera,
        },
      });
      setPrompt(res.script);
      toast.success("Script enhanced — review and edit freely before submitting");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enhance failed — try again");
    } finally {
      setVaEnhancing(false);
    }
  };

  const doGenerate = async () => {
    if (!user) return toast.error("Please sign in to generate");
    if (!prompt.trim()) return toast.error("Enter a prompt first");
    if (startImageRequired && !startImageFile && !imageUrl.trim()) {
      return toast.error(
        "Runway animates a start image — upload one, or pick Auto for text-to-video",
      );
    }
    setBusy(true);
    setLastError(null);
    setResult(null);
    setPendingState("pending");
    try {
      // Uploaded file wins over a pasted URL (picking a file clears the URL field).
      let startImageUrl = imageUrl.trim();
      if (modality === "video" && startImageFile) {
        startImageUrl = await uploadStartImage(startImageFile);
      }
      const res = await run({
        data: {
          kind: modality,
          prompt: prompt.trim(),
          // ── Quote-to-charge parity enforcement ───────────────────────────
          // Pass the signed quoteToken from the server estimate so that
          // orchestrateGenerate can verify the charge equals the quote at the
          // execution boundary — especially for motion-priced requests.
          // The token was signed by /api/estimate using the server's secret;
          // the server extracts and uses the quoted features as the authoritative
          // billing set. If motion was in the quote but cannot be reproduced at
          // charge time, the server rejects rather than silently undercharging.
          //
          // Also pass features directly: if the token is absent (e.g. estimate
          // network failure), the server uses data.features as a fallback so
          // the charge still matches the client-computed price. detectFeatures
          // (line 193) uses the same pricing module as the server.
          ...(serverEstimate?.quoteToken ? { quoteToken: serverEstimate.quoteToken } : {}),
          features: features as Array<"image" | "upscale" | "text" | "audio" | "lipsync" | "motion" | "video">,
          ...(effectiveModel ? { model: effectiveModel } : {}),
          // Preview pass: first video generation runs cheap (480p/5s) so the
          // user can confirm the scene before paying for the full render.
          ...(usesResolution ? { resolution: isPreviewPass ? "480p" : resolution } : {}),
          ...(usesDuration ? { duration: isPreviewPass ? 5 : duration } : {}),
          ...(isPreviewPass ? { previewOnly: true } : {}),
          // Full-quality pass must present the preview's id or the server
          // gate forces it back down to a preview.
          ...(!isPreviewPass && previewTicket ? { confirmPreviewId: previewTicket } : {}),
          // Video Agent doesn't accept start images (avatar pipeline); other
          // video models treat a start image as an animate-frame hint.
          ...(modality === "video" && !isVideoAgent && startImageUrl ? { imageUrls: [startImageUrl] } : {}),
          ...(modality === "audio" && voiceId.trim() ? { voiceId: voiceId.trim() } : {}),
          // Portrait orientation for HeyGen avatar videos (720×1280 vs default 1280×720).
          ...(isVideoAgent ? { orientation: vaPortrait ? "portrait" : "landscape" } as const : {}),
          // Aspect ratio for image/video (Kling, Gemini Veo, etc.)
          ...((modality === "image" || modality === "video") && !isVideoAgent
            ? { aspectRatio }
            : {}),
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
        aspectRatio,
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

  const onGenerate = () => {
    if (awaitingFullRender && isHdResolution) {
      setHdDialogOpen(true);
    } else {
      void doGenerate();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-brand">
              <Sparkles className="h-4 w-4" />
              AI Router
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Create</h1>
            <p className="mt-1 text-sm text-neutral-400">
              One prompt, every modality — image, video, audio — routed to the best available
              provider with automatic fallback.
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
                    ? "border-brand/60 bg-brand/10 text-brand"
                    : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                {m.label}
              </button>
            );
          })}
        </div>
        {lockedModel && isVideoAgent && (
          <div className="mb-6 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-neutral-200">
            <span className="font-semibold text-brand">HeyGen Video Agent</span>
            <span className="text-neutral-400">
              {" "}creates a presenter-led video. It runs alongside, not inside, Aurora’s storyboard-based Video Agent.
            </span>
            <Link to="/video-agent" className="ml-2 font-medium text-brand underline underline-offset-4 hover:text-white">
              Open Aurora Video Agent
            </Link>
          </div>
        )}

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
                    : isVideoAgent
                      ? "Write what the presenter says — or describe your idea and hit Enhance…"
                      : "Describe what to generate…"
              }
              className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none focus:border-brand"
            />

            {/* HeyGen Video Agent helpers: inline guide, Enhance button, orientation + mode toggles */}
            {isVideoAgent && (
              <div className="mt-3 space-y-3">
                <p className="text-xs leading-relaxed text-neutral-400">
                  {VIDEO_AGENT_HELPER_TEXT}
                </p>
                <button
                  type="button"
                  onClick={() => void doEnhance()}
                  disabled={vaEnhancing || !prompt.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand transition hover:border-brand/70 hover:bg-brand/20 disabled:opacity-50"
                >
                  {vaEnhancing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  {vaEnhancing ? "Enhancing…" : "Enhance prompt"}
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVaPortrait((v) => !v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      vaPortrait
                        ? "border-brand/60 bg-brand/10 text-brand"
                        : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    Portrait (TikTok / Reels)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaDirectToCamera((v) => !v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      vaDirectToCamera
                        ? "border-brand/60 bg-brand/10 text-brand"
                        : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    Translation-ready
                  </button>
                </div>
                {vaDirectToCamera && (
                  <p className="text-[11px] leading-relaxed text-neutral-500">
                    Translation-ready: Enhance will write a self-contained script with no references to on-screen visuals — ideal for redubbing into other languages.
                  </p>
                )}
              </div>
            )}

            {/* Start image: only relevant for non-Video-Agent video models */}
            {modality === "video" && !isVideoAgent && !lockedModel && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Start image{" "}
                  {startImageRequired ? "(required by Runway)" : "(optional — image to video)"}
                </label>
                {startImagePreview ? (
                  <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-2.5">
                    <img
                      src={startImagePreview}
                      alt="Start frame"
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1 text-xs text-neutral-400">
                      <div className="truncate">{startImageFile?.name}</div>
                      <div className="text-[10px] text-neutral-500">
                        This frame will be animated
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearStartImage}
                      className="rounded-lg border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 px-4 py-4 text-sm text-neutral-400 transition hover:border-brand/60 hover:text-neutral-200">
                      <ImageIcon className="h-4 w-4" />
                      Upload a start image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onStartImage(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="…or paste an image URL"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </div>
                )}
                {!startImageRequired && (
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                    Leave empty for pure text-to-video, or add an image to animate it.
                  </p>
                )}
              </div>
            )}

            {modality === "audio" && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Voice
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {VOICE_OPTIONS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVoiceId(v.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        voiceId === v.id
                          ? "border-brand/60 bg-brand/10 text-brand"
                          : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <div className="font-medium">{v.label}</div>
                      <div className="text-[10px] text-neutral-500">{v.description}</div>
                    </button>
                  ))}
                </div>
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
                    model={effectiveModel}
                    className="col-span-full sm:col-span-1"
                  />
                )}
                {usesDuration && (
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Length
                    </label>
                    <div className="flex gap-2">
                      {DURATIONS.map((s) => {
                        // Lengths beyond the plan's duration cap are locked with
                        // a Pro badge (same convention as the resolution picker)
                        // instead of failing at generate time.
                        const overCap = s > DURATION_CAPS[planTier];
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              if (!overCap) setDuration(s);
                            }}
                            className={`relative flex-1 rounded-lg border px-2 py-2 text-xs transition ${
                              duration === s && !overCap
                                ? "border-brand/60 bg-brand/10 text-brand"
                                : overCap
                                  ? "cursor-default select-none border-neutral-800 text-neutral-600 opacity-60"
                                  : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                            }`}
                          >
                            {s}s
                            {overCap && (
                              <span className="absolute -top-2 right-1 flex items-center gap-0.5 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                                <Lock className="h-2.5 w-2.5" />
                                {planTier === "free" ? "Pro" : ""}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aspect ratio picker — image and non-agent video */}
            {(modality === "image" || modality === "video") && !isVideoAgent && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Aspect ratio
                </label>
                <div className="flex flex-wrap gap-2">
                  {(modality === "image"
                    ? (["1:1", "16:9", "9:16"] as const)
                    : (["16:9", "9:16", "1:1"] as const)
                  ).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAspectRatio(r)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        aspectRatio === r
                          ? "border-brand/60 bg-brand/10 text-brand"
                          : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
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
                <span className="tabular-nums text-brand">{quote.total} Aura</span>
              </div>
              {awaitingFullRender && (
                <div className="mt-2 flex items-center justify-between border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
                  <span>Server-confirmed price</span>
                  {estimateLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> confirming…
                    </span>
                  ) : (
                    <span className="tabular-nums text-neutral-300">{displayCost} Aura</span>
                  )}
                </div>
              )}
            </div>

            {/* Pre-click plan-limit warnings: shown BEFORE the user clicks into a
                server-side rejection (duration cap, HD/4K entitlement), with the
                actual limit and the plan that lifts it. Client-side warnings are
                instant; server-confirmed extras cover anything the client missed. */}
            <PlanLimitNotice warnings={planWarnings} className="mt-3" />
            <PlanLimitNotice warnings={serverOnlyWarnings} className="mt-3" />
            {/* Server-round-trip blocker (e.g. duration cap caught at the estimate
                step) — kept for cases the structured warnings don't already cover,
                such as a tier mismatch between client state and the real profile. */}
            {awaitingFullRender &&
              serverEstimate?.blocked &&
              !planWarnings.some((w) => w.code === "duration_cap") &&
              !serverOnlyWarnings.some((w) => w.code === "duration_cap") && (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  {serverEstimate.blocked.message}
                </div>
              )}

            <button
              onClick={onGenerate}
              disabled={
                busy ||
                planBlocked ||
                // While the full-render quote is refreshing there is no valid
                // price/quoteToken for the CURRENT selection — hold the button
                // rather than submit against a stale or unknown quote.
                (awaitingFullRender && estimateLoading) ||
                !!(awaitingFullRender && serverEstimate?.blocked)
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {busy
                ? "Generating…"
                : awaitingFullRender
                  ? `Render Full Quality · ${displayCost} Aura`
                  : isPreviewPass
                    ? "Preview · 480p · 5s"
                    : `Generate · ${cost} credit${cost === 1 ? "" : "s"}`}
            </button>

            <AlertDialog open={hdDialogOpen} onOpenChange={setHdDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Render at {resolution === "2160p" ? "4K (2160p)" : "HD (1080p)"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will charge <strong>{displayCost} Aura</strong> from your balance to produce a full-quality {resolution === "2160p" ? "4K" : "HD"} render.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void doGenerate()}>
                    Confirm &amp; Render
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

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
                <Link to="/auth" search={authNextSearch()} className="underline">
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
                  <BlurredPreview
                    src={result.url}
                    alt="Generated image"
                    aspectRatio={result.aspectRatio.replace(":", "/")}
                    className="rounded-lg border-0"
                  />
                )}
                {result.kind === "video" && (
                  <div style={{ aspectRatio: result.aspectRatio.replace(":", "/") }} className="w-full overflow-hidden rounded-lg">
                    <video src={result.url} controls className="h-full w-full object-contain" />
                  </div>
                )}
                {result.kind === "audio" && <audio src={result.url} controls className="w-full" />}
                {result.kind === "text" && (
                  <p className="whitespace-pre-wrap text-sm text-neutral-200">{result.text}</p>
                )}
                {result.url && result.kind !== "text" && (
                  <button
                    type="button"
                    onClick={() => void downloadResult(result.url, result.kind)}
                    disabled={downloading}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand transition hover:text-brand/80 disabled:opacity-60"
                  >
                    {downloading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {downloading ? "Downloading…" : "Download"}
                  </button>
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
                      ? "border-brand/60 bg-brand/10"
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
                className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 relative group"
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
                <button
                  type="button"
                  onClick={() => { if (confirm("Delete this generation permanently?")) orcDelMut.mutate(g.id); }}
                  disabled={orcDelMut.isPending}
                  className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80 disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="size-3" />
                </button>
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
