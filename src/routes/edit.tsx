import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  getAutocutUploadUrls,
  createAutocutJob,
  getGenerationStatus,
} from "@/lib/autocut-generation.functions";
import { handleGenerationError } from "@/lib/error-toasts";
import { saveAssetToDisk } from "@/lib/save";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Music2,
  Sparkles,
  TrendingUp,
  Upload,
  User2,
  Wand2,
  X,
  Zap,
} from "lucide-react";

// ─── Style manifest (client-safe, mirrors autocut.server.ts) ─────────────────

const STYLES = [
  {
    id: "hype" as const,
    label: "Hype",
    desc: "Fast cuts · beat-synced · high energy",
    Icon: Zap,
  },
  {
    id: "cinematic" as const,
    label: "Cinematic",
    desc: "Slow crossfades · epic scale",
    Icon: Film,
  },
  {
    id: "talking_head" as const,
    label: "Talking Head",
    desc: "Speaker-led · B-roll mix",
    Icon: User2,
  },
  {
    id: "tiktok_hook" as const,
    label: "TikTok Hook",
    desc: "3-sec opener · story arc",
    Icon: TrendingUp,
  },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

// ─── Music manifest (client-safe, mirrors autocut.server.ts MUSIC_TRACKS) ────

const STYLE_MUSIC: Record<StyleId, Array<{ id: string; label: string; bpm?: number }>> = {
  hype: [
    { id: "hype-1", label: "Adrenaline Rush", bpm: 128 },
    { id: "hype-2", label: "High Voltage", bpm: 140 },
    { id: "hype-3", label: "Drop the Beat", bpm: 135 },
    { id: "hype-4", label: "Fire Starter", bpm: 142 },
    { id: "hype-5", label: "Turbo Boost", bpm: 138 },
    { id: "hype-6", label: "Maximum Overdrive", bpm: 145 },
  ],
  cinematic: [
    { id: "cine-1", label: "Epic Journey", bpm: 80 },
    { id: "cine-2", label: "Dreamscape", bpm: 72 },
    { id: "cine-3", label: "Golden Hour", bpm: 76 },
    { id: "cine-4", label: "Horizon", bpm: 68 },
    { id: "cine-5", label: "Midnight Bloom", bpm: 74 },
    { id: "cine-6", label: "Celestial", bpm: 70 },
  ],
  talking_head: [
    { id: "talk-1", label: "Upbeat Chillhop", bpm: 88 },
    { id: "talk-2", label: "Coffee & Ideas", bpm: 84 },
    { id: "talk-3", label: "Focused Flow", bpm: 90 },
    { id: "talk-4", label: "Easy Groove", bpm: 86 },
    { id: "talk-5", label: "Soft Bounce", bpm: 82 },
    { id: "talk-6", label: "Workspace Vibes", bpm: 92 },
  ],
  tiktok_hook: [
    { id: "tiktok-1", label: "Trending Now", bpm: 120 },
    { id: "tiktok-2", label: "Viral Energy", bpm: 118 },
    { id: "tiktok-3", label: "Hook & Loop", bpm: 122 },
    { id: "tiktok-4", label: "Dopamine Drop", bpm: 124 },
    { id: "tiktok-5", label: "FYP Ready", bpm: 116 },
    { id: "tiktok-6", label: "Scroll Stopper", bpm: 126 },
  ],
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_MB = 100;
const MAX_CLIPS = 10;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const POLL_INTERVAL_MS = 3_000;

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/edit")({
  component: AutoCutPage,
  head: () => ({
    meta: [
      { title: "AutoCut — Aurora" },
      {
        name: "description",
        content:
          "Drop your clips, pick a style and music, and Aurora cuts a polished 9:16 short-form video for you in minutes.",
      },
      { property: "og:title", content: "AutoCut — Aurora" },
      {
        property: "og:description",
        content: "Upload clips · pick a style · get a finished 9:16 short.",
      },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/edit" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/edit" }],
  }),
});

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadSlot = { signedUrl: string; token: string; path: string };
type FileProgress = { file: File; pct: number; done: boolean };
type Phase = "idle" | "uploading" | "dispatching" | "processing" | "done" | "error";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uploadFileXhr(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); }
      else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.send(file);
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

function AutoCutPage() {
  const { user } = useAuth();

  // ── Input state ─────────────────────────────────────────────────────────
  const [files, setFiles]             = useState<File[]>([]);
  const [style, setStyle]             = useState<StyleId>("hype");
  const [musicTrackId, setMusicTrackId] = useState<string>(STYLE_MUSIC.hype[0].id);
  const [noMusic, setNoMusic]         = useState(false);

  // ── Job state ───────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<Phase>("idle");
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [resultUrl, setResultUrl]     = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingStartRef = useRef<number | null>(null);

  // ── Server fns ──────────────────────────────────────────────────────────
  const uploadUrlsFn = useServerFn(getAutocutUploadUrls);
  const createJobFn  = useServerFn(createAutocutJob);
  const getStatusFn  = useServerFn(getGenerationStatus);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── File helpers ─────────────────────────────────────────────────────────
  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: only MP4, MOV, or WebM allowed`);
        return false;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name}: max ${MAX_SIZE_MB} MB`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_CLIPS));
  }, []);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const onStyleChange = (id: StyleId) => {
    setStyle(id);
    setMusicTrackId(STYLE_MUSIC[id][0].id);
    setNoMusic(false);
  };

  // ── Polling ──────────────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (genId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s = await getStatusFn({ generationId: genId });
        if (s.status === "succeeded") {
          stopPolling();
          setResultUrl(s.videoUrl ?? s.imageUrl ?? null);
          setPhase("done");
        } else if (s.status === "failed") {
          stopPolling();
          setErrorMsg(s.error ?? "AutoCut render failed");
          setPhase("error");
        }
      } catch {
        // transient polling error — keep trying
      }
    }, POLL_INTERVAL_MS);
  };

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) { toast.error("Sign in to use AutoCut"); return; }
    if (!files.length) { toast.error("Add at least one clip first"); return; }

    setErrorMsg(null);
    setPhase("uploading");
    setFileProgress(files.map((f) => ({ file: f, pct: 0, done: false })));

    try {
      // 1. Request signed upload URLs from server
      const slots: UploadSlot[] = await uploadUrlsFn({
        files: files.map((f) => ({
          name: f.name,
          ext: (f.name.split(".").pop() ?? "mp4").toLowerCase(),
        })),
      });

      // 2. Upload each file directly to Supabase storage via signed PUT URL
      await Promise.all(
        slots.map(({ signedUrl }, idx) =>
          uploadFileXhr(signedUrl, files[idx], (pct) =>
            setFileProgress((prev) =>
              prev.map((p, i) => (i === idx ? { ...p, pct, done: pct === 100 } : p)),
            ),
          ),
        ),
      );

      // 3. Create the autocut job (server signs download URLs + enqueues)
      setPhase("dispatching");
      const { generationId: genId } = await createJobFn({
        clipPaths: slots.map((s) => s.path),
        style,
        musicTrackId: noMusic ? undefined : musicTrackId,
        aspect: "9:16",
      });

      setGenerationId(genId);
      processingStartRef.current = Date.now();
      setPhase("processing");
      startPolling(genId);
    } catch (err) {
      handleGenerationError(err);
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = () => {
    stopPolling();
    setFiles([]);
    setFileProgress([]);
    setPhase("idle");
    setGenerationId(null);
    setResultUrl(null);
    setErrorMsg(null);
    setStyle("hype");
    setMusicTrackId(STYLE_MUSIC.hype[0].id);
    setNoMusic(false);
  };

  const isActive = phase === "uploading" || phase === "dispatching" || phase === "processing";
  const overallPct = fileProgress.length
    ? Math.round(fileProgress.reduce((s, p) => s + p.pct, 0) / fileProgress.length)
    : 0;

  // ── Stage indicator derived from elapsed processing time ─────────────────
  const STAGES = [
    { key: "uploading",  label: "Uploading" },
    { key: "analysing",  label: "Analysing clips" },
    { key: "assembling", label: "Assembling" },
    { key: "rendering",  label: "Rendering" },
  ] as const;
  type StageKey = (typeof STAGES)[number]["key"];

  function getProcessingStage(): StageKey {
    if (phase === "uploading" || phase === "dispatching") return "uploading";
    if (phase !== "processing" || !processingStartRef.current) return "analysing";
    const elapsed = (Date.now() - processingStartRef.current) / 1000;
    if (elapsed < 15) return "analysing";
    if (elapsed < 45) return "assembling";
    return "rendering";
  }
  const currentStage = getProcessingStage();

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
        <div className="flex items-center gap-2">
          <span className="aurora-kicker">AutoCut</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            8 Aura
          </span>
        </div>
      </header>

      <div className="relative z-10 flex flex-col gap-6 px-5 pb-32 pt-6">
        {/* ── Intro ──────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <Wand2 className="size-4 text-primary" />
            <span className="aurora-kicker">Auto Edit</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Drop clips.
            <span className="block aurora-gradient-text">Get a finished short.</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Up to {MAX_CLIPS} clips · max {MAX_SIZE_MB} MB each · 9:16 vertical · 60 s output
          </p>
        </div>

        {/* ── Result ─────────────────────────────────────────────────────── */}
        {phase === "done" && resultUrl && (
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <CheckCircle2 className="size-8 text-primary" />
            <p className="text-sm font-medium text-foreground">Your AutoCut is ready!</p>
            <video
              src={resultUrl}
              controls
              playsInline
              className="w-full max-w-xs rounded-xl"
              style={{ aspectRatio: "9/16" }}
            />
            <div className="flex gap-3">
              <Button
                size="sm"
                onClick={() => saveAssetToDisk(resultUrl, `autocut-${Date.now()}.mp4`)}
              >
                <Download className="mr-1.5 size-4" /> Download
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset}>
                New AutoCut
              </Button>
            </div>
          </section>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {phase === "error" && (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
            <p className="text-sm font-medium text-destructive">{errorMsg ?? "Something went wrong"}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={handleReset}>
              Try again
            </Button>
          </section>
        )}

        {/* ── Active progress ────────────────────────────────────────────── */}
        {isActive && (
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card/50 p-5">
            {/* Step indicator */}
            <ol className="flex items-center gap-0">
              {STAGES.map(({ key, label }, i) => {
                const stageOrder: StageKey[] = ["uploading", "analysing", "assembling", "rendering"];
                const currentIdx = stageOrder.indexOf(currentStage);
                const thisIdx    = stageOrder.indexOf(key);
                const done    = thisIdx < currentIdx;
                const active  = key === currentStage;
                return (
                  <li key={key} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                          done   ? "bg-primary text-primary-foreground"
                          : active ? "bg-primary/20 text-primary ring-1 ring-primary"
                          :         "bg-muted text-muted-foreground",
                        )}
                      >
                        {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] leading-tight text-center",
                          active ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div
                        className={cn(
                          "mb-3 h-px flex-1 transition-colors",
                          thisIdx < currentIdx ? "bg-primary" : "bg-muted",
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Upload per-file bars */}
            {phase === "uploading" && fileProgress.length > 0 && (
              <div className="space-y-2">
                {fileProgress.map((p, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="max-w-[70%] truncate">{p.file.name}</span>
                      <span>{p.pct}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-[image:var(--gradient-hero)] transition-all duration-200"
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Processing hint */}
            {phase === "processing" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                <span>
                  {currentStage === "analysing"  && "Analysing your clips…"}
                  {currentStage === "assembling" && "Assembling the edit — usually 1–3 min…"}
                  {currentStage === "rendering"  && "Final render in progress…"}
                </span>
              </div>
            )}

            {/* Dispatching hint */}
            {phase === "dispatching" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                <span>Queuing your job…</span>
              </div>
            )}
          </section>
        )}

        {/* ── Clip drop zone (hidden while active/done) ──────────────────── */}
        {!isActive && phase !== "done" && (
          <>
            <section>
              <h2 className="mb-2 text-sm font-semibold">Your Clips</h2>

              {/* Drop zone */}
              <div
                className={cn(
                  "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-5 transition-colors",
                  files.length
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                aria-label="Select video clips"
              >
                {files.length === 0 ? (
                  <>
                    <Upload className="size-7 text-muted-foreground" />
                    <p className="text-center text-sm text-muted-foreground">
                      Tap to pick clips
                      <span className="block text-xs">or drag & drop</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      MP4 · MOV · WebM · up to {MAX_SIZE_MB} MB each
                    </p>
                  </>
                ) : (
                  <>
                    <Film className="size-6 text-primary" />
                    <p className="text-sm font-medium text-primary">
                      {files.length} clip{files.length !== 1 ? "s" : ""} ready
                    </p>
                    <p className="text-xs text-muted-foreground">Tap to add more</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="video/mp4,video/quicktime,video/webm"
                multiple
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />

              {/* File list */}
              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-sm"
                    >
                      <Film className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{f.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(f.size / 1_048_576).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="ml-1 shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Style picker ─────────────────────────────────────────────── */}
            <section>
              <h2 className="mb-2 text-sm font-semibold">Style</h2>
              <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
                {STYLES.map(({ id, label, desc, Icon }) => {
                  const active = style === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onStyleChange(id)}
                      className={cn(
                        "relative flex w-36 shrink-0 snap-start flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-all",
                        active
                          ? "border-primary/60 bg-primary/10 shadow-[var(--shadow-glow-soft)]"
                          : "border-border bg-card/50 hover:border-primary/30",
                      )}
                    >
                      <Icon
                        className={cn("size-5", active ? "text-primary" : "text-muted-foreground")}
                      />
                      <span className="text-sm font-medium leading-tight">{label}</span>
                      <span className="text-[11px] leading-snug text-muted-foreground">{desc}</span>
                      {active && (
                        <span className="absolute right-2 top-2 size-2 rounded-full bg-primary shadow-[var(--shadow-glow-soft)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Music picker ─────────────────────────────────────────────── */}
            <section>
              <h2 className="mb-2 text-sm font-semibold">Background Music</h2>
              <ul className="space-y-1.5">
                {/* No music option */}
                <li>
                  <button
                    type="button"
                    onClick={() => setNoMusic(true)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      noMusic
                        ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/20 hover:text-foreground",
                    )}
                  >
                    <Sparkles className="size-4 shrink-0" />
                    <span>No music</span>
                    {noMusic && <span className="ml-auto size-2 rounded-full bg-primary" />}
                  </button>
                </li>

                {/* Style-matched tracks */}
                {STYLE_MUSIC[style].map((track) => {
                  const active = !noMusic && musicTrackId === track.id;
                  return (
                    <li key={track.id}>
                      <button
                        type="button"
                        onClick={() => { setMusicTrackId(track.id); setNoMusic(false); }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                            : "border-border bg-card/50 text-muted-foreground hover:border-primary/20 hover:text-foreground",
                        )}
                      >
                        <Music2 className="size-4 shrink-0 text-primary" />
                        <span className="flex-1">{track.label}</span>
                        {track.bpm && (
                          <span className="text-xs text-muted-foreground">{track.bpm} BPM</span>
                        )}
                        {active && <span className="ml-2 size-2 shrink-0 rounded-full bg-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Royalty-free tracks · admin uploads enable playback
              </p>
            </section>
          </>
        )}
      </div>

      {/* ── Fixed CTA bar ────────────────────────────────────────────────── */}
      {!isActive && phase !== "done" && (
        <div className="phone-fixed-x fixed bottom-0 z-50 border-t border-border bg-background/85 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <Button
            className="button-premium w-full"
            size="lg"
            disabled={files.length === 0 || !user}
            onClick={handleSubmit}
          >
            <Wand2 className="mr-2 size-4" />
            Auto Edit — 8 Aura
          </Button>
          {!user && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Sign in to use AutoCut
            </p>
          )}
          {files.length === 0 && user && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Add at least one clip to continue
            </p>
          )}
        </div>
      )}
    </main>
  );
}
