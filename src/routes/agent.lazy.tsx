import { useEffect, useRef, useState } from "react";
import { createLazyFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  chatWithAuroraAgent,
  listAgentChat,
  clearAgentChat,
  saveAgentMemory,
  type SkillMeta,
} from "@/lib/agent.functions";
import { useAuth } from "@/hooks/use-auth";
import {
  enhanceVideoAgentPrompt,
  generateHeyGenAgentVideo,
  analyzeCinematicBrief,
  VIDEO_AGENT_COST,
  type VideoAgentResult,
} from "@/lib/video-agent.functions";
import { VIDEO_AGENT_HELPER_TEXT } from "@/lib/video-agent-prompt";
import { HEYGEN_STYLES, type VideoPlan, type VideoShot } from "@/lib/video-agent-skills";
import { UgcBatchStudio } from "@/components/prime/UgcBatchStudio";
import {
  Send,
  Sparkle,
  Video,
  Wand2,
  Clapperboard,
  Film,
  Music,
  PenLine,
  FileVideo,
  Captions as CaptionsIcon,
  Search,
  Magnet,
  Brain,
  Trash2,
  Save,
  ChevronLeft,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Rocket,
  type LucideIcon,
} from "lucide-react";

export const Route = createLazyFileRoute("/agent")({ component: AgentPage });

// ── Tool definitions ──────────────────────────────────────────────────────

type ToolDef = { label: string; icon: LucideIcon; prompt: string };

const QUICK_START: ToolDef[] = [
  {
    label: "30-second ad",
    icon: Sparkle,
    prompt: "Direct a 30s premium ad: brand promise, one visual metaphor, 6-shot spine, hero product moment, and a ready-to-paste Seedance prompt for the hero shot. Pick a compelling subject or ask me.",
  },
  {
    label: "Music video",
    icon: Music,
    prompt: "Plan a music video: song-structure to visual-structure map, hero shot per section, wardrobe changes, and 3 model prompts for key moments. Ask me for the track, or choose something evocative.",
  },
  {
    label: "Write a script",
    icon: PenLine,
    prompt: "Write a video script in industry format (SLUGLINE / ACTION / CHARACTER / DIALOGUE) for a 90-second piece. Ask me for the topic — or pick something compelling.",
  },
  {
    label: "Avatar video",
    icon: Video,
    prompt: "Plan a talking-head avatar video: 60-second presenter script, on-screen b-roll cues, and captions timing for an explainer.",
  },
  {
    label: "Go fully autonomous",
    icon: Rocket,
    prompt: `AGENT MODE — go fully autonomous. From now on, act as an end-to-end video director.

Ask me ONE short discovery question at a time (max 4 total), then produce the full production package:
1) Logline + concept direction (commit to the strongest, justify).
2) Full script in industry format.
3) 10–14 shot list.
4) Ready-to-paste model prompts for the 3 hero shots.
5) A next-actions checklist.

Never say "let me know" or "would you like". Commit. Ship.`,
  },
  {
    label: "Batch UGC",
    icon: FileVideo,
    prompt: "UGC Batch: generate 6 short-form vertical (9:16) UGC video briefs — persona, hook, on-screen caption, beat plan, and a Seedance prompt for each. Rank by hook strength at the end.",
  },
];

const AURORA_SKILLS: ToolDef[] = [
  {
    label: "Web search",
    icon: Search,
    prompt: "Search the web for the latest trends and references relevant to my current video project.",
  },
  {
    label: "Viral hooks",
    icon: Magnet,
    prompt: "Generate 5 competing viral hooks for my video concept. Score each on clarity, tension, and curiosity gap — explain which is strongest.",
  },
  {
    label: "Brand memory",
    icon: Brain,
    prompt: "Recall my brand memory and tell me everything you know about my ongoing projects, brand voice, and characters.",
  },
  {
    label: "Captions",
    icon: CaptionsIcon,
    prompt: "Write a caption style guide — font, weight, animation, safe-area, and timing — for TikTok, Reels, and YouTube Shorts.",
  },
];

// Welcome-screen starter cards

type Starter = { label: string; desc: string; prompt: string; icon: LucideIcon };

const STARTERS: Starter[] = [
  {
    label: "Make a 30-second ad",
    desc: "Concept, shot list, and a ready-to-paste model prompt.",
    prompt: QUICK_START[0].prompt,
    icon: Sparkle,
  },
  {
    label: "Plan a music video",
    desc: "Visual structure, hero shots, and wardrobe by section.",
    prompt: QUICK_START[1].prompt,
    icon: Music,
  },
  {
    label: "Write a video script",
    desc: "Industry-format script — any topic, any length.",
    prompt: QUICK_START[2].prompt,
    icon: PenLine,
  },
  {
    label: "Create an avatar video",
    desc: "Script, b-roll cues, and captions for a talking-head explainer.",
    prompt: QUICK_START[3].prompt,
    icon: Video,
  },
  {
    label: "Go fully autonomous",
    desc: "Aurora asks a few questions, then ships the entire package.",
    prompt: QUICK_START[4].prompt,
    icon: Rocket,
  },
  {
    label: "Batch UGC content",
    desc: "6 short-form video briefs with Seedance prompts, ranked by hook strength.",
    prompt: QUICK_START[5].prompt,
    icon: FileVideo,
  },
];

// ── Chat message type ─────────────────────────────────────────────────────

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  skillMeta?: SkillMeta | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Shot card ─────────────────────────────────────────────────────────────

function ShotCard({ shot, index }: { shot: VideoShot; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const purposeColor: Record<string, string> = {
    establishing: "text-sky-400",
    context: "text-blue-400",
    character: "text-violet-400",
    reaction: "text-fuchsia-400",
    detail: "text-amber-400",
    insert: "text-orange-400",
    payoff: "text-emerald-400",
  };
  return (
    <div className="rounded-sm border border-line bg-panel/40">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 shrink-0 text-[13px] font-bold text-ink-dim">
          {shot.id ?? `S${index + 1}`}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-widest ${purposeColor[shot.purpose] ?? "text-ink-dim"}`}>
              {shot.purpose}
            </span>
            <span className="text-xs text-ink-dim/60">{shot.shot_type}</span>
            {shot.duration_s && (
              <span className="ml-auto text-xs text-ink-dim/40">{shot.duration_s}s</span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-ink">
            {shot.action}
          </p>
        </div>
        <ChevronDown
          className={`mt-1 size-3.5 shrink-0 text-ink-dim transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-line/50 px-4 pb-4 pt-3 space-y-3">
          {shot.lighting && (
            <div>
              <p className="text-xs uppercase tracking-widest text-ink-dim/60 mb-1">Lighting</p>
              <p className="text-sm text-ink-dim leading-relaxed">{shot.lighting}</p>
            </div>
          )}
          {shot.camera && (
            <div>
              <p className="text-xs uppercase tracking-widest text-ink-dim/60 mb-1">Camera</p>
              <p className="text-sm text-ink-dim leading-relaxed">
                {shot.camera}{shot.lens_mm ? ` · ${shot.lens_mm}mm` : ""}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-ink-dim/60 mb-1">Model Prompt</p>
            <p className="text-sm text-ink leading-relaxed rounded-sm bg-panel-2/60 px-3 py-2">
              {shot.prompt}
            </p>
          </div>
          {shot.chain_from && (
            <p className="text-xs text-ink-dim/40">chain from → {shot.chain_from}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── HeyGen / Cinematic panel ──────────────────────────────────────────────

function HeyGenPanel() {
  const enhanceFn  = useServerFn(enhanceVideoAgentPrompt);
  const generateFn = useServerFn(generateHeyGenAgentVideo);
  const analyzeFn  = useServerFn(analyzeCinematicBrief);

  const [mode,        setMode]        = useState<"script" | "cinematic">("script");
  const [prompt,      setPrompt]      = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [enhancing,   setEnhancing]   = useState(false);
  const [result,      setResult]      = useState<{ url: string; generationId: string } | null>(null);
  const [styleId,     setStyleId]     = useState<string>("");
  const [plan,        setPlan]        = useState<VideoPlan | null>(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const genMut = useMutation({
    mutationFn: async () => {
      const p = prompt.trim();
      if (!p) throw new Error("Write your script or describe your video idea first");
      const res: VideoAgentResult = await generateFn({ data: { prompt: p, orientation } });
      return res;
    },
    onSuccess: (res) => {
      if (!res.ok) {
        if ("heygenCredit" in res && res.heygenCredit) {
          toast.error("HeyGen credits exhausted — top up at app.heygen.com", { duration: 8000 });
        } else if (res.insufficient) {
          toast.error("Not enough Aura — top up in Billing");
        } else {
          toast.error(res.error ?? "Generation failed");
        }
      } else {
        setResult({ url: res.url, generationId: res.generationId });
        toast.success("Avatar video ready!");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const doEnhance = async () => {
    const p = prompt.trim();
    if (!p) return;
    setEnhancing(true);
    try {
      const res = await enhanceFn({ data: { prompt: p, targetSeconds: 20, styleId: styleId || undefined } });
      setPrompt(res.script);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };

  const doAnalyze = async () => {
    const idea = prompt.trim();
    if (!idea) return;
    setAnalyzing(true);
    setPlan(null);
    try {
      const res = await analyzeFn({
        data: { userIdea: idea, format: orientation === "portrait" ? "9:16" : "16:9" },
      });
      setPlan(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const downloadVideo = () => {
    if (!result) return;
    fetch(result.url)
      .then((r) => r.blob())
      .then((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `heygen-video-${result.generationId}.mp4`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => window.open(result.url, "_blank"));
  };

  const selectedStyle = HEYGEN_STYLES.find((s) => s.id === styleId);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header>
          <p className="text-[13px] font-bold uppercase tracking-[0.3em] text-prime">
            Avatar Video
          </p>
          <h2 className="mt-1 text-3xl font-black uppercase leading-tight text-ink">
            Talking-head video<br /><span className="text-prime">from a prompt.</span>
          </h2>
          <p className="mt-2 text-[13px] font-medium text-ink-dim">
            Write what the presenter says, or describe your idea and hit Enhance. Aurora picks the avatar and layout — HeyGen renders the video.
          </p>
        </header>

        {/* Mode tabs */}
        <div className="flex rounded-sm border border-line overflow-hidden">
          {(["script", "cinematic"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setPlan(null); }}
              className={
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-bold uppercase tracking-widest transition-colors " +
                (mode === m
                  ? "bg-prime text-white"
                  : "bg-panel text-ink-dim hover:text-ink")
              }
            >
              {m === "script"
                ? <><Video className="size-3" /> Script</>
                : <><Clapperboard className="size-3" /> Cinematic Plan</>
              }
            </button>
          ))}
        </div>

        {mode === "script" && (
          <>
            <p className="rounded-sm border border-line/60 px-3 py-2 text-sm leading-relaxed text-ink-dim/80">
              {VIDEO_AGENT_HELPER_TEXT}
            </p>

            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="Write what the presenter says — or describe your idea and hit Enhance…"
                className="w-full resize-none rounded-sm border border-line bg-panel/60 px-4 py-3 text-sm text-ink placeholder:text-ink-dim/60 focus:border-prime focus:outline-none"
              />

              {/* Style selector */}
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-widest text-ink-dim/60">Visual Style</p>
                <div className="relative">
                  <select
                    value={styleId}
                    onChange={(e) => setStyleId(e.target.value)}
                    className="w-full appearance-none rounded-sm border border-line bg-panel px-3 py-2 pr-8 text-[12px] text-ink focus:border-prime focus:outline-none"
                  >
                    <option value="">— Aurora decides —</option>
                    {HEYGEN_STYLES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.artist}) — {s.mood}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-dim" />
                </div>
                {selectedStyle && (
                  <p className="text-[13px] text-ink-dim/60 italic">{selectedStyle.bestFor}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => void doEnhance()}
                  disabled={enhancing || !prompt.trim()}
                  className="flex items-center gap-2 rounded-sm border border-line bg-panel px-3 py-2 text-sm font-bold uppercase tracking-wider text-ink-dim transition-colors hover:border-prime/60 hover:text-prime disabled:opacity-40"
                >
                  <Wand2 className="size-3.5" />
                  {enhancing ? "Enhancing…" : "Enhance"}
                </button>

                <div className="ml-auto flex items-center gap-2">
                  {(["landscape", "portrait"] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setOrientation(o)}
                      className={
                        "rounded-sm border px-2.5 py-1.5 text-[13px] font-bold uppercase tracking-wider transition-colors " +
                        (orientation === o
                          ? "border-prime/60 bg-prime/10 text-prime"
                          : "border-line text-ink-dim hover:text-ink")
                      }
                    >
                      {o === "landscape" ? "16:9" : "9:16"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => genMut.mutate()}
                disabled={genMut.isPending || !prompt.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-prime px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-prime-glow disabled:cursor-not-allowed disabled:opacity-40"
              >
                {genMut.isPending ? (
                  <><Loader2 className="size-4 animate-spin" /> Generating…</>
                ) : (
                  <><Video className="size-4" /> Generate · {VIDEO_AGENT_COST} Aura</>
                )}
              </button>
            </div>

            {result && (
              <div className="space-y-3 rounded-sm border border-prime/40 bg-prime/5 p-4">
                <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-prime">
                  <CheckCircle2 className="size-4" /> Video ready
                </div>
                <video src={result.url} controls className="max-h-80 w-full rounded-sm bg-black" />
                <button
                  onClick={downloadVideo}
                  className="text-xs text-prime underline hover:text-prime-glow"
                >
                  Download video
                </button>
              </div>
            )}
          </>
        )}

        {mode === "cinematic" && (
          <>
            <div className="rounded-sm border border-line/60 px-3 py-2 text-sm leading-relaxed text-ink-dim/80">
              Describe your video idea in plain language. Aurora applies its director skill — brief → direction → shot list — and builds a full production plan with ready-to-paste model prompts for each shot.
            </div>

            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. A lone chef plating a dish in a dark Michelin restaurant at 2am…"
                className="w-full resize-none rounded-sm border border-line bg-panel/60 px-4 py-3 text-sm text-ink placeholder:text-ink-dim/60 focus:border-prime focus:outline-none"
              />

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {(["landscape", "portrait"] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setOrientation(o)}
                      className={
                        "rounded-sm border px-2.5 py-1.5 text-[13px] font-bold uppercase tracking-wider transition-colors " +
                        (orientation === o
                          ? "border-prime/60 bg-prime/10 text-prime"
                          : "border-line text-ink-dim hover:text-ink")
                      }
                    >
                      {o === "landscape" ? "16:9" : "9:16"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => void doAnalyze()}
                  disabled={analyzing || !prompt.trim()}
                  className="ml-auto flex items-center gap-2 rounded-sm bg-prime px-4 py-2 text-[13px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-prime-glow disabled:opacity-40"
                >
                  {analyzing
                    ? <><Loader2 className="size-3.5 animate-spin" /> Analyzing…</>
                    : <><Clapperboard className="size-3.5" /> Analyze</>
                  }
                </button>
              </div>
            </div>

            {plan && plan.brief && (
              <div className="space-y-4">
                {/* Brief */}
                <div className="rounded-sm border border-prime/30 bg-prime/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-prime/70 mb-1">
                        {plan.brief.motion_language} · {plan.brief.format}
                      </p>
                      <h3 className="text-lg font-black uppercase text-ink">{plan.brief.title}</h3>
                      <p className="mt-1 text-[12px] font-medium italic text-ink-dim">{plan.brief.logline}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {plan.brief.palette.slice(0, 5).map((p) => (
                        <span
                          key={p.hex}
                          title={p.role}
                          className="size-5 rounded-full border border-white/10"
                          style={{ backgroundColor: p.hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.brief.references.map((r) => (
                      <span key={r} className="rounded-sm border border-line px-2 py-0.5 text-xs text-ink-dim">{r}</span>
                    ))}
                  </div>
                  {plan.brief.assumptions && plan.brief.assumptions.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-ink-dim/50 mb-1">Assumptions</p>
                      <ul className="space-y-0.5">
                        {plan.brief.assumptions.map((a, i) => (
                          <li key={i} className="text-[13px] text-ink-dim/70 italic">· {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Direction — collapsible technical details */}
                {plan.direction && (
                  <div>
                    <button
                      onClick={() => setShowDetails((v) => !v)}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-dim hover:text-ink transition-colors"
                    >
                      <ChevronDown className={`size-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                      Technical direction
                    </button>
                    {showDetails && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          { label: "Lens",       value: plan.direction.lens },
                          { label: "Film Look",  value: plan.direction.film_stock },
                          { label: "Camera",     value: plan.direction.camera_movement },
                          { label: "Pacing",     value: plan.direction.pacing },
                          { label: "Lighting",   value: plan.direction.lighting },
                          { label: "Sound",      value: plan.direction.sound_register },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-sm border border-line/50 bg-panel/30 px-3 py-2">
                            <p className="text-xs uppercase tracking-widest text-ink-dim/50 mb-0.5">{label}</p>
                            <p className="text-sm font-medium text-ink leading-snug">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Shots */}
                {plan.shots && plan.shots.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-ink-dim/60">
                      {plan.shots.length} shots — click to see technical details
                    </p>
                    {plan.shots.map((shot, i) => (
                      <ShotCard key={shot.id ?? i} shot={shot} index={i} />
                    ))}
                  </div>
                )}

                {/* Director's notes */}
                {plan.suggestions && plan.suggestions.length > 0 && (
                  <div className="rounded-sm border border-line/40 px-4 py-3 space-y-1.5">
                    <p className="text-xs uppercase tracking-widest text-ink-dim/50 mb-2">Director's Notes</p>
                    {plan.suggestions.map((s, i) => (
                      <p key={i} className="text-sm text-ink-dim leading-relaxed">→ {s}</p>
                    ))}
                  </div>
                )}

                {/* Render hint */}
                {plan.render_plan && (
                  <div className="flex items-center gap-2 text-[13px] text-ink-dim/50">
                    <Film className="size-3" />
                    <span>Suggested: {plan.render_plan.model} · {plan.render_plan.resolution} · {plan.render_plan.fps}fps</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Main page component
// ══════════════════════════════════════════════════════════════════════════

function AgentPage() {
  const { user, loading } = useAuth();
  const navigate          = useNavigate();
  const qc                = useQueryClient();

  const chatFn  = useServerFn(chatWithAuroraAgent);
  const listFn  = useServerFn(listAgentChat);
  const clearFn = useServerFn(clearAgentChat);
  const saveFn  = useServerFn(saveAgentMemory);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/" });
  }, [user, loading, navigate]);

  // ── Local state ─────────────────────────────────────────────────────────
  const MEMORY_KEY = "aurora-prime:memory:v1";

  const [messages,        setMessages]        = useState<ChatMsg[]>([]);
  const [isLoading,       setIsLoading]       = useState(false);
  const [input,           setInput]           = useState("");
  const [directorMemory,  setDirectorMemory]  = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(MEMORY_KEY) ?? "";
  });
  const [memorySaveState, setMemorySaveState] = useState<"saved" | "unsaved" | "saving">("saved");
  const memorySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tab: tabParam } = useSearch({ from: "/agent" });
  // "Generate" tab (OrchestrateStudio) was retired; always open Workspace.
  // tabParam kept in search type so old ?tab=generate deep-links don't 404.
  const [activeTab, setActiveTab] = useState<"Workspace" | "HeyGen">(
    tabParam === "heygen" ? "HeyGen" : "Workspace",
  );
  const [leftOpen, setLeftOpen] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Persist director memory: localStorage immediately + debounced server save
  const saveMemoryToServer = (text: string) => {
    if (memorySaveTimer.current) clearTimeout(memorySaveTimer.current);
    setMemorySaveState("unsaved");
    memorySaveTimer.current = setTimeout(() => {
      setMemorySaveState("saving");
      saveFn({ data: { memory: text } })
        .then(() => setMemorySaveState("saved"))
        .catch(() => setMemorySaveState("unsaved"));
    }, 1200);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MEMORY_KEY, directorMemory);
    }
  }, [directorMemory]);

  // ── Load chat history ────────────────────────────────────────────────────
  const historyQ = useQuery({
    queryKey: ["agent-chat-history"],
    queryFn: () => listFn({}),
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (historyQ.data?.messages && messages.length === 0) {
      setMessages(
        historyQ.data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          skillMeta: m.skillMeta,
        })),
      );
      if (historyQ.data.memory) {
        setDirectorMemory(historyQ.data.memory);
      }
    }
  }, [historyQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMsg = { id: genId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await chatFn({ data: { message: trimmed, cinematicMode: true } });
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "assistant",
          content: result.reply,
          skillMeta: result.skillInvoked,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const launch = (text: string) => { setInput(""); void sendMessage(text); };
  const submit = () => { void sendMessage(input); };

  // ── Clear chat ────────────────────────────────────────────────────────────
  const clearThread = async () => {
    if (!confirm("Clear conversation? Your brand memory is kept.")) return;
    await clearFn({});
    setMessages([]);
    qc.invalidateQueries({ queryKey: ["agent-chat-history"] });
  };

  if (loading) return null;

  return (
    <div
      data-page="prime-gold"
      className="relative flex h-screen w-full overflow-hidden text-ink"
      style={{ fontFamily: "inherit", background: "var(--canvas)", color: "var(--ink)" }}
    >
      <AmbientBackdrop />

      {/* ── LEFT SIDEBAR ────────────────────────────────────────────────────── */}
      {leftOpen && (
        <aside
          className="flex w-60 shrink-0 flex-col border-r border-line bg-panel/70 backdrop-blur-sm"
          style={{ zIndex: 10 }}
        >
          {/* header */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-4">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2 rounded-full bg-primary" /></span>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-ink-dim">Video Agent</span>
              <span className="text-[13px] font-black uppercase tracking-widest text-ink">Aurora</span>
            </div>
          </div>

          {/* navigation */}
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <SidebarSection title="Quick Start">
              {QUICK_START.map((t) => (
                <SidebarItem
                  key={t.label}
                  icon={t.icon}
                  label={t.label}
                  onClick={() => { setActiveTab("Workspace"); launch(t.prompt); }}
                />
              ))}
            </SidebarSection>
            <SidebarSection title="Aurora Skills">
              {AURORA_SKILLS.map((t) => (
                <SidebarItem
                  key={t.label}
                  icon={t.icon}
                  label={t.label}
                  onClick={() => { setActiveTab("Workspace"); launch(t.prompt); }}
                  accent
                />
              ))}
            </SidebarSection>
          </nav>

          {/* footer — director memory */}
          <div className="border-t border-line px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-ink-dim">
              <span>Director</span>
              <button
                onClick={clearThread}
                className="flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-ink-dim transition-colors hover:border-rec/60 hover:text-rec text-xs"
              >
                <Trash2 className="size-2.5" /> Clear
              </button>
            </div>
            <div className="rounded-sm border border-line bg-panel-2/60 px-2 py-1.5">
              <div className="mb-1 flex items-center justify-between gap-1 text-xs font-bold uppercase tracking-widest text-prime">
                <span className="flex items-center gap-1"><Save className="size-3" /> Brand Memory</span>
                <span
                  className={
                    "text-[10px] font-medium normal-case tracking-normal " +
                    (memorySaveState === "saved"
                      ? "text-ink-dim/50"
                      : memorySaveState === "saving"
                      ? "text-prime/70 animate-pulse"
                      : "text-amber-400/80")
                  }
                >
                  {memorySaveState === "saved" ? "saved" : memorySaveState === "saving" ? "saving…" : "unsaved"}
                </span>
              </div>
              <textarea
                value={directorMemory}
                onChange={(e) => {
                  setDirectorMemory(e.target.value);
                  saveMemoryToServer(e.target.value);
                }}
                rows={3}
                placeholder="Brand voice, characters, ongoing project…"
                className="w-full resize-none bg-transparent text-[13px] font-medium leading-snug text-ink placeholder:text-ink-dim/50 focus:outline-none"
              />
            </div>
          </div>
        </aside>
      )}

      {/* left toggle */}
      <button
        onClick={() => setLeftOpen((v) => !v)}
        className="absolute top-1/2 z-30 -translate-y-1/2 flex h-12 w-6 flex-col items-center justify-center gap-0.5 rounded-r-md border border-l-0 border-line bg-panel text-ink-dim shadow-md transition-all hover:bg-panel-2 hover:text-ink"
        style={{ left: leftOpen ? "15rem" : "0" }}
        title={leftOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <ChevronLeft className={"size-3.5 transition-transform " + (leftOpen ? "" : "rotate-180")} />
      </button>

      {/* ── CENTER ──────────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col" style={{ zIndex: 5 }}>
        {/* tab bar */}
        <div className="flex h-13 items-center border-b border-line bg-canvas/80 px-6 backdrop-blur-sm">
          <div className="flex gap-6 text-[13px] font-bold uppercase tracking-[0.2em]">
            {(["Workspace", "HeyGen"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={
                  "py-4 transition-colors " +
                  (activeTab === t ? "border-b border-prime text-ink" : "text-ink-dim hover:text-ink")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "HeyGen" && <HeyGenPanel />}

        {activeTab === "Workspace" && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-3xl">

              {/* welcome / empty state */}
              {messages.length === 0 && (
                <div className="space-y-10 pb-12">
                  <header className="space-y-2">
                    <h1 className="text-4xl font-black uppercase leading-tight text-ink">
                      What do you want<br /><span className="text-prime">to create?</span>
                    </h1>
                    <p className="max-w-lg text-[14px] font-medium leading-relaxed text-ink-dim">
                      Describe your idea and Aurora will direct it — script, shot list, and ready-to-paste model prompts.
                    </p>
                  </header>

                  {/* Starter cards */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {STARTERS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.label}
                          onClick={() => launch(s.prompt)}
                          className="group rounded-sm border border-line bg-panel/50 p-4 text-left transition-all hover:border-prime/60 hover:bg-panel"
                        >
                          <Icon className="mb-3 size-4 text-prime transition-colors group-hover:text-prime-glow" />
                          <p className="text-sm font-bold text-ink leading-snug">{s.label}</p>
                          <p className="mt-1 text-[12px] text-ink-dim leading-snug">{s.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* UGC Batch Studio — real generation tool, kept accessible */}
                  <UgcBatchStudio onLaunch={launch} />
                </div>
              )}

              {/* messages */}
              <div className="space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
                    {m.role === "user" ? (
                      <div className="max-w-[85%] rounded-l-2xl rounded-br-sm border-r-2 border-prime bg-panel-2/60 px-4 py-3 text-sm text-ink">
                        <div className="mb-1 text-xs uppercase tracking-widest text-ink-dim">You</div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    ) : (
                      <>
                        <span className="mt-1 flex size-[26px] shrink-0 items-center justify-center rounded bg-primary/10"><span className="inline-block size-1.5 rounded-full bg-primary" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-prime">
                            Aurora
                            <span className="text-ink-dim">/ Director</span>
                            {m.skillMeta && (
                              <span className="flex items-center gap-1 rounded-md border border-prime/30 bg-prime/10 px-2 py-0.5 text-xs text-prime-glow">
                                {m.skillMeta.icon} {m.skillMeta.label}
                              </span>
                            )}
                          </div>
                          <article className="prose prose-invert prose-sm max-w-none prose-headings:text-ink prose-p:text-ink prose-strong:text-ink prose-code:text-prime-glow prose-pre:border prose-pre:border-line prose-pre:bg-panel/80 prose-a:text-prime-glow">
                            <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                          </article>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <span className="mt-1 flex size-[26px] shrink-0 items-center justify-center rounded bg-primary/10"><span className="inline-block size-1.5 rounded-full bg-primary" /></span>
                    <div className="flex items-center gap-2 text-[13px] uppercase tracking-widest text-ink-dim">
                      <span className="size-1.5 rounded-full bg-prime rec-pulse" />
                      Aurora is thinking…
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* composer — only show for Workspace tab */}
        {activeTab === "Workspace" && (
          <div className="border-t border-line bg-canvas/80 px-6 py-4 backdrop-blur-sm">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-sm border border-line bg-panel/60 px-3 py-2 focus-within:border-prime/60">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                  }}
                  rows={1}
                  placeholder="Describe your idea, ask for a script, or paste a reference…"
                  className="max-h-40 min-h-6 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-ink-dim/60 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={submit}
                  disabled={isLoading || !input.trim()}
                  className="flex size-9 items-center justify-center rounded-sm bg-prime text-white transition-colors hover:bg-prime-glow disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-1.5 text-right text-xs uppercase tracking-widest text-ink-dim/40">
                Enter to send · Shift+Enter for newline
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute inset-0 bg-canvas" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, color-mix(in oklch, var(--prime) 25%, transparent) 0%, transparent 45%), " +
            "radial-gradient(circle at 80% 75%, color-mix(in oklch, var(--prime) 15%, transparent) 0%, transparent 50%)",
          filter: "blur(60px)",
          opacity: 0.4,
        }}
      />
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.25em] text-ink-dim/70">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2 rounded-sm border border-transparent px-3 py-1.5 text-left text-[12px] font-medium text-ink transition-colors hover:border-prime/30 hover:bg-panel-2"
    >
      <span
        className={
          "flex size-5 shrink-0 items-center justify-center rounded-sm border " +
          (accent
            ? "border-prime/40 bg-prime/10 text-prime-glow"
            : "border-line bg-panel-2 text-ink-dim group-hover:text-ink")
        }
      >
        <Icon className="size-3" />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
