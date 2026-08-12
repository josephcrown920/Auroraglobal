import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExampleOutputGrid } from "@/components/studio/ExampleOutputGrid";
import { useServerFn } from "@tanstack/react-start";
import { LipSyncDemo } from "@/components/landing/LipSyncDemo";
import { Mic2, ArrowRight, Upload, Music2, Wand2, Download, Loader2, Play, Pause, CheckCircle2, X, Zap, Sparkles, Server, ImageIcon, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startLipsync, startBatchLipsync } from "@/lib/lipsync.functions";
import { friendlyGenerationMessage, handleGenerationError } from "@/lib/error-toasts";
import { GenerationProgress } from "@/components/ui/GenerationProgress";
import { GenerationErrorCard } from "@/components/ui/GenerationErrorCard";
import { useGenerationProgress, lipsyncStatusToJobStatus } from "@/hooks/use-generation-progress";
import { ExampleChips } from "@/components/onboarding/ExampleChips";
import { LIPSYNC_EXAMPLE_PRESETS } from "@/lib/example-presets";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { hasCompletedFirstGen, hasDismissedTour, isFirstPageVisit, markFirstGenComplete, markPageVisited } from "@/lib/first-run";
import { computeCost, lipsyncEngineCost, LIPSYNC_ENGINE_MODEL, type LipsyncEngine } from "@/lib/pricing";
import { saveAssetToDisk } from "@/lib/save";
import { AUDIO_ACCEPT } from "@/lib/utils";

export const Route = createLazyFileRoute("/lipsync")({ component: LipSyncStudioPage });

type JobStatus = "idle" | "uploading" | "syncing" | "rendering" | "done" | "error";
type Engine = LipsyncEngine;

function LipSyncStudioPage() {
  return (
    <div className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <section className="relative z-10 px-6 md:px-12 pt-20 pb-4 animate-fade-in">
        <div className="max-w-5xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary border border-primary/30 bg-primary/10 px-3 py-1 rounded-full">
            <Mic2 className="size-3" /> Lip Sync Studio
          </span>
          <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
            Make any face <span className="aurora-gradient-text">sing your hook</span>.
          </h1>
        </div>
      </section>

      <LipSyncModeSwitcher />
    </div>
  );
}

function LipSyncModeSwitcher() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  return (
    <>
      <section className="relative z-10 px-6 md:px-12">
        <div className="max-w-5xl mx-auto flex items-center gap-2 rounded-2xl aurora-glass p-1 w-fit">
          {([
            { id: "single", label: "Single render" },
            { id: "batch", label: "Batch Lip Sync" },
          ] as const).map((o) => (
            <button
              key={o.id}
              onClick={() => setMode(o.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                mode === o.id ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]" : "text-white/70 hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>
      {mode === "single" ? <LipSyncForm /> : <BatchLipSyncForm />}
    </>
  );
}

function LipSyncForm() {
  const { user } = useAuth();
  const runLipsync = useServerFn(startLipsync);

  const [video, setVideo] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>("sync-v2");

  const isXaiUgc = engine === "xai-ugc";
  const isHeygenPhoto = engine === "heygen-photo";
  const isPhotoEngine = isXaiUgc || isHeygenPhoto;

  // lipsyncEngineCost is the shared UI+server price source; for xai-ugc it is
  // the full two-stage price (xAI video + mandatory relip to your audio).
  const engineCost = useMemo(() => lipsyncEngineCost(engine), [engine]);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeExampleId, setActiveExampleId] = useState("studio-quality");
  const [showTour, setShowTour] = useState(false);
  const [likelyConsent, setLikelyConsent] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [videoUrl, audioUrl, imageUrl]);

  // Guided Workflows deep-link handoff: ?image=… pre-stages a generated still
  // into the image-based engine (fetch → File, since this form uploads Files).
  const search = Route.useSearch();
  const prefilledRef = useRef<string | null>(null);
  useEffect(() => {
    const url = search.image;
    if (!url || prefilledRef.current === url) return;
    prefilledRef.current = url;
    setEngine("xai-ugc");
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch failed (${res.status})`);
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) throw new Error("not an image");
        const file = new File([blob], "guided-workflow-still.jpg", { type: blob.type });
        setImage(file);
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(file);
        });
      } catch {
        toast.error("Couldn't load the image from your workflow — please upload it manually.");
      }
    })();
  }, [search.image]);

  useEffect(() => {
    if (!hasCompletedFirstGen() && isFirstPageVisit("lipsync")) {
      markPageVisited("lipsync");
      const p = LIPSYNC_EXAMPLE_PRESETS[0];
      if (p.extra?.engine) setEngine(p.extra.engine as Engine);
      setActiveExampleId(p.id);
    }
    if (!hasDismissedTour()) {
      const t = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const onVideo = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/") && !f.type.startsWith("image/")) {
      return toast.error("Please upload a video or image file");
    }
    if (f.size > 100 * 1024 * 1024) return toast.error("Video must be under 100MB");
    setVideo(f);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(f));
    setStatus("idle");
    setResultUrl(null);
  };

  const onImage = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      return toast.error("Please upload a JPG, PNG, or WebP photo");
    }
    if (f.size > 20 * 1024 * 1024) return toast.error("Photo must be under 20MB");
    setImage(f);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(f));
    setStatus("idle");
    setResultUrl(null);
  };

  const onAudio = (f: File | null) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return toast.error("Audio must be under 50MB");
    setAudio(f);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
    setStatus("idle");
    setResultUrl(null);
  };

  const uploadOne = async (file: File, kind: "video" | "audio" | "image"): Promise<string> => {
    const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "jpg");
    const path = `${user!.id}/lipsync/${Date.now()}-${kind}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(`${kind} upload failed: ${error.message}`);
    const { data: signed, error: signErr } = await supabase.storage
      .from("studio")
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) throw new Error(`${kind} URL failed: ${signErr?.message ?? "no url"}`);
    return signed.signedUrl;
  };

  const run = async (opts?: { videoFile: File; audioFile: File }) => {
    const vid = opts?.videoFile ?? video;
    const aud = opts?.audioFile ?? audio;
    const img = image;

    if (!likelyConsent) return toast.error("Please confirm you have the rights to use this voice and likeness before generating");

    if (isPhotoEngine) {
      if (!img) return toast.error(`Upload a still photo for the ${isXaiUgc ? "xAI UGC" : "HeyGen Photo"} engine`);
      if (!aud) return toast.error("Upload a vocal track");
    } else {
      if (!vid || !aud) return toast.error("Upload both a clip and a vocal first");
    }
    if (!user) return toast.error("Sign in to run lip sync");

    setStatus("uploading");
    setProgress(5);
    setResultUrl(null);
    setErrorMsg(null);

    let p = 5;
    const ticker = setInterval(() => {
      p = Math.min(95, p + Math.random() * 4 + 1);
      setProgress(p);
      setStatus(p < 30 ? "uploading" : p < 70 ? "syncing" : "rendering");
    }, 600);

    try {
      let vUrl: string;
      let iUrl: string | undefined;

      if (isPhotoEngine) {
        // For xAI UGC / HeyGen Photo, upload the still photo as the "image" source.
        // We still need a placeholder videoUrl for the server schema — pass the image URL there too.
        [iUrl] = await Promise.all([
          uploadOne(img!, "image"),
        ]);
        vUrl = iUrl; // schema requires videoUrl; server ignores it for photo engines
      } else {
        [vUrl] = await Promise.all([uploadOne(vid!, "video")]);
      }

      const [aUrl] = await Promise.all([uploadOne(aud!, "audio")]);

      setStatus("syncing");
      const res = await runLipsync({
        data: {
          videoUrl: vUrl,
          audioUrl: aUrl,
          engine,
          ...(isPhotoEngine && iUrl ? { imageUrl: iUrl } : {}),
        },
      });
      clearInterval(ticker);
      if (res.status === "done" && res.resultUrl) {
        setProgress(100);
        setStatus("done");
        setResultUrl(res.resultUrl);
        markFirstGenComplete();
        toast.success("Lip-sync rendered.");
      } else {
        setStatus("error");
        const reason = res.status === "error" ? (res as { error?: string }).error ?? "Render failed" : "Render failed";
        const friendly = friendlyGenerationMessage(reason);
        setErrorMsg(friendly);
        toast.error(friendly);
      }
    } catch (e) {
      clearInterval(ticker);
      setStatus("error");
      setErrorMsg(friendlyGenerationMessage(e));
      handleGenerationError(e);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setVideo(null); setAudio(null); setImage(null);
    setVideoUrl(null); setAudioUrl(null); setImageUrl(null);
    setStatus("idle"); setProgress(0); setPlaying(false); setResultUrl(null); setErrorMsg(null);
  };

  const download = () => {
    if (!resultUrl) return;
    const filename = `synced-${((isPhotoEngine ? image?.name : video?.name) ?? "clip").replace(/\.[^.]+$/, "")}.mp4`;
    saveAssetToDisk(resultUrl, filename);
  };

  const stageLabel: Record<JobStatus, string> = {
    idle: "Ready",
    uploading: "Uploading assets…",
    syncing: isPhotoEngine ? "Animating photo into talking-head…" : "Aligning phonemes to mouth shapes…",
    rendering: "Rendering final clip…",
    done: "Sync complete",
    error: "Something went wrong",
  };

  const busy = status === "uploading" || status === "syncing" || status === "rendering";

  const genProgress = useGenerationProgress({
    jobStatus: lipsyncStatusToJobStatus(status),
    persistKey: "aurora.progress.lipsync",
    estimatedMs: isPhotoEngine ? 90_000 : 45_000,
    labels: {
      queued: "Uploading assets…",
      processing: isPhotoEngine ? "Animating photo into talking-head…" : "Aligning phonemes to mouth shapes…",
      finalizing: "Rendering final clip…",
      done: "Sync complete",
      error: "Something went wrong",
    },
  });

  const hasSource = isPhotoEngine ? !!image : !!video;

  return (
    <section className="relative z-10 px-6 md:px-12 pb-12">
      <div className="max-w-5xl mx-auto rounded-3xl aurora-glass p-6 md:p-8 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="aurora-kicker">New job</p>
            <h2 className="text-xl md:text-2xl font-semibold mt-1">Run a lip sync</h2>
          </div>
          {(video || audio || image) && (
            <button onClick={reset} className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1">
              <X className="size-3" /> Reset
            </button>
          )}
        </div>

        {!user && (
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            You need to <Link to="/auth" search={authNextSearch()} className="underline font-semibold">sign in</Link> to upload clips and run a render.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isPhotoEngine ? (
            <DropSlot
              label="Still photo (selfie / portrait)"
              hint="JPG / PNG / WebP · up to 20MB"
              icon={ImageIcon}
              accept="image/*"
              file={image}
              onFile={onImage}
              previewUrl={imageUrl}
              kind="image"
            />
          ) : (
            <DropSlot
              label="Performance source"
              hint="MP4 / MOV / JPG / PNG · up to 100MB"
              icon={Upload}
              accept="video/*,image/*"
              file={video}
              onFile={onVideo}
              previewUrl={videoUrl}
              kind="video"
            />
          )}
          <DropSlot
            label="Vocal track"
            hint="Any audio · up to 50MB"
            icon={Music2}
            accept={AUDIO_ACCEPT}
            file={audio}
            onFile={onAudio}
            previewUrl={audioUrl}
            kind="audio"
          />
        </div>

        {/* xAI UGC: show the hardcoded prompt so the user knows what will be generated */}
        {isXaiUgc && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <Info className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary mb-1">xAI UGC — hardcoded prompt</p>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Your still photo is animated into a realistic UGC-style walking talking-head video (9:16, ~10s).
                  The person walks toward the camera speaking the built-in script with natural lip-sync, micro-expressions,
                  and slight handheld-cam movement — optimised for TikTok / Reels.
                </p>
                <p className="text-[11px] text-white/50 mt-1 italic">
                  Powered by xAI grok-imagine-video-1.5. Your uploaded audio DRIVES the final voice — the
                  clip is re-lip-synced to your track, so the character sounds identical on every render.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* HeyGen Photo: single-stage photo animator, no fixed script */}
        {isHeygenPhoto && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <Info className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary mb-1">HeyGen Photo — no script needed</p>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Your still photo is animated directly to your uploaded audio — HeyGen generates the talking
                  motion and syncs the lips to whatever plays in your track. No fixed script, no walking shot —
                  just a natural talking-head performance of your photo.
                </p>
                <p className="text-[11px] text-white/50 mt-1 italic">
                  Powered by HeyGen. Works with any vocal, voiceover, or spoken track — the mouth follows your audio exactly.
                </p>
              </div>
            </div>
          </div>
        )}

        <WelcomeTour show={showTour} onDismiss={() => setShowTour(false)} />
        {!isPhotoEngine && (
          <ExampleChips
            presets={LIPSYNC_EXAMPLE_PRESETS}
            activeId={activeExampleId}
            onSelect={(preset) => {
              if (preset.extra?.engine) setEngine(preset.extra.engine as Engine);
              setActiveExampleId(preset.id);
            }}
            onGenerate={() => {
              if (video && audio) {
                void run();
                return;
              }
              const preset = LIPSYNC_EXAMPLE_PRESETS.find((p) => p.id === activeExampleId);
              const demoVideo = typeof preset?.extra?.sampleVideoUrl === "string" ? preset.extra.sampleVideoUrl : null;
              const demoAudio = typeof preset?.extra?.sampleAudioUrl === "string" ? preset.extra.sampleAudioUrl : null;
              if (demoVideo && demoAudio) {
                toast.loading("Loading demo media…", { id: "lipsync-demo" });
                Promise.all([fetch(demoVideo), fetch(demoAudio)])
                  .then(([vr, ar]) => Promise.all([vr.blob(), ar.blob()]))
                  .then(([vb, ab]) => {
                    toast.dismiss("lipsync-demo");
                    void run({
                      videoFile: new File([vb], "demo-video.mp4", { type: "video/mp4" }),
                      audioFile: new File([ab], "demo-audio.mp3", { type: "audio/mpeg" }),
                    });
                  })
                  .catch(() => {
                    toast.dismiss("lipsync-demo");
                    toast.error("Failed to fetch demo media");
                  });
              } else {
                void run();
              }
            }}
            label="Pick a mode:"
            className="mt-5"
          />
        )}

        {/* Engine toggle */}
        <div className="mt-4">
          <p className="aurora-kicker mb-2">Engine</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-2xl aurora-glass p-1">
            {([
              { id: "sync-v2", label: "Studio", sub: "Sync 1.9 · film-grade", icon: Sparkles },
              { id: "wav2lip", label: "Fast", sub: "Wav2Lip · cheaper", icon: Zap },
              { id: "latentsync", label: "Self-hosted", sub: "LatentSync · your GPU", icon: Server },
              { id: "xai-ugc", label: "xAI UGC", sub: "Still photo → talking head", icon: ImageIcon },
              { id: "heygen-photo", label: "HeyGen Photo", sub: "Still photo → your audio", icon: ImageIcon },
            ] as const).map(o => (
              <button
                key={o.id}
                onClick={() => setEngine(o.id)}
                disabled={busy}
                className={`flex items-center gap-2 justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  engine === o.id ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]" : "text-white/70 hover:text-white"
                }`}
              >
                <o.icon className="size-3.5 shrink-0" />
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            {engine === "sync-v2" && "Sync 1.9 — film-grade phoneme alignment on a video clip"}
            {engine === "wav2lip" && "Wav2Lip — fast & cheap, slightly lower quality"}
            {engine === "latentsync" && "LatentSync — runs on your registered GPU worker"}
            {engine === "xai-ugc" && "grok-imagine-video-1.5 — animates a still photo into a 9:16 UGC talking-head video"}
            {engine === "heygen-photo" && "HeyGen — animates a still photo directly to your uploaded audio, no fixed script"}
          </p>
        </div>

        {/* Voice & likeness consent */}
        <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={likelyConsent}
            onChange={(e) => setLikelyConsent(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-primary)] flex-shrink-0"
          />
          <span className="text-xs text-white/70 leading-relaxed">
            I confirm I have the legal right to use this voice and likeness for AI generation.{" "}
            <Link
              to="/legal/$slug"
              params={{ slug: "ai-policy" }}
              className="underline text-white/60 hover:text-white"
              target="_blank"
            >
              AI &amp; Content Policy
            </Link>
          </span>
        </label>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => void run()}
            disabled={!hasSource || !audio || busy || !user || !likelyConsent}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)] px-6 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover-scale"
          >
            {busy ? (
              <><Loader2 className="size-4 animate-spin" /> {stageLabel[status]}</>
            ) : status === "done" ? (
              <><CheckCircle2 className="size-4" /> Run again</>
            ) : (
              <><Wand2 className="size-4" /> {isPhotoEngine ? "Generate video" : "Run lip sync"}</>
            )}
          </button>
          <p className="text-xs text-white/50">
            {engine === "latentsync"
              ? `${engineCost} Aura · your GPU worker`
              : engine === "xai-ugc"
              ? `${engineCost} Aura · ~90s · 9:16 vertical`
              : engine === "heygen-photo"
              ? `${engineCost} Aura · ~60s`
              : `${engineCost} Aura · ~${engine === "sync-v2" ? "45" : "25"}s`}
          </p>
        </div>

        <GenerationProgress
          visible={genProgress.isActive && genProgress.state !== "done"}
          progress={genProgress.progress}
          label={genProgress.label}
        />

        {status === "error" && (
          <GenerationErrorCard
            visible
            error={errorMsg}
            onRetry={() => void run()}
            retryLabel="Try again"
          />
        )}

        {status === "done" && resultUrl && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-300" />
                <p className="text-sm font-semibold text-emerald-100">
                  {isXaiUgc ? "UGC video generated" : isHeygenPhoto ? "Photo video generated" : "Synced render"}
                </p>
              </div>
              <button onClick={download} className="inline-flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover-scale">
                <Download className="size-3.5" /> Download
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
              <video
                ref={videoRef}
                src={resultUrl}
                playsInline
                loop
                className="w-full max-h-[60vh] object-contain"
                onEnded={() => setPlaying(false)}
              />
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group"
                aria-label={playing ? "Pause" : "Play"}
              >
                <span className="size-14 rounded-full bg-white/90 text-black flex items-center justify-center opacity-90 group-hover:scale-110 transition-transform">
                  {playing ? <Pause className="size-6" /> : <Play className="size-6 ml-0.5" />}
                </span>
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/50">
              Rendered with{" "}
              {engine === "sync-v2" ? "Sync 1.9 (Studio)"
                : engine === "wav2lip" ? "Wav2Lip (Fast)"
                : engine === "xai-ugc" ? "xAI grok-imagine-video-1.5 (UGC)"
                : engine === "heygen-photo" ? "HeyGen Photo"
                : "LatentSync (self-hosted)"}.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

type BatchItemResult = {
  sourceUrl: string;
  id: string | null;
  status: "done" | "error" | string;
  resultUrl?: string;
  error?: string;
};

function BatchLipSyncForm() {
  const { user } = useAuth();
  const runBatch = useServerFn(startBatchLipsync);

  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>("heygen-photo");
  const [likelyConsent, setLikelyConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BatchItemResult[] | null>(null);

  const isPhotoEngine = engine === "xai-ugc" || engine === "heygen-photo";
  const engineCost = useMemo(() => lipsyncEngineCost(engine), [engine]);
  const totalCost = engineCost * photos.length;

  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [previews, audioUrl]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/") && f.size <= 20 * 1024 * 1024);
    if (!valid.length) return toast.error("Please add JPG/PNG/WebP photos under 20MB each");
    setPhotos((prev) => {
      const next = [...prev, ...valid].slice(0, 8);
      setPreviews(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
    setResults(null);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const onAudio = (f: File | null) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return toast.error("Audio must be under 50MB");
    setAudio(f);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
    setResults(null);
  };

  const uploadOne = async (file: File, kind: "audio" | "image"): Promise<string> => {
    const ext = file.name.split(".").pop() || (kind === "audio" ? "mp3" : "jpg");
    const path = `${user!.id}/lipsync/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${kind}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(`${kind} upload failed: ${error.message}`);
    const { data: signed, error: signErr } = await supabase.storage
      .from("studio")
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) throw new Error(`${kind} URL failed: ${signErr?.message ?? "no url"}`);
    return signed.signedUrl;
  };

  const run = async () => {
    if (!user) return toast.error("Sign in to run batch lip sync");
    if (photos.length < 2) return toast.error("Add at least 2 photos for a batch");
    if (!audio) return toast.error("Upload a shared vocal track");
    if (!likelyConsent) return toast.error("Please confirm you have the rights to use this voice and likeness before generating");

    setBusy(true);
    setResults(null);
    try {
      const sourceUrls = await Promise.all(photos.map((f) => uploadOne(f, "image")));
      const aUrl = await uploadOne(audio, "audio");
      const res = await runBatch({ data: { sourceUrls, audioUrl: aUrl, engine } });
      setResults(res.results as BatchItemResult[]);
      if (res.succeeded > 0) markFirstGenComplete();
      if (res.failed === 0) toast.success(`All ${res.succeeded} videos rendered.`);
      else toast.warning(`${res.succeeded} rendered, ${res.failed} failed.`);
    } catch (e) {
      handleGenerationError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative z-10 px-6 md:px-12 pb-12">
      <div className="max-w-5xl mx-auto rounded-3xl aurora-glass p-6 md:p-8 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="aurora-kicker">Batch Lip Sync</p>
            <h2 className="text-xl md:text-2xl font-semibold mt-1">N photos, one audio, N videos</h2>
            <p className="mt-1 text-xs text-white/60">Upload up to 8 photos and one shared vocal track — Aurora renders a lip-synced video for each photo.</p>
          </div>
          {(photos.length > 0 || audio) && (
            <button
              onClick={() => { setPhotos([]); previews.forEach((u) => URL.revokeObjectURL(u)); setPreviews([]); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudio(null); setAudioUrl(null); setResults(null); }}
              className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1"
            >
              <X className="size-3" /> Reset
            </button>
          )}
        </div>

        {!user && (
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            You need to <Link to="/auth" search={authNextSearch()} className="underline font-semibold">sign in</Link> to upload photos and run a batch.
          </div>
        )}

        <label
          className="relative block rounded-2xl border-2 border-dashed border-white/15 bg-white/5 hover:bg-white/10 p-4 cursor-pointer transition-colors"
        >
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" />
            <p className="text-sm font-semibold">Photos ({photos.length}/8)</p>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5">JPG / PNG / WebP · up to 20MB each · min 2, max 8</p>
        </label>

        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-4 md:grid-cols-8 gap-2">
            {previews.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-black/40 group">
                <img src={url} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 size-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove photo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <DropSlot
            label="Shared vocal track"
            hint="Any audio · up to 50MB · applied to every photo"
            icon={Music2}
            accept={AUDIO_ACCEPT}
            file={audio}
            onFile={onAudio}
            previewUrl={audioUrl}
            kind="audio"
          />
        </div>

        <div className="mt-4">
          <p className="aurora-kicker mb-2">Engine</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-2xl aurora-glass p-1">
            {([
              { id: "heygen-photo", label: "HeyGen Photo" },
              { id: "xai-ugc", label: "xAI UGC" },
              { id: "sync-v2", label: "Studio" },
              { id: "wav2lip", label: "Fast" },
              { id: "latentsync", label: "Self-hosted" },
            ] as const).map((o) => (
              <button
                key={o.id}
                onClick={() => setEngine(o.id)}
                disabled={busy}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  engine === o.id ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]" : "text-white/70 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            {isPhotoEngine
              ? "Each photo is used directly as the source still for this engine."
              : "Non-photo engines treat each photo as a single-frame source clip."}
          </p>
        </div>

        <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={likelyConsent}
            onChange={(e) => setLikelyConsent(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-primary)] flex-shrink-0"
          />
          <span className="text-xs text-white/70 leading-relaxed">
            I confirm I have the legal right to use this voice and likeness for every photo in this batch.{" "}
            <Link to="/legal/$slug" params={{ slug: "ai-policy" }} className="underline text-white/60 hover:text-white" target="_blank">
              AI &amp; Content Policy
            </Link>
          </span>
        </label>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => void run()}
            disabled={photos.length < 2 || !audio || busy || !user || !likelyConsent}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)] px-6 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover-scale"
          >
            {busy ? (
              <><Loader2 className="size-4 animate-spin" /> Rendering {photos.length} videos…</>
            ) : (
              <><Wand2 className="size-4" /> Run batch ({photos.length || 0})</>
            )}
          </button>
          {photos.length > 0 && (
            <p className="text-xs text-white/50">{engineCost} Aura × {photos.length} = {totalCost} Aura total</p>
          )}
        </div>

        {results && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {results.map((r, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                {r.status === "done" && r.resultUrl ? (
                  <video src={r.resultUrl} controls playsInline loop className="w-full aspect-square object-cover bg-black" />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-red-500/10 p-2">
                    <p className="text-[10px] text-red-200 text-center leading-tight">{r.error ?? "Failed"}</p>
                  </div>
                )}
                {r.status === "done" && r.resultUrl && (
                  <button
                    type="button"
                    onClick={() => saveAssetToDisk(r.resultUrl!, `batch-lipsync-${i + 1}.mp4`)}
                    className="flex items-center justify-center gap-1.5 text-[11px] py-1.5 bg-white/5 hover:bg-white/10 text-white/80 w-full"
                  >
                    <Download className="size-3" /> Save
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DropSlot({
  label, hint, icon: Icon, accept, file, onFile, previewUrl, kind,
}: {
  label: string;
  hint: string;
  icon: typeof Upload;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  previewUrl: string | null;
  kind: "video" | "audio" | "image";
}) {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`relative block rounded-2xl border-2 border-dashed p-4 cursor-pointer transition-colors ${
        drag ? "border-primary bg-primary/10" : file ? "border-emerald-400/40 bg-emerald-500/5" : "border-white/15 bg-white/5 hover:bg-white/10"
      }`}
    >
      <input type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="text-[11px] text-white/50 mt-0.5">{hint}</p>

      {file && previewUrl ? (
        <div className="mt-3 rounded-lg overflow-hidden bg-black/40">
          {kind === "video" ? (
            <AutoplayVideo src={previewUrl} className="w-full max-h-48 object-contain" controls autoPlay={false} />
          ) : kind === "image" ? (
            <img src={previewUrl} alt="preview" className="w-full max-h-48 object-contain" />
          ) : (
            <audio src={previewUrl} className="w-full" controls />
          )}
          <p className="text-[11px] text-white/60 px-2 py-1.5 truncate">{file.name}</p>
        </div>
      ) : (
        <div className="mt-3 h-32 rounded-lg border border-white/10 bg-black/20 flex flex-col items-center justify-center text-white/40">
          <Upload className="size-5 mb-1" />
          <p className="text-[11px]">Click or drop file</p>
        </div>
      )}
    </label>
  );
}

// ── Lipsync inspiration block ─────────────────────────────────────────────────
const LIPSYNC_EXAMPLES = [
  { src: "/josh/josh-pink-mic-portrait.jpg",   label: "Studio Sync",    caption: "Sync 1.9 · film-grade phoneme alignment" },
  { src: "/josh/josh-concert-performance.webp", label: "Live energy",   caption: "Performance clip + vocal stem → synced" },
  { src: "/josh/josh-pink-leather-mic.jpg",     label: "Pink leather",  caption: "Full-body performance sync" },
  { src: "/videos/thumbs/avatar-main.jpg",      label: "Talking head",  caption: "HeyGen Photo — still to audio" },
  { src: "/videos/thumbs/heygen-avatar-1.jpg",  label: "HeyGen voice",  caption: "Photo → animated + lip-synced" },
  { src: "/josh/josh-orange-performance.jpg",   label: "xAI UGC",       caption: "Still photo → walking talking-head" },
];

const WAVEFORM_PORTRAITS = [
  { src: "/josh/josh-pink-mic-portrait.jpg",    name: "Studio Sync",   color: "#a78bfa" },
  { src: "/josh/josh-mirror-getready.webp",     name: "HeyGen Photo",  color: "#34d399" },
  { src: "/videos/thumbs/avatar-iv.jpg",        name: "xAI UGC",       color: "#60a5fa" },
  { src: "/videos/thumbs/heygen-avatar-2.jpg",  name: "Wav2Lip Fast",  color: "#f472b6" },
];

function LipsyncInspirationBlock() {
  return (
    <div className="relative z-10 px-6 md:px-12 py-6 space-y-8">
      <style>{`
        @keyframes waveform-bar {
          0%, 100% { height: 30%; }
          50% { height: 100%; }
        }
        .wf-bar { animation: waveform-bar 0.7s ease-in-out infinite; }
      `}</style>
      <div className="max-w-5xl mx-auto">
        <ExampleOutputGrid
          items={LIPSYNC_EXAMPLES}
          title="What Aurora lip-sync creates"
          subtitle="Frame-perfect phoneme sync across engines — Sync 1.9, Wav2Lip, HeyGen Photo, xAI UGC."
          columns={3}
        />

        {/* "Now syncing" animated waveform strip */}
        <div className="mt-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pick a face, give it a voice</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {WAVEFORM_PORTRAITS.map((p) => (
              <div key={p.src} className="relative rounded-2xl overflow-hidden border border-border/60 bg-background/40 aspect-[3/4] group">
                <img
                  src={p.src}
                  alt={p.name}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-[11px] font-semibold text-white mb-2">{p.name}</p>
                  {/* Pulsing waveform bars */}
                  <div className="flex items-end gap-[3px] h-6">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <span
                        key={i}
                        className="wf-bar w-[4px] rounded-full"
                        style={{
                          background: p.color,
                          animationDelay: `${i * 0.07}s`,
                          animationDuration: `${0.5 + (i % 4) * 0.15}s`,
                          minHeight: "20%",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
