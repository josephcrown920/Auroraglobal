import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Download,
  Film,
  Loader2,
  MessageSquare,
  Music2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  User2,
  Video,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createEditSession,
  loadEditSession,
  saveEditSession,
  listStudioVideoClips,
  editorChatFn,
  exportEditSession,
  type TimelineClip,
  type ChatMessage,
  type StudioClip,
  type EditorMutation,
  type SoundtrackSettings,
} from "@/lib/video-editor.functions";

// ─── Client-safe style / music manifests (mirror autocut.server.ts) ──────────

const STYLES = [
  { id: "hype",         label: "Hype",         Icon: Zap,       desc: "Fast cuts · high energy" },
  { id: "cinematic",    label: "Cinematic",     Icon: Film,      desc: "Slow crossfades · epic scale" },
  { id: "talking_head", label: "Talking Head",  Icon: User2,     desc: "Speaker-led · B-roll mix" },
  { id: "tiktok_hook",  label: "TikTok Hook",   Icon: TrendingUp,desc: "3-sec hook · viral pacing" },
] as const;
type StyleId = (typeof STYLES)[number]["id"];

const MUSIC_LIST: Record<StyleId, Array<{ id: string; label: string }>> = {
  hype:         [{ id: "hype-1", label: "Adrenaline Rush" }, { id: "hype-2", label: "High Voltage" }, { id: "hype-3", label: "Drop the Beat" }],
  cinematic:    [{ id: "cine-1", label: "Epic Journey" }, { id: "cine-2", label: "Dreamscape" }, { id: "cine-3", label: "Golden Hour" }],
  talking_head: [{ id: "talk-1", label: "Upbeat Chillhop" }, { id: "talk-2", label: "Coffee & Ideas" }, { id: "talk-3", label: "Focused Flow" }],
  tiktok_hook:  [{ id: "tiktok-1", label: "Trending Now" }, { id: "tiktok-2", label: "Viral Energy" }, { id: "tiktok-3", label: "Hook & Loop" }],
};

const SUGGESTED_COMMANDS = [
  "Cut the first 3 seconds of clip 1",
  "Move clip 2 to the beginning",
  "Remove clip 3",
  "Make it feel cinematic",
  "Add upbeat background music",
  "Swap clips 1 and 2",
];

const DEFAULT_SOUNDTRACK: SoundtrackSettings = {
  offsetSec: 0,
  trimStartSec: 0,
  trimEndSec: 0,
  volume: 1,
  mode: "mix",
};

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createLazyFileRoute("/video-editor")({ component: VideoEditorPage });

// ─── Component ───────────────────────────────────────────────────────────────

function VideoEditorPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // ── Session ────────────────────────────────────────────────────────────────
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // ── Timeline ───────────────────────────────────────────────────────────────
  const [clips, setClips]             = useState<TimelineClip[]>([]);
  const [style, setStyle]             = useState<StyleId>("hype");
  const [musicTrackId, setMusicTrackId] = useState<string | null>(null);
  const [previewClipId, setPreviewClipId] = useState<string | null>(null);
  const [sourceAudioUrl, setSourceAudioUrl] = useState<string | null>(null);
  const [soundtrack, setSoundtrack] = useState<SoundtrackSettings>(DEFAULT_SOUNDTRACK);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatBusy, setChatBusy]       = useState(false);

  // ── Clip tray ──────────────────────────────────────────────────────────────
  const [studioClips, setStudioClips] = useState<StudioClip[]>([]);
  const [trayLoading, setTrayLoading] = useState(false);

  // ── Export ─────────────────────────────────────────────────────────────────
  const [exporting, setExporting]     = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState<"clips" | "timeline" | "chat">("clips");

  // ── Refs ───────────────────────────────────────────────────────────────────
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // ── Server fns ─────────────────────────────────────────────────────────────
  const createSessionFn = useServerFn(createEditSession);
  const loadSessionFn   = useServerFn(loadEditSession);
  const saveSessionFn   = useServerFn(saveEditSession);
  const listClipsFn     = useServerFn(listStudioVideoClips);
  const chatFn          = useServerFn(editorChatFn);
  const exportFn        = useServerFn(exportEditSession);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Load Studio clip tray
    setTrayLoading(true);
    listClipsFn().then(setStudioClips).catch(console.error).finally(() => setTrayLoading(false));

    // Load existing session or create a new one
    if (search.session) {
      loadSessionFn({ data: { sessionId: search.session } })
        .then((s) => {
          setSessionId(s.id);
          setClips(s.clipList);
          setMessages(s.chatHistory);
          setStyle((s.style as StyleId) ?? "hype");
          setMusicTrackId(s.musicTrackId);
          setSourceAudioUrl(s.sourceAudioUrl);
           setSoundtrack(s.soundtrack);
          if (s.resultUrl) setExportResult(s.resultUrl);
          setSessionReady(true);
          if (s.clipList.length > 0) setActiveTab("timeline");
        })
        .catch(() => initNewSession()); // session not found / forbidden
    } else {
      void initNewSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function initNewSession() {
    try {
      const { sessionId: id } = await createSessionFn();
      setSessionId(id);
      setSessionReady(true);
      void navigate({ search: (prev) => ({ ...prev, session: id }), replace: true });
    } catch (err) {
      toast.error("Failed to create editing session");
    }
  }

  // ── Auto-save (debounced 2 s) ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !sessionReady) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSessionFn({
        data: { sessionId, clipList: clips, chatHistory: messages, style, musicTrackId, soundtrack },
      }).catch(console.error);
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [clips, messages, style, musicTrackId, soundtrack, sessionId, sessionReady, saveSessionFn]);

  // ── Scroll chat to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatBusy]);

  // ── Mutation applicator ────────────────────────────────────────────────────
  const applyMutation = useCallback((m: EditorMutation) => {
    if (m.op === "setStyle" && m.styleId) {
      setStyle(m.styleId as StyleId);
      return;
    }
    if (m.op === "setMusic") {
      setMusicTrackId(m.trackId ?? null);
      return;
    }
    setClips((prev) => {
      switch (m.op) {
        case "trim":
          return prev.map((c) =>
            c.id !== m.clipId ? c : {
              ...c,
              trimStartSec: m.trimStartSec ?? c.trimStartSec,
              trimEndSec:   m.trimEndSec   ?? c.trimEndSec,
            }
          );
        case "remove":
          return prev.filter((c) => c.id !== m.clipId);
        case "move": {
          const idx = prev.findIndex((c) => c.id === m.clipId);
          if (idx === -1 || m.toIndex === undefined) return prev;
          const next = [...prev];
          const [item] = next.splice(idx, 1);
          next.splice(Math.max(0, Math.min(m.toIndex, next.length)), 0, item);
          return next;
        }
        default:
          return prev;
      }
    });
  }, []);

  // ── Add clip from Studio tray ──────────────────────────────────────────────
  function addStudioClip(sc: StudioClip) {
    const id = crypto.randomUUID();
    const clip: TimelineClip = {
      id,
      generationId: sc.generationId,
      videoUrl: sc.videoUrl,
      thumbnailUrl: sc.thumbnailUrl ?? undefined,
      label: sc.label,
      durationSec: 0,
      trimStartSec: 0,
      trimEndSec: 0,
    };
    setClips((prev) => [...prev, clip]);
    setPreviewClipId(id);
    setActiveTab("timeline");
    toast.success("Clip added to timeline");
  }

  // Update clip duration when video metadata loads
  function onClipDuration(clipId: string, dur: number) {
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, durationSec: dur } : c)));
  }

  // ── Timeline reorder helpers ───────────────────────────────────────────────
  function moveUp(idx: number) {
    if (idx === 0) return;
    setClips((prev) => { const n = [...prev]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; });
  }
  function moveDown(idx: number) {
    setClips((prev) => {
      if (idx >= prev.length - 1) return prev;
      const n = [...prev]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; return n;
    });
  }
  function removeFromTimeline(clipId: string) {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
    if (previewClipId === clipId) setPreviewClipId(null);
  }

  // ── Chat send ──────────────────────────────────────────────────────────────
  async function handleChatSend() {
    if (!chatInput.trim() || !sessionId || chatBusy) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
    setChatBusy(true);
    try {
      const { summary, mutations } = await chatFn({
        data: { sessionId, clipList: clips, userMessage: msg.content },
      });
      mutations.forEach(applyMutation);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: summary, timestamp: new Date().toISOString() },
      ]);
      if (mutations.length > 0) {
        toast.success("Timeline updated");
        setActiveTab("timeline");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI chat failed — try again");
    } finally {
      setChatBusy(false);
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!sessionId) return;
    if (!clips.length) { toast.error("Add at least one clip before exporting"); return; }
    setExporting(true);
    setExportResult(null);
    try {
      const { resultUrl } = await exportFn({
        data: { sessionId, clipList: clips, style, musicTrackId, soundtrack },
      });
      setExportResult(resultUrl);
      toast.success("Export complete — your video is ready!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const previewClip = clips.find((c) => c.id === previewClipId) ?? clips[0] ?? null;
  const currentMusicTracks = MUSIC_LIST[style] ?? MUSIC_LIST.hype;

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="aurora-page-shell flex flex-col items-center justify-center gap-4 text-foreground">
        <span aria-hidden className="aurora-ambient" />
        <Film className="relative z-10 size-12 text-primary" />
        <p className="relative z-10 text-lg font-semibold">Sign in to use the AI Video Editor</p>
        <Link to="/auth" search={authNextSearch()} className="relative z-10">
          <Button>Sign in</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="aurora-page-shell text-foreground flex flex-col">
      <span aria-hidden className="aurora-ambient" />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl shrink-0">
        <Link to="/edit" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline">
          <ArrowLeft className="size-4" /> AutoCut
        </Link>
        <div className="flex items-center gap-2">
          <Wand2 className="size-4 text-primary" />
          <span className="aurora-kicker">AI Video Editor</span>
        </div>
        <Button
          size="sm"
          disabled={exporting || !clips.length || !sessionReady}
          onClick={handleExport}
          className="gap-1.5"
        >
          {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Export
        </Button>
      </header>

      {sourceAudioUrl && (
        <div className="relative z-10 border-b border-primary/20 bg-primary/5 px-5 py-3">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
            <Music2 className="size-4 shrink-0 text-primary" />
            <div className="min-w-48 flex-1">
              <p className="text-xs font-semibold">Performance reference audio</p>
              <p className="text-[10px] text-muted-foreground">This user-owned track will be aligned and mixed into the exported video.</p>
            </div>
            <audio src={sourceAudioUrl} controls preload="metadata" className="h-8 max-w-full" />
          </div>
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex shrink-0 border-b border-border bg-background/60 backdrop-blur">
        {(["clips", "timeline", "chat"] as const).map((tab) => {
          const icons = { clips: Video, timeline: Film, chat: MessageSquare };
          const labels = { clips: "Clips", timeline: `Timeline${clips.length ? ` (${clips.length})` : ""}`, chat: "Chat" };
          const Icon = icons[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors",
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto">

        {/* ── CLIPS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "clips" && (
          <div className="flex flex-col gap-4 px-5 py-5 pb-32">
            <div>
              <h2 className="text-lg font-semibold">Your Studio clips</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tap a clip to add it to the timeline.</p>
            </div>

            {trayLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading clips…
              </div>
            )}

            {!trayLoading && studioClips.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <Film className="mx-auto mb-3 size-8 opacity-40" />
                <p>No video results yet.</p>
                <Link to="/studio" className="mt-2 inline-block text-primary underline-offset-2 hover:underline">
                  Generate videos in Studio
                </Link>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {studioClips.map((sc) => (
                <button
                  key={sc.generationId}
                  onClick={() => addStudioClip(sc)}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary/60 hover:ring-1 hover:ring-primary/30"
                >
                  {sc.thumbnailUrl ? (
                    <img
                      src={sc.thumbnailUrl}
                      alt={sc.label}
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-muted">
                      <Video className="size-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                    <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                      <Plus className="size-3" /> Add
                    </span>
                  </div>
                  <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{sc.label || "Video"}</p>
                </button>
              ))}
            </div>

            {/* Device upload placeholder */}
            <div className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              <Upload className="mx-auto mb-2 size-5 opacity-50" />
              <p className="text-xs">Upload from device coming soon — use AutoCut for device clips for now.</p>
            </div>
          </div>
        )}

        {/* ── TIMELINE TAB ──────────────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <div className="flex flex-col gap-4 px-5 py-5 pb-36">
            {/* Preview player */}
            {previewClip && (
              <div className="relative overflow-hidden rounded-xl border border-border bg-black">
                <video
                  key={previewClip.id}
                  src={previewClip.videoUrl}
                  className="aspect-video w-full object-contain"
                  controls
                  playsInline
                  onLoadedMetadata={(e) => onClipDuration(previewClip.id, (e.target as HTMLVideoElement).duration)}
                />
                <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                  {previewClip.label}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!clips.length && (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <Film className="mx-auto mb-3 size-8 opacity-40" />
                <p>No clips yet.</p>
                <button onClick={() => setActiveTab("clips")} className="mt-2 text-primary underline-offset-2 hover:underline">
                  Add from Studio library
                </button>
              </div>
            )}

            {/* Clip cards */}
            <div className="flex flex-col gap-2">
              {clips.map((clip, idx) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  idx={idx}
                  total={clips.length}
                  isPreview={previewClipId === clip.id || (!previewClipId && idx === 0)}
                  onSelect={() => setPreviewClipId(clip.id)}
                  onMoveUp={() => moveUp(idx)}
                  onMoveDown={() => moveDown(idx)}
                  onRemove={() => removeFromTimeline(clip.id)}
                  onTrimChange={(trimStartSec, trimEndSec) =>
                    setClips((prev) =>
                      prev.map((c) => (c.id === clip.id ? { ...c, trimStartSec, trimEndSec } : c))
                    )
                  }
                  onDuration={(dur) => onClipDuration(clip.id, dur)}
                />
              ))}
            </div>

            {/* Style picker */}
            <section className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edit style</p>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(({ id, label, Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setStyle(id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-xs transition",
                      style === id
                        ? "border-primary/60 bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="font-semibold">{label}</span>
                    <span className="leading-tight opacity-70">{desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Music picker */}
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Music2 className="size-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Background music</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setMusicTrackId(null)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition",
                    !musicTrackId ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30",
                  )}
                >
                  No music
                </button>
                {currentMusicTracks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setMusicTrackId(t.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs transition",
                      musicTrackId === t.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            {sourceAudioUrl && (
              <section className="rounded-xl border border-primary/30 bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Music2 className="size-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Performance soundtrack</p>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {(["mix", "replace"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSoundtrack((current) => ({ ...current, mode }))}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition",
                        soundtrack.mode === mode
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {mode === "mix" ? "Mix with clip audio" : "Replace clip audio"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SoundtrackNumber
                    label="Start offset (sec)"
                    value={soundtrack.offsetSec}
                    max={120}
                    onChange={(offsetSec) => setSoundtrack((current) => ({ ...current, offsetSec }))}
                  />
                  <SoundtrackNumber
                    label="Volume"
                    value={soundtrack.volume}
                    max={2}
                    step={0.05}
                    onChange={(volume) => setSoundtrack((current) => ({ ...current, volume }))}
                  />
                  <SoundtrackNumber
                    label="Trim start (sec)"
                    value={soundtrack.trimStartSec}
                    max={3600}
                    onChange={(trimStartSec) => setSoundtrack((current) => ({ ...current, trimStartSec }))}
                  />
                  <SoundtrackNumber
                    label="Trim end (sec)"
                    value={soundtrack.trimEndSec}
                    max={3600}
                    onChange={(trimEndSec) => setSoundtrack((current) => ({ ...current, trimEndSec }))}
                  />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Offset delays the track on the video timeline. Trim values remove time from the beginning or end of the song.
                </p>
              </section>
            )}

            {/* Export result */}
            {exportResult && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <p className="mb-2 text-sm font-semibold text-emerald-400">Export ready!</p>
                <video
                  src={exportResult}
                  controls
                  playsInline
                  preload="metadata"
                  className="mb-3 aspect-video w-full rounded-lg bg-black object-contain"
                />
                <a
                  href={exportResult}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
                >
                  <Download className="size-4" /> Download video
                </a>
              </div>
            )}

            {/* Export button (also in header, but repeat here for convenience) */}
            <Button
              disabled={exporting || !clips.length}
              onClick={handleExport}
              className="w-full gap-2"
            >
              {exporting ? (
                <><Loader2 className="size-4 animate-spin" /> Assembling…</>
              ) : (
                <><Sparkles className="size-4" /> Export video</>
              )}
            </Button>
          </div>
        )}

        {/* ── CHAT TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "chat" && (
          <div className="flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-5 py-5 pb-4">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto mb-3 size-8 opacity-40" />
                  <p className="font-medium">Tell me how to edit your timeline</p>
                  <p className="mt-1 text-xs opacity-70">I can trim clips, reorder them, change the style, and more.</p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "mr-auto border border-border bg-card text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {chatBusy && (
                  <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Suggested commands */}
            {messages.length === 0 && !chatBusy && (
              <div className="shrink-0 flex gap-2 overflow-x-auto px-5 pb-2 no-scrollbar">
                {SUGGESTED_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => { setChatInput(cmd); }}
                    className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}

            {/* No clips warning */}
            {!clips.length && (
              <div className="mx-5 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                Add clips to the timeline first — the AI needs something to edit.
              </div>
            )}

            {/* Input */}
            <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur px-5 py-4 pb-safe">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleChatSend(); }
                  }}
                  placeholder="Cut first 3s from clip 1, make it cinematic…"
                  rows={2}
                  disabled={chatBusy || !clips.length || !sessionReady}
                  className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                />
                <Button
                  size="icon"
                  disabled={chatBusy || !chatInput.trim() || !clips.length || !sessionReady}
                  onClick={handleChatSend}
                  className="size-10 shrink-0"
                >
                  {chatBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── ClipCard ─────────────────────────────────────────────────────────────────

type ClipCardProps = {
  clip: TimelineClip;
  idx: number;
  total: number;
  isPreview: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onTrimChange: (start: number, end: number) => void;
  onDuration: (dur: number) => void;
};

function ClipCard({ clip, idx, total, isPreview, onSelect, onMoveUp, onMoveDown, onRemove, onTrimChange, onDuration }: ClipCardProps) {
  const maxTrim = Math.max(0, clip.durationSec - clip.trimStartSec - clip.trimEndSec - 0.5);
  const effectiveDur = Math.max(0, clip.durationSec - clip.trimStartSec - clip.trimEndSec);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition",
        isPreview ? "border-primary/60 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail / index */}
        <button onClick={onSelect} className="relative shrink-0 overflow-hidden rounded-lg bg-black" style={{ width: 72, height: 48 }}>
          {clip.thumbnailUrl ? (
            <img src={clip.thumbnailUrl} alt={clip.label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/30">
              <Film className="size-5" />
            </div>
          )}
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">
            {idx + 1}
          </span>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{clip.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {clip.durationSec > 0
              ? `${effectiveDur.toFixed(1)}s${clip.trimStartSec > 0 || clip.trimEndSec > 0 ? " (trimmed)" : ""}`
              : "Loading…"}
          </p>
        </div>

        {/* Reorder + remove */}
        <div className="flex shrink-0 flex-col gap-1">
          <button onClick={onMoveUp} disabled={idx === 0} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronUp className="size-4" />
          </button>
          <button onClick={onMoveDown} disabled={idx === total - 1} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="size-4" />
          </button>
          <button onClick={onRemove} className="rounded p-1 text-muted-foreground hover:text-rose-400">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Trim sliders — only visible when duration is known */}
      {clip.durationSec > 0 && (
        <div className="border-t border-border/50 px-3 pb-3 pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trim</p>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-12 shrink-0">Start</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, clip.durationSec - clip.trimEndSec - 0.5)}
                step={0.1}
                value={clip.trimStartSec}
                onChange={(e) => onTrimChange(parseFloat(e.target.value), clip.trimEndSec)}
                className="flex-1 accent-primary"
              />
              <span className="w-10 text-right">{clip.trimStartSec.toFixed(1)}s</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-12 shrink-0">End</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, clip.durationSec - clip.trimStartSec - 0.5)}
                step={0.1}
                value={clip.trimEndSec}
                onChange={(e) => onTrimChange(clip.trimStartSec, parseFloat(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="w-10 text-right">{clip.trimEndSec.toFixed(1)}s</span>
            </label>
          </div>
        </div>
      )}

      {/* Hidden video to probe duration */}
      {!clip.durationSec && clip.videoUrl && (
        <video
          src={clip.videoUrl}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={(e) => onDuration((e.target as HTMLVideoElement).duration)}
        />
      )}
    </div>
  );
}

function SoundtrackNumber({
  label,
  value,
  max,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
      {label}
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.max(0, Math.min(max, next)));
        }}
        className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary/60"
      />
    </label>
  );
}
