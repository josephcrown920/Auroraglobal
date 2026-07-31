import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Zap, Loader2, Sparkles, ChevronDown, ChevronUp,
  Film, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  videoAgentStore,
  styleDescriptions,
  voiceLabels,
  vaUid,
  type VideoStyle,
  type VideoVoice,
  type VideoProject,
} from "@/lib/video-agent-store";

export const Route = createLazyFileRoute("/video-agent")({
  component: VideoAgentHome,
});

const DIRECTION_CARDS: Array<{ style: VideoStyle; emoji: string; name: string; feel: string }> = [
  { style: "cinematic",   emoji: "🎬", name: "Cinematic",       feel: "Film grain · rich color · wide shots" },
  { style: "minimal",     emoji: "◻️", name: "Clean & Modern",  feel: "Open space · crisp motion · type-led" },
  { style: "vibrant",     emoji: "⚡", name: "Bold & Energetic", feel: "Punchy cuts · vivid palette · dynamic" },
  { style: "documentary", emoji: "📽️", name: "Documentary",     feel: "Real moments · natural light · candid" },
];

const LENGTH_CHIPS: Array<{ value: number; label: string }> = [
  { value: 30, label: "~30 sec" },
  { value: 60, label: "~1 min" },
  { value: 90, label: "~90 sec" },
  { value: 120, label: "~2 min" },
];

const EXAMPLE_PROMPTS = [
  "A short film about sustainable fashion for Gen Z",
  "The science of meditation in under a minute",
  "Launch reveal for an AI productivity app",
  "How coffee quietly changed modern civilization",
  "A luxury eco-resort hidden in the Maldives",
];

function VideoAgentHome() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<VideoStyle>("cinematic");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voice, setVoice] = useState<VideoVoice>("narrator-warm");
  const [recent, setRecent] = useState<VideoProject[]>([]);

  useEffect(() => {
    setRecent(videoAgentStore.list().slice(0, 4));
  }, []);

  async function handleCreate() {
    const trimmed = prompt.trim();
    if (!trimmed) return toast.error("Describe your video first");
    if (trimmed.length < 10) return toast.error("Add a bit more detail");

    setLoading(true);
    try {
      const id = vaUid();
      videoAgentStore.create({
        id,
        prompt: trimmed,
        title: "Untitled Video",
        style,
        voice,
        targetDuration: duration,
        scenes: [],
        status: "creating",
        statusMessage: "Starting…",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        exportUrl: null,
        thumbnailUrl: null,
      });
      await navigate({ to: "/video-agent-process", search: { id } });
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="aurora-page-shell">
      <div className="relative z-10 mx-auto max-w-2xl px-5 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
          <Sparkles className="h-3 w-3 text-primary" /> Aurora Video Agent
        </div>
        <h1 className="text-3xl font-bold tracking-tight leading-tight">
          What's your video <span className="aurora-gradient-text">about?</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe the idea — Aurora will write the script, plan the scenes, and generate visuals.
        </p>

        {/* Prompt */}
        <div className="mt-7 glass rounded-xl p-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Tell Aurora what you want to make…"
            className="min-h-32 resize-none text-sm bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
            disabled={loading}
            autoFocus
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                disabled={loading}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border transition-colors text-muted-foreground truncate max-w-[220px]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Style picker */}
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Choose a look</div>
          <div className="grid grid-cols-2 gap-2">
            {DIRECTION_CARDS.map((card) => (
              <button
                key={card.style}
                onClick={() => setStyle(card.style)}
                disabled={loading}
                aria-pressed={style === card.style}
                className={`glass rounded-lg p-3 text-left transition-all border ${
                  style === card.style
                    ? "border-primary/70 bg-primary/10"
                    : "border-border/40 hover:border-border/80"
                }`}
              >
                <div className="text-lg mb-1.5 leading-none">{card.emoji}</div>
                <div className="text-sm font-semibold leading-tight">{card.name}</div>
                <div className="mt-1 text-[10px] text-muted-foreground leading-snug">{card.feel}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Length */}
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Length</div>
          <div className="flex gap-1.5 flex-wrap">
            {LENGTH_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setDuration(chip.value)}
                disabled={loading}
                aria-pressed={duration === chip.value}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  duration === chip.value
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAdvanced ? "Hide" : "Show"} advanced options
          </button>
          {showAdvanced && (
            <div className="mt-3 glass rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Voice-over style</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(voiceLabels) as VideoVoice[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVoice(v)}
                    disabled={loading}
                    aria-pressed={voice === v}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      voice === v
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {voiceLabels[v]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Style: <em>{styleDescriptions[style]}</em>
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Button
            size="lg"
            className="w-full h-12 text-sm font-semibold gap-2"
            onClick={handleCreate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Directing your video…</>
            ) : (
              <><Zap className="h-4 w-4" /> Create Video</>
            )}
          </Button>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
            Aurora writes the script, picks the shots, and generates visuals automatically.
          </p>
        </div>

        {/* Recent projects */}
        {recent.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent projects</h2>
              <button
                onClick={() => videoAgentStore.clear()}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {recent.map((p) => (
                <Link key={p.id} to="/video-agent-edit" search={{ id: p.id }}>
                  <div className="group glass rounded-xl overflow-hidden border border-border/50 hover:border-primary/40 transition">
                    <div className="aspect-video bg-muted/30 relative">
                      {p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt={p.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Film className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                          {p.status}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-medium line-clamp-1">{p.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(p.createdAt).toLocaleDateString()}
                        <span>·</span>
                        <span>{p.scenes.length} scenes</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-3 text-center">
              <Link to="/gallery" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                View full gallery <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
