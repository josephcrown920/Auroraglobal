import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chatWithAuroraAgent,
  listAgentChat,
  clearAgentChat,
  deleteAgentMemory,
  type AgentPlan,
  type AgentShot,
  type AgentChatMessage,
  type SkillMeta,
} from "@/lib/agent.functions";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Plus,
  Film,
  Palette,
  Brain,
  MoreVertical,
  Eraser,
  Trash2,
  Clapperboard,
  Camera,
  Wand2,
  Copy,
  Check,
  Search,
  Globe,
  Anchor,
  Image,
  BookOpen,
  Save,
  Captions,
  VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Node, Edge } from "@xyflow/react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks "Send to canvas" — produces a node graph of all shots. */
  onSendToCanvas: (graph: { nodes: Node<any>[]; edges: Edge[] }) => void;
};

const SAMPLES = [
  "Plan a music video: moody R&B track, rainy Tokyo rooftop, neon reflections, single performer.",
  "What's the best lens + lighting for a gritty 90s hip-hop look?",
  "Remember this: my visual style is dark cinematic with violet neon accents.",
];

// Curated visual styles — modeled on HeyGen's Video Agent style gallery, tuned
// to Aurora's own gradient/genre language so a tap actually steers the plan.
const STYLES: { name: string; hint: string; gradient: string }[] = [
  { name: "Cinematic", hint: "moody cinematic lighting, anamorphic lens, film grain", gradient: "from-slate-600 to-slate-900" },
  { name: "Neon Noir", hint: "neon-drenched noir, rain-slicked streets, magenta/cyan rim light", gradient: "from-fuchsia-600 to-indigo-700" },
  { name: "Retro VHS", hint: "90s VHS tape aesthetic, scan lines, warm grain, boxy framing", gradient: "from-amber-500 to-rose-600" },
  { name: "Studio Clean", hint: "clean studio backdrop, soft key light, high production polish", gradient: "from-zinc-300 to-zinc-500" },
  { name: "Documentary", hint: "handheld documentary realism, natural light, candid framing", gradient: "from-emerald-600 to-teal-700" },
  { name: "Anime", hint: "vivid anime-style illustration, bold linework, cel shading", gradient: "from-sky-500 to-violet-600" },
];

// Map skill names → Lucide icons (keeps the chip consistent with the registry).
const SKILL_ICONS: Record<string, React.ReactNode> = {
  web_search:          <Search className="size-2.5" />,
  scrape_url:          <Globe className="size-2.5" />,
  generate_hooks:      <Anchor className="size-2.5" />,
  generate_broll:      <Image className="size-2.5" />,
  recall_brand_memory: <BookOpen className="size-2.5" />,
  update_brand_memory: <Save className="size-2.5" />,
  add_captions:        <Captions className="size-2.5" />,
};

// ─── SkillChip ───────────────────────────────────────────────────────────────

function SkillChip({ meta }: { meta: SkillMeta }) {
  const icon = SKILL_ICONS[meta.name] ?? <Sparkles className="size-2.5" />;
  const secs = (meta.durationMs / 1000).toFixed(1);
  return (
    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[9.5px] font-medium text-violet-200/90 max-w-full">
      <span className="text-violet-300 shrink-0">{icon}</span>
      <span className="truncate">{meta.label}</span>
      <span className="text-violet-400/70 shrink-0">· {meta.summary.slice(0, 55)}</span>
      <span className="text-violet-400/50 shrink-0 ml-0.5">{secs}s</span>
    </div>
  );
}

// ─── SkillPulse (shown during pending while a skill is running) ───────────────

function SkillPulse({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[9.5px] font-medium text-violet-200/80">
      <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
      {label}…
    </div>
  );
}

// ─── planToGraph ─────────────────────────────────────────────────────────────

function planToGraph(plan: AgentPlan): { nodes: Node<any>[]; edges: Edge[] } {
  const nodes: Node<any>[] = [
    { id: "in", position: { x: 40, y: 60 }, type: "aurora", data: { kind: "input" } },
  ];
  const edges: Edge[] = [];
  plan.shots.forEach((s, i) => {
    const id = `shot-${i}`;
    nodes.push({
      id,
      position: { x: 380 + (i % 3) * 360, y: 60 + Math.floor(i / 3) * 340 },
      type: "aurora",
      data: { kind: "image", prompt: s.prompt },
    });
    edges.push({ id: `in-${id}`, source: "in", target: id, animated: true });
  });
  return { nodes, edges };
}

// ─── ShotCard ────────────────────────────────────────────────────────────────

function ShotCard({ shot, index, palette }: { shot: AgentShot; index: number; palette: string[] }) {
  const [copied, setCopied] = useState(false);
  const tint = palette[index % palette.length] ?? "#7C3AED";
  return (
    <div className="relative w-[168px] shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/40">
      <div
        className="relative h-24 flex items-end p-2"
        style={{ background: `linear-gradient(160deg, ${tint}55, #05050a)` }}
      >
        <span className="absolute top-1.5 left-1.5 size-5 rounded-full bg-black/50 text-[10px] font-bold text-white grid place-items-center border border-white/15">
          {index + 1}
        </span>
        <Clapperboard className="absolute right-2 top-2 size-3.5 text-white/40" />
        <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2">{shot.title}</p>
      </div>
      <div className="p-2 space-y-1.5">
        <p className="text-[9.5px] text-white/50 inline-flex items-center gap-1">
          <Camera className="size-2.5 text-violet-300" /> {shot.shotType} · {shot.camera}
        </p>
        <p className="text-[10px] text-white/60 leading-snug line-clamp-2">{shot.action}</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(shot.prompt);
            setCopied(true);
            toast.success("Prompt copied");
            setTimeout(() => setCopied(false), 1500);
          }}
          className="w-full mt-1 inline-flex items-center justify-center gap-1 text-[10px] font-medium text-violet-300 hover:text-violet-200 rounded-md py-1 bg-white/5 hover:bg-white/10"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
    </div>
  );
}

// ─── PlanCard ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onSend }: { plan: AgentPlan; onSend: () => void }) {
  return (
    <div className="mt-2 rounded-2xl border border-violet-400/25 bg-gradient-to-b from-violet-500/[0.09] to-transparent overflow-hidden shadow-lg shadow-violet-900/20">
      <div className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-violet-300/80 inline-flex items-center gap-1.5">
              <Clapperboard className="size-3" /> Storyboard built
            </p>
            <p className="text-base font-bold text-white leading-tight mt-1">{plan.title}</p>
            <p className="text-[11px] text-white/55 italic mt-0.5">"{plan.logline}"</p>
          </div>
          <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-[10px] font-semibold text-violet-200">
            {plan.shots.length} shots
          </span>
        </div>

        {plan.direction && (
          <p className="text-[11px] text-white/60 leading-relaxed border-l-2 border-violet-400/40 pl-2">
            {plan.direction}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          {plan.palette.slice(0, 6).map((c) => (
            <span
              key={c}
              className="size-5 rounded-full border border-white/20 shadow-sm"
              style={{ background: c }}
              title={c}
            />
          ))}
          <span className="text-[9px] text-white/40 ml-1 inline-flex items-center gap-1">
            <Palette className="size-2.5" /> color story
          </span>
        </div>

        {/* Filmstrip — the actual "building" visual, HeyGen-style */}
        <div className="-mx-3.5 px-3.5">
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
            {plan.shots.map((s, i) => (
              <div className="snap-start" key={s.id}>
                <ShotCard shot={s} index={i} palette={plan.palette} />
              </div>
            ))}
          </div>
        </div>

        {plan.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {plan.suggestions.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-[9.5px] text-white/50 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onSend}
        className="w-full py-2.5 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 hover:brightness-110 transition-[filter]"
        style={{ background: "linear-gradient(135deg, oklch(0.65 0.22 305), oklch(0.62 0.22 340))" }}
      >
        <Plus className="size-3.5" /> Send storyboard to canvas
      </button>
    </div>
  );
}

// ─── AuroraAgentPanel ────────────────────────────────────────────────────────

export function AuroraAgentPanel({ open, onClose, onSendToCanvas }: Props) {
  const [draft, setDraft] = useState("");
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [cinematicMode, setCinematicMode] = useState(false);
  const [activeSkillLabel, setActiveSkillLabel] = useState<string | null>(null);
  const chatFn = useServerFn(chatWithAuroraAgent);
  const listFn = useServerFn(listAgentChat);
  const clearFn = useServerFn(clearAgentChat);
  const forgetFn = useServerFn(deleteAgentMemory);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ["agent-chat"],
    enabled: open,
    queryFn: () => listFn({}),
  });
  const messages: AgentChatMessage[] = history.data?.messages ?? [];
  const hasMemory = history.data?.hasMemory ?? false;

  const sendMut = useMutation({
    mutationFn: async (message: string) => chatFn({ data: { message, cinematicMode } }),
    onSuccess: (res) => {
      setActiveSkillLabel(null);
      setPendingUserMsg(null);
      qc.invalidateQueries({ queryKey: ["agent-chat"] });
      if (res.memoryUpdated) toast.success("Aurora updated its memory of you", { icon: "🧠" });
      if (res.skillInvoked) {
        toast.success(`${res.skillInvoked.icon} ${res.skillInvoked.label} completed`, {
          description: res.skillInvoked.summary,
          duration: 3000,
        });
      }
    },
    onError: (e: Error) => {
      setActiveSkillLabel(null);
      setPendingUserMsg(null);
      toast.error(e.message);
    },
  });

  const clearMut = useMutation({
    mutationFn: async () => clearFn({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-chat"] });
      toast.success("Chat cleared — memory kept");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forgetMut = useMutation({
    mutationFn: async () => forgetFn({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-chat"] });
      toast.success("Memory erased");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = () => {
    const text = draft.trim();
    if (text.length < 2 || sendMut.isPending) return;
    setPendingUserMsg(text);
    setDraft("");
    setActiveStyle(null);
    setActiveSkillLabel(null);
    sendMut.mutate(text);
  };

  const toggleStyle = (style: (typeof STYLES)[number]) => {
    if (activeStyle === style.name) {
      setActiveStyle(null);
      setDraft((d) => d.replace(`, in a ${style.hint} style.`, "").trim());
      return;
    }
    setActiveStyle(style.name);
    setDraft((d) => {
      const base = d.trim().length > 0 ? d.trim() : "Plan a video";
      return `${base}, in a ${style.hint} style.`;
    });
  };

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pendingUserMsg, sendMut.isPending, open]);

  if (!open) return null;

  return (
    <div className="phone-panel-col fixed inset-y-0 z-50 bg-[oklch(0.09_0.03_290/0.97)] backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative size-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40">
            <Clapperboard className="size-4.5 text-white" />
            <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-400 border-2 border-[#0c0a17]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
              Aurora Video Agent
              {cinematicMode && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/90 bg-amber-500/15 border border-amber-400/25 rounded-full px-1.5 py-0.5">
                  Cinematic
                </span>
              )}
            </p>
            <p className="text-[10px] text-white/50 inline-flex items-center gap-1">
              {hasMemory ? (
                <>
                  <Brain className="size-2.5 text-violet-300" />
                  <span className="text-violet-300/90">Remembers you</span>
                </>
              ) : (
                "Scripts, styles & storyboards — end to end"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Cinematic mode toggle */}
          <button
            onClick={() => setCinematicMode((v) => !v)}
            title={cinematicMode ? "Cinematic mode ON — click to toggle off" : "Enable cinematic mode (director-tier prompts)"}
            className={`p-1.5 rounded-md transition-colors ${
              cinematicMode
                ? "text-amber-300 bg-amber-500/20 border border-amber-400/30"
                : "text-white/40 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            <VideoIcon className="size-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5" aria-label="Chat options">
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => clearMut.mutate()}
                disabled={clearMut.isPending || messages.length === 0}
              >
                <Eraser className="size-3.5 mr-2" /> Clear chat (keep memory)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => forgetMut.mutate()}
                disabled={forgetMut.isPending || !hasMemory}
                className="text-rose-400 focus:text-rose-300"
              >
                <Trash2 className="size-3.5 mr-2" /> Forget everything about me
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button onClick={onClose} className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {history.isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-violet-300" />
          </div>
        )}

        {!history.isLoading && messages.length === 0 && !pendingUserMsg && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/[0.06] to-transparent p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="size-8 rounded-lg grid place-items-center bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
                  <Wand2 className="size-4 text-white" />
                </span>
                <p className="text-sm font-bold text-white">Direct a full video, start to finish</p>
              </div>
              <p className="text-xs text-white/65 leading-relaxed">
                Pick a look, describe the idea, and I'll write the script, shot list, camera direction and color
                story — then build a storyboard you can drop straight onto the canvas.
              </p>
              <p className="text-[10px] text-violet-300/70 mt-2 leading-relaxed">
                Enable <strong className="text-amber-300/90">Cinematic mode</strong> (🎬 button above) for director-tier
                prompts with film stocks, focal lengths, and auto-generated B-roll.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Pick a visual style</p>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((style) => (
                  <button
                    key={style.name}
                    onClick={() => toggleStyle(style)}
                    className={`group relative aspect-[4/3] rounded-lg overflow-hidden border transition-all ${
                      activeStyle === style.name
                        ? "border-violet-300 ring-2 ring-violet-400/50"
                        : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient}`} />
                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
                    <span className="absolute inset-x-0 bottom-0 p-1.5 text-[9.5px] font-semibold text-white text-left leading-tight drop-shadow">
                      {style.name}
                    </span>
                    {activeStyle === style.name && (
                      <Check className="absolute top-1 right-1 size-3.5 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Or try saying</p>
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setDraft(s)}
                  className="w-full text-left text-xs p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-violet-400/30 text-white/75"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-xs leading-relaxed text-white bg-gradient-to-br from-violet-600/80 to-fuchsia-600/70 border border-violet-400/20"
                  : "max-w-[94%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-xs leading-relaxed text-white/85 bg-white/[0.05] border border-white/10"
              }
            >
              {/* Skill chip — shown above the reply text on assistant messages */}
              {m.role === "assistant" && m.skillMeta && (
                <SkillChip meta={m.skillMeta} />
              )}
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && m.plan && (
                <PlanCard
                  plan={m.plan}
                  onSend={() => {
                    onSendToCanvas(planToGraph(m.plan!));
                    toast.success("Storyboard added to canvas");
                    onClose();
                  }}
                />
              )}
            </div>
          </div>
        ))}

        {pendingUserMsg && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-xs leading-relaxed text-white bg-gradient-to-br from-violet-600/80 to-fuchsia-600/70 border border-violet-400/20 opacity-80">
              <p className="whitespace-pre-wrap">{pendingUserMsg}</p>
            </div>
          </div>
        )}

        {sendMut.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white/[0.05] border border-white/10 space-y-1.5">
              {activeSkillLabel && <SkillPulse label={activeSkillLabel} />}
              <div className="inline-flex items-center gap-2 text-xs text-white/60">
                <Film className="size-3.5 text-violet-300 animate-pulse" />
                {activeSkillLabel ? "Integrating results…" : "Directing your storyboard…"}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-white/10 p-3 space-y-2">
        {messages.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mt-0.5">
            {STYLES.map((style) => (
              <button
                key={style.name}
                onClick={() => toggleStyle(style)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors ${
                  activeStyle === style.name
                    ? "border-violet-300/60 bg-violet-500/20 text-violet-100"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80 hover:border-white/25"
                }`}
              >
                {style.name}
              </button>
            ))}
          </div>
        )}
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Describe the video you want — I'll write it, shoot it, and storyboard it…"
          rows={2}
          className="bg-black/30 border-white/10 text-white text-xs resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setCinematicMode((v) => !v)}
            title={cinematicMode ? "Cinematic mode active" : "Enable cinematic mode"}
            className={`shrink-0 rounded-lg px-2.5 py-2 text-[10px] font-semibold border transition-all flex items-center gap-1 ${
              cinematicMode
                ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70 hover:border-white/20"
            }`}
          >
            <VideoIcon className="size-3" />
            {cinematicMode ? "Cinematic ON" : "Cinematic"}
          </button>
          <Button
            onClick={send}
            disabled={sendMut.isPending || draft.trim().length < 2}
            className="flex-1 text-white shadow-lg shadow-violet-500/30"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.22 305), oklch(0.62 0.22 340))" }}
          >
            {sendMut.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Send className="size-3.5 mr-1" />}
            Send
          </Button>
        </div>
      </footer>
    </div>
  );
}
