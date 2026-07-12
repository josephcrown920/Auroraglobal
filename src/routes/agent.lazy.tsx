import { useEffect, useMemo, useRef, useState } from "react";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  refineAuroraPlan,
  listAgentSessions,
  getAgentSession,
  deleteAgentSession,
  renderAgentShot,
  renderAgentShotVideo,
  type AgentPlan,
  type PlanIteration,
} from "@/lib/agent.functions";
import {
  listAuroraTemplates,
  createAuroraTemplate,
  deleteAuroraTemplate,
  generateAuroraTemplateVideo,
  AURORA_TEMPLATE_MODEL,
  type AuroraTemplateRow,
} from "@/lib/aurora-templates.functions";
import { computeCost } from "@/lib/pricing";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { generateLyricVideoFromSong } from "@/lib/captions.functions";
import { useVideoFromImageJobFn, usePerformanceShotJobFn } from "@/lib/use-job-polling";
import {
  MUSIC_VIDEO_STYLES,
  MUSIC_VIDEO_MODES,
  buildMusicVideoPrompt,
  buildEvenLyricSegments,
  LOCATION_SUGGESTIONS,
  SUBJECT_SUGGESTIONS,
  type MusicVideoMode,
  type MusicVideoStyle,
} from "@/lib/music-video-prompts";
import { VIDEO_MODEL_LIST } from "@/lib/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, AUDIO_ACCEPT } from "@/lib/utils";
import {
  Sparkles,
  Send,
  Loader2,
  Film,
  Wand2,
  Image as ImageIcon,
  Plus,
  Trash2,
  History,
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  Upload,
  User,
  Copy,
  CheckCircle2,
  Bot,
  Play,
  Music2,
  Download,
  Zap,
  RefreshCw,
  X,
  AlignLeft,
  Layers,
  SlidersHorizontal,
  Share2,
  Monitor,
  Smartphone,
  Mic,
  LayoutGrid,
  Check,
} from "lucide-react";

export const Route = createLazyFileRoute("/agent")({ component: AgentPage });

type RenderStatus = "idle" | "rendering" | "succeeded" | "failed";
type RenderState = { status: RenderStatus; url?: string | null };
type VideoStatus = "idle" | "rendering" | "succeeded" | "failed";
type VideoState = { status: VideoStatus; url?: string | null; error?: string };

type AgentMode = "agent" | "templates" | "recipes" | "lyric-video" | "music-video";

const TEMPLATE_COST = computeCost({ features: ["video"], model: AURORA_TEMPLATE_MODEL }).total;

function extractTemplateId(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("templates");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // not a URL — treat as bare ID
  }
  const trimmed = raw.trim();
  return trimmed.length > 4 ? trimmed : null;
}

const SAMPLES = [
  "A man and a chimpanzee rob a bank in the Albuquerque desert. Red Ferrari Testarossa. Hard midday sun, 16mm film look.",
  "Music video for a moody R&B track. Rainy Tokyo rooftop, neon reflections, single performer, slow dolly.",
  "UGC ad for a cold brew brand. Sunlit kitchen, hand pours coffee, condensation on glass, golden hour.",
];

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-rose-300";
}
function scoreBar(score: number): string {
  if (score >= 85) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-rose-400";
}

const SIDEBAR_ITEMS = [
  { id: "avatar",    icon: User,       label: "Avatar",    mode: "templates" as AgentMode, nav: null },
  { id: "ai-tools",  icon: Bot,        label: "AI Tools",  mode: "agent" as AgentMode, nav: null },
  { id: "media",     icon: ImageIcon,  label: "Media",     mode: null, nav: "/studio" },
  { id: "elements",  icon: Sparkles,   label: "Elements",  mode: "recipes" as AgentMode, nav: null },
  { id: "music",     icon: Music2,     label: "Music",     mode: "music-video" as AgentMode, nav: null },
  { id: "captions",  icon: AlignLeft,  label: "Captions",  mode: "lyric-video" as AgentMode, nav: null },
  { id: "templates", icon: Film,       label: "Templates", mode: "templates" as AgentMode, nav: null },
  { id: "layers",    icon: Layers,     label: "Layers",    mode: "agent" as AgentMode, nav: null },
] as const;

function AgentPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const refineFn    = useServerFn(refineAuroraPlan);
  const listFn      = useServerFn(listAgentSessions);
  const getFn       = useServerFn(getAgentSession);
  const delFn       = useServerFn(deleteAgentSession);
  const renderFn    = useServerFn(renderAgentShot);
  const animateFn   = useServerFn(renderAgentShotVideo);
  const listTplFn   = useServerFn(listAuroraTemplates);
  const createTplFn = useServerFn(createAuroraTemplate);
  const deleteTplFn = useServerFn(deleteAuroraTemplate);
  const generateTplFn = useServerFn(generateAuroraTemplateVideo);
  const lyricVideoFn  = useServerFn(generateLyricVideoFromSong);
  const genFn   = usePerformanceShotJobFn();
  const videoFn = useVideoFromImageJobFn();

  const [mode, setMode] = useState<AgentMode>("templates");
  const [activeSidebarId, setActiveSidebarId] = useState<string>("avatar");

  // ── HeyGen-style UI state ────────────────────────────────────────────────
  const [voiceMode, setVoiceMode]   = useState<"no-voice" | "recorded">("no-voice");
  const [layoutMode, setLayoutMode] = useState<"original" | "circle">("original");
  const [radius, setRadius] = useState(0);
  const [zoom, setZoom]     = useState(100);
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
  const [activeShot, setActiveShot] = useState<string | null>(null);

  // ── Lyric Video state ─────────────────────────────────────────────────────
  const [lyricAudioUrl, setLyricAudioUrl]       = useState<string | null>(null);
  const [lyricAudioDuration, setLyricAudioDuration] = useState<number | null>(null);
  const [lyricsText, setLyricsText] = useState("");
  const lyricLines    = lyricsText.split("\n").map((l) => l.trim()).filter(Boolean);
  const lyricSegments = lyricAudioDuration ? buildEvenLyricSegments(lyricAudioDuration, lyricLines) : [];
  const lyricVideoCost = computeCost({ features: ["lyric_video"] }).total;

  useEffect(() => {
    if (!lyricAudioUrl) { setLyricAudioDuration(null); return; }
    const audio = new Audio();
    audio.preload = "metadata";
    const onLoaded = () => setLyricAudioDuration(audio.duration || null);
    const onError  = () => { setLyricAudioDuration(null); toast.error("Couldn't read that audio file's duration"); };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = lyricAudioUrl;
    return () => { audio.removeEventListener("loadedmetadata", onLoaded); audio.removeEventListener("error", onError); };
  }, [lyricAudioUrl]);

  // ── Music Video state ─────────────────────────────────────────────────────
  const [mvStyle,    setMvStyle]    = useState<MusicVideoStyle>("trap");
  const [mvMode,     setMvMode]     = useState<MusicVideoMode>("text-to-video");
  const [mvLocation, setMvLocation] = useState(LOCATION_SUGGESTIONS[0]);
  const [mvSubject,  setMvSubject]  = useState(SUBJECT_SUGGESTIONS[0]);
  const [mvPrompt,   setMvPrompt]   = useState(() =>
    buildMusicVideoPrompt("text-to-video", "trap", LOCATION_SUGGESTIONS[0], SUBJECT_SUGGESTIONS[0]),
  );
  const [mvImage,      setMvImage]      = useState<string | null>(null);
  const [mvVideoModel, setMvVideoModel] = useState(VIDEO_MODEL_LIST[0].value);
  const mvCurrentMode = MUSIC_VIDEO_MODES.find((m) => m.key === mvMode)!;
  const mvVideoCost   = computeCost({ features: ["video"], model: mvVideoModel, durationSeconds: 5, resolution: "720p" }).total;

  useEffect(() => {
    setMvPrompt(buildMusicVideoPrompt(mvMode, mvStyle, mvLocation, mvSubject));
  }, [mvMode, mvStyle, mvLocation, mvSubject]);

  // ── Story Agent state ──────────────────────────────────────────────────────
  const [brief,      setBrief]      = useState("");
  const [sessionId,  setSessionId]  = useState<string | null>(null);
  const [plan,       setPlan]       = useState<AgentPlan | null>(null);
  const [iterations, setIterations] = useState<PlanIteration[]>([]);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [renders,    setRenders]    = useState<Record<string, RenderState>>({});
  const [videos,     setVideos]     = useState<Record<string, VideoState>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Template state ───────────────────────────────────────────────────────
  const [tplFormOpen, setTplFormOpen] = useState(false);
  const [tplName,     setTplName]     = useState("");
  const [tplRawId,    setTplRawId]    = useState("");
  const [tplCharKey,  setTplCharKey]  = useState("character");
  const [genPhotoUrl, setGenPhotoUrl] = useState<Record<string, string>>({});
  const [genAvatarId, setGenAvatarId] = useState<Record<string, string>>({});
  const [genMode,     setGenMode]     = useState<Record<string, "photo" | "avatar">>({});
  const [tplResult,   setTplResult]   = useState<Record<string, { status: "rendering" | "done" | "failed"; url?: string }>>({});

  // ── Auth redirect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const sessionsQuery = useQuery({
    queryKey: ["agent-sessions"],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const templatesQuery = useQuery({
    queryKey: ["aurora-templates"],
    queryFn: () => listTplFn(),
    enabled: !!user,
  });

  // Derived: selected template
  const templates   = templatesQuery.data ?? [];
  const selectedTpl = useMemo(
    () => templates.find((t) => t.id === selectedTplId) ?? templates[0] ?? null,
    [templates, selectedTplId],
  );

  // Auto-select first template when list loads
  useEffect(() => {
    if (!selectedTplId && templates.length > 0) setSelectedTplId(templates[0].id);
  }, [templates, selectedTplId]);

  // Auto-select first shot when plan changes
  useEffect(() => {
    if (plan?.shots.length) setActiveShot((prev) => prev ?? plan.shots[0].id);
  }, [plan]);

  // Sync sidebar active icon when mode changes programmatically
  useEffect(() => {
    const item = SIDEBAR_ITEMS.find((i) => i.mode === mode);
    if (item) setActiveSidebarId(item.id);
  }, [mode]);

  // ── Derived: current preview result ─────────────────────────────────────
  const currentResult = useMemo((): { url: string; type: "video" | "image" } | null => {
    if (mode === "templates" && selectedTpl) {
      const res = tplResult[selectedTpl.id];
      if (res?.status === "done" && res.url) return { url: res.url, type: "video" };
    }
    if (mode === "agent" && activeShot) {
      const vs = videos[activeShot];
      if (vs?.status === "succeeded" && vs.url) return { url: vs.url, type: "video" };
      const rs = renders[activeShot];
      if (rs?.status === "succeeded" && rs.url) return { url: rs.url, type: "image" };
    }
    return null;
  }, [mode, selectedTpl, tplResult, activeShot, videos, renders]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveTplMut = useMutation({
    mutationFn: async () => {
      if (!tplName.trim()) throw new Error("Give this template a name");
      const tid = extractTemplateId(tplRawId.trim());
      if (!tid) throw new Error("Paste a HeyGen template ID or URL");
      if (!tplCharKey.trim()) throw new Error("Enter the character variable key");
      return createTplFn({
        data: {
          name: tplName.trim(),
          heygenTemplateId: tid,
          fixedVariables: {
            [tplCharKey.trim()]: {
              name: tplCharKey.trim(),
              type: "character",
              properties: { url: "", talking_photo_id: "" },
            },
          },
          characterVariableKey: tplCharKey.trim(),
        },
      });
    },
    onSuccess: () => {
      setTplName(""); setTplRawId(""); setTplCharKey("character"); setTplFormOpen(false);
      qc.invalidateQueries({ queryKey: ["aurora-templates"] });
      toast.success("Template saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTplMut = useMutation({
    mutationFn: (id: string) => deleteTplFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aurora-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateTplMut = useMutation({
    mutationFn: async ({ tpl, gMode }: { tpl: AuroraTemplateRow; gMode: "photo" | "avatar" }) => {
      const photo  = genPhotoUrl[tpl.id]?.trim();
      const avatar = genAvatarId[tpl.id]?.trim();
      if (gMode === "photo"  && !photo)  throw new Error("Enter a photo URL");
      if (gMode === "avatar" && !avatar) throw new Error("Enter an avatar ID");
      setTplResult((r) => ({ ...r, [tpl.id]: { status: "rendering" } }));
      return generateTplFn({
        data: {
          auroraTemplateId: tpl.id,
          character: {
            name: tpl.character_variable_key,
            type: "character" as const,
            properties: {
              type: gMode === "photo" ? "talking_photo" : "avatar",
              character_id: gMode === "photo" ? photo! : avatar!,
            },
          },
        },
      });
    },
    onSuccess: (r, { tpl }) => {
      setTplResult((prev) => ({ ...prev, [tpl.id]: { status: "done", url: r.ok ? r.url : undefined } }));
      toast.success("Video ready!");
    },
    onError: (e: Error, { tpl }) => {
      setTplResult((prev) => ({ ...prev, [tpl.id]: { status: "failed" } }));
      toast.error(e.message);
    },
  });

  const refineMut = useMutation({
    mutationFn: (input: { brief: string; sessionId?: string }) =>
      refineFn({ data: { brief: input.brief, sessionId: input.sessionId } }),
    onSuccess: (r) => {
      setSessionId(r.sessionId);
      setPlan(r.plan);
      setIterations(r.iterations);
      setFinalScore(r.finalScore);
      setStopReason(r.stopReason);
      setRenders({});
      setVideos({});
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
      toast.success(`Plan ready — ${r.plan.shots.length} shots · scored ${r.finalScore}/100`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadMut = useMutation({
    mutationFn: (id: string) => getFn({ data: { sessionId: id } }),
    onSuccess: (r) => {
      setSessionId(r.session.id);
      setBrief(r.session.brief);
      setPlan(r.session.plan);
      setIterations(r.session.iterations);
      setFinalScore(r.session.iterations.at(-1)?.critique.score ?? null);
      setStopReason(null);
      const rmap: Record<string, RenderState> = {};
      for (const [sid, v] of Object.entries(r.renders)) {
        rmap[sid] = { status: v.status === "succeeded" ? "succeeded" : "rendering", url: v.url };
      }
      setRenders(rmap);
      setVideos({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { sessionId: id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["agent-sessions"] });
      if (id === sessionId) startNew();
      toast.success("Session deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const startNew = () => {
    setSessionId(null);
    setPlan(null);
    setIterations([]);
    setFinalScore(null);
    setStopReason(null);
    setRenders({});
    setVideos({});
    setBrief("");
  };

  const renderShot = async (shotId: string) => {
    if (!sessionId) { toast.error("Save a plan before rendering"); return; }
    setRenders((m) => ({ ...m, [shotId]: { status: "rendering" } }));
    try {
      const r = await renderFn({ data: { sessionId, shotId } });
      setRenders((m) => ({ ...m, [shotId]: { status: "succeeded", url: r.url } }));
      setVideos((m) => ({ ...m, [shotId]: { status: "idle" } }));
      toast.success(`Shot ${shotId} rendered`);
    } catch (e) {
      setRenders((m) => ({ ...m, [shotId]: { status: "failed" } }));
      toast.error(e instanceof Error ? e.message : "Render failed");
    }
  };

  const animateShot = async (shotId: string) => {
    if (!sessionId) { toast.error("Save a plan before animating"); return; }
    setVideos((m) => ({ ...m, [shotId]: { status: "rendering" } }));
    try {
      const r = await animateFn({ data: { sessionId, shotId } });
      setVideos((m) => ({ ...m, [shotId]: { status: "succeeded", url: r.url } }));
      toast.success(`Shot ${shotId} animated`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Animate failed";
      setVideos((m) => ({ ...m, [shotId]: { status: "failed", error: message } }));
      toast.error(message);
    }
  };

  const submitBrief = () => {
    const text = brief.trim();
    if (text.length < 4) return;
    refineMut.mutate({ brief: text, sessionId: sessionId ?? undefined });
  };

  const handleGenerate = () => {
    if (mode === "templates" && selectedTpl) {
      const gm = genMode[selectedTpl.id] ?? "photo";
      generateTplMut.mutate({ tpl: selectedTpl, gMode: gm });
    } else if (mode === "agent") {
      submitBrief();
    } else if (mode === "lyric-video") {
      if (!lyricAudioUrl) return toast.error("Upload a song first");
      if (lyricSegments.length === 0) return toast.error("Paste at least one lyric line");
      lyricVideoFn({ data: { audioUrl: lyricAudioUrl, lines: lyricSegments } })
        .then(() => { toast.success("Lyric video queued"); qc.invalidateQueries({ queryKey: ["agent-gens"] }); })
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"));
    } else if (mode === "music-video") {
      if (!mvPrompt.trim()) return toast.error("Enter a prompt");
      const doGen = async () => {
        try {
          if (mvCurrentMode?.needsImage && mvImage) {
            await videoFn({ data: { imageUrl: mvImage, prompt: mvPrompt, duration: 5, resolution: "720p", modelKey: mvVideoModel, cameraMovement: "static", endFrameUrl: null } });
          } else {
            await genFn({ data: { prompt: mvPrompt, imageUrls: [], motionVideoUrl: null, model: "black-forest-labs/flux-1.1-pro" } });
          }
          toast.success("Queued — result will appear in your studio");
          qc.invalidateQueries({ queryKey: ["agent-gens"] });
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
      };
      void doGen();
    }
  };

  const busy = refineMut.isPending;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div className="h-screen grid place-items-center bg-[#0d0d11]">
        <Loader2 className="size-6 animate-spin text-violet-400" />
      </div>
    );
  }

  // ── Active shot data (for right panel) ───────────────────────────────────
  const activeShotData  = plan?.shots.find((s) => s.id === activeShot) ?? null;
  const activeShotRs    = activeShot ? (renders[activeShot] ?? { status: "idle" as RenderStatus }) : null;
  const activeShotVs    = activeShot ? (videos[activeShot]  ?? { status: "idle" as VideoStatus  }) : null;
  const currentGenMode  = selectedTpl ? (genMode[selectedTpl.id] ?? "photo") : "photo";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0d11] text-white">

      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d0d11] px-2 gap-2">
        <div className="flex items-center gap-0.5">
          <Link
            to="/"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="size-3.5" />
          </Link>
          <button
            onClick={startNew}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <LayoutGrid className="size-3.5" />
          </button>
        </div>

        <p className="text-[11px] font-medium text-white/35 tracking-wide">Aurora Video Studio</p>

        <div className="flex items-center gap-1">
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <Share2 className="size-3.5" />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <RefreshCw className="size-3.5" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={busy || generateTplMut.isPending}
            className="flex items-center gap-1.5 h-7 px-4 rounded-md text-xs font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)" }}
          >
            {(busy || generateTplMut.isPending) && <Loader2 className="size-3 animate-spin" />}
            Generate
          </button>
        </div>
      </header>

      {/* ─── Sub-bar ──────────────────────────────────────────────────────── */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0d0d11] px-3">
        <div className="flex items-center gap-2">
          {/* Mode selector pill */}
          <div className="flex items-center gap-1 rounded border border-white/12 bg-white/5 px-2 h-5 text-[10px] text-white/50 cursor-pointer hover:bg-white/10 transition-colors select-none">
            <Film className="size-2.5" />
            <span>
              {mode === "templates"   ? "Avatar videos"
               : mode === "agent"    ? "Story Agent"
               : mode === "recipes"  ? "Showcase"
               : mode === "lyric-video" ? "Lyric Video"
               : "Music Video"}
            </span>
            <ChevronDown className="size-2.5 ml-0.5 opacity-60" />
          </div>
          {/* Project name */}
          <span className="text-[11px] text-white/60 font-medium truncate max-w-[180px]">
            {mode === "templates" && selectedTpl ? selectedTpl.name
             : mode === "agent" && plan ? plan.title
             : "New project"}
          </span>
          {/* Device toggles */}
          <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-white/10">
            {[Monitor, Smartphone].map((Icon, i) => (
              <button key={i} className="flex h-5 w-5 items-center justify-center rounded text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors">
                <Icon className="size-3" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 h-5 text-[10px] text-white/40 hover:bg-white/10 transition-colors">
            <Sparkles className="size-2.5 text-violet-400" /> Brand System
          </button>
          <button className="flex h-5 w-5 items-center justify-center rounded text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors">
            <Play className="size-3" />
          </button>
        </div>
      </div>

      {/* ─── Main 4-panel layout ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ─── Left: Script Panel (256px) ──────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-white/10 bg-[#0d0d11]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 h-9 border-b border-white/10 shrink-0">
            <span className="text-[11px] font-semibold text-white/70">Script</span>
            <div className="flex items-center">
              <button className="h-6 w-6 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors">
                <Copy className="size-3.5" />
              </button>
              <button className="h-6 w-6 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors">
                <SlidersHorizontal className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* ─ Templates mode script ─ */}
            {mode === "templates" && (
              <div className="p-3 space-y-3">
                {/* Scene 1 */}
                <div className={cn(
                  "flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer",
                  selectedTpl ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-white/[0.03]",
                )}>
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-violet-500/25 text-violet-300 shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold">1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white/85 truncate">
                      {selectedTpl?.name ?? "Select a template →"}
                    </p>
                    <p className="text-[10px] text-white/35 mt-0.5">24.3s · Avatar video</p>
                  </div>
                </div>

                {/* Character input */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/35 uppercase tracking-wider">Character</p>
                  {/* Photo / Avatar toggle */}
                  <div className="flex gap-1">
                    {(["photo", "avatar"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => selectedTpl && setGenMode((m) => ({ ...m, [selectedTpl.id]: k }))}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] border transition-colors",
                          currentGenMode === k
                            ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                            : "border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/5",
                        )}
                      >
                        {k === "photo" ? <Upload className="size-3" /> : <User className="size-3" />}
                        {k === "photo" ? "My Photo" : "HeyGen ID"}
                      </button>
                    ))}
                  </div>
                  {currentGenMode === "photo" ? (
                    <Input
                      value={selectedTpl ? (genPhotoUrl[selectedTpl.id] ?? "") : ""}
                      onChange={(e) => selectedTpl && setGenPhotoUrl((u) => ({ ...u, [selectedTpl.id]: e.target.value }))}
                      placeholder="Photo URL…"
                      className="h-7 text-xs bg-white/5 border-white/12 text-white placeholder:text-white/25"
                    />
                  ) : (
                    <Input
                      value={selectedTpl ? (genAvatarId[selectedTpl.id] ?? "") : ""}
                      onChange={(e) => selectedTpl && setGenAvatarId((a) => ({ ...a, [selectedTpl.id]: e.target.value }))}
                      placeholder="HeyGen avatar ID…"
                      className="h-7 text-xs bg-white/5 border-white/12 text-white font-mono placeholder:text-white/25"
                    />
                  )}
                  {selectedTpl && (genPhotoUrl[selectedTpl.id] || genAvatarId[selectedTpl.id]) && (
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full border border-violet-400/50 overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                        {genPhotoUrl[selectedTpl.id] ? (
                          <img src={genPhotoUrl[selectedTpl.id]} alt="Avatar preview" className="size-full object-cover" />
                        ) : (
                          <User className="size-4 text-white/30" />
                        )}
                      </div>
                      <p className="text-[10px] text-white/40 truncate">
                        {currentGenMode === "photo" ? "Photo ready" : "Avatar ID set"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Template ID */}
                {selectedTpl && (
                  <p className="text-[10px] font-mono text-white/20 truncate">
                    {selectedTpl.heygen_template_id}
                  </p>
                )}

                {/* Status in script */}
                {selectedTpl && tplResult[selectedTpl.id]?.status === "rendering" && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Loader2 className="size-3 animate-spin text-violet-400" /> Rendering video…
                  </div>
                )}
                {selectedTpl && tplResult[selectedTpl.id]?.status === "failed" && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-300">
                    <AlertTriangle className="size-3" /> Render failed — try again
                  </div>
                )}
                {selectedTpl && tplResult[selectedTpl.id]?.status === "done" && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                    <Check className="size-3" /> Video ready
                  </div>
                )}
              </div>
            )}

            {/* ─ Agent mode script ─ */}
            {mode === "agent" && (
              <div className="p-3 space-y-3">
                <Textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder={"Characters, location, vibe, era…\ne.g. a man and a chimp rob a bank in the desert"}
                  rows={4}
                  className="resize-none text-xs bg-white/5 border-white/12 text-white placeholder:text-white/25"
                />

                {/* Shot list as scenes */}
                {plan && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">
                      Scenes · {plan.shots.length}
                    </p>
                    {plan.shots.map((s, i) => {
                      const rs      = renders[s.id] ?? { status: "idle" as RenderStatus };
                      const vs      = videos[s.id]  ?? { status: "idle" as VideoStatus  };
                      const isActive = activeShot === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActiveShot(s.id)}
                          className={cn(
                            "w-full flex items-start gap-2 rounded-lg border p-2 text-left transition-colors",
                            isActive
                              ? "border-violet-400/40 bg-violet-500/10"
                              : "border-white/10 bg-white/[0.02] hover:bg-white/5",
                          )}
                        >
                          <div className="flex items-center justify-center w-5 h-5 rounded bg-white/10 text-white/50 shrink-0 mt-0.5">
                            <span className="text-[9px] font-bold">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-white/85 truncate">{s.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] font-mono text-white/25">{s.id}</span>
                              {vs.status === "succeeded" && <span className="text-[9px] text-violet-300">● video</span>}
                              {rs.status === "succeeded" && vs.status !== "succeeded" && <span className="text-[9px] text-teal-300">● still</span>}
                              {(rs.status === "rendering" || vs.status === "rendering") && <Loader2 className="size-2.5 animate-spin text-white/35" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Sample prompts */}
                {!plan && !busy && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/25 uppercase tracking-wider">Try a prompt</p>
                    {SAMPLES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setBrief(s)}
                        className="w-full text-left text-[11px] p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-white/55 transition-all leading-relaxed"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─ Lyric Video mode script ─ */}
            {mode === "lyric-video" && (
              <div className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/35 uppercase tracking-wider">Song</p>
                  <UploadSlot
                    userId={user!.id}
                    label="Upload audio"
                    hint="MP3 / WAV / M4A"
                    accept={AUDIO_ACCEPT}
                    kind="video"
                    value={lyricAudioUrl}
                    onChange={setLyricAudioUrl}
                  />
                  {lyricAudioUrl && lyricAudioDuration == null && (
                    <p className="text-xs text-white/40 flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Reading duration…</p>
                  )}
                  {lyricAudioDuration != null && (
                    <p className="text-[10px] text-white/40">Duration: {Math.round(lyricAudioDuration)}s</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">Lyrics</p>
                    <span className="text-[10px] text-white/25">one line per lyric</span>
                  </div>
                  <Textarea
                    rows={12}
                    value={lyricsText}
                    onChange={(e) => setLyricsText(e.target.value)}
                    className="resize-none text-xs bg-white/5 border-white/12 text-white placeholder:text-white/25"
                    placeholder={"Line one\nLine two\nLine three"}
                  />
                  {lyricLines.length > 0 && (
                    <p className="text-[10px] text-white/35">
                      {lyricLines.length} line{lyricLines.length === 1 ? "" : "s"}
                      {lyricAudioDuration != null && lyricSegments.length > 0
                        ? ` · ~${(lyricAudioDuration / lyricLines.length).toFixed(1)}s each`
                        : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ─ Music Video mode script ─ */}
            {mode === "music-video" && (
              <div className="p-3 space-y-3">
                {mvCurrentMode?.needsImage && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">Reference image</p>
                    <UploadSlot userId={user!.id} label="Upload" hint="Cover art or frame" value={mvImage} onChange={setMvImage} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/35 uppercase tracking-wider">
                    Direction <span className="normal-case font-normal text-white/25">auto-built · editable</span>
                  </p>
                  <Textarea
                    rows={12}
                    value={mvPrompt}
                    onChange={(e) => setMvPrompt(e.target.value)}
                    className="resize-none text-xs bg-white/5 border-white/12 text-white"
                  />
                </div>
              </div>
            )}

            {/* ─ Recipes/Showcase mode script ─ */}
            {mode === "recipes" && (
              <div className="p-3 space-y-3">
                <p className="text-[10px] text-white/35 uppercase tracking-wider">About</p>
                <p className="text-xs text-white/50 leading-relaxed">
                  Real HeyGen Video Agent recipes — copy-paste command sets for CI/CD pipelines, batch generation, Chrome Extensions, and more.
                </p>
                <div className="space-y-2">
                  {["README-to-Video", "Viral Video Pipeline", "Site2Video Extension", "AI News Broadcast", "AI Mafia Game"].map((title, i) => (
                    <div key={title} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-white/10 text-white/40 shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold">{i + 1}</span>
                      </div>
                      <p className="text-[11px] text-white/65 leading-tight">{title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-white/10 px-3 py-2 flex items-center justify-between">
            <button className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/65 transition-colors">
              <Plus className="size-3.5" /> Add scene
            </button>
            <button className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/65 hover:bg-white/10 transition-colors">
              <Mic className="size-3.5" />
            </button>
          </div>
        </aside>

        {/* ─── Center: Preview Canvas ──────────────────────────────────────── */}
        <main className="flex-1 flex flex-col bg-[#0f0f15] min-w-0">
          {/* Preview area */}
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_#1a1a2e_0%,_#0f0f15_70%)]">
              {currentResult?.type === "video" && (
                <video
                  key={currentResult.url}
                  src={currentResult.url}
                  controls
                  playsInline
                  className="max-w-full max-h-full rounded-xl shadow-2xl"
                />
              )}
              {currentResult?.type === "image" && (
                <img
                  src={currentResult.url}
                  alt="Preview"
                  className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
                />
              )}
              {!currentResult && (
                <div className="flex flex-col items-center gap-5 text-center px-8">
                  {mode === "templates" && selectedTpl && tplResult[selectedTpl.id]?.status === "rendering" ? (
                    <>
                      <div className="size-24 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Loader2 className="size-10 text-violet-400 animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/60">Rendering video…</p>
                        <p className="text-xs text-white/30 mt-1">This may take 30–60 seconds</p>
                      </div>
                    </>
                  ) : busy ? (
                    <>
                      <Loader2 className="size-10 text-violet-400 animate-spin" />
                      <div>
                        <p className="text-sm text-white/60">Running director ↔ critic loop…</p>
                        <p className="text-xs text-white/30 mt-1">propose · critique · refine · re-score</p>
                      </div>
                    </>
                  ) : mode === "recipes" ? (
                    /* Showcase mode: show recipes in center */
                    <div className="w-full max-w-2xl text-left space-y-4 max-h-full overflow-y-auto">
                      <div>
                        <p className="text-lg font-bold text-white">Showcase</p>
                        <p className="text-xs text-white/40 mt-0.5">HeyGen Video Agent recipes — real production patterns</p>
                      </div>
                      {[
                        { title: "README-to-Video", badge: "GitHub Actions", accent: "from-emerald-400 to-teal-500", stack: "TypeScript · GitHub Actions · Claude", cost: "~$0.05–0.15/video", steps: ["GitHub Action watches README changes", "Claude writes scene-by-scene prompts", "Video Agent renders and embeds back in README"] },
                        { title: "Viral Video Pipeline", badge: "Batch · Portrait", accent: "from-violet-400 to-purple-500", stack: "Claude Code · HeyGen Skills", cost: "~$6 for 6 videos", steps: ["Web search for trending topics", "Generate 6 TikTok/Reels-ready videos", "Batch report with performance predictions"] },
                        { title: "Site2Video — Chrome Extension", badge: "Chrome Extension", accent: "from-blue-400 to-cyan-500", stack: "Vite + React · Next.js · Gemini", cost: "Per-render", steps: ["Extension captures full-page screenshot", "Analyzes site's visual DNA", "Generates style-aware Video Agent prompt"] },
                        { title: "AI News Broadcast", badge: "Automated Pipeline", accent: "from-amber-400 to-orange-500", stack: "Bun · TypeScript", cost: "Per-video", steps: ["Gathers AI papers from arXiv + HN", "Builds script with an LLM", "Posts video to Telegram"] },
                        { title: "AI Mafia — Live Avatar Game", badge: "Live Avatars", accent: "from-rose-400 to-pink-500", stack: "Next.js · HeyGen Live Avatar SDK · Claude", cost: "Live streaming", steps: ["3 AI NPCs argue, accuse, and vote", "Claude powers decision-making", "Real-time streaming — not pre-rendered"] },
                      ].map((recipe) => (
                        <div key={recipe.title} className="aurora-panel p-4 space-y-2 relative overflow-hidden">
                          <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${recipe.accent} rounded-l-xl`} />
                          <div className="pl-3">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold">{recipe.title}</h3>
                              <span className={`rounded-full bg-gradient-to-r ${recipe.accent} px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider`}>{recipe.badge}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-[10px] text-white/40">
                              <span>{recipe.stack}</span>
                              <span className="font-mono">{recipe.cost}</span>
                            </div>
                            <ol className="mt-2 space-y-0.5 list-decimal list-inside text-[11px] text-white/55">
                              {recipe.steps.map((s, i) => <li key={i}>{s}</li>)}
                            </ol>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="size-24 rounded-3xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                        <Film className="size-10 text-white/12" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/45">
                          {mode === "templates"
                            ? (selectedTpl ? "Configure & Generate" : "Select a template →")
                            : mode === "agent"
                            ? "Describe your video to begin"
                            : "Preview appears here"}
                        </p>
                        <p className="text-xs text-white/25 mt-1.5">
                          {mode === "templates" && selectedTpl
                            ? `Add a photo URL in the Script panel and click Generate · ${TEMPLATE_COST} Aura`
                            : mode === "agent"
                            ? "Type a brief in the Script panel, then click Generate"
                            : ""}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="absolute bottom-3 right-3 text-[10px] font-bold text-white/8 tracking-widest uppercase pointer-events-none">Aurora</div>
          </div>

          {/* Playback bar + scene thumbnails */}
          <div className="shrink-0 border-t border-white/10 bg-[#0d0d11] px-4 pt-2 pb-3 space-y-2">
            {/* Transport */}
            <div className="flex items-center gap-2">
              <button className="text-white/35 hover:text-white/70 transition-colors">
                <Play className="size-4" />
              </button>
              <span className="text-[10px] font-mono text-white/40">00:00</span>
              <span className="text-[10px] text-white/20">/</span>
              <span className="text-[10px] font-mono text-white/25">
                {mode === "lyric-video" && lyricAudioDuration
                  ? `${Math.round(lyricAudioDuration)}s`
                  : mode === "templates" ? "24.3s" : "--"}
              </span>
              <div className="flex-1 h-0.5 bg-white/10 rounded-full mx-1 cursor-pointer relative">
                <div className="h-full w-0 bg-violet-400 rounded-full" />
              </div>
              <span className="border border-white/12 rounded px-1.5 py-0.5 text-[10px] text-white/35 cursor-pointer hover:bg-white/10 transition-colors">1×</span>
            </div>

            {/* Scene thumbnails */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {mode === "templates" && templates.map((tpl) => {
                const res      = tplResult[tpl.id];
                const isActive = selectedTpl?.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTplId(tpl.id)}
                    className={cn(
                      "shrink-0 w-16 h-9 rounded border overflow-hidden relative transition-colors",
                      isActive ? "border-violet-400/70 ring-1 ring-violet-400/40" : "border-white/10 hover:border-white/25",
                    )}
                  >
                    {res?.status === "done" && res.url ? (
                      <video src={res.url} className="size-full object-cover" muted playsInline />
                    ) : (
                      <div className="size-full bg-white/5 flex items-center justify-center">
                        {res?.status === "rendering"
                          ? <Loader2 className="size-3 animate-spin text-violet-400" />
                          : <Film className="size-3 text-white/20" />}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                      <p className="text-[8px] text-white/55 truncate">{tpl.name}</p>
                    </div>
                  </button>
                );
              })}

              {mode === "agent" && plan?.shots.map((s, i) => {
                const rs      = renders[s.id] ?? { status: "idle" as RenderStatus };
                const vs      = videos[s.id]  ?? { status: "idle" as VideoStatus  };
                const isActive = activeShot === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveShot(s.id)}
                    className={cn(
                      "shrink-0 w-16 h-9 rounded border overflow-hidden relative transition-colors",
                      isActive ? "border-violet-400/70" : "border-white/10 hover:border-white/25",
                    )}
                  >
                    {vs.status === "succeeded" && vs.url ? (
                      <video src={vs.url} className="size-full object-cover" muted playsInline />
                    ) : rs.status === "succeeded" && rs.url ? (
                      <img src={rs.url} alt={s.title} className="size-full object-cover" />
                    ) : (
                      <div className="size-full bg-white/5 flex items-center justify-center">
                        {rs.status === "rendering" || vs.status === "rendering"
                          ? <Loader2 className="size-3 animate-spin text-violet-400" />
                          : <span className="text-[9px] text-white/25">{i + 1}</span>}
                      </div>
                    )}
                  </button>
                );
              })}

              <button className="shrink-0 w-16 h-9 rounded border border-white/10 border-dashed flex items-center justify-center text-white/25 hover:text-white/45 hover:bg-white/5 transition-colors">
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        </main>

        {/* ─── Right: Properties Panel (224px) ─────────────────────────────── */}
        <aside className="w-56 shrink-0 flex flex-col border-l border-white/10 bg-[#0d0d11] overflow-y-auto">

          {/* ── TEMPLATES mode properties ── */}
          {mode === "templates" && (
            <>
              {/* Avatar & Voice */}
              <div className="border-b border-white/10">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-white/75">Avatar &amp; Voice (Scene 1)</p>
                  <button className="text-white/25 hover:text-white/60 transition-colors">
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex gap-1">
                    {[
                      { key: "no-voice" as const,  label: "No voice"       },
                      { key: "recorded" as const,   label: "Recorded voice" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setVoiceMode(key)}
                        className={cn(
                          "flex-1 py-1 rounded text-[10px] font-medium border transition-colors",
                          voiceMode === key
                            ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                            : "border-white/10 bg-white/[0.03] text-white/35 hover:bg-white/5",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Motion Engine = Template selector */}
              <div className="border-b border-white/10 px-3 py-3 space-y-2">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Motion Engine</p>

                {templatesQuery.isLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="size-4 animate-spin text-white/25" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                    <Film className="size-5 text-white/15 mx-auto mb-1.5" />
                    <p className="text-[10px] text-white/35">No templates saved</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setSelectedTplId(tpl.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                          selectedTpl?.id === tpl.id
                            ? "border-violet-400/40 bg-violet-500/10"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/5",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-6 rounded-md bg-[var(--teal-dim)] border border-[var(--teal-border)] flex items-center justify-center shrink-0">
                            <User className="size-3 text-[var(--teal)]" />
                          </div>
                          <p className="text-[11px] text-white/75 truncate">{tpl.name}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTplMut.mutate(tpl.id); }}
                          className="text-white/15 hover:text-rose-300 shrink-0 transition-colors"
                          aria-label="Delete template"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}

                {/* Add template */}
                <button
                  onClick={() => setTplFormOpen((o) => !o)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/12 py-1.5 text-[11px] text-white/35 hover:text-white/55 hover:border-white/25 transition-colors"
                >
                  <Plus className="size-3" /> {tplFormOpen ? "Cancel" : "Add template"}
                </button>

                {tplFormOpen && (
                  <div className="space-y-1.5 p-2.5 rounded-lg border border-white/10 bg-white/[0.03]">
                    <Input value={tplName}    onChange={(e) => setTplName(e.target.value)}    placeholder="Template name" className="h-7 text-xs bg-black/30 border-white/10 text-white" />
                    <Input value={tplRawId}   onChange={(e) => setTplRawId(e.target.value)}   placeholder="HeyGen template ID or URL" className="h-7 text-xs bg-black/30 border-white/10 text-white font-mono" />
                    <Input value={tplCharKey} onChange={(e) => setTplCharKey(e.target.value)} placeholder="character" className="h-7 text-xs bg-black/30 border-white/10 text-white font-mono" />
                    <Button onClick={() => saveTplMut.mutate()} disabled={saveTplMut.isPending} size="sm" className="w-full h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white border-0">
                      {saveTplMut.isPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <CheckCircle2 className="size-3 mr-1" />}
                      Save template
                    </Button>
                    <div className="text-[10px] text-white/30 leading-relaxed space-y-0.5">
                      <p>1. Go to <a href="https://app.heygen.com/templates" target="_blank" rel="noreferrer" className="text-violet-400 underline">app.heygen.com</a></p>
                      <p>2. Open template → copy the URL or ID</p>
                      <p>3. Note the character variable key name</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar Background */}
              <div className="border-b border-white/10 px-3 py-3 space-y-2">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Avatar Background</p>
                <div className="flex gap-1">
                  {["Customize", "Remove", "Color"].map((opt) => (
                    <button
                      key={opt}
                      className="flex-1 py-1 rounded text-[10px] border border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/8 transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout */}
              <div className="border-b border-white/10 px-3 py-3 space-y-2">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Layout</p>
                <div className="flex gap-1">
                  {([["original", "Original"], ["circle", "Circle"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setLayoutMode(key)}
                      className={cn(
                        "flex-1 py-1 rounded text-[10px] border transition-colors",
                        layoutMode === key
                          ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                          : "border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/8",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius */}
              <div className="border-b border-white/10 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Radius</p>
                  <span className="text-[10px] font-mono text-white/35">{radius}px</span>
                </div>
                <input
                  type="range" min="0" max="100" value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full h-1 rounded-full accent-violet-400 cursor-pointer"
                  style={{ background: `linear-gradient(to right, #7c3aed ${radius}%, rgba(255,255,255,0.1) ${radius}%)` }}
                />
              </div>

              {/* Zoom */}
              <div className="border-b border-white/10 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Zoom</p>
                  <span className="text-[10px] font-mono text-white/35">{zoom}%</span>
                </div>
                <input
                  type="range" min="50" max="200" value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 rounded-full accent-violet-400 cursor-pointer"
                  style={{ background: `linear-gradient(to right, #7c3aed ${(zoom - 50) / 1.5}%, rgba(255,255,255,0.1) ${(zoom - 50) / 1.5}%)` }}
                />
              </div>

              {/* Render + download */}
              <div className="p-3 space-y-2.5">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedTpl || generateTplMut.isPending}
                  className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: generateTplMut.isPending ? "#78350f" : "linear-gradient(135deg, #d97706 0%, #b45309 100%)", boxShadow: "0 2px 12px rgba(217,119,6,0.35)" }}
                >
                  {generateTplMut.isPending
                    ? <><Loader2 className="size-3.5 animate-spin" /> Rendering…</>
                    : <><Sparkles className="size-3.5" /> Render Scene</>}
                </button>

                <p className="text-[10px] text-white/25 text-center">{TEMPLATE_COST} Aura · ~30–60s</p>

                {selectedTpl && tplResult[selectedTpl.id]?.status === "done" && tplResult[selectedTpl.id]?.url && (
                  <div className="flex gap-1.5">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        const url = tplResult[selectedTpl.id].url!;
                        fetch(url).then((r) => r.blob()).then((blob) => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `${selectedTpl.name}-heygen.mp4`;
                          a.click();
                        });
                      }}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 text-white/65 transition-colors"
                    >
                      <Download className="size-3" /> Download
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(tplResult[selectedTpl.id].url!); toast.success("URL copied"); }}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 text-white/65 transition-colors"
                    >
                      <Copy className="size-3" /> Copy URL
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── AGENT mode properties ── */}
          {mode === "agent" && (
            <div className="flex flex-col flex-1">
              <div className="px-3 py-2.5 border-b border-white/10">
                <p className="text-[11px] font-semibold text-white/75">AI Tools</p>
              </div>
              <div className="p-3 space-y-3 flex-1">
                {/* Score */}
                {finalScore !== null && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                    <p className={`text-3xl font-bold ${scoreColor(finalScore)}`}>{finalScore}</p>
                    <p className="text-[9px] uppercase tracking-wider text-white/35 mt-0.5">critic score</p>
                    {stopReason && (
                      <p className="text-[10px] text-white/30 mt-1">
                        {stopReason === "threshold" ? "✓ met quality bar" : stopReason === "converged" ? "improvements plateaued" : "reached max iterations"}
                      </p>
                    )}
                  </div>
                )}

                {/* Plan summary */}
                {plan && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-white/70">{plan.title}</p>
                    <p className="text-[11px] text-white/40 italic leading-relaxed">&ldquo;{plan.logline}&rdquo;</p>
                    <div className="flex gap-1.5">
                      {plan.palette.slice(0, 5).map((c) => (
                        <div key={c} title={c} className="flex-1 aspect-square rounded-md border border-white/10" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Active shot controls */}
                {activeShotData && activeShotRs && activeShotVs && (
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">Active scene</p>
                    <p className="text-[11px] text-white/70 font-medium leading-tight">{activeShotData.title}</p>
                    <p className="text-[10px] text-white/35">{activeShotData.shotType} · {activeShotData.camera}</p>
                    <Button
                      onClick={() => renderShot(activeShotData.id)}
                      disabled={activeShotRs.status === "rendering"}
                      size="sm"
                      className="w-full h-7 text-[11px] bg-white/8 hover:bg-white/12 text-white/75 border border-white/12"
                    >
                      {activeShotRs.status === "rendering" ? <Loader2 className="size-3 mr-1 animate-spin" /> : <ImageIcon className="size-3 mr-1" />}
                      {activeShotRs.status === "succeeded" ? "Re-render" : activeShotRs.status === "rendering" ? "Rendering…" : "Render still"}
                    </Button>
                    <Button
                      onClick={() => animateShot(activeShotData.id)}
                      disabled={activeShotRs.status !== "succeeded" || activeShotVs.status === "rendering"}
                      size="sm"
                      className="w-full h-7 text-[11px] bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border border-violet-500/25"
                    >
                      {activeShotVs.status === "rendering" ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Film className="size-3 mr-1" />}
                      {activeShotVs.status === "succeeded" ? "Re-animate" : activeShotVs.status === "rendering" ? "Animating…" : "Animate shot"}
                    </Button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(activeShotData.prompt); toast.success("Prompt copied"); }}
                      className="w-full text-[10px] text-violet-300/60 hover:text-violet-300 transition-colors text-center"
                    >
                      <Wand2 className="size-3 inline mr-1" /> Copy scene prompt
                    </button>
                  </div>
                )}

                {/* Refinement history (compact) */}
                {iterations.length > 0 && (
                  <div className="border-t border-white/10 pt-3 space-y-1.5">
                    <button
                      onClick={() => setHistoryOpen((o) => !o)}
                      className="w-full flex items-center justify-between text-[10px] text-white/35 hover:text-white/55 transition-colors"
                    >
                      <span className="uppercase tracking-wider flex items-center gap-1.5"><History className="size-3" /> History · {iterations.length}</span>
                      <ChevronDown className={cn("size-3 transition-transform", historyOpen && "rotate-180")} />
                    </button>
                    {historyOpen && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {iterations.map((it: PlanIteration) => (
                          <div key={it.n} className="rounded-lg border border-white/10 bg-black/20 p-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-mono text-white/35">Round {it.n}</span>
                              <span className={`text-xs font-bold ${scoreColor(it.critique.score)}`}>{it.critique.score}</span>
                              <div className="flex-1 h-1 rounded-full bg-white/10">
                                <div className={`h-full rounded-full ${scoreBar(it.critique.score)}`} style={{ width: `${it.critique.score}%` }} />
                              </div>
                            </div>
                            <p className="text-[10px] text-white/50 mt-1 line-clamp-2">{it.critique.verdict}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Direct story button */}
                <div className="border-t border-white/10 pt-3">
                  <Button
                    onClick={submitBrief}
                    disabled={busy || brief.trim().length < 4}
                    className="w-full h-9 text-xs font-medium text-white border-0"
                    style={{ background: "var(--gradient-hero)" }}
                  >
                    {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Send className="size-3.5 mr-1.5" />}
                    {busy ? "Directing…" : plan ? "Re-direct" : "Direct story"}
                  </Button>
                </div>
              </div>

              {/* Saved sessions (compact) */}
              <div className="border-t border-white/10 shrink-0">
                <div className="px-3 py-2 flex items-center gap-1.5 text-[10px] text-white/30 border-b border-white/5">
                  <History className="size-3" /> Recent sessions
                </div>
                <div className="max-h-36 overflow-y-auto p-2 space-y-1">
                  {sessionsQuery.isLoading ? (
                    <div className="flex justify-center py-3"><Loader2 className="size-3.5 animate-spin text-white/25" /></div>
                  ) : (sessionsQuery.data ?? []).length === 0 ? (
                    <p className="text-[10px] text-white/20 text-center py-3">No sessions yet</p>
                  ) : (sessionsQuery.data ?? []).slice(0, 6).map((s) => (
                    <div key={s.id} className={cn(
                      "group flex items-center justify-between rounded-md border px-2 py-1.5 cursor-pointer transition-colors",
                      s.id === sessionId ? "border-violet-400/30 bg-violet-500/10" : "border-white/5 hover:bg-white/5",
                    )}>
                      <button onClick={() => loadMut.mutate(s.id)} className="flex-1 text-left min-w-0">
                        <p className="text-[11px] text-white/65 truncate">{s.title || "Untitled"}</p>
                      </button>
                      <button
                        onClick={() => deleteMut.mutate(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-rose-300 ml-1 shrink-0 transition-all"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── LYRIC VIDEO mode properties ── */}
          {mode === "lyric-video" && (
            <div className="p-3 space-y-3">
              <div className="pb-3 border-b border-white/10">
                <p className="text-[11px] font-semibold text-white/75">Lyric Video</p>
                <p className="text-[10px] text-white/35 mt-0.5">Times each line evenly to your track</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
                <Zap className="size-3.5 text-violet-400 shrink-0" />
                <span className="text-xs text-white/45">Cost:</span>
                <span className="text-xs text-white font-medium">{lyricVideoCost} Aura</span>
                <span className="text-xs text-white/25">· ~20–40s</span>
              </div>
              <Button
                disabled={!lyricAudioUrl || lyricSegments.length === 0}
                onClick={async () => {
                  if (!lyricAudioUrl) return toast.error("Upload a song in the Script panel first");
                  if (lyricSegments.length === 0) return toast.error("Add at least one lyric line");
                  try {
                    await lyricVideoFn({ data: { audioUrl: lyricAudioUrl, lines: lyricSegments } });
                    toast.success("Lyric video queued — check your studio");
                    qc.invalidateQueries({ queryKey: ["agent-gens"] });
                  } catch (e: unknown) {
                    toast.error((e instanceof Error ? e.message : null) ?? "Generation failed");
                  }
                }}
                className="w-full h-9 text-xs font-medium text-white border-0"
                style={{ background: "var(--gradient-hero)" }}
              >
                <Wand2 className="size-3.5 mr-1.5" /> Generate · {lyricVideoCost} Aura
              </Button>
              {(!lyricAudioUrl || lyricSegments.length === 0) && (
                <p className="text-[10px] text-white/25 text-center leading-relaxed">
                  {!lyricAudioUrl ? "Upload a song in the Script panel" : "Add lyrics in the Script panel"}
                </p>
              )}
            </div>
          )}

          {/* ── MUSIC VIDEO mode properties ── */}
          {mode === "music-video" && (
            <div className="p-3 space-y-3">
              <div className="pb-3 border-b border-white/10">
                <p className="text-[11px] font-semibold text-white/75">Music Video</p>
                <p className="text-[10px] text-white/35 mt-0.5">Cinematic AI music videos</p>
              </div>
              {/* Genre */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-white/35 uppercase tracking-wider">Genre</p>
                <div className="grid grid-cols-2 gap-1">
                  {(Object.entries(MUSIC_VIDEO_STYLES) as [MusicVideoStyle, (typeof MUSIC_VIDEO_STYLES)[MusicVideoStyle]][]).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setMvStyle(key)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-[10px] text-left transition-colors",
                        mvStyle === key ? "border-violet-400/50 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/8",
                      )}
                    >
                      {meta.emoji} {meta.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Mode */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-white/35 uppercase tracking-wider">What to create</p>
                <div className="space-y-1">
                  {MUSIC_VIDEO_MODES.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMvMode(m.key)}
                      className={cn(
                        "w-full rounded-md border px-2 py-1.5 text-[10px] text-left transition-colors",
                        mvMode === m.key ? "border-violet-400/50 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/8",
                      )}
                    >
                      <div className="font-semibold">{m.label}</div>
                      <div className="text-[9px] opacity-50 mt-0.5">{m.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Location & Subject */}
              {(mvMode === "text-to-video" || mvMode === "ai-performance" || mvMode === "beat-sync") && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/35 uppercase tracking-wider">Scene details</p>
                  <Select value={mvLocation} onValueChange={setMvLocation}>
                    <SelectTrigger className="h-7 text-xs bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCATION_SUGGESTIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={mvSubject} onValueChange={setMvSubject}>
                    <SelectTrigger className="h-7 text-xs bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBJECT_SUGGESTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
                <Zap className="size-3.5 text-violet-400 shrink-0" />
                <span className="text-xs text-white/45">Cost:</span>
                <span className="text-xs text-white font-medium">{mvVideoCost} Aura</span>
              </div>
              <Button
                disabled={!mvPrompt.trim() || (mvCurrentMode?.needsImage && !mvImage)}
                onClick={handleGenerate}
                className="w-full h-9 text-xs font-medium text-white border-0"
                style={{ background: "var(--gradient-hero)" }}
              >
                <Music2 className="size-3.5 mr-1.5" /> Generate · {mvVideoCost} Aura
              </Button>
            </div>
          )}

          {/* ── RECIPES mode properties ── */}
          {mode === "recipes" && (
            <div className="p-3 space-y-3">
              <div className="pb-3 border-b border-white/10">
                <p className="text-[11px] font-semibold text-white/75">Showcase</p>
                <p className="text-[10px] text-white/35 mt-0.5">Patterns &amp; common workflows</p>
              </div>
              <div className="space-y-2">
                {[
                  "Content → LLM → Video Agent prompt",
                  "Batch generation with rate limiting",
                  "Style extraction → prompt instructions",
                  "Modular pipelines: research → script → render → deliver",
                ].map((p) => (
                  <div key={p} className="flex items-start gap-2 text-[11px] text-white/50">
                    <span className="mt-1 size-1.5 rounded-full bg-violet-400 shrink-0" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ─── Far Right: Icon Sidebar (52px) ──────────────────────────────── */}
        <nav className="w-[52px] shrink-0 flex flex-col items-center border-l border-white/10 bg-[#0d0d11] py-2 gap-0.5">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.id === activeSidebarId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.nav) {
                    navigate({ to: item.nav as "/" });
                  } else if (item.mode) {
                    setMode(item.mode);
                    setActiveSidebarId(item.id);
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 w-10 py-2 px-1 rounded-lg transition-all text-center",
                  isActive
                    ? "text-violet-300 bg-violet-500/15"
                    : "text-white/30 hover:text-white/60 hover:bg-white/5",
                )}
                title={item.label}
              >
                <item.icon className="size-4" />
                <span className="text-[8px] leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </div>
  );
}
