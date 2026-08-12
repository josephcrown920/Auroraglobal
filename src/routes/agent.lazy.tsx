import { authNextSearch } from "@/lib/auth-return-path";
import { useEffect, useRef, useState } from "react";
import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  chatWithAuroraAgent,
  listAgentChat,
  clearAgentChat,
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
import { HeyGenStyleTiles } from "@/components/prime/HeyGenStyleTiles";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import {
  Send,
  Camera,
  Aperture,
  Film,
  Sparkle,
  Clapperboard,
  Video,
  Languages,
  Wand2,
  Scissors,
  ArrowUpRightSquare,
  PackageCheck,
  Layers as LayersIcon,
  UserSquare2,
  ImagePlus,
  MousePointerClick,
  Mic,
  Radio,
  FileVideo,
  Users,
  AudioLines,
  Music,
  Captions as CaptionsIcon,
  MonitorPlay,
  LayoutTemplate,
  PenLine,
  Shapes,
  Volume2,
  Eye,
  Palette,
  Move3d,
  Focus,
  Sun,
  Cloud,
  Flame,
  Snowflake,
  Droplets,
  Sparkles,
  Clock,
  Ruler,
  Compass,
  Trash2,
  Save,
  BookOpen,
  Drama,
  Crown,
  Gauge,
  Zap,
  FileText,
  Rocket,
  Repeat,
  TrendingUp,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  Loader2,
  CircleDot,
  Search,
  Globe,
  Magnet,
  Brain,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  ExternalLink,
  X,
  type LucideIcon,
} from "lucide-react";

export const Route = createLazyFileRoute("/agent")({ component: AgentPage });

// ── Design constants ──────────────────────────────────────────────────────

const FILM_STOCKS = [
  "Kodak Vision3 500T (5219)",
  "Kodak Vision3 250D (5207)",
  "Fujifilm Eterna 250D",
  "Kodak Portra 800 (still)",
  "Ilford HP5 400 B&W",
  "ARRI LogC — digital",
];
const APERTURES = ["f/1.4", "f/2.0", "f/2.8", "f/4.0", "f/5.6", "f/8.0"];
const ASPECTS   = ["16:9", "2.39:1", "1.85:1", "9:16", "1:1", "4:3"];
const MODELS    = ["Seedance", "Veo 3", "Sora", "Runway Gen-3", "Kling 1.5"];
const LIGHTING  = [
  "Low-key noir",
  "Golden hour warm",
  "Neon rain",
  "Overcast soft",
  "Practical only",
  "Hard butterfly",
];

type Inspector = {
  focalLength: number;
  aperture: string;
  filmStock: string;
  aspect: string;
  lighting: string;
  targetModel: string;
  mood: string;
};

// ── Tool definitions ──────────────────────────────────────────────────────

type ToolDef = { label: string; icon: LucideIcon; prompt: string };

const AVATAR_TOOLS: ToolDef[] = [
  { label: "Quick create",  icon: Wand2,       prompt: "Quick create: draft a 30-second cinematic ad concept end-to-end — logline, script, 5-shot list, and a Seedance prompt. Pick a compelling subject." },
  { label: "AI Studio",     icon: Video,       prompt: "AI Studio: give me a professional avatar video plan — talking-head anchor, on-screen b-roll cues, and captions timing for a 60s explainer." },
  { label: "Avatar Shots",  icon: UserSquare2, prompt: "Avatar Shots: describe 6 hyper-realistic film-quality avatar shots (lens, wardrobe, blocking, lighting) for a fashion campaign." },
  { label: "Avatars",       icon: Users,       prompt: "Design 4 hyper-realistic avatar personas (name, look, wardrobe, voice tone, camera-friendly presence) for a tech brand's video ads." },
  { label: "Voices",        icon: AudioLines,  prompt: "Recommend 5 voice profiles (accent, timbre, pace, energy) for a moody neon-noir short. Include sample line delivery direction." },
];

const CINEMATIC_TOOLS: ToolDef[] = [
  { label: "DP Notes",          icon: Camera,       prompt: "As Director of Photography, write a full cinematography breakdown for the current scene: camera body, lens set, T-stop, filtration, sensor/ISO, white balance, and why each choice serves the story." },
  { label: "Blocking & Staging",icon: Move3d,       prompt: "Block a 2-minute dialogue scene between 3 characters in a cramped interior. Give me actor positions, sightlines, cross-moves, and where the camera lives for each beat." },
  { label: "Camera Movement",   icon: Compass,      prompt: "Choreograph a single-take oner (~90s): describe camera movement in explicit beats (dolly, crane, gimbal drift, whip, focus rack) synced to story beats and actor blocking." },
  { label: "Lighting Diagram",  icon: Sun,          prompt: "Give me a lighting diagram in text: key, fill, rim/back, practicals, ambience, negative fill. Specify fixture, wattage/color temp, diffusion, and lighting ratio. Match the current inspector mood." },
  { label: "Anamorphic Set",    icon: Focus,        prompt: "Recommend an anamorphic lens package for a hyper-real neo-noir feature: primes, close-focus, flare character, breathing, T-stop, and how to lens each key scene type." },
  { label: "Color Grade / LUT", icon: Palette,      prompt: "Design a color grade: base LUT, secondary keys (skin, sky, neons), roll-off, halation, grain plate, and target display (Rec.709 / P3 / HDR PQ). Include reference films." },
  { label: "Aspect Reframe",    icon: Ruler,        prompt: "Reframe the current scene across 2.39:1 theatrical, 16:9 broadcast, 9:16 vertical short-form, and 1:1 square. Note what MUST stay in each safe area and what recomposes." },
  { label: "Shot List Table",   icon: Clapperboard, prompt: "Produce a full shot list table for the current scene with columns: # / Shot / Framing / Lens / Movement / Duration / Sound / Notes. Aim for 8-14 shots, industry-realistic." },
  { label: "Storyboard Frames", icon: BookOpen,     prompt: "Describe 6 storyboard frames for the current scene — composition, subject action, camera POV, focal length, and light direction — so a storyboard artist could draw them directly." },
  { label: "VFX Breakdown",     icon: Sparkles,     prompt: "Break the current scene into VFX shots: what's plate, what's CG, what's comp. For each, list plate coverage, matchmove refs, cleanup, and integration notes." },
  { label: "Production Design", icon: LayersIcon,   prompt: "Design the production/art direction for the scene: palette, textures, hero props, wardrobe, set dressing, and how each element supports the story theme." },
  { label: "Location Scout",    icon: Compass,      prompt: "Scout 4 hyper-realistic real-world locations for the current scene. For each: geography, time of day sweet spot, sun path, permit reality, logistical risks." },
  { label: "Trailer Beats",     icon: Zap,          prompt: "Cut a 60-second trailer for the project: cold open hook, act-out 1, act-out 2, title card placement, needle-drop cue points, and end-tag. Give me the beat sheet with timecodes." },
  { label: "Genre: Neo-Noir",   icon: Drama,        prompt: "Emulate the neo-noir genre: rain, neon, low-key, wide anamorphic, morally grey lead. Write a 3-scene treatment with cinematography notes for each scene." },
  { label: "Music Video",       icon: Music,        prompt: "Direct a music video: song structure to visual structure map, hero shot per section, wardrobe changes, and 3 hyper-realistic Seedance prompts for signature moments." },
  { label: "Commercial 30s",    icon: Crown,        prompt: "Direct a 30s premium commercial: brand promise, single visual metaphor, 6-shot spine, hero product moment, VO structure, and a ready-to-paste Seedance prompt for the hero shot." },
];

const DIRECTOR_STYLES: ToolDef[] = [
  { label: "In the style of Deakins",   icon: Sun,     prompt: "Emulate Roger Deakins: motivated natural light, restrained camera, wide compositions with negative space, patient blocking. Design a scene from scratch in this idiom." },
  { label: "In the style of Fincher",   icon: Focus,   prompt: "Emulate David Fincher: cold controlled palette, precise geometry, minimal camera moves that mean something, 40-50mm bias, high shutter clarity. Design a scene." },
  { label: "In the style of Villeneuve",icon: Move3d,  prompt: "Emulate Denis Villeneuve: monumental scale, foreground silhouette against vast backgrounds, slow zoom-ins, low-frequency drone score. Design a scene." },
  { label: "In the style of Malick",    icon: Sparkles,prompt: "Emulate Terrence Malick: golden hour handheld, whispered VO, subject moving away from camera into light, wide primes. Design a scene." },
  { label: "In the style of Kubrick",   icon: Compass, prompt: "Emulate Stanley Kubrick: one-point perspective, symmetrical compositions, slow track-ins, ultra-wide lenses, unsettling stillness. Design a scene." },
  { label: "In the style of Wong Kar-wai",icon:Droplets,prompt: "Emulate Wong Kar-wai: step-printed motion, saturated tungsten, longing framing through doorways, expressive practical light. Design a scene." },
];

const AI_TOOLS: ToolDef[] = [
  { label: "Script writer",      icon: PenLine,           prompt: "Script writer: draft an industry-standard script (SLUGLINE / ACTION / CHARACTER / DIALOGUE) for a 90-second cinematic short. Ask if you need a topic — otherwise pick something evocative." },
  { label: "Motion Designer",    icon: Shapes,            prompt: "Motion Designer: animate a still image into a living shot. Give me exact motion directions (dolly, parallax, subject micro-movement, camera drift) plus a Seedance image-to-video prompt." },
  { label: "Image Generator",    icon: ImagePlus,         prompt: "Image Generator: write 3 hyper-realistic image prompts (subject, lens, film stock, lighting, negative prompt) suitable for Midjourney or Flux, aligned to my current inspector settings." },
  { label: "Video Generator",    icon: Video,             prompt: "Video Generator: give me a ready-to-paste Seedance prompt card (subject, action, camera, lighting, film stock, aspect, negative, duration) for a hyper-real 8s clip." },
  { label: "Translate Videos",   icon: Languages,         prompt: "Translate Videos: adapt a 30s English VO script into Spanish, French, and Japanese, preserving cinematic tone and lip-sync friendliness." },
  { label: "AI Clipping",        icon: Scissors,          prompt: "AI Clipping: from a 10-minute interview, suggest 5 vertical short-form clips with in/out timecodes, hook lines, and caption styles." },
  { label: "Speech Cleanup",     icon: Mic,               prompt: "Speech Cleanup: give me a director's note pass — mark filler words, awkward pauses, and breath spots to cut in a rough VO transcript." },
  { label: "Upscale Video",      icon: ArrowUpRightSquare,prompt: "Upscale Video: recommend a workflow to take a 720p24 handheld clip to hyper-real 4K60 without plastic-skin AI artifacts." },
  { label: "Product Placement",  icon: PackageCheck,      prompt: "Product Placement: design a 15s ad concept that hero-shots a product organically inside a cinematic narrative moment. Give me a Seedance prompt." },
  { label: "Batch Mode",         icon: FileVideo,         prompt: "Batch Mode: plan a 6-variant A/B test — same script, 6 different hooks/openers, each with its own Seedance prompt." },
  { label: "PPT to Video",       icon: FileVideo,         prompt: "PPT/PDF to Video: turn a 5-slide pitch deck into a 60s cinematic explainer. Give me scene breakdowns and VO copy per slide." },
  { label: "Video Podcast",      icon: Radio,             prompt: "Video Podcast: block a 2-host cinematic podcast set — camera angles, lens choices, lighting, wardrobe, and a cold-open script." },
  { label: "LiveAvatar",         icon: MonitorPlay,       prompt: "LiveAvatar: design a real-time interactive avatar host persona — appearance, voice, personality, and 5 conversational fallbacks." },
];

const SCENE_TOOLS: ToolDef[] = [
  { label: "Media",           icon: ImagePlus,      prompt: "Media: suggest 6 hyper-realistic stock-style reference images that would complete the current scene's storyboard. Describe each precisely." },
  { label: "Elements",        icon: Shapes,         prompt: "Elements: propose graphic overlays, lower-thirds, and title cards that match a cinematic noir aesthetic — with font, weight, and motion cues." },
  { label: "Music",           icon: Music,          prompt: "Music: suggest 4 score directions (genre, tempo, key, instrumentation, reference tracks) for a moody neon-noir short." },
  { label: "Captions",        icon: CaptionsIcon,   prompt: "Captions: draft a caption style guide — font, weight, safe-area, animation, and burn-in timing — for TikTok, Reels, and YouTube Shorts." },
  { label: "Sound Design",    icon: Volume2,        prompt: "Sound Design: give me a layered SFX bed (foley, ambience, transitions, sub-drops) for a 15s cinematic teaser." },
  { label: "Templates",       icon: LayoutTemplate, prompt: "Templates: propose 4 reusable scene templates (opening hook, product reveal, testimonial, CTA outro) with camera, lighting, and pacing specs." },
  { label: "Interactivity",   icon: MousePointerClick, prompt: "Interactivity: design a branching interactive video with 3 viewer-choice moments and clear next-scene consequences." },
  { label: "Screen Recorder", icon: MonitorPlay,    prompt: "Screen Recorder: outline a workflow to turn a raw screen recording into a cinematic product demo with cutaways, zooms, and VO." },
];

// Aurora-specific skills that invoke the built-in skill dispatch system
const AURORA_SKILL_TOOLS: ToolDef[] = [
  { label: "🔍 Web Search",        icon: Search,   prompt: "Search the web for the latest trends and relevant data for my current video project." },
  { label: "🌐 URL Scraper",       icon: Globe,    prompt: "Scrape and summarize the content from this URL for research: " },
  { label: "🎣 Hook Generator",    icon: Magnet,   prompt: "Generate 3 competing viral hooks for my current video concept. Score each and explain which is strongest." },
  { label: "🎬 B-roll Prompter",   icon: Film,     prompt: "Expand this shot description into a full cinematic image prompt with lens, lighting, texture, movement, and color science: " },
  { label: "🧠 Recall Brand",      icon: Brain,    prompt: "Recall my brand memory and tell me everything you know about my ongoing projects, brand voice, and characters." },
  { label: "💾 Save Brand Profile",icon: Save,     prompt: "Save to my brand memory: " },
  { label: "💬 Add Captions",      icon: CaptionsIcon, prompt: "Add auto-captions to the last video we rendered — use the audio track for timing and style them for TikTok." },
];

// ── Chat message type ─────────────────────────────────────────────────────

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  skillMeta?: SkillMeta | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatInspector(i: Inspector): string {
  return `[Director Inspector · ${i.focalLength}mm · ${i.aperture} · ${i.filmStock.split(" ")[0]} · ${i.aspect} · ${i.lighting} → ${i.targetModel}]`;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Cinematic reel images (copied to public/prime/) ───────────────────────

const REEL_IMAGES = [
  { src: "/prime/shot-neon-face.jpg",  label: "ECU · NEON" },
  { src: "/prime/shot-highway.jpg",    label: "WIDE · DUSK" },
  { src: "/prime/shot-chef.jpg",       label: "TOP · TUNGSTEN" },
  { src: "/prime/shot-dancer.jpg",     label: "SILHOUETTE" },
  { src: "/prime/shot-alley.jpg",      label: "ALLEY · RAIN" },
  { src: "/prime/shot-eye.jpg",        label: "MACRO · IRIS" },
  { src: "/prime/shot-desert.jpg",     label: "WIDE · DESERT" },
];

const STORYBOARD_SHOTS = [
  { src: "/prime/shot-alley.jpg",     name: "Shot_01_ECU",    meta: "50mm · Push-in · 24fps",   tc: "00:04:12" },
  { src: "/prime/shot-neon-face.jpg", name: "Shot_02_Med",    meta: "35mm · Static · 24fps",    tc: "00:08:05" },
  { src: "/prime/shot-highway.jpg",   name: "Shot_03_Wide",   meta: "24mm · Handheld · 24fps",  tc: "00:12:22" },
];

// ── Autonomous agent run types ────────────────────────────────────────────

type AgentStatus = "idle" | "running" | "paused" | "done" | "stopped";
type StepStatus  = "pending" | "active" | "done";
type AgentStep   = { key: string; label: string; detail: string; status: StepStatus; startedAt?: number; endedAt?: number };

const AGENT_STEPS_TEMPLATE: Omit<AgentStep, "status">[] = [
  { key: "brief",      label: "Brief",            detail: "Locking concept, references, avatar, props" },
  { key: "directions", label: "Directions",        detail: "Drafting 4 story directions & aesthetics" },
  { key: "script",     label: "Script",            detail: "Industry-format script + dialogue polish" },
  { key: "shotlist",   label: "Shot List",         detail: "10–14 shots · lens · movement · duration" },
  { key: "scenes",     label: "Scenes / Storyboard",detail: "Storyboard frames + blocking" },
  { key: "voiceover",  label: "Voiceover",         detail: "VO script, cast, delivery notes" },
  { key: "visuals",    label: "Visuals",            detail: "Seedance / Veo / Sora prompt cards" },
  { key: "render",     label: "Render",             detail: "16:9 · 9:16 · 1:1 platform cuts" },
  { key: "review",     label: "Review",             detail: "QC pass + next-actions checklist" },
];

const makeSteps = (): AgentStep[] =>
  AGENT_STEPS_TEMPLATE.map((s) => ({ ...s, status: "pending" as StepStatus }));

// ══════════════════════════════════════════════════════════════════════════
// HeyGen Video Agent panel — /agent tab "HeyGen"
// Prompt → Enhance (LLM script polish) → Generate (HeyGen v2 avatar video)
// ══════════════════════════════════════════════════════════════════════════

// ── Cinematic Plan shot card ──────────────────────────────────────────────
function ShotCard({ shot, index }: { shot: VideoShot; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [plate, setPlate] = useState<string | null>(null);
  const [plateStatus, setPlateStatus] = useState<"idle" | "loading" | "error">("idle");

  // Previs Pro (free tier): turn this shot's engineered prompt into a visible
  // plate via the open-access Pollinations keyframe engine — $0, no account
  // needed. Premium plates live in the session-backed storyboard editor.
  const renderPlate = async () => {
    if (plateStatus === "loading" || !shot.prompt?.trim()) return;
    setPlateStatus("loading");
    try {
      const res = await fetch("/api/video-agent/generate-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: shot.prompt }),
      });
      if (!res.ok) throw new Error(`Previs failed (${res.status})`);
      const { url } = (await res.json()) as { url: string };
      setPlate(url);
      setPlateStatus("idle");
    } catch {
      setPlateStatus("error");
    }
  };

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
          {/* Previs Pro — free preview plate */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-ink-dim/60">Previs Plate</p>
              <button
                onClick={() => void renderPlate()}
                disabled={plateStatus === "loading" || !shot.prompt?.trim()}
                className="flex items-center gap-1.5 rounded-sm border border-prime/40 bg-prime/5 px-2 py-1 text-xs font-bold uppercase tracking-widest text-prime transition-colors hover:bg-prime/10 disabled:opacity-40"
              >
                {plateStatus === "loading" ? (
                  <><Loader2 className="size-3 animate-spin" /> Rendering…</>
                ) : (
                  <><Eye className="size-3" /> {plate ? "Re-render" : "Previsualize"} · Free</>
                )}
              </button>
            </div>
            {plate ? (
              <img src={plate} alt={shot.action} className="w-full rounded-sm border border-line/50 bg-black object-cover" />
            ) : plateStatus === "error" ? (
              <p className="rounded-sm border border-rec/30 bg-rec/5 px-3 py-2 text-xs text-rec">Previs failed — try again.</p>
            ) : (
              <p className="rounded-sm border border-line/40 px-3 py-2 text-xs text-ink-dim/50">
                Render a free preview plate from this shot's prompt.
              </p>
            )}
          </div>
          {shot.lighting && (
            <div>
              <p className="text-xs uppercase tracking-widest text-ink-dim/60 mb-1">Lighting</p>
              <p className="text-sm text-ink-dim leading-relaxed">{shot.lighting}</p>
            </div>
          )}
          {shot.camera && (
            <div>
              <p className="text-xs uppercase tracking-widest text-ink-dim/60 mb-1">Camera</p>
              <p className="text-sm text-ink-dim leading-relaxed">{shot.camera}{shot.lens_mm ? ` · ${shot.lens_mm}mm` : ""}</p>
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

function HeyGenPanel() {
  const enhanceFn   = useServerFn(enhanceVideoAgentPrompt);
  const generateFn  = useServerFn(generateHeyGenAgentVideo);
  const analyzeFn   = useServerFn(analyzeCinematicBrief);

  const [mode,        setMode]        = useState<"script" | "cinematic">("script");
  const [prompt,      setPrompt]      = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [enhancing,   setEnhancing]   = useState(false);
  const [result,      setResult]      = useState<{ url: string; generationId: string } | null>(null);
  const [styleId,     setStyleId]     = useState<string>("");
  const [plan,        setPlan]        = useState<VideoPlan | null>(null);
  const [analyzing,   setAnalyzing]   = useState(false);

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
          toast.error("HeyGen api credits exhausted — top up at app.heygen.com", { duration: 8000 });
        } else if (res.insufficient) {
          toast.error("Not enough Aura — top up credits in Billing");
        } else {
          toast.error(res.error ?? "Generation failed");
        }
      } else {
        setResult({ url: res.url, generationId: res.generationId });
        toast.success("Talking-head video ready!");
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
      const result = await analyzeFn({
        data: { userIdea: idea, format: orientation === "portrait" ? "9:16" : "16:9" },
      });
      setPlan(result);
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

  const [exportingZip, setExportingZip] = useState(false);

  // Package every artifact this session produced (prompt, plan, style, video,
  // shot list, direction, render plan, suggestions, settings) into one .zip so
  // nothing is left behind when the user hands the output to a producer.
  const exportFullZip = async () => {
    if (!result && !plan && !prompt.trim()) {
      toast.error("Nothing to export yet — generate a video or analyze a brief first.");
      return;
    }
    setExportingZip(true);
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      const style = HEYGEN_STYLES.find((s) => s.id === styleId) ?? null;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const runId = result?.generationId ?? `plan-${stamp}`;
      const root = `video-agent-${runId}/`;

      // settings + raw prompt always included
      files[`${root}settings.json`] = strToU8(
        JSON.stringify(
          { mode, orientation, styleId, style, exportedAt: new Date().toISOString(), runId },
          null,
          2,
        ),
      );
      files[`${root}prompt.txt`] = strToU8(prompt);

      // cinematic plan → full JSON + readable brief.md + one prompt file per shot
      if (plan) {
        files[`${root}plan.json`] = strToU8(JSON.stringify(plan, null, 2));
        const briefLines: string[] = [];
        if (plan.brief) {
          briefLines.push(`# ${plan.brief.title}`, "", `_${plan.brief.logline}_`, "");
          briefLines.push(`- Motion language: ${plan.brief.motion_language}`);
          briefLines.push(`- Format: ${plan.brief.format}`);
          if (plan.brief.palette?.length) briefLines.push(`- Palette: ${plan.brief.palette.join(", ")}`);
          if (plan.brief.references?.length) briefLines.push(`- References: ${plan.brief.references.join(", ")}`);
          if (plan.brief.assumptions?.length) {
            briefLines.push("", "## Assumptions");
            plan.brief.assumptions.forEach((a) => briefLines.push(`- ${a}`));
          }
        }
        if (plan.direction) {
          briefLines.push("", "## Direction");
          for (const [k, v] of Object.entries(plan.direction)) briefLines.push(`- **${k}**: ${v}`);
        }
        if (plan.render_plan) {
          briefLines.push(
            "",
            "## Render plan",
            `- Model: ${plan.render_plan.model}`,
            `- Resolution: ${plan.render_plan.resolution}`,
            `- FPS: ${plan.render_plan.fps}`,
          );
        }
        if (plan.suggestions?.length) {
          briefLines.push("", "## Suggestions");
          plan.suggestions.forEach((s) => briefLines.push(`- ${s}`));
        }
        files[`${root}brief.md`] = strToU8(briefLines.join("\n"));
        if (plan.shots?.length) {
          plan.shots.forEach((shot: VideoShot, i: number) => {
            const idx = String(i + 1).padStart(2, "0");
            files[`${root}shots/shot-${idx}.json`] = strToU8(JSON.stringify(shot, null, 2));
          });
        }
      }

      // Fetch the rendered video and include it verbatim
      if (result?.url) {
        try {
          const r = await fetch(result.url);
          const buf = new Uint8Array(await r.arrayBuffer());
          files[`${root}video.mp4`] = buf;
          files[`${root}video-url.txt`] = strToU8(result.url);
        } catch {
          files[`${root}video-url.txt`] = strToU8(result.url);
        }
      }

      // README so a producer can navigate the folder cold
      files[`${root}README.md`] = strToU8(
        [
          "# Video Agent — Full Export",
          "",
          `Run: \`${runId}\`  ·  exported ${new Date().toLocaleString()}`,
          "",
          "Contents:",
          "- `prompt.txt` — your original prompt / script",
          "- `settings.json` — mode, orientation, style selection",
          plan ? "- `plan.json` + `brief.md` + `shots/` — cinematic breakdown" : "",
          result ? "- `video.mp4` — rendered talking-head" : "",
          "",
          "Nothing about this session was left behind.",
        ]
          .filter(Boolean)
          .join("\n"),
      );

      const zipped = zipSync(files, { level: 6 });
      const blob = new Blob([zipped], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `video-agent-${runId}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Full export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportingZip(false);
    }
  };


  const selectedStyle = HEYGEN_STYLES.find((s) => s.id === styleId);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header>
          <p className="text-[13px] font-bold uppercase tracking-[0.3em] text-prime">
            HeyGen · Video Agent
          </p>
          <h2 className="mt-1 text-3xl font-black uppercase leading-tight text-ink">
            Talking-head video<br /><span className="text-prime">from a prompt.</span>
          </h2>
          <p className="mt-2 text-[13px] font-medium text-ink-dim">
            Write what the presenter says, or describe your idea and hit Enhance. Aurora picks the avatar, voice, and layout — HeyGen renders the video.
          </p>
        </header>

        {/* Full-session export — everything (prompt, plan, shots, video) in one zip */}
        <button
          type="button"
          onClick={() => void exportFullZip()}
          disabled={exportingZip || (!result && !plan && !prompt.trim())}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-prime/40 bg-prime/5 px-3 py-2 text-[12px] font-bold uppercase tracking-widest text-prime transition-colors hover:bg-prime/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exportingZip ? (
            <><Loader2 className="size-3.5 animate-spin" /> Packaging…</>
          ) : (
            <><PackageCheck className="size-3.5" /> Export full zip · leave nothing behind</>
          )}
        </button>

        {/* Mode tabs */}
        <div className="flex gap-0 rounded-sm border border-line overflow-hidden">
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
                    <option value="">— No style (Video Agent decides) —</option>
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
                <video
                  src={result.url}
                  controls
                  className="max-h-80 w-full rounded-sm bg-black"
                />
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
              Describe your video idea in plain language. Aurora applies the cinematic director skill — brief → direction → shot list — and builds a full production plan with engineered model prompts for each shot.
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
                {/* Brief card */}
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
                      <span key={r} className="rounded-sm border border-line px-2 py-0.5 text-xs text-ink-dim">
                        {r}
                      </span>
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

                {/* Direction */}
                {plan.direction && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Lens", value: plan.direction.lens },
                      { label: "Film Stock", value: plan.direction.film_stock },
                      { label: "Camera", value: plan.direction.camera_movement },
                      { label: "Pacing", value: plan.direction.pacing },
                      { label: "Lighting", value: plan.direction.lighting },
                      { label: "Sound", value: plan.direction.sound_register },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-sm border border-line/50 bg-panel/30 px-3 py-2">
                        <p className="text-xs uppercase tracking-widest text-ink-dim/50 mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-ink leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Shots */}
                {plan.shots && plan.shots.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-ink-dim/60">
                      {plan.shots.length} Shots
                    </p>
                    {plan.shots.map((shot, i) => (
                      <ShotCard key={shot.id ?? i} shot={shot} index={i} />
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {plan.suggestions && plan.suggestions.length > 0 && (
                  <div className="rounded-sm border border-line/40 px-4 py-3 space-y-1.5">
                    <p className="text-xs uppercase tracking-widest text-ink-dim/50 mb-2">Director's Notes</p>
                    {plan.suggestions.map((s, i) => (
                      <p key={i} className="text-sm text-ink-dim leading-relaxed">→ {s}</p>
                    ))}
                  </div>
                )}

                {/* Render plan */}
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

  const chatFn    = useServerFn(chatWithAuroraAgent);
  const listFn    = useServerFn(listAgentChat);
  const clearFn   = useServerFn(clearAgentChat);

  // Auth guard — the Video Agent needs a signed-in account for chat memory,
  // credits and renders. Show a visible gate instead of silently bouncing to "/"
  // (which read as "the page doesn't load").


  // ── Local state ─────────────────────────────────────────────────────────
  const MEMORY_KEY = "aurora-prime:memory:v1";

  const [messages,        setMessages]        = useState<ChatMsg[]>([]);
  const [isLoading,       setIsLoading]       = useState(false);
  const [input,           setInput]           = useState("");
  const [directorMemory,  setDirectorMemory]  = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(MEMORY_KEY) ?? "";
  });

  const [inspector, setInspector] = useState<Inspector>({
    focalLength: 35,
    aperture:    "f/2.8",
    filmStock:   FILM_STOCKS[0],
    aspect:      "2.39:1",
    lighting:    "Low-key noir",
    targetModel: "Seedance",
    mood: "Hyper-realistic, atmospheric fog, subtle halation, no plastic AI skin.",
  });

  const [activeTab, setActiveTab] = useState<"Workspace" | "Script" | "Dailies" | "Timeline" | "HeyGen">("Workspace");
  const [leftOpen,  setLeftOpen]  = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);

  // Collapse both side panels by default on small screens so the chat gets
  // the full width (runs client-side only — avoids an SSR hydration mismatch).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, []);

  // Autonomous agent run state
  const [agentStatus,  setAgentStatus]  = useState<AgentStatus>("idle");
  const [agentSteps,   setAgentSteps]   = useState<AgentStep[]>(makeSteps);
  const [agentIndex,   setAgentIndex]   = useState(0);
  const [agentTitle,   setAgentTitle]   = useState("");
  const agentTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentStatusRef = useRef<AgentStatus>("idle");
  agentStatusRef.current = agentStatus;

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Persist director memory to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MEMORY_KEY, directorMemory);
    }
  }, [directorMemory]);

  // ── Load chat history from Supabase ──────────────────────────────────────
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
    if (!user) {
      toast.error("Sign in to chat with the agent", {
        action: { label: "Sign in", onClick: () => void navigate({ to: "/auth", search: authNextSearch() }) },
      });
      return;
    }


    // Prepend inspector context
    const ctx = formatInspector(inspector);
    const fullMsg = `${ctx}\n\n${trimmed}`;

    const userMsg: ChatMsg = { id: genId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await chatFn({ data: { message: fullMsg, cinematicMode: true } });
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

  // ── Tab click ─────────────────────────────────────────────────────────────
  const TAB_PROMPTS: Record<string, string> = {
    Script:   "Open the Script tab: draft a full industry-standard script for the current project (SLUGLINE / ACTION / CHARACTER / DIALOGUE). If you don't have a locked concept yet, propose 3 directions and pick the strongest.",
    Dailies:  "Open the Dailies tab: give me a 'dailies review' pass — list each hero shot, what's working, what's not, and a concrete fix (lens, blocking, light, grade) per shot.",
    Timeline: "Open the Timeline tab: build a shot-by-shot timeline with in/out timecodes, transitions, music cue points, and caption timing for the current cut.",
  };

  const handleTabClick = (t: typeof activeTab) => {
    setActiveTab(t);
    if (t === "Workspace" || t === "HeyGen") return;
    startAgent(`${t} pass`, TAB_PROMPTS[t] ?? "", t);
  };

  // ── Autonomous agent run ──────────────────────────────────────────────────
  const clearAgentTimer = () => {
    if (agentTimer.current) { clearTimeout(agentTimer.current); agentTimer.current = null; }
  };

  const advanceAgent = (fromIndex: number) => {
    if (agentStatusRef.current !== "running") return;
    setAgentIndex(fromIndex);
    setAgentSteps((prev) =>
      prev.map((s, i) => {
        if (i < fromIndex) return { ...s, status: "done",   endedAt: s.endedAt ?? Date.now() };
        if (i === fromIndex) return { ...s, status: "active", startedAt: s.startedAt ?? Date.now() };
        return { ...s, status: "pending" };
      }),
    );
    if (fromIndex >= AGENT_STEPS_TEMPLATE.length) {
      setAgentSteps((prev) => prev.map((s) => ({ ...s, status: "done", endedAt: s.endedAt ?? Date.now() })));
      setAgentStatus("done");
      return;
    }
    const delay = 2200 + Math.random() * 1600;
    agentTimer.current = setTimeout(() => advanceAgent(fromIndex + 1), delay);
  };

  const startAgent = (title: string, prompt: string, tab: typeof activeTab = "Timeline") => {
    clearAgentTimer();
    setAgentTitle(title);
    setAgentSteps(makeSteps());
    setAgentIndex(0);
    setAgentStatus("running");
    setActiveTab(tab);
    void sendMessage(prompt);
    setTimeout(() => advanceAgent(0), 30);
  };

  const pauseAgent  = () => { if (agentStatus === "running") { clearAgentTimer(); setAgentStatus("paused"); } };
  const resumeAgent = () => { if (agentStatus === "paused")  { setAgentStatus("running"); setTimeout(() => advanceAgent(agentIndex), 30); } };
  const stopAgent   = () => {
    clearAgentTimer();
    setAgentStatus("stopped");
    setAgentSteps((prev) => prev.map((s, i) => i < agentIndex ? { ...s, status: "done" } : { ...s, status: "pending" }));
  };
  const resetAgent  = () => {
    clearAgentTimer();
    setAgentStatus("idle");
    setAgentSteps(makeSteps());
    setAgentIndex(0);
    setAgentTitle("");
  };

  const renderAll = () =>
    startAgent(
      "Full render · package deliverable",
      "Render All: package the current project — final logline, script, shot list, storyboards, Seedance/Veo/Sora prompts for hero shots, VO, captions, music brief, and 16:9 / 9:16 / 1:1 cuts. Ship the full deliverable.",
      "Timeline",
    );

  useEffect(() => () => clearAgentTimer(), []);

  // ── Quick prompts ─────────────────────────────────────────────────────────
  const QUICK_PROMPTS = [
    "Draft a 60-second cinematic ad for a boutique whisky — moody neon noir.",
    "Give me a 6-shot shot list for a rooftop chase at golden hour.",
    "Write a Seedance prompt: hyper-realistic close-up of a violinist, one candle key light.",
    "Turn this into a TikTok hook: 'a courier delivers a package that starts humming'.",
  ];

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-sm text-muted-foreground">
        Loading Video Agent…
      </div>
    );
  }

  // No sign-in gate: the Video Agent UI is open to everyone. Account-backed
  // actions (chat memory, renders) prompt for sign-in only when used.



  return (
    <div className="relative flex h-screen w-full overflow-hidden text-ink" style={{ fontFamily: "inherit" }}>
      <AmbientBackdrop />

      {/* ── LEFT SIDEBAR ────────────────────────────────────────────────────── */}
      {leftOpen && (
        <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel/70 backdrop-blur-sm" style={{ zIndex: 10 }}>
          {/* header */}
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <img loading="lazy" src={auroraLogo.url} alt="Aurora" width={32} height={32} className="rounded-md" />
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-ink-dim">Studio</span>
              <span className="text-[13px] font-black uppercase tracking-widest text-ink">Aurora Prime</span>
            </div>
            <span className="ml-auto flex items-center gap-1.5 rounded-md border border-rec/40 bg-rec/10 px-2 py-1 text-xs font-bold text-rec">
              <span className="size-1.5 rounded-full bg-rec rec-pulse" />Rec
            </span>
          </div>

          {/* tool nav — decluttered: pinned skills only; everything else in "More tools" */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {/* Quick links to dedicated surfaces (used to be the Avatar Videos section) */}
            <div className="mb-3 space-y-0.5">
              <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.25em] text-ink-dim">Studios</p>
              <Link to="/avatar" className="group flex w-full items-center gap-2 rounded-sm border border-transparent px-3 py-1.5 text-left text-[12px] font-medium text-ink no-underline transition-colors hover:border-prime/30 hover:bg-panel-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-line bg-panel-2 text-ink-dim group-hover:text-ink"><UserSquare2 className="size-3" /></span>
                <span className="truncate">Talking Avatars</span>
                <ExternalLink className="ml-auto size-3 text-ink-dim/50" />
              </Link>
              <Link to="/video-agent" className="group flex w-full items-center gap-2 rounded-sm border border-transparent px-3 py-1.5 text-left text-[12px] font-medium text-ink no-underline transition-colors hover:border-prime/30 hover:bg-panel-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-line bg-panel-2 text-ink-dim group-hover:text-ink"><Clapperboard className="size-3" /></span>
                <span className="truncate">Video Agent</span>
                <ExternalLink className="ml-auto size-3 text-ink-dim/50" />
              </Link>
            </div>

            {/* Pinned Aurora skills — the agent's real capabilities */}
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.25em] text-ink-dim">Aurora Skills</p>
            {AURORA_SKILL_TOOLS.map((t) => <SidebarItem key={t.label} icon={t.icon} label={t.label} onClick={() => launch(t.prompt)} accent />)}

            {/* Everything else lives behind one overflow control */}
            <button
              onClick={() => setMoreToolsOpen(true)}
              className="group mt-3 flex w-full items-center gap-2 rounded-sm border border-line/60 px-3 py-2 text-left text-[12px] font-semibold text-ink-dim transition-colors hover:border-prime/40 hover:text-ink"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-line bg-panel-2 text-ink-dim group-hover:text-ink"><MoreHorizontal className="size-3" /></span>
              <span className="truncate">More tools…</span>
            </button>
          </nav>

          {/* footer */}
          <div className="border-t border-line px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-ink-dim">
              <span>Director · Aurora Prime</span>
              <button onClick={clearThread} className="flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-ink-dim transition-colors hover:border-rec/60 hover:text-rec text-xs">
                <Trash2 className="size-2.5" /> Clear
              </button>
            </div>
            <div className="rounded-sm border border-line bg-panel-2/60 px-2 py-1.5">
              <div className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-prime">
                <Save className="size-3" /> Director Memory
              </div>
              <textarea
                value={directorMemory}
                onChange={(e) => setDirectorMemory(e.target.value)}
                rows={3}
                placeholder="Brand voice, ongoing project, client rules, characters…"
                className="w-full resize-none bg-transparent text-[13px] font-medium leading-snug text-ink placeholder:text-ink-dim/50 focus:outline-none"
              />
            </div>
          </div>
        </aside>
      )}

      {/* left toggle */}
      <button
        onClick={() => setLeftOpen((v) => !v)}
        className="absolute left-0 top-1/2 z-20 -translate-y-1/2 translate-x-0 flex h-8 w-4 items-center justify-center rounded-r-sm border border-l-0 border-line bg-panel/80 text-ink-dim hover:text-ink transition-colors"
        style={{ left: leftOpen ? "16rem" : "0" }}
        title={leftOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {leftOpen ? <ChevronLeft className="size-3" /> : <ChevronRight className="size-3" />}
      </button>

      {/* ── MORE TOOLS OVERLAY ─────────────────────────────────────────────── */}
      {moreToolsOpen && (
        <div
          className="absolute inset-0 z-40 flex items-end justify-center bg-canvas/70 backdrop-blur-sm md:items-center"
          onClick={() => setMoreToolsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="More tools"
        >
          <div
            className="flex max-h-[85%] w-full max-w-2xl flex-col overflow-hidden rounded-t-md border border-line bg-panel shadow-2xl md:rounded-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="text-[13px] font-black uppercase tracking-widest text-ink">More tools</span>
              <button
                onClick={() => setMoreToolsOpen(false)}
                className="flex size-7 items-center justify-center rounded-sm border border-line text-ink-dim transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {([
                ["Avatar Videos", AVATAR_TOOLS],
                ["Cinematic Craft", CINEMATIC_TOOLS],
                ["Director Style", DIRECTOR_STYLES],
                ["AI Tools", AI_TOOLS],
                ["Scene Assets", SCENE_TOOLS],
              ] as const).map(([title, tools]) => (
                <div key={title}>
                  <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-[0.25em] text-ink-dim">{title}</p>
                  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                    {tools.map((t) => (
                      <SidebarItem
                        key={t.label}
                        icon={t.icon}
                        label={t.label}
                        onClick={() => { setMoreToolsOpen(false); launch(t.prompt); }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CENTER ──────────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col" style={{ zIndex: 5 }}>
        {/* tab bar */}
        <div className="flex h-13 items-center justify-between border-b border-line bg-canvas/80 px-6 backdrop-blur-sm">
          <div className="flex gap-6 text-[13px] font-bold uppercase tracking-[0.2em]">
            {(["Workspace", "Script", "Dailies", "Timeline", "HeyGen"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTabClick(t)}
                className={
                  "py-4 transition-colors " +
                  (activeTab === t
                    ? "border-b border-prime text-ink"
                    : "text-ink-dim hover:text-ink")
                }
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={renderAll}
            className="flex items-center gap-1.5 rounded-md bg-rec px-4 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:bg-rec-glow"
          >
            <Rocket className="size-3" /> Render All
          </button>
        </div>

        {/* agent dashboard */}
        <AgentDashboard
          status={agentStatus}
          title={agentTitle}
          steps={agentSteps}
          activeIndex={agentIndex}
          onRun={() => startAgent("Autonomous director run", "AGENT MODE: run the full autonomous director loop end-to-end on the current project. Ship the complete production package now.", "Timeline")}
          onPause={pauseAgent}
          onResume={resumeAgent}
          onStop={stopAgent}
          onReset={resetAgent}
        />

        {/* HeyGen Video Agent panel — replaces the chat area when HeyGen tab is active */}
        {activeTab === "HeyGen" && <HeyGenPanel />}

        {/* chat scroll area — only rendered for non-HeyGen tabs */}
        {activeTab !== "HeyGen" && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl">
            {/* tab-specific header */}
            {activeTab !== "Workspace" && <TabHeader tab={activeTab as "Script" | "Dailies" | "Timeline"} status={agentStatus} />}

            {/* progress timeline */}
            {activeTab === "Timeline" && (
              <ProgressTimeline steps={agentSteps} status={agentStatus} title={agentTitle} />
            )}

            {/* welcome / empty state */}
            {messages.length === 0 && (
              <div className="space-y-6">
                <header className="mb-8">
                  <p className="text-[13px] font-bold uppercase tracking-[0.3em] text-rec">Aurora Prime Director</p>
                  <h1 className="font-black-display mt-2 text-4xl uppercase leading-tight text-ink">
                    Direct your video,<br /><span className="text-prime">end to end.</span>
                  </h1>
                  <p className="mt-3 max-w-xl text-[14px] font-medium leading-relaxed text-ink-dim">
                    Draft scripts, shot lists, storyboards, and ready-to-paste Seedance, Veo, and Sora prompts. Aurora's skills — web search, brand memory, hook generation, B-roll prompting, and captions — are available automatically.
                  </p>
                </header>

                <HeyGenStyleTiles />
                <UgcBatchStudio onLaunch={launch} />
                <ProductionBriefIntake onLaunch={launch} />

                <StoryDirectionsSideBySide onLaunch={launch} />
                <AgentModeBanner onLaunch={launch} />

                <div className="grid gap-3 sm:grid-cols-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => launch(q)}
                      className="group rounded-sm border border-line bg-panel/50 p-4 text-left text-sm font-medium text-ink transition-colors hover:border-prime/60 hover:bg-panel"
                    >
                      <Sparkle className="mb-2 size-4 text-prime" />
                      {q}
                    </button>
                  ))}
                </div>

                <ReelStrip />
                <StoryboardGrid />
              </div>
            )}

            {/* messages */}
            <div className="space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-l-2xl rounded-br-sm border-r-2 border-prime bg-panel-2/60 px-4 py-3 text-sm text-ink">
                      <div className="mb-1 text-xs uppercase tracking-widest text-ink-dim">Director / You</div>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ) : (
                    <>
                      <img loading="lazy" src={auroraLogo.url} alt="" width={26} height={26} className="mt-1 size-[26px] shrink-0 rounded" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-prime">
                          Aurora Prime
                          <span className="text-ink-dim">/ Director</span>
                          {m.skillMeta && (
                            <span className="flex items-center gap-1 rounded-md border border-prime/30 bg-prime/10 px-2 py-0.5 text-xs text-prime-glow">
                              {m.skillMeta.icon} {m.skillMeta.label}
                            </span>
                          )}
                        </div>
                        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-ink prose-p:text-ink prose-strong:text-ink prose-code:text-prime-glow prose-pre:border prose-pre:border-line prose-pre:bg-panel/80 prose-pre:prose-a:text-prime-glow">
                          <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                        </article>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <img loading="lazy" src={auroraLogo.url} alt="" width={26} height={26} className="mt-1 size-[26px] shrink-0 rounded" />
                  <div className="flex items-center gap-2 text-[13px] uppercase tracking-widest text-ink-dim">
                    <span className="size-1.5 rounded-full bg-prime rec-pulse" />
                    Aurora is composing the shot…
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* composer */}
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
                placeholder="Direct Aurora — shot idea, script beat, or paste a Seedance prompt…"
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
            <div className="mt-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-[0.15em] text-ink-dim">
              <span>{inspector.focalLength}mm · {inspector.aperture} · {inspector.filmStock.split(" ")[0]} · {inspector.aspect} · → {inspector.targetModel}</span>
              <span>Enter to send · Shift+Enter for newline</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── RIGHT INSPECTOR ─────────────────────────────────────────────────── */}
      {rightOpen && (
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-line bg-panel/70 backdrop-blur-sm" style={{ zIndex: 10 }}>
          <div className="border-b border-line px-5 py-4">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-ink-dim">Cinematic Inspector</div>
            <div className="mt-2 h-px w-8 bg-rec" />
          </div>

          <div className="space-y-6 px-5 py-5">
            <InspectorSection icon={<Camera className="size-3.5" />} title="Lens & Optics">
              <label className="text-xs uppercase text-ink-dim">Focal Length</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={14} max={200}
                  value={inspector.focalLength}
                  onChange={(e) => setInspector((s) => ({ ...s, focalLength: Number(e.target.value) }))}
                  className="flex-1 accent-[var(--prime)]"
                />
                <span className="w-12 text-right text-[13px] text-ink">{inspector.focalLength}mm</span>
              </div>
              <label className="mt-3 block text-xs uppercase text-ink-dim">Aperture</label>
              <div className="flex flex-wrap gap-1.5">
                {APERTURES.map((a) => (
                  <Chip key={a} active={inspector.aperture === a} onClick={() => setInspector((s) => ({ ...s, aperture: a }))}>{a}</Chip>
                ))}
              </div>
            </InspectorSection>

            <InspectorSection icon={<Film className="size-3.5" />} title="Color & Stock">
              <label className="text-xs uppercase text-ink-dim">Film Stock</label>
              <select
                value={inspector.filmStock}
                onChange={(e) => setInspector((s) => ({ ...s, filmStock: e.target.value }))}
                className="w-full rounded-sm border border-line bg-canvas px-2 py-1.5 text-sm text-ink focus:border-prime focus:outline-none"
              >
                {FILM_STOCKS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <label className="mt-3 block text-xs uppercase text-ink-dim">Aspect Ratio</label>
              <div className="flex flex-wrap gap-1.5">
                {ASPECTS.map((a) => (
                  <Chip key={a} active={inspector.aspect === a} onClick={() => setInspector((s) => ({ ...s, aspect: a }))}>{a}</Chip>
                ))}
              </div>
            </InspectorSection>

            <InspectorSection icon={<Aperture className="size-3.5" />} title="Lighting Mood">
              <div className="space-y-1">
                {LIGHTING.map((l) => (
                  <button
                    key={l}
                    onClick={() => setInspector((s) => ({ ...s, lighting: l }))}
                    className={
                      "flex w-full items-center gap-2 rounded-sm border px-2.5 py-1.5 text-left text-sm transition-colors " +
                      (inspector.lighting === l
                        ? "border-prime/60 bg-prime/10 text-ink"
                        : "border-transparent text-ink-dim hover:text-ink")
                    }
                  >
                    <span className={"size-1.5 rounded-full " + (inspector.lighting === l ? "bg-prime" : "bg-ink-dim/50")} />
                    {l}
                  </button>
                ))}
              </div>
            </InspectorSection>

            <InspectorSection icon={<Clapperboard className="size-3.5" />} title="Target Model">
              <div className="flex flex-wrap gap-1.5">
                {MODELS.map((m) => (
                  <Chip key={m} active={inspector.targetModel === m} onClick={() => setInspector((s) => ({ ...s, targetModel: m }))}>{m}</Chip>
                ))}
              </div>
              <label className="mt-3 block text-xs uppercase text-ink-dim">Director Mood Note</label>
              <textarea
                value={inspector.mood}
                onChange={(e) => setInspector((s) => ({ ...s, mood: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded-sm border border-line bg-canvas px-2 py-1.5 text-sm italic leading-relaxed text-ink-dim focus:border-prime focus:outline-none"
              />
            </InspectorSection>

            <div className="rounded-sm border border-rec/30 bg-rec/5 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-rec">Live Telemetry</span>
                <span className="flex items-center gap-1 text-xs text-rec">
                  <span className="size-1.5 rounded-full bg-rec rec-pulse" /> REC
                </span>
              </div>
              <div className="space-y-0.5 text-xs uppercase leading-relaxed text-rec/70">
                <div>Backend: Aurora · Multi-LLM</div>
                <div>Skills: 7 active (search · hooks · memory · broll · captions)</div>
                <div>Style bias: hyper-realistic · no plastic skin</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* right toggle */}
      <button
        onClick={() => setRightOpen((v) => !v)}
        className="absolute right-0 top-1/2 z-20 -translate-y-1/2 flex h-8 w-4 items-center justify-center rounded-l-sm border border-r-0 border-line bg-panel/80 text-ink-dim hover:text-ink transition-colors"
        style={{ right: rightOpen ? "18rem" : "0" }}
        title={rightOpen ? "Collapse inspector" : "Expand inspector"}
      >
        {rightOpen ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function AmbientBackdrop() {
  const bokeh = [
    { src: "/prime/shot-neon-face.jpg", top: "8%",  left: "6%",  size: 320, opacity: 0.3 },
    { src: "/prime/shot-highway.jpg",   top: "55%", left: "68%", size: 380, opacity: 0.22 },
    { src: "/prime/shot-alley.jpg",     top: "70%", left: "4%",  size: 280, opacity: 0.25 },
    { src: "/prime/shot-desert.jpg",    top: "4%",  left: "70%", size: 340, opacity: 0.2 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute inset-0 bg-canvas" />
      {bokeh.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: b.top, left: b.left,
            width: b.size, height: b.size,
            backgroundImage: `url(${b.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) saturate(1.2)",
            opacity: b.opacity,
            transform: "translate3d(0,0,0)",
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 20% 20%, color-mix(in oklch, var(--prime) 35%, transparent) 0%, transparent 45%), radial-gradient(circle at 80% 70%, color-mix(in oklch, var(--rec) 30%, transparent) 0%, transparent 50%)",
          filter: "blur(40px)",
          opacity: 0.3,
        }}
      />
    </div>
  );
}

function InspectorSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink">
        <span className="text-prime">{icon}</span>
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-sm border px-2 py-1 text-xs transition-colors " +
        (active
          ? "border-prime/60 bg-prime/10 text-ink"
          : "border-line bg-canvas text-ink-dim hover:border-prime/40 hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function SidebarItem({ icon: Icon, label, onClick, accent }: { icon: LucideIcon; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-2 rounded-sm border border-transparent px-3 py-1.5 text-left text-[12px] font-medium text-ink transition-colors hover:border-prime/30 hover:bg-panel-2"
    >
      <span className={
        "flex size-5 shrink-0 items-center justify-center rounded-sm border " +
        (accent ? "border-prime/40 bg-prime/10 text-prime-glow" : "border-line bg-panel-2 text-ink-dim group-hover:text-ink")
      }>
        <Icon className="size-3" />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function AgentDashboard({
  status, title, steps, activeIndex, onRun, onPause, onResume, onStop, onReset,
}: {
  status: AgentStatus; title: string; steps: AgentStep[]; activeIndex: number;
  onRun: () => void; onPause: () => void; onResume: () => void; onStop: () => void; onReset: () => void;
}) {
  const done = steps.filter((s) => s.status === "done").length;
  const pct  = Math.round((done / steps.length) * 100);
  const badge =
    status === "running" ? { label: "Running", color: "text-rec",        dot: "bg-rec rec-pulse" } :
    status === "paused"  ? { label: "Paused",  color: "text-amber-400",  dot: "bg-amber-400"     } :
    status === "done"    ? { label: "Done",    color: "text-prime-glow", dot: "bg-prime-glow"    } :
    status === "stopped" ? { label: "Stopped", color: "text-ink-dim",    dot: "bg-ink-dim"       } :
                           { label: "Idle",    color: "text-ink-dim",    dot: "bg-ink-dim/50"    };
  const current = steps[activeIndex];

  return (
    <div className="relative flex flex-wrap items-center gap-3 border-b border-line bg-panel/60 px-5 py-2 backdrop-blur-sm" style={{ zIndex: 8 }}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-ink">
        <span className={"size-1.5 rounded-full " + badge.dot} />
        <span className={badge.color}>Agent · {badge.label}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold uppercase tracking-[0.15em] text-ink-dim">
          {title || "No active run — press Run to launch"}
          {current && status === "running" && (
            <> · <span className="text-ink">Step {activeIndex + 1}/{steps.length} · {current.label}</span></>
          )}
        </div>
        <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-gradient-to-r from-prime via-prime-glow to-rec transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        {status !== "running" && status !== "paused" && <DashBtn onClick={onRun}    tone="rec"   title="Run"><Play  className="size-3" /> Run</DashBtn>}
        {status === "running"  && <DashBtn onClick={onPause}  tone="amber" title="Pause"><Pause  className="size-3" /> Pause</DashBtn>}
        {status === "paused"   && <DashBtn onClick={onResume} tone="prime" title="Resume"><Play  className="size-3" /> Resume</DashBtn>}
        {(status === "running" || status === "paused") && <DashBtn onClick={onStop} tone="line" title="Stop"><Square className="size-3" /> Stop</DashBtn>}
        {(status === "done"    || status === "stopped") && <DashBtn onClick={onReset} tone="line" title="Reset"><RotateCcw className="size-3" /> Reset</DashBtn>}
      </div>
    </div>
  );
}

function DashBtn({ onClick, tone, title, children }: { onClick: () => void; tone: "rec" | "prime" | "amber" | "line"; title: string; children: React.ReactNode }) {
  const cls =
    tone === "rec"   ? "bg-rec text-white hover:bg-rec-glow" :
    tone === "prime" ? "bg-prime text-white hover:bg-prime-glow" :
    tone === "amber" ? "bg-amber-400/90 text-canvas hover:bg-amber-300" :
                       "border border-line bg-panel-2 text-ink hover:border-prime/60";
  return (
    <button onClick={onClick} title={title}
      className={"inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-bold uppercase tracking-[0.2em] transition-colors " + cls}
    >{children}</button>
  );
}

function TabHeader({ tab, status }: { tab: "Script" | "Dailies" | "Timeline"; status: AgentStatus }) {
  const meta = {
    Script:   { title: "Script Room",     sub: "Industry-format script · dialogue polish · scene-by-scene", accent: "border-prime/50" },
    Dailies:  { title: "Dailies Review",  sub: "Hero shots · what's working · concrete fixes",              accent: "border-rec/50"   },
    Timeline: { title: "Live Timeline",   sub: "Streaming autonomous director steps",                        accent: "border-prime/50" },
  }[tab];
  return (
    <section className={"fade-up mb-5 rounded-sm border bg-panel/60 p-4 " + meta.accent}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-ink-dim">{tab} tab</div>
          <div className="font-black-display mt-1 text-xl uppercase text-ink">{meta.title}</div>
          <div className="mt-0.5 text-[12px] font-medium text-ink-dim">{meta.sub}</div>
        </div>
        <span className={"text-xs uppercase tracking-widest " + (status === "running" ? "text-rec" : "text-ink-dim")}>
          {status === "running" ? "● streaming" : "○ waiting"}
        </span>
      </div>
    </section>
  );
}

function ProgressTimeline({ steps, status, title }: { steps: AgentStep[]; status: AgentStatus; title: string }) {
  return (
    <section className="fade-up mb-6 overflow-hidden rounded-sm border border-line bg-panel/60">
      <div className="flex items-center justify-between border-b border-line bg-panel-2/60 px-4 py-2">
        <div className="text-[13px] font-bold uppercase tracking-[0.25em] text-prime">Agent stream · {title || "no active run"}</div>
        <span className={
          "text-xs uppercase tracking-widest " +
          (status === "running" ? "text-rec" : status === "paused" ? "text-amber-400" : status === "done" ? "text-prime-glow" : "text-ink-dim")
        }>{status}</span>
      </div>
      <ol className="relative divide-y divide-line/70">
        {steps.map((s, i) => {
          const Icon = s.status === "done" ? CheckCircle2 : s.status === "active" ? Loader2 : CircleDot;
          return (
            <li key={s.key} className="flex items-start gap-3 px-4 py-3">
              <span className={"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border " +
                (s.status === "done"   ? "border-prime/60 bg-prime/15 text-prime-glow" :
                 s.status === "active" ? "border-rec/70 bg-rec/15 text-rec" :
                                         "border-line bg-panel-2 text-ink-dim")}>
                <Icon className={"size-3.5 " + (s.status === "active" ? "animate-spin" : "")} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase tracking-[0.15em] text-ink">{i + 1}. {s.label}</span>
                  {s.status === "active" && <span className="text-xs font-bold uppercase tracking-widest text-rec">streaming</span>}
                  {s.status === "done"   && <span className="text-xs font-bold uppercase tracking-widest text-prime-glow">ok</span>}
                </div>
                <div className="mt-0.5 text-sm font-medium text-ink-dim">{s.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AgentModeBanner({ onLaunch }: { onLaunch: (t: string) => void }) {
  const BRIEF = `AGENT MODE — go fully autonomous. From now on, act as an end-to-end video director.

Ask me ONE short discovery question at a time (max 4 total), then take over and produce the full production package:
1) Logline + 3 concept directions (pick the strongest, justify).
2) Full script in industry format.
3) 10–14 shot list table (# / Framing / Lens / Movement / Duration / Sound / Notes).
4) Storyboard frame descriptions.
5) Ready-to-paste Seedance + Veo + Sora prompts for the 3 hero shots.
6) Voiceover script, on-screen caption plan, music brief, and platform cuts (16:9, 9:16, 1:1).
7) A "next actions" checklist.

Never say "let me know" or "would you like". Commit. Ship the package.`;

  return (
    <button
      onClick={() => onLaunch(BRIEF)}
      className="group relative w-full overflow-hidden rounded-sm border border-prime/50 bg-gradient-to-br from-prime/20 via-panel to-rec/20 p-5 text-left transition-colors hover:border-prime"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-prime/70 scan-line" />
      <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.25em] text-prime">
        <span className="size-1.5 rounded-full bg-prime rec-pulse" />
        Aurora Agent · Autonomous Mode
      </div>
      <div className="font-black-display mt-2 text-2xl uppercase leading-tight text-ink">Direct an entire video, end to end.</div>
      <div className="mt-2 max-w-lg text-[13px] font-medium text-ink-dim">
        Aurora asks a few tight questions, then autonomously ships logline, script, shot list, storyboards, model prompts, and platform cuts.
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-sm bg-rec px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.2em] text-white group-hover:bg-rec-glow">
        <Zap className="size-3.5" /> Launch Agent
      </div>
    </button>
  );
}

function ProductionBriefIntake({ onLaunch }: { onLaunch: (t: string) => void }) {
  const [concept,    setConcept]    = useState("");
  const [references, setReferences] = useState("");
  const [avatar,     setAvatar]     = useState("");
  const [props,      setProps]      = useState("");
  const [format,     setFormat]     = useState("Music video · 90s");

  const submit = () => {
    const brief = [
      "PRODUCTION BRIEF — draft multiple story directions from these inputs, then wait for me to pick one before shipping the full package.",
      `FORMAT: ${format || "unspecified"}`,
      `CONCEPT: ${concept.trim() || "not specified — infer something evocative"}`,
      `REFERENCES: ${references.trim() || "none — propose your own"}`,
      `AVATAR / TALENT: ${avatar.trim() || "not specified"}`,
      `PROPS / SCENE: ${props.trim() || "not specified"}`,
      "",
      "DELIVER RIGHT NOW — do not ask for permission:",
      "1) 4 distinct STORY DIRECTIONS. For each: name, logline, aesthetic, visual palette, wardrobe/prop treatment, 3-beat arc.",
      "2) A comparison table of the 4 directions across: mood, palette, camera, pace, music vibe.",
      "3) Your recommended pick with reasoning.",
    ].join("\n");
    onLaunch(brief);
  };

  const ready = concept.trim() || references.trim() || avatar.trim() || props.trim();

  return (
    <section className="fade-up rounded-sm border border-prime/40 bg-panel/70 p-5 shadow-[0_0_60px_-20px_color-mix(in_oklch,var(--prime)_60%,transparent)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.25em] text-prime">
          <FileText className="size-3.5" /> Production Brief · Draft Story Directions
        </div>
      </div>
      <p className="mb-4 max-w-xl text-[13px] font-medium text-ink-dim">
        Drop your concept, references, avatar, props. Aurora drafts 4 story directions — you pick, then it ships the full production package.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <BriefField label="Concept / Idea"          value={concept}    onChange={setConcept}    placeholder="e.g. moody synth track, main character wanders a dead mall at 4am…" />
        <BriefField label="References (films, links)" value={references} onChange={setReferences} placeholder="e.g. In the Mood for Love, Weeknd 'Blinding Lights', Gregory Crewdson…" />
        <BriefField label="Avatar / Talent / Wardrobe" value={avatar}   onChange={setAvatar}    placeholder="e.g. androgynous, oil-black hair, crimson silk suit…" />
        <BriefField label="Props / Scene / Location"  value={props}     onChange={setProps}      placeholder="e.g. broken payphone, wet asphalt, single flickering sodium lamp…" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-dim">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)}
            className="rounded-sm border border-line bg-canvas px-2 py-1 text-[13px] normal-case text-ink focus:border-prime focus:outline-none">
            {["Music video · 90s","Music video · 3 min","Short film · 5 min","Ad · 30s","Ad · 60s","Trailer · 90s","Fashion film · 60s"].map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <button onClick={submit} disabled={!ready}
          className="ml-auto flex items-center gap-2 rounded-sm bg-prime px-4 py-2 text-[13px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-prime-glow disabled:cursor-not-allowed disabled:opacity-40">
          <Sparkles className="size-3.5" /> Draft 4 Story Directions
        </button>
      </div>
    </section>
  );
}

function BriefField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-ink-dim">{label}</span>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder}
        className="resize-none rounded-sm border border-line bg-canvas/70 px-3 py-2 text-[12px] font-medium leading-snug text-ink placeholder:text-ink-dim/60 focus:border-prime focus:outline-none"
      />
    </label>
  );
}

function StoryDirectionsSideBySide({ onLaunch }: { onLaunch: (t: string) => void }) {
  const directions = [
    { name: "Hyper-Real Documentary", aesthetic: "Grounded · natural light · 35mm",       palette: ["#1a1613","#c98a5a","#e7d7c5","#7a2020"], shots: ["/prime/shot-alley.jpg",  "/prime/shot-chef.jpg",      "/prime/shot-highway.jpg"], beat: "Ordinary morning → tension pulse → decision made." },
    { name: "Cinematic Anamorphic",   aesthetic: "2.39:1 · Kodak 500T · neon spill",       palette: ["#0b0d1a","#5b2fd1","#e14a6b","#c9d1e0"], shots: ["/prime/shot-alley.jpg",  "/prime/shot-neon-face.jpg", "/prime/shot-highway.jpg"], beat: "Rain sheen intro → chase escalate → reveal on kick." },
    { name: "Photo-Real High Fashion", aesthetic: "Editorial · anamorphic close · silk",   palette: ["#080606","#b0836a","#f5ecd6","#2a1616"], shots: ["/prime/shot-dancer.jpg", "/prime/shot-chef.jpg",      "/prime/shot-eye.jpg"],    beat: "Icon reveal → fabric motion → knowing look to lens." },
    { name: "Grounded Sci-Fi Real",   aesthetic: "2049 tactile · monolithic · patient",    palette: ["#0a1112","#2d5f6b","#d4a24a","#efe6d4"], shots: ["/prime/shot-desert.jpg", "/prime/shot-eye.jpg",       "/prime/shot-highway.jpg"], beat: "Silhouette in vastness → object activates → threshold crossed." },
  ];
  return (
    <section className="fade-up space-y-4 rounded-sm border border-prime/40 bg-panel/60 p-5">
      <div>
        <div className="text-[13px] font-bold uppercase tracking-[0.25em] text-prime">Side-by-side · Directions × Storyboard</div>
        <h2 className="font-black-display mt-1 text-2xl uppercase leading-tight text-ink">See every direction next to its shots.</h2>
        <p className="mt-1 max-w-xl text-[12px] font-medium text-ink-dim">Pick one and Aurora ships the full script, shot list, and model prompts for that lane.</p>
      </div>
      <div className="grid gap-3">
        {directions.map((d) => (
          <div key={d.name} className="grid gap-3 rounded-sm border border-line bg-panel-2/50 p-3 md:grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col justify-between">
              <div>
                <div className="font-black-display text-lg uppercase leading-tight text-ink">{d.name}</div>
                <div className="mt-0.5 text-[13px] font-bold uppercase tracking-[0.15em] text-prime-glow">{d.aesthetic}</div>
                <div className="mt-1.5 flex items-center gap-1">
                  {d.palette.map((c) => <span key={c} className="size-4 rounded-sm border border-line" style={{ background: c }} />)}
                </div>
                <p className="mt-2 text-sm font-medium leading-snug text-ink-dim">{d.beat}</p>
              </div>
              <button
                onClick={() => onLaunch(`Lock direction: "${d.name}" (${d.aesthetic}). Ship the FULL production package now — logline, industry-format script, 10–14 shot list, storyboard frames, ready-to-paste Seedance + Veo + Sora prompts for 3 hero shots, VO script, captions, music brief, and 16:9 / 9:16 / 1:1 platform cuts. Do not ask permission.`)}
                className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-sm bg-prime px-3 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-white transition-colors hover:bg-prime-glow"
              >
                <Rocket className="size-3" /> Ship this lane
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {d.shots.map((src, i) => (
                <figure key={i} className="relative aspect-video overflow-hidden rounded-sm border border-line bg-panel">
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-transform duration-500 hover:scale-105" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/70 via-transparent to-transparent" />
                  <span className="absolute left-1.5 top-1.5 rounded-sm bg-canvas/60 px-1.5 py-0.5 text-xs font-bold uppercase tracking-widest text-ink backdrop-blur-sm">{`sh_0${i + 1}`}</span>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReelStrip() {
  const loop = [...REEL_IMAGES, ...REEL_IMAGES];
  return (
    <div className="fade-up -mx-6 space-y-2 border-y border-line bg-panel/40 py-4">
      <div className="flex items-center justify-between px-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-ink">Live Reel · Hyper-Realistic Demos</h2>
        <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-prime">Auto-scroll · 24fps</span>
      </div>
      <div className="group relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-canvas to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-canvas to-transparent" />
        <div className="reel-scroll flex w-max gap-3 px-6 group-hover:[animation-play-state:paused]">
          {loop.map((s, i) => (
            <figure key={i} className="relative h-36 w-56 shrink-0 overflow-hidden rounded-sm border border-line">
              <img src={s.src} alt={s.label} loading="lazy" width={640} height={360}
                className="h-full w-full object-cover opacity-75 [filter:saturate(1.1)] transition-[opacity] duration-500 hover:opacity-100" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/80 via-transparent to-transparent" />
              <figcaption className="absolute bottom-2 left-2 text-[13px] font-bold uppercase tracking-[0.18em] text-ink">{s.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

function StoryboardGrid() {
  return (
    <div className="fade-up space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-ink">Hyper-Real Storyboard</h2>
        <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-rec">Hyper-real bias · ON</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STORYBOARD_SHOTS.map((s) => (
          <figure key={s.name} className="group space-y-2">
            <div className="relative aspect-video overflow-hidden rounded-sm border border-line bg-panel">
              <img src={s.src} alt={s.name} loading="lazy" className="h-full w-full object-cover" style={{ animation: "ken-burns 12s ease-in-out infinite alternate" }} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/70 via-transparent to-transparent" />
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-sm bg-rec/90 px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.18em] text-white">
                <span className="size-1 rounded-full bg-white rec-pulse" /> Rec
              </span>
            </div>
            <figcaption className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.15em] text-ink">{s.name}</div>
                <div className="text-[13px] font-medium text-ink-dim">{s.meta}</div>
              </div>
              <span className="rounded border border-line px-1.5 py-0.5 text-xs tracking-wider text-ink-dim">{s.tc}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
