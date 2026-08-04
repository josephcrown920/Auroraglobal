import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  getAutocutUploadUrls,
  createAutocutJob,
  getGenerationStatus,
  getAutocutJobStage,
  getAutocutJobDetail,
} from "@/lib/autocut-generation.functions";
import { handleGenerationError } from "@/lib/error-toasts";
import { saveAssetToDisk } from "@/lib/save";
import { COST_AUTOCUT, type AutocutStyle } from "@/lib/template-studio";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Music2,
  Plus,
  RectangleVertical,
  Sparkles,
  TrendingUp,
  Upload,
  User2,
  Wand2,
  X,
  Zap,
} from "lucide-react";

// ─── Style manifest (client-safe, mirrors autocut.server.ts) ─────────────────
// StyleId aliases the template-studio manifest union so /edit, the Editing
// templates and the ?style= search param can never drift apart. STYLE_MUSIC
// is typed Record<StyleId, …> — adding a style without tracks fails to compile.

type StyleId = AutocutStyle;

const STYLES: ReadonlyArray<{
  id: StyleId;
  label: string;
  desc: string;
  Icon: typeof Zap;
}> = [
  {
    id: "hype",
    label: "Hype",
    desc: "Fast cuts · beat-synced · high energy",
    Icon: Zap,
  },
  {
    id: "cinematic",
    label: "Cinematic",
    desc: "Slow crossfades · epic scale",
    Icon: Film,
  },
  {
    id: "talking_head",
    label: "Talking Head",
    desc: "Speaker-led · B-roll mix",
    Icon: User2,
  },
  {
    id: "tiktok_hook",
    label: "TikTok Hook",
    desc: "3-sec opener · story arc",
    Icon: TrendingUp,
  },
];

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

/** Timeline scale: pixels per second of clip footage. */
const PPS = 18;
/** Chip width fallback while a clip's real duration is still being probed. */
const FALLBACK_DUR = 4;

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createLazyFileRoute("/edit")({ component: AutoCutPage });

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadSlot = { signedUrl: string; token: string; path: string };
type UploadStatus = "pending" | "uploading" | "done" | "error";
type FileProgress = { file: File; pct: number; status: UploadStatus; error?: string };
type Phase = "idle" | "uploading" | "dispatching" | "processing" | "done" | "error";
type ToolId = "style" | "music" | "ratio";
type ClipMeta = { url: string; duration: number | null };

const UPLOAD_TIMEOUT_MS = 60_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uploadFileXhr(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); }
      else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out — tap to retry"));
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.send(file);
  });
}

/** Stable identity for a picked file (name+size+mtime) — keys the object-URL cache. */
const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

const clipBasename = (path: string) => path.split("/").pop() ?? path;

// ─── Component ───────────────────────────────────────────────────────────────

function AutoCutPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // ── Input state ─────────────────────────────────────────────────────────
  // ?style= comes from the Editing templates on /templates (validated in edit.tsx).
  const initialStyle: StyleId = search.style ?? "hype";
  const [files, setFiles]             = useState<File[]>([]);
  const [style, setStyle]             = useState<StyleId>(initialStyle);
  const [musicTrackId, setMusicTrackId] = useState<string>(STYLE_MUSIC[initialStyle][0].id);
  const [noMusic, setNoMusic]         = useState(false);

  // ── Editor chrome state (CapCut-style shell) ────────────────────────────
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeTool, setActiveTool]   = useState<ToolId | null>(null);
  const [clipMeta, setClipMeta]       = useState<Record<string, ClipMeta>>({});

  // ── Job state ───────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<Phase>("idle");
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [uploadSlots, setUploadSlots] = useState<UploadSlot[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [jobId, setJobId]             = useState<string | null>(null);
  const [serverStage, setServerStage] = useState<"analysing" | "assembling" | "rendering">("analysing");
  const [resultUrl, setResultUrl]     = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [clipPaths, setClipPaths]     = useState<string[]>([]);
  const [isReEditing, setIsReEditing] = useState(false);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirrors per-file success so we can decide "all uploaded" without racing
  // against React's async state batching (updated in lockstep with fileProgress).
  const uploadedRef = useRef<boolean[]>([]);
  // Mirror of clipMeta for cleanup paths that must not re-subscribe effects.
  const clipMetaRef = useRef<Record<string, ClipMeta>>({});
  // Idempotency fence: createAutocutJob is a real credit charge, so dispatch
  // may fire at most once per attempt no matter how many async upload
  // completions race in (initial Promise.all vs a user-triggered retry).
  const dispatchStartedRef = useRef(false);
  // Monotonic attempt token: bumped on every submit/reset so late async
  // completions from a cancelled attempt can never dispatch a job afterwards.
  const attemptIdRef = useRef(0);

  // ── Server fns ──────────────────────────────────────────────────────────
  const uploadUrlsFn   = useServerFn(getAutocutUploadUrls);
  const createJobFn    = useServerFn(createAutocutJob);
  const getStatusFn    = useServerFn(getGenerationStatus);
  const getJobStageFn  = useServerFn(getAutocutJobStage);
  const getJobDetailFn = useServerFn(getAutocutJobDetail);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => {
    clipMetaRef.current = clipMeta;
  }, [clipMeta]);
  useEffect(
    () => () => {
      Object.values(clipMetaRef.current).forEach((m) => URL.revokeObjectURL(m.url));
    },
    [],
  );

  // ── Clip previews: object URLs + real durations from video metadata ─────
  useEffect(() => {
    // Probe any newly added files.
    for (const f of files) {
      const key = fileKey(f);
      if (clipMetaRef.current[key]) continue;
      const url = URL.createObjectURL(f);
      clipMetaRef.current[key] = { url, duration: null };
      setClipMeta((prev) => ({ ...prev, [key]: { url, duration: null } }));
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const duration = Number.isFinite(probe.duration) ? probe.duration : null;
        setClipMeta((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], duration } } : prev));
        probe.removeAttribute("src");
      };
      probe.src = url;
    }
    // Revoke URLs for files that were removed.
    setClipMeta((prev) => {
      const live = new Set(files.map(fileKey));
      const stale = Object.keys(prev).filter((k) => !live.has(k));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const k of stale) {
        URL.revokeObjectURL(next[k].url);
        delete next[k];
      }
      return next;
    });
  }, [files]);

  // Keep the selected clip in range as clips come and go.
  useEffect(() => {
    if (selectedIdx >= files.length) setSelectedIdx(Math.max(0, files.length - 1));
  }, [files.length, selectedIdx]);

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
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback((genId: string, jId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        // Poll generation completion status.
        const s = await getStatusFn({ data: { generationId: genId } });
        if (s.status === "succeeded") {
          stopPolling();
          setResultUrl(s.videoUrl ?? s.imageUrl ?? null);
          setPhase("done");
          // Job reached a terminal state — a future re-cut is a legitimately
          // new attempt, so release the dispatch fence.
          dispatchStartedRef.current = false;
          return;
        } else if (s.status === "failed") {
          stopPolling();
          setErrorMsg(s.error ?? "AutoCut render failed");
          setPhase("error");
          dispatchStartedRef.current = false;
          return;
        }
        // Still processing — fetch real worker stage from the DB.
        try {
          const st = await getJobStageFn({ data: { jobId: jId } });
          setServerStage(st.stage);
        } catch {
          // transient stage fetch error — keep current stage
        }
      } catch {
        // transient status polling error — keep trying
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, getStatusFn, getJobStageFn]);

  // ── Upload orchestration ─────────────────────────────────────────────────
  // Uploads are isolated per-file: one clip timing out or erroring never
  // cancels its siblings, and a failed clip can be retried on its own without
  // re-uploading anything that already succeeded.
  const attemptUploadOne = useCallback(async (idx: number, slot: UploadSlot, file: File) => {
    uploadedRef.current[idx] = false;
    setFileProgress((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, status: "uploading", pct: 0, error: undefined } : p)),
    );
    try {
      await uploadFileXhr(slot.signedUrl, file, (pct) =>
        setFileProgress((prev) => prev.map((p, i) => (i === idx ? { ...p, pct } : p))),
      );
      setFileProgress((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, pct: 100, status: "done", error: undefined } : p)),
      );
      uploadedRef.current[idx] = true;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed — tap to retry";
      setFileProgress((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, status: "error", error: message } : p)),
      );
      uploadedRef.current[idx] = false;
      return false;
    }
  }, []);

  // Fires the autocut job creation once — and only once — every clip has
  // successfully uploaded. This is the gate equivalent of a disabled Generate
  // button: job creation simply never runs while any clip is pending/errored.
  const proceedToDispatch = useCallback(
    async (paths: string[]) => {
      // Synchronous check-and-set (no await before it): when the initial
      // upload completion and a retry completion race in here, only the
      // first wins — the second is a silent no-op instead of a 2nd charge.
      if (dispatchStartedRef.current) return;
      dispatchStartedRef.current = true;
      try {
        setPhase("dispatching");
        const { generationId: genId, jobId: jId } = await createJobFn({
          data: {
            clipPaths: paths,
            style,
            musicTrackId: noMusic ? undefined : musicTrackId,
            aspect: "9:16",
          },
        });

        setClipPaths(paths);
        setGenerationId(genId);
        setJobId(jId);
        setServerStage("analysing");
        setPhase("processing");
        setIsReEditing(false);
        startPolling(genId, jId);
        // Keep the URL in sync so returning to /edit (back button, bookmark,
        // refresh) can re-hydrate this exact job instead of starting blank.
        void navigate({ search: (prev) => ({ ...prev, job: jId }), replace: true });
      } catch (err) {
        handleGenerationError(err);
        setPhase("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    },
    [createJobFn, style, musicTrackId, noMusic, navigate, startPolling],
  );

  const maybeProceedAfterUpload = useCallback(
    (slots: UploadSlot[], attempt: number) => {
      // A reset or a newer submit bumps the attempt token — completions from
      // the old attempt land here afterwards and must never dispatch.
      if (attempt !== attemptIdRef.current) return;
      if (slots.length > 0 && uploadedRef.current.length === slots.length && uploadedRef.current.every(Boolean)) {
        void proceedToDispatch(slots.map((s) => s.path));
      }
    },
    [proceedToDispatch],
  );

  const retryUpload = useCallback(
    async (idx: number) => {
      const attempt = attemptIdRef.current;
      const slot = uploadSlots[idx];
      const file = fileProgress[idx]?.file;
      if (!slot || !file) return;
      await attemptUploadOne(idx, slot, file);
      maybeProceedAfterUpload(uploadSlots, attempt);
    },
    [uploadSlots, fileProgress, attemptUploadOne, maybeProceedAfterUpload],
  );

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Re-entrancy fence: the CTA is swapped for a status pill while active,
    // but a rapid double-tap can invoke this twice before that renders.
    if (phase === "uploading" || phase === "dispatching" || phase === "processing") return;
    if (!user) { toast.error("Sign in to use AutoCut"); return; }
    if (!files.length) { toast.error("Add at least one clip first"); return; }

    const attempt = ++attemptIdRef.current;
    dispatchStartedRef.current = false;
    setErrorMsg(null);
    setPhase("uploading");
    setUploadSlots([]);
    uploadedRef.current = files.map(() => false);
    setFileProgress(files.map((f) => ({ file: f, pct: 0, status: "pending" as const })));

    try {
      // 1. Request signed upload URLs from server
      const slots: UploadSlot[] = await uploadUrlsFn({
        data: {
          files: files.map((f) => ({
            name: f.name,
            ext: (f.name.split(".").pop() ?? "mp4").toLowerCase(),
          })),
        },
      });
      if (attempt !== attemptIdRef.current) return; // reset/new submit happened meanwhile
      setUploadSlots(slots);

      // 2. Upload each file directly to Supabase storage via signed PUT URL.
      // Failures are isolated per-file (never Promise.all fail-fast) so one
      // stalled clip doesn't cancel the others.
      await Promise.all(slots.map((slot, idx) => attemptUploadOne(idx, slot, files[idx])));

      // 3. Only create the job once every clip is confirmed uploaded.
      maybeProceedAfterUpload(slots, attempt);
    } catch (err) {
      // Failure to even obtain upload URLs is a real infra error, not a
      // per-file issue — abort the whole flow (unless this attempt was
      // already cancelled by a reset, in which case stay silent).
      if (attempt !== attemptIdRef.current) return;
      handleGenerationError(err);
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = () => {
    stopPolling();
    // Invalidate any in-flight attempt: its uploads may still resolve, but
    // the token mismatch guarantees they can never dispatch a job.
    attemptIdRef.current++;
    dispatchStartedRef.current = false;
    setFiles([]);
    setFileProgress([]);
    setUploadSlots([]);
    uploadedRef.current = [];
    setPhase("idle");
    setGenerationId(null);
    setJobId(null);
    setServerStage("analysing");
    setResultUrl(null);
    setErrorMsg(null);
    setStyle("hype");
    setMusicTrackId(STYLE_MUSIC.hype[0].id);
    setNoMusic(false);
    setClipPaths([]);
    setIsReEditing(false);
    setSelectedIdx(0);
    setActiveTool(null);
    void navigate({ search: () => ({}), replace: true });
  };

  // Re-edit: reuses the already-uploaded clips from the completed job — no
  // re-upload needed — and creates a brand-new job + reservation with
  // whatever style/music the user picks now. The original job is untouched.
  const handleReEditSubmit = () => {
    if (!user) { toast.error("Sign in to use AutoCut"); return; }
    if (!clipPaths.length) {
      toast.error("Original clips are unavailable — start a new AutoCut");
      return;
    }
    setErrorMsg(null);
    void proceedToDispatch(clipPaths);
  };

  // ── Deep-link resume: /edit?job=<id> pre-populates style/music and shows
  // the previous result (or resumes polling if it's still processing).
  useEffect(() => {
    if (!search.job || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await getJobDetailFn({ data: { jobId: search.job! } });
        if (cancelled) return;
        setStyle(detail.style as StyleId);
        if (detail.musicTrackId) {
          setMusicTrackId(detail.musicTrackId);
          setNoMusic(false);
        } else {
          setNoMusic(true);
        }
        setClipPaths(detail.clipPaths);
        setGenerationId(detail.generationId);
        setJobId(detail.jobId);
        if (detail.status === "succeeded") {
          setResultUrl(detail.videoUrl);
          setPhase("done");
        } else if (detail.status === "failed") {
          setErrorMsg(detail.error ?? "AutoCut render failed");
          setPhase("error");
        } else {
          setPhase("processing");
          startPolling(detail.generationId, detail.jobId);
        }
      } catch {
        // Stale, foreign, or deleted job id — silently fall back to idle.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- async cancel flag uses a stable closure ref; dep array covers all meaningful reactive inputs
  }, [search.job, user]);

  const isActive = phase === "uploading" || phase === "dispatching" || phase === "processing";
  const overallPct = fileProgress.length
    ? Math.round(fileProgress.reduce((s, p) => s + p.pct, 0) / fileProgress.length)
    : 0;
  const hasUploadErrors = fileProgress.some((p) => p.status === "error");

  // ── Stage indicator (driven by real backend state from getAutocutJobStage) ─
  const STAGES = [
    { key: "uploading",  label: "Upload" },
    { key: "analysing",  label: "Analyse" },
    { key: "assembling", label: "Assemble" },
    { key: "rendering",  label: "Render" },
  ] as const;
  type StageKey = (typeof STAGES)[number]["key"];

  // Map real phase + DB workerStage to the step indicator's current key.
  const currentStage: StageKey =
    phase === "uploading" || phase === "dispatching"
      ? "uploading"
      : phase === "processing"
        ? serverStage   // "analysing" | "assembling" | "rendering" — set by DB poll
        : "uploading";  // idle/done/error: step indicator is hidden anyway
  const stageOrder: StageKey[] = ["uploading", "analysing", "assembling", "rendering"];
  const currentStageIdx = stageOrder.indexOf(currentStage);

  // Tools are usable pre-submit, or when re-editing a completed job
  // (style/music only — clips are fixed then, no add/remove).
  const showPickers = (!isActive && phase !== "done") || isReEditing;
  const canEditClips = showPickers && !isReEditing;

  // ── Timeline lanes (real data: your clips, your chosen track) ────────────
  const laneClips =
    files.length > 0
      ? files.map((f, i) => {
          const meta = clipMeta[fileKey(f)];
          return { key: `${fileKey(f)}#${i}`, label: f.name, duration: meta?.duration ?? null, idx: i };
        })
      : clipPaths.map((p, i) => ({ key: p, label: clipBasename(p), duration: null, idx: i }));

  const totalSec = Math.max(
    laneClips.reduce((s, c) => s + (c.duration ?? FALLBACK_DUR), 0),
    12,
  );
  const timelineWidth = Math.ceil(totalSec * PPS) + 96;
  const rulerTicks: number[] = [];
  for (let s = 0; s <= Math.ceil(totalSec); s += 2) rulerTicks.push(s);

  const selectedFile = files[selectedIdx];
  const selectedMeta = selectedFile ? clipMeta[fileKey(selectedFile)] : undefined;
  const activeTrackLabel = noMusic
    ? "No music"
    : STYLE_MUSIC[style].find((t) => t.id === musicTrackId)?.label ?? "Soundtrack";
  const styleLabel = STYLES.find((s) => s.id === style)?.label ?? "Hype";

  return (
    <main
      className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)] text-foreground"
      style={{ background: "var(--gradient-page)" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
        <Link
          to="/"
          aria-label="Back home"
          className="flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground shadow-[var(--shadow-card)] no-underline transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-sm font-extrabold tracking-tight">AutoCut</span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {styleLabel} · 9:16 · up to 60s
          </span>
        </div>
        <Link
          to="/video-editor"
          className="flex items-center gap-1 rounded-full bg-card px-3 py-2 text-xs font-bold text-muted-foreground shadow-[var(--shadow-card)] no-underline transition hover:text-foreground"
        >
          <Sparkles className="size-3.5 text-brand-ink" /> AI Editor
        </Link>
      </header>

      {/* ── Preview stage ───────────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-1 items-center justify-center px-4 py-2">
        <div
          className="relative aspect-[9/16] h-full max-h-full max-w-full overflow-hidden rounded-2xl bg-black/70 shadow-[var(--shadow-card)] ring-1 ring-white/10"
          onDrop={canEditClips ? onDrop : undefined}
          onDragOver={canEditClips ? (e) => e.preventDefault() : undefined}
        >
          {/* Done: the real rendered result */}
          {phase === "done" && resultUrl && !isReEditing ? (
            <video src={resultUrl} controls playsInline className="h-full w-full object-contain" />
          ) : phase === "error" ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center">
              <X className="size-7 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                {errorMsg ?? "Something went wrong"}
              </p>
              <Button size="sm" variant="outline" onClick={handleReset}>
                Try again
              </Button>
            </div>
          ) : selectedMeta?.url ? (
            // Live preview of the selected clip (local object URL)
            <video
              key={selectedMeta.url}
              src={selectedMeta.url}
              muted
              playsInline
              loop
              autoPlay
              className="h-full w-full object-contain"
            />
          ) : files.length === 0 && (isReEditing || clipPaths.length > 0) ? (
            // Resumed / re-edit session: clips live in storage, not this device
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-5 text-center">
              <Film className="size-7 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {clipPaths.length} clip{clipPaths.length === 1 ? "" : "s"} from your last cut
              </p>
            </div>
          ) : (
            // Empty stage — the tap target to add clips
            <button
              type="button"
              onClick={() => canEditClips && fileInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center"
              aria-label="Select video clips"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-dashed ring-white/25">
                <Upload className="size-6 text-muted-foreground" />
              </span>
              <span className="text-sm font-semibold">Tap to add clips</span>
              <span className="text-[11px] text-muted-foreground">
                MP4 · MOV · WebM · up to {MAX_CLIPS} clips, {MAX_SIZE_MB} MB each
              </span>
            </button>
          )}

          {/* Clip counter badge */}
          {files.length > 0 && !isActive && phase !== "done" && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              Clip {Math.min(selectedIdx + 1, files.length)}/{files.length}
            </span>
          )}

          {/* Busy overlay: real upload % + real worker stage */}
          {isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-5 backdrop-blur-[2px]">
              {phase === "uploading" ? (
                <>
                  <span className="text-3xl font-extrabold text-white">{overallPct}%</span>
                  <span className="text-xs font-medium text-white/70">
                    Uploading {fileProgress.filter((p) => p.status === "done").length}/
                    {fileProgress.length} clips
                  </span>
                  {hasUploadErrors && (
                    <span className="text-center text-[11px] text-red-300">
                      Some clips failed — tap the red clips below to retry
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Loader2 className="size-7 animate-spin text-white" />
                  <span className="text-xs font-medium text-white/80">
                    {phase === "dispatching" && "Queuing your job…"}
                    {phase === "processing" && currentStage === "analysing" && "Analysing your clips…"}
                    {phase === "processing" && currentStage === "assembling" && "Assembling the edit — usually 1–3 min…"}
                    {phase === "processing" && currentStage === "rendering" && "Final render in progress…"}
                  </span>
                </>
              )}
              {/* Compact 4-step indicator, driven by real backend stage */}
              <ol className="flex items-center gap-2">
                {STAGES.map(({ key, label }) => {
                  const thisIdx = stageOrder.indexOf(key);
                  const done = thisIdx < currentStageIdx;
                  const active = key === currentStage;
                  return (
                    <li key={key} className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          "size-1.5 rounded-full transition-colors",
                          done ? "bg-primary" : active ? "bg-white" : "bg-white/25",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[9px] leading-none",
                          active ? "font-bold text-white" : "text-white/50",
                        )}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </section>

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

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <section
        className="shrink-0 rounded-t-3xl px-4 pb-2 pt-3 shadow-[var(--shadow-float)]"
        style={{ background: "var(--gradient-sheet)" }}
      >
        {isReEditing && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-primary/10 px-3 py-1.5 ring-1 ring-primary/25">
            <p className="text-[11px] text-muted-foreground">
              Same clips — pick a new style or music, then re-cut.
            </p>
            <button
              type="button"
              className="text-[11px] font-semibold text-primary"
              onClick={() => setIsReEditing(false)}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Ruler */}
            <div className="relative h-4">
              {rulerTicks.map((s) => (
                <span
                  key={s}
                  className="absolute top-0 flex h-full flex-col justify-between"
                  style={{ left: s * PPS }}
                >
                  <span className="text-[9px] font-medium leading-none text-muted-foreground/60">
                    {s}s
                  </span>
                  <span className="h-1 w-px bg-white/15" />
                </span>
              ))}
            </div>

            {/* Video lane — one chip per real clip */}
            <div className="mt-1 flex items-center gap-1">
              {laneClips.length === 0 && (
                <div className="flex h-11 items-center rounded-lg border border-dashed border-white/15 px-3 text-[11px] text-muted-foreground/70">
                  Your clips appear here
                </div>
              )}
              {laneClips.map((clip) => {
                const prog = phase === "uploading" ? fileProgress[clip.idx] : undefined;
                const isSelected = files.length > 0 && clip.idx === selectedIdx && !isActive && phase !== "done";
                const isErrored = prog?.status === "error";
                return (
                  <button
                    key={clip.key}
                    type="button"
                    onClick={() => {
                      if (isErrored) { void retryUpload(clip.idx); return; }
                      if (canEditClips && files.length > 0) setSelectedIdx(clip.idx);
                    }}
                    className={cn(
                      "relative h-11 shrink-0 overflow-hidden rounded-lg text-left transition-all",
                      isErrored
                        ? "bg-destructive/80 ring-2 ring-destructive"
                        : "bg-track-video/80 ring-1 ring-white/10",
                      isSelected && "ring-2 ring-white",
                    )}
                    style={{ width: Math.max((clip.duration ?? FALLBACK_DUR) * PPS, 64) }}
                  >
                    {/* Upload progress fill (real per-file %) */}
                    {prog && !isErrored && (
                      <span
                        className="absolute inset-y-0 left-0 bg-white/25 transition-all duration-200"
                        style={{ width: `${prog.pct}%` }}
                      />
                    )}
                    <span className="relative flex h-full flex-col justify-between px-2 py-1">
                      <span className="max-w-full truncate text-[10px] font-semibold text-white">
                        {isErrored ? "Failed — tap to retry" : clip.label}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-medium text-white/70">
                        <Film className="size-2.5" />
                        {isErrored
                          ? prog?.error ?? "Upload error"
                          : clip.duration != null
                            ? `${clip.duration.toFixed(1)}s`
                            : files.length > 0
                              ? "…"
                              : "uploaded"}
                      </span>
                    </span>
                    {/* Remove — only on the selected chip while editable */}
                    {isSelected && canEditClips && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${clip.label}`}
                        onClick={(e) => { e.stopPropagation(); removeFile(clip.idx); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.stopPropagation(); removeFile(clip.idx); }
                        }}
                        className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <X className="size-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
              {canEditClips && files.length < MAX_CLIPS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add clips"
                  className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/25 text-muted-foreground transition hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>

            {/* Audio lane — the actually selected soundtrack */}
            <div className="mt-1.5">
              <div
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-2",
                  noMusic ? "bg-white/5 ring-1 ring-white/10" : "bg-track-audio/80 ring-1 ring-white/10",
                )}
                style={{ width: Math.max(140, Math.round(totalSec * PPS)) }}
              >
                <Music2 className={cn("size-3", noMusic ? "text-muted-foreground" : "text-white")} />
                <span
                  className={cn(
                    "truncate text-[10px] font-semibold",
                    noMusic ? "text-muted-foreground" : "text-white",
                  )}
                >
                  {activeTrackLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {hasUploadErrors && phase === "uploading" && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-1.5 ring-1 ring-destructive/30">
            <p className="text-[11px] text-destructive">Retry the red clips to continue.</p>
            <Button size="sm" variant="outline" onClick={handleReset}>
              Cancel
            </Button>
          </div>
        )}

        {canEditClips && files.length > 0 && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">
            Clip order matters — AutoCut re-times everything to the {styleLabel.toLowerCase()} beat.
          </p>
        )}
      </section>

      {/* ── Tool dock ───────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-white/5 bg-background/85 px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        {/* Contextual tool panel */}
        {showPickers && activeTool === "style" && (
          <div className="no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">
            {STYLES.map(({ id, label, desc, Icon }) => {
              const active = style === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onStyleChange(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-left transition-all",
                    active ? "text-white" : "bg-card text-muted-foreground shadow-[var(--shadow-card)]",
                  )}
                  style={active ? { background: "var(--gradient-cta)" } : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-xs font-bold">{label}</span>
                    <span className={cn("text-[9px]", active ? "text-white/75" : "text-muted-foreground/70")}>
                      {desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showPickers && activeTool === "music" && (
          <div className="mb-2 max-h-44 overflow-y-auto rounded-2xl bg-card p-1.5 shadow-[var(--shadow-card)]">
            <button
              type="button"
              onClick={() => setNoMusic(true)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors",
                noMusic ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="size-3.5 shrink-0" />
              <span className="flex-1">No music</span>
              {noMusic && <span className="size-1.5 rounded-full bg-primary" />}
            </button>
            {STYLE_MUSIC[style].map((track) => {
              const active = !noMusic && musicTrackId === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => { setMusicTrackId(track.id); setNoMusic(false); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors",
                    active ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Music2 className="size-3.5 shrink-0 text-track-audio" />
                  <span className="flex-1 truncate">{track.label}</span>
                  {track.bpm && <span className="text-[10px] text-muted-foreground">{track.bpm} BPM</span>}
                  {active && <span className="ml-1 size-1.5 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
            <p className="px-3 py-1.5 text-[10px] text-muted-foreground/60">
              Royalty-free tracks · admin uploads enable playback
            </p>
          </div>
        )}

        {showPickers && activeTool === "ratio" && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <span
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-white"
              style={{ background: "var(--gradient-cta)" }}
            >
              <RectangleVertical className="size-3.5" /> 9:16 · Vertical
            </span>
            <span className="text-[10px] text-muted-foreground">
              AutoCut outputs vertical shorts for TikTok, Reels & Shorts.
            </span>
          </div>
        )}

        {/* Dock row */}
        {phase === "done" && !isReEditing && resultUrl ? (
          <div className="flex items-center gap-2">
            <Button
              className="flex-1 rounded-full border-0 font-bold text-white"
              style={{ background: "var(--gradient-cta)" }}
              onClick={() => saveAssetToDisk(resultUrl, `autocut-${Date.now()}.mp4`)}
            >
              <Download className="mr-1.5 size-4" /> Download
            </Button>
            {clipPaths.length > 0 && (
              <Button variant="outline" className="rounded-full" onClick={() => setIsReEditing(true)}>
                <Wand2 className="mr-1.5 size-4" /> Re-edit
              </Button>
            )}
            <Button variant="outline" className="rounded-full" onClick={handleReset}>
              New
            </Button>
            <Link
              to="/gallery"
              className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground"
            >
              Gallery
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <DockButton
              icon={Plus}
              label="Add"
              disabled={!canEditClips || files.length >= MAX_CLIPS}
              onClick={() => fileInputRef.current?.click()}
            />
            <DockButton
              icon={Wand2}
              label="Style"
              active={activeTool === "style"}
              disabled={!showPickers}
              onClick={() => setActiveTool((t) => (t === "style" ? null : "style"))}
            />
            <DockButton
              icon={Music2}
              label="Music"
              active={activeTool === "music"}
              disabled={!showPickers}
              onClick={() => setActiveTool((t) => (t === "music" ? null : "music"))}
            />
            <DockButton
              icon={RectangleVertical}
              label="Ratio"
              active={activeTool === "ratio"}
              disabled={!showPickers}
              onClick={() => setActiveTool((t) => (t === "ratio" ? null : "ratio"))}
            />
            <div className="flex-1" />
            {isActive ? (
              <span className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-xs font-bold text-muted-foreground shadow-[var(--shadow-card)]">
                <Loader2 className="size-3.5 animate-spin" />
                {phase === "uploading" ? `Uploading ${overallPct}%` : "Cutting…"}
              </span>
            ) : (
              <button
                type="button"
                disabled={isReEditing ? !user || clipPaths.length === 0 : files.length === 0 || !user}
                onClick={isReEditing ? handleReEditSubmit : handleSubmit}
                className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-extrabold text-white transition disabled:opacity-40"
                style={{ background: "var(--gradient-cta)" }}
              >
                <CheckCircle2 className="size-4" />
                {isReEditing ? `Re-cut · ${COST_AUTOCUT} Aura` : `Export · ${COST_AUTOCUT} Aura`}
              </button>
            )}
          </div>
        )}

        {!user && showPickers && (
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Sign in to use AutoCut
          </p>
        )}
      </footer>
    </main>
  );
}

// ─── Dock button ──────────────────────────────────────────────────────────────

function DockButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors disabled:opacity-35",
        active ? "bg-white/8 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4.5", active && "text-brand-ink")} />
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );
}
