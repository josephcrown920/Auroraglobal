import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Music, Play, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/PageSpinner";
import { AuthRedirect } from "@/components/AuthRedirect";
import { usePerformanceShotJobFn, useVideoFromImageJobFn } from "@/lib/use-job-polling";
import { handleGenerationError, friendlyGenerationMessage } from "@/lib/error-toasts";
import { computeCost } from "@/lib/pricing";
import { TEMPLATE_DEFAULTS } from "@/lib/template-studio";

export const Route = createLazyFileRoute("/beat-reel")({ component: BeatReelPage });

// ── Cost constants (client-safe — derived from pricing.ts only) ──────────────
// These must stay in sync with what the server charges:
//   Image stage:   computeCost({ features: ["image"] }).total             = 10 Aura
//   Preview video: computeCost({ features: ["video"], resolution:"480p" }).total = 50 Aura
//   Full video:    computeCost({ features: ["video"], resolution:"720p" }).total = 100 Aura
const IMAGE_COST = computeCost({ features: ["image"] }).total;
const VIDEO_PREVIEW_COST = computeCost({
  features: ["video"],
  model: TEMPLATE_DEFAULTS.videoModel,
  durationSeconds: 5,
  resolution: "480p",
}).total;
const VIDEO_FULL_COST = computeCost({
  features: ["video"],
  model: TEMPLATE_DEFAULTS.videoModel,
  durationSeconds: 5,
  resolution: "720p",
}).total;
// First submit charges image + preview. Confirming a preview charges full video only.
const FIRST_GEN_COST = IMAGE_COST + VIDEO_PREVIEW_COST;

// Preset beat track — shipped as a static asset.
// The track's drop is timed to ~2.5 s (the midpoint of a 5-second reel),
// matching the snap-zoom moment the video prompt forces at the midpoint.
const BEAT_TRACK_URL = "/audio/the-one-hook2-clip.mp3";

// ── Generation prompts ────────────────────────────────────────────────────────
const IMAGE_PROMPT =
  "Editorial fashion photograph. Show the EXACT person from the first reference image wearing " +
  "the EXACT outfit from the second reference image. Preserve the person's facial features, " +
  "skin tone, body proportions, and hair faithfully. Render the outfit with accurate fabric " +
  "texture, colour, and cut. Professional fashion editorial lighting, VERTICAL 9:16 portrait " +
  "format optimised for mobile short-form video, shallow depth of field, urban streetwear " +
  "aesthetic, high-end styling. " +
  "Preserve the exact facial likeness, skin tone, hair and identity from the uploaded reference photo with no drift.";

const VIDEO_PROMPT =
  "Vertical 9:16 fashion reel. The subject stands confidently displaying the outfit. " +
  "At EXACTLY the midpoint of the clip — a sudden, sharp snap-zoom jump-cut: the camera " +
  "lurches instantly close to the outfit detail, like a beat-drop transition. " +
  "The cut is abrupt and dramatic, NOT a smooth zoom. " +
  "First half: wide confident stance with subtle sway. " +
  "Second half: tight close-up on outfit texture and fit. " +
  "Urban fashion editorial, cinematic lighting, camera locked off except for the snap-zoom moment.";

// ── Component ────────────────────────────────────────────────────────────────
function BeatReelPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [outfitUrl, setOutfitUrl] = useState<string | null>(null);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // previewId: when set, the last video render was a 480p preview. Pass it as
  // confirmPreviewId to unlock the full 720p render on the next submit.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [stageLabel, setStageLabel] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Ref keeps the staged image URL available to the mutationFn closure without
  // relying on React state capture timing — guarantees the confirm step reuses
  // the exact same composite image from the preview step (no re-run of Stage 1).
  const stagedImageRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const genFn = usePerformanceShotJobFn();
  const videoFn = useVideoFromImageJobFn();

  // Helper: keep state + ref in sync so the mutation always reads the latest URL.
  const storeStagedImage = (url: string | null) => {
    stagedImageRef.current = url;
    setStagedImage(url);
  };

  // ── Two-stage chained mutation ────────────────────────────────────────────
  const genMut = useMutation({
    mutationFn: async ({ currentPreviewId }: { currentPreviewId: string | null }) => {
      if (!portraitUrl) throw new Error("Upload your portrait first");
      if (!outfitUrl) throw new Error("Upload an outfit photo first");

      // Determine whether this is a preview-confirm step.
      // On confirm: skip Stage 1 entirely — reuse the same composite image so
      // the user is confirming exactly what they previewed, not a new render.
      const isConfirmStep = !!(currentPreviewId && stagedImageRef.current);
      let imageUrl: string;

      if (isConfirmStep) {
        // Stage 1 skip: use the existing composite (already charged & displayed).
        imageUrl = stagedImageRef.current!;
      } else {
        // Stage 1 — identity-preserving composite image in 9:16 format.
        // generatePerformanceShot enforces reference-image ownership guard
        // for both uploaded URLs before reserving credits.
        setStageLabel("Compositing outfit…");
        const imgOut = await genFn({
          data: {
            prompt: IMAGE_PROMPT,
            imageUrls: [portraitUrl, outfitUrl],
            motionVideoUrl: null,
            model: TEMPLATE_DEFAULTS.imageModel,
          },
        });
        imageUrl = imgOut.resultUrl;
        storeStagedImage(imgOut.resultUrl);
      }

      // Stage 2 — animate to a 9:16 snap-zoom reel.
      // The preview-confirm gate is enforced inside generateVideoFromImage:
      //   • First submit (currentPreviewId=null): forces 480p/≤5s, records mode='preview'
      //   • Confirm submit (currentPreviewId=<uuid>): full 720p render
      setStageLabel(currentPreviewId ? "Rendering full quality…" : "Rendering preview reel…");
      const vidOut = await videoFn({
        data: {
          imageUrl,
          prompt: VIDEO_PROMPT,
          duration: 5,
          resolution: currentPreviewId ? "720p" : "480p",
          modelKey: TEMPLATE_DEFAULTS.videoModel,
          cameraMovement: null,
          endFrameUrl: null,
          confirmPreviewId: currentPreviewId ?? undefined,
        },
      });
      return vidOut;
    },
    onMutate: () => {
      setGenError(null);
      setStageLabel("Starting…");
    },
    onSuccess: (out) => {
      setVideoUrl(out.videoUrl);
      qc.invalidateQueries({ queryKey: ["profile"] });
      if (out.preview) {
        setPreviewId(out.id);
        toast.success("Preview ready — tap Render Full Quality for the shareable reel");
      } else {
        setPreviewId(null);
        toast.success("Your beat-drop reel is ready! 🎬");
      }
    },
    onError: (e) => {
      if (e instanceof Error && e.message.includes("Unsupported preview confirmation")) {
        setPreviewId(null);
      }
      setGenError(friendlyGenerationMessage(e));
      handleGenerationError(e);
    },
    onSettled: () => setStageLabel(""),
  });

  // Snapshot previewId at trigger time so the mutationFn closure sees the
  // correct value even if state updates race with the async work.
  const handleGenerate = () => {
    genMut.mutate({ currentPreviewId: previewId });
  };

  // ── Beat-synced player callbacks ──────────────────────────────────────────
  // Audio stays aligned with the video on every play/pause/seek/loop event.
  // The beat track is pre-aligned so its drop lands at ~2.5 s — the snap-zoom
  // midpoint forced by the video prompt.
  const syncAudio = useCallback(() => {
    if (audioRef.current && videoRef.current) {
      audioRef.current.currentTime = videoRef.current.currentTime;
    }
  }, []);

  const handlePlay = useCallback(() => {
    syncAudio();
    audioRef.current?.play().catch(() => {
      // Autoplay blocked — audio unlocks on next user gesture (native video play counts).
    });
  }, [syncAudio]);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const handleSeeked = useCallback(() => {
    syncAudio();
    if (videoRef.current && !videoRef.current.paused) {
      audioRef.current?.play().catch(() => {});
    }
  }, [syncAudio]);

  const handleEnded = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // ── Download (cross-origin-safe fetch→Blob) ───────────────────────────────
  // <a download> silently fails across origins (studio bucket). Fetch→objectURL
  // forces a real save dialog. Downloaded file is the silent video — audio
  // overlay is player-only (baking it in is a follow-up task).
  const handleDownload = async () => {
    if (!videoUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "beat-reel.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      toast.error("Download failed — try long-pressing the video to save instead");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (!user) return <AuthRedirect />;

  const canGenerate = !!portraitUrl && !!outfitUrl && !genMut.isPending;
  const isPreviewDone = !!videoUrl && !!previewId;
  // First submit: image (10) + preview video (50) = 60 Aura
  // Confirm step: full video only (100) — image is reused, not re-charged
  const displayCost = isPreviewDone ? VIDEO_FULL_COST : FIRST_GEN_COST;

  const resetPhotos = () => {
    storeStagedImage(null);
    setVideoUrl(null);
    setPreviewId(null);
  };

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl">
        <Link
          to="/templates"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline"
        >
          <ArrowLeft className="size-4" /> Templates
        </Link>
        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Music className="size-3.5" /> Urban Cuts
        </span>
      </header>

      <section className="relative z-10 px-5 pb-32 pt-6 space-y-6 max-w-md mx-auto">
        {/* Title */}
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Zap className="size-3" /> Urban Cuts Style
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Beat-Drop
            <span className="block aurora-gradient-text">Outfit Reel</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Upload your portrait and a target outfit. Aurora composites you wearing it, then renders a 9:16 vertical reel with a snap-zoom jump-cut timed to the beat drop.
          </p>
        </div>

        {/* Upload slots */}
        <div className="grid grid-cols-2 gap-3">
          <UploadSlot
            userId={user.id}
            label="Your portrait"
            hint="Clear front-facing or ¾ photo of you"
            value={portraitUrl}
            onChange={(url) => { setPortraitUrl(url); resetPhotos(); }}
          />
          <UploadSlot
            userId={user.id}
            label="Outfit photo"
            hint="Photo of the clothing or style"
            value={outfitUrl}
            onChange={(url) => { setOutfitUrl(url); resetPhotos(); }}
          />
        </div>

        {/* Cost + generate button */}
        <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isPreviewDone
                ? "Full-quality 720p render (image reused)"
                : "Composite image + 480p preview reel"}
            </span>
            <span className="font-semibold text-foreground">
              {displayCost} <span className="text-primary text-xs">Aura</span>
            </span>
          </div>

          {isPreviewDone && (
            <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
              Your portrait composite is reused — only the video re-renders at full quality.
            </p>
          )}

          <Button
            className="w-full"
            disabled={!canGenerate}
            onClick={handleGenerate}
            variant="premium"
          >
            {genMut.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {stageLabel || "Generating…"}
              </span>
            ) : isPreviewDone ? (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Render Full Quality · {VIDEO_FULL_COST} Aura
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Generate Reel · {FIRST_GEN_COST} Aura
              </span>
            )}
          </Button>
        </div>

        {/* Error state */}
        {genError && !genMut.isPending && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {genError}
          </p>
        )}

        {/* Staged composite image (visible while video is generating on first submit) */}
        {stagedImage && genMut.isPending && !previewId && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Composite image
            </p>
            <div className="relative mx-auto max-w-[180px]">
              <img
                src={stagedImage}
                alt="Composited outfit"
                className="w-full rounded-2xl object-cover shadow-lg opacity-80"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/40 backdrop-blur-[2px]">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-xs text-white/80">Animating…</span>
              </div>
            </div>
          </div>
        )}

        {/* Result player */}
        {videoUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Play className="size-3.5" />
                {previewId ? "Preview (480p)" : "Your reel (720p)"}
              </p>
              {!previewId && (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:brightness-125 transition-all disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {downloading ? "Saving…" : "Download (silent)"}
                </button>
              )}
            </div>

            {/* 9:16 player with beat-synced audio overlay */}
            <div className="relative mx-auto max-w-[240px] rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full aspect-[9/16] object-cover"
                controls
                playsInline
                loop
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
                onEnded={handleEnded}
              />
              {/* Beat track — audio-only, synced to video playback via ref callbacks above */}
              <audio ref={audioRef} src={BEAT_TRACK_URL} preload="auto" loop />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-10 pt-4">
                <Music className="size-3 text-primary shrink-0" />
                <span className="text-[10px] text-white/70">Beat track plays on tap</span>
              </div>
            </div>

            {previewId && (
              <p className="text-center text-xs text-muted-foreground px-4">
                This is a 480p preview. Tap{" "}
                <span className="text-foreground font-medium">Render Full Quality</span> above
                for the 720p shareable version. Your composite image is reused — no extra charge.
              </p>
            )}
          </div>
        )}

        {/* How it works — shown only before first result */}
        {!videoUrl && !genMut.isPending && (
          <div className="rounded-2xl border border-border/50 bg-card/20 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How it works</p>
            <ol className="space-y-2.5 text-sm text-muted-foreground">
              {[
                "Aurora composites you wearing the exact outfit from photo 2",
                "The composite is animated into a 9:16 vertical reel",
                "A snap-zoom jump-cut fires at the beat-drop midpoint (~2.5 s)",
                "A preset beat track plays in the player, synced to the drop",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground/70 pt-1">
              Download gives you the silent video. Audio overlay is player-only — baked-in audio is coming soon.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
