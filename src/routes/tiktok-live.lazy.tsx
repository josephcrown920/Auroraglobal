import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Film,
  Globe,
  Layers,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Monitor,
  Moon,
  Plus,
  Radio,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { orchestrateGenerate } from "@/lib/orchestration.functions";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/tiktok-live")({ component: TikTokLiveStudio });

// ─── Scene presets ──────────────────────────────────────────────────────────
const SCENE_PRESETS = [
  {
    id: "stage",
    label: "Concert Stage",
    prompt: "Cinematic concert stage with dramatic neon lights, fog machine effects, crowd in background, ultra realistic, wide shot, 16:9",
    thumb: "/hero/hero-perform-anywhere.png",
  },
  {
    id: "rooftop",
    label: "City Rooftop",
    prompt: "Luxury rooftop at golden hour, city skyline background, warm atmospheric lighting, ultra realistic, 16:9",
    thumb: "/hero/hero-1.png",
  },
  {
    id: "studio",
    label: "Recording Studio",
    prompt: "Professional recording studio interior, mixing console, warm lighting, acoustic panels, dark aesthetic, ultra realistic 16:9",
    thumb: "/hero/hero-2.png",
  },
  {
    id: "neon",
    label: "Neon Alley",
    prompt: "Rain-soaked neon alley at night, Tokyo street aesthetic, colorful reflections on wet pavement, cinematic 16:9",
    thumb: "/hero/hero-3.png",
  },
  {
    id: "mansion",
    label: "Mansion Interior",
    prompt: "Luxury mansion living room, modern art on walls, floor to ceiling windows, city view at night, ultra realistic 16:9",
    thumb: "/hero/hero-4.png",
  },
  {
    id: "beach",
    label: "Sunset Beach",
    prompt: "Tropical beach at sunset, golden hour light, palm trees silhouettes, dramatic sky, cinematic 16:9",
    thumb: "/hero/hero-5.png",
  },
] as const;

type SceneId = (typeof SCENE_PRESETS)[number]["id"];

interface GeneratedScene {
  id: string;
  label: string;
  imageUrl: string;
  prompt: string;
  generatedAt: Date;
}

// ─── Component ───────────────────────────────────────────────────────────────
function TikTokLiveStudio() {
  const { user } = useAuth();
  const { showFeature } = useFeatureVisibility();
  const generateFn = useServerFn(orchestrateGenerate);

  const [activeScene, setActiveScene] = useState<SceneId | string>("stage");
  const [generatedScenes, setGeneratedScenes] = useState<GeneratedScene[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [chatMessages, setChatMessages] = useState<{ user: string; msg: string; color: string }[]>([
    { user: "aurora_fan99", msg: "Let's gooo 🔥🔥", color: "#a3e635" },
    { user: "musiclover", msg: "The background is INSANE", color: "#818cf8" },
    { user: "creator_hub", msg: "How did you make that?? 👀", color: "#f472b6" },
    { user: "tiktok_vibes", msg: "aurora did that fr fr", color: "#34d399" },
  ]);
  const chatRef = useRef<HTMLDivElement>(null);

  // Simulate live viewers/likes while LIVE
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => {
      setViewers((v) => v + Math.floor(Math.random() * 12));
      setLikes((l) => l + Math.floor(Math.random() * 30));
      if (Math.random() > 0.6) {
        const names = ["@waves_up", "@letsgetit", "@night_mode", "@aurora_user", "@topfan"];
        const msgs = ["🔥🔥🔥", "amazing backdrop!", "w background fr", "how?? 👀", "stream legend", "drop the link!", "🫶🫶"];
        const colors = ["#a3e635", "#818cf8", "#f472b6", "#34d399", "#fb923c", "#60a5fa"];
        setChatMessages((prev) => [
          ...prev.slice(-20),
          { user: names[Math.floor(Math.random() * names.length)], msg: msgs[Math.floor(Math.random() * msgs.length)], color: colors[Math.floor(Math.random() * colors.length)] },
        ]);
      }
    }, 1200);
    return () => clearInterval(t);
  }, [isLive]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  // Generate AI background
  const genMutation = useMutation({
    mutationFn: async ({ prompt, label }: { prompt: string; label: string }) => {
      if (!user) throw new Error("Sign in to generate scenes");
      const res = await generateFn({
        data: {
          kind: "image",
          prompt,
          width: 1280,
          height: 720,
          referenceImageUrl: undefined,
        },
      });
      if (!res.ok || !res.url) throw new Error(res.ok ? "No image returned" : res.error);
      return { imageUrl: res.url, label, prompt };
    },
    onSuccess: ({ imageUrl, label, prompt }) => {
      const scene: GeneratedScene = {
        id: `gen-${Date.now()}`,
        label,
        imageUrl,
        prompt,
        generatedAt: new Date(),
      };
      setGeneratedScenes((prev) => [scene, ...prev]);
      setActiveScene(scene.id);
      toast.success(`"${label}" scene generated`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const handlePresetGen = (preset: (typeof SCENE_PRESETS)[number]) => {
    genMutation.mutate({ prompt: preset.prompt, label: preset.label });
  };

  const handleCustomGen = () => {
    if (!customPrompt.trim()) return;
    genMutation.mutate({ prompt: customPrompt + ", ultra realistic, cinematic 16:9 background, no people", label: "Custom Scene" });
    setCustomPrompt("");
    setShowCustom(false);
  };

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(`https://auroraperformancestudio.com/tiktok-live`);
    toast.success("Link copied!");
  };

  const downloadScene = async (scene: GeneratedScene) => {
    try {
      const response = await fetch(scene.imageUrl);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);

      const blob = await response.blob();
      const extension = blob.type === "image/jpeg" ? "jpg" : "png";
      const filename = `${scene.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "aurora-live-background"}-1280x720.${extension}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("OBS-ready background saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download this background");
    }
  };

  // Resolve current background
  const currentBg = (() => {
    const gen = generatedScenes.find((s) => s.id === activeScene);
    if (gen) return gen.imageUrl;
    const preset = SCENE_PRESETS.find((s) => s.id === activeScene);
    return preset?.thumb ?? SCENE_PRESETS[0].thumb;
  })();

  const currentLabel = (() => {
    const gen = generatedScenes.find((s) => s.id === activeScene);
    if (gen) return gen.label;
    return SCENE_PRESETS.find((s) => s.id === activeScene)?.label ?? "Scene";
  })();
  const currentGeneratedScene = generatedScenes.find((scene) => scene.id === activeScene);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white font-sans flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/8 pl-20 pr-4 bg-[#111]">
        {/* Left: branding */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="flex size-6 items-center justify-center rounded bg-[#fe2c55]">
              <Video className="size-3.5 text-white" />
            </span>
            <span className="text-[13px] font-black text-white">TikTok</span>
            <span className="rounded-sm bg-[#fe2c55] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
              LIVE Studio
            </span>
          </Link>
          <span className="text-white/20">·</span>
          <span className="text-[11px] text-white/40 flex items-center gap-1">
            <Sparkles className="size-3 text-violet-400" />
            Powered by Aurora AI
          </span>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <Copy className="size-3" />
            Copy link
          </button>
          {user ? (
            <button
              type="button"
              onClick={() => {
                if (!isLive) { setViewers(0); setLikes(0); }
                setIsLive((v) => !v);
                toast(isLive ? "Stream ended" : "You are now LIVE 🔴");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors",
                isLive
                  ? "bg-white/10 text-white border border-white/20 hover:bg-white/15"
                  : "bg-[#fe2c55] text-white hover:bg-[#e6284d]",
              )}
            >
              {isLive ? (
                <><span className="size-1.5 rounded-full bg-red-400 animate-pulse" />LIVE</>
              ) : (
                <><Radio className="size-3" />Go LIVE</>
              )}
            </button>
          ) : (
            <Link
              to="/auth" search={authNextSearch()}
              className="flex items-center gap-1.5 rounded-md bg-[#fe2c55] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white no-underline hover:bg-[#e6284d] transition-colors"
            >
              Sign in to go LIVE
            </Link>
          )}
          <Link to="/settings" search={{ tiktok: undefined, msg: undefined }} className="flex size-7 items-center justify-center rounded-md border border-white/10 hover:bg-white/5 transition-colors no-underline">
            <Settings className="size-3.5 text-white/50" />
          </Link>
        </div>
      </header>

      {/* ── Main 3-panel studio ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>

        {/* ── LEFT: LIVE tools / scenes ──────────────────────────────────── */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-white/8 bg-[#111] overflow-y-auto">
          <div className="border-b border-white/8 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">LIVE tools</p>
          </div>

          {/* Scenes */}
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Scenes</p>
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                <Plus className="size-3" />
                New
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {/* Generated scenes first */}
              {generatedScenes.map((scene) => (
                <div
                  key={scene.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveScene(scene.id)}
                  onKeyDown={(e) => e.key === "Enter" && setActiveScene(scene.id)}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-left transition-all",
                    activeScene === scene.id
                      ? "bg-violet-500/20 ring-1 ring-violet-500/40"
                      : "hover:bg-white/5",
                  )}
                >
                  <div className="relative shrink-0 h-10 w-16 overflow-hidden rounded-md bg-white/5">
                    <img src={scene.imageUrl} alt={scene.label} className="h-full w-full object-cover" />
                    {activeScene === scene.id && (
                      <div className="absolute inset-0 ring-2 ring-inset ring-violet-500 rounded-md" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-white truncate">{scene.label}</p>
                    <p className="text-[9px] text-[#a3e635]">AI generated</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setGeneratedScenes((p) => p.filter((s) => s.id !== scene.id)); if (activeScene === scene.id) setActiveScene("stage"); }}
                     className="opacity-0 group-hover:opacity-100 transition-opacity"
                     aria-label={`Remove ${scene.label}`}
                  >
                    <X className="size-3 text-white/40 hover:text-red-400" />
                  </button>
                   <button
                     type="button"
                     onClick={(e) => { e.stopPropagation(); void downloadScene(scene); }}
                     className="opacity-0 group-hover:opacity-100 transition-opacity"
                     title="Download 1280×720 OBS background"
                     aria-label={`Download ${scene.label} for OBS`}
                   >
                     <Download className="size-3 text-violet-300 hover:text-white" />
                   </button>
                </div>
              ))}

              {/* Preset scenes */}
              {SCENE_PRESETS.map((scene) => (
                <div
                  key={scene.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveScene(scene.id)}
                  onKeyDown={(e) => e.key === "Enter" && setActiveScene(scene.id)}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-left transition-all",
                    activeScene === scene.id
                      ? "bg-white/10 ring-1 ring-white/20"
                      : "hover:bg-white/5",
                  )}
                >
                  <div className="relative shrink-0 h-10 w-16 overflow-hidden rounded-md bg-white/5">
                    <img src={scene.thumb} alt={scene.label} className="h-full w-full object-cover" />
                    {activeScene === scene.id && (
                      <div className="absolute inset-0 ring-2 ring-inset ring-white/40 rounded-md" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-white truncate">{scene.label}</p>
                    <p className="text-[9px] text-white/30">Preset</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!user) { toast.error("Sign in to generate AI scenes"); return; }
                      handlePresetGen(scene);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Generate AI version"
                  >
                    <Sparkles className="size-3 text-violet-400 hover:text-violet-300" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Aurora AI gen button */}
          <div className="mt-auto border-t border-white/8 p-3">
            <button
              type="button"
              onClick={() => {
                if (!user) { toast.error("Sign in to generate AI scenes"); return; }
                setShowCustom(true);
              }}
              disabled={genMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
            >
              {genMutation.isPending ? (
                <><Loader2 className="size-3.5 animate-spin" />Generating…</>
              ) : (
                <><Sparkles className="size-3.5" />Generate AI Scene</>
              )}
            </button>
            <p className="mt-1.5 text-center text-[9px] text-white/30">Powered by Aurora · 5 Aura</p>
          </div>
        </aside>

        {/* ── CENTER: preview stage ──────────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Preview */}
          <div className="relative flex-1 bg-black overflow-hidden">
            {/* Background scene */}
            <img
              key={currentBg}
              src={currentBg}
              alt={currentLabel}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

            {/* LIVE badge */}
            {isLive && (
              <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-md bg-[#fe2c55] px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[11px] font-black text-white">LIVE</span>
              </div>
            )}

            {/* Generating overlay */}
            {genMutation.isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
                <Loader2 className="size-10 animate-spin text-violet-400" />
                <p className="text-sm font-semibold text-white">Generating your scene…</p>
                <p className="text-xs text-white/50">Aurora AI is building your background</p>
              </div>
            )}

            {/* Scene label */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <span className="rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {currentLabel}
              </span>
              {generatedScenes.some((s) => s.id === activeScene) && (
                <span className="rounded-md bg-violet-500/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                  AI Generated
                </span>
              )}
            </div>
             {currentGeneratedScene && (
               <button
                 type="button"
                 onClick={() => void downloadScene(currentGeneratedScene)}
                 className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-black/30 transition-colors hover:bg-violet-500"
                 title="Save this 1280×720 background for OBS or TikTok LIVE Studio"
               >
                 <Download className="size-3.5" />
                 Save OBS background
               </button>
             )}

            {/* Maximize */}
            <button type="button" className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-md bg-black/40 text-white/60 hover:text-white transition-colors backdrop-blur-sm">
              <Maximize2 className="size-3.5" />
            </button>
          </div>

          {/* ── Bottom controls ─────────────────────────────────────────── */}
          <div className="flex h-14 shrink-0 items-center justify-between border-t border-white/8 bg-[#111] px-4">
            <div className="flex items-center gap-2">
              {/* Mic */}
              <button
                type="button"
                onClick={() => setMicOn((v) => !v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border transition-colors",
                  micOn ? "border-white/15 bg-white/5 text-white" : "border-red-500/40 bg-red-500/10 text-red-400",
                )}
              >
                {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </button>
              {/* Camera */}
              <button
                type="button"
                onClick={() => setCamOn((v) => !v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border transition-colors",
                  camOn ? "border-white/15 bg-white/5 text-white" : "border-red-500/40 bg-red-500/10 text-red-400",
                )}
              >
                {camOn ? <Camera className="size-4" /> : <VideoOff className="size-4" />}
              </button>
              <button type="button" className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors">
                <Volume2 className="size-4" />
              </button>
              <div className="ml-2 h-5 w-px bg-white/10" />
              <button type="button" className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/50 hover:text-white transition-colors">
                <Monitor className="size-4" />
              </button>
              <button type="button" className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/50 hover:text-white transition-colors">
                <Layers className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-white/40">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-400" />
                480p ready
              </span>
              {isLive && (
                <>
                  <span>·</span>
                  <span className="text-red-400 font-bold">● {formatTime()}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {showFeature("spin") && (
                <Link
                  to="/spin"
                  search={{ prompt: undefined, jobId: undefined }}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-300 no-underline hover:bg-violet-500/20 transition-colors"
                >
                  <Film className="size-3.5" />
                  TikTok30 Posts
                </Link>
              )}
              <a
                href="https://www.tiktok.com/live-studio/download"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white no-underline hover:bg-white/10 transition-colors"
              >
                <Download className="size-3.5" />
                Download OBS
              </a>
            </div>
          </div>
        </main>

        {/* ── RIGHT: LIVE data + chat ────────────────────────────────────── */}
        <aside className="flex w-64 shrink-0 flex-col border-l border-white/8 bg-[#111]">
          {/* Stats */}
          <div className="border-b border-white/8 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-3">LIVE data</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/5 p-2.5 text-center">
                <p className="text-[18px] font-black text-white tabular-nums">{isLive ? viewers.toLocaleString() : "—"}</p>
                <p className="text-[9px] text-white/40 mt-0.5 flex items-center justify-center gap-1"><Users className="size-2.5" />Viewers</p>
              </div>
              <div className="rounded-xl bg-white/5 p-2.5 text-center">
                <p className="text-[18px] font-black text-[#fe2c55] tabular-nums">{isLive ? (likes / 1000).toFixed(1) + "K" : "—"}</p>
                <p className="text-[9px] text-white/40 mt-0.5">❤️ Likes</p>
              </div>
              <div className="rounded-xl bg-white/5 p-2.5 text-center">
                <p className="text-[18px] font-black text-[#a3e635] tabular-nums">{isLive ? Math.floor(viewers * 0.08) : "—"}</p>
                <p className="text-[9px] text-white/40 mt-0.5 flex items-center justify-center gap-1"><Zap className="size-2.5" />Gifts</p>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-white/8 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">LIVE chat</p>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-[12px]">
              {chatMessages.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 font-bold" style={{ color: m.color }}>{m.user}</span>
                  <span className="text-white/70 break-words min-w-0">{m.msg}</span>
                </div>
              ))}
              {!isLive && (
                <p className="text-center text-[11px] text-white/25 py-4">Go LIVE to see chat</p>
              )}
            </div>
            {/* Chat input */}
            {user && (
              <div className="border-t border-white/8 p-2">
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <input
                    type="text"
                    placeholder="Say something…"
                    className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        setChatMessages((prev) => [...prev, { user: "You", msg: e.currentTarget.value, color: "#a3e635" }]);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <Globe className="size-3.5 text-white/30" />
                </div>
              </div>
            )}
          </div>

          {/* Aurora CTA */}
          <div className="border-t border-white/8 p-3 space-y-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Aurora tools</p>
            {showFeature("spin") && (
            <Link to="/spin" search={{ prompt: undefined, jobId: undefined }} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 no-underline hover:bg-white/8 transition-colors group">
              <div>
                <p className="text-[11px] font-bold text-white">TikTok30</p>
                <p className="text-[10px] text-white/40">30 posts from 1 idea</p>
              </div>
              <ChevronRight className="size-3.5 text-white/30 group-hover:text-white transition-colors" />
            </Link>
            )}
            <Link to="/lipsync" className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 no-underline hover:bg-white/8 transition-colors group">
              <div>
                <p className="text-[11px] font-bold text-white">Lip Sync</p>
                <p className="text-[10px] text-white/40">Sync your voice to video</p>
              </div>
              <ChevronRight className="size-3.5 text-white/30 group-hover:text-white transition-colors" />
            </Link>
            <Link to="/templates" className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 no-underline hover:bg-white/8 transition-colors group">
              <div>
                <p className="text-[11px] font-bold text-white">Templates</p>
                <p className="text-[10px] text-white/40">One-tap scene starters</p>
              </div>
              <ChevronRight className="size-3.5 text-white/30 group-hover:text-white transition-colors" />
            </Link>
          </div>
        </aside>
      </div>

      {/* ── Custom scene prompt modal ──────────────────────────────────────── */}
      {showCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-violet-400" />
                Generate AI Background
              </h3>
              <button type="button" onClick={() => setShowCustom(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="size-4" />
              </button>
            </div>

            <p className="text-[11px] text-white/50 mb-3">Or generate one of these instantly:</p>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {SCENE_PRESETS.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setShowCustom(false); handlePresetGen(p); }}
                  className="flex flex-col items-start rounded-xl overflow-hidden border border-white/10 hover:border-violet-500/50 transition-colors text-left"
                >
                  <div className="h-14 w-full overflow-hidden">
                    <img src={p.thumb} alt={p.label} className="h-full w-full object-cover" />
                  </div>
                  <p className="px-2 py-1.5 text-[10px] font-semibold text-white">{p.label}</p>
                </button>
              ))}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center"><span className="bg-[#111] px-2 text-[10px] text-white/30">or describe your own</span></div>
            </div>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Cyberpunk nightclub with purple neon lights, smoke machine, dark aesthetic, 16:9 background"
              rows={3}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-violet-500/50 resize-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-[12px] font-semibold text-white/60 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomGen}
                disabled={!customPrompt.trim() || genMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-[12px] font-bold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="size-3.5" />
                Generate — 5 Aura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
