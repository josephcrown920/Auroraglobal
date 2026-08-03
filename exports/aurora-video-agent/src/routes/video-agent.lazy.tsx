import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
} from "lucide-react";
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
    <main className="video-agent-shell">
      <header className="video-agent-header">
        <Link to="/video-agent" className="video-agent-brand" aria-label="Aurora Video Agent">
          <span className="video-agent-brand-mark"><Sparkles className="size-4" /></span>
          <span>Aurora AI</span>
        </Link>
        <div className="video-agent-header-actions">
          <button type="button" className="video-agent-new-project" onClick={() => setPrompt("")}>
            <Plus className="size-3.5" /> New project
          </button>
          <button type="button" className="video-agent-header-icon" aria-label="Open workspace menu">
            <Film className="size-4" />
          </button>
          <button type="button" className="video-agent-header-icon" aria-label="Open account menu">
            <span className="size-2 rounded-full bg-primary" />
          </button>
        </div>
      </header>

      <div className="video-agent-content">
        <div className="video-agent-greeting">
          <p className="video-agent-eyebrow">Aurora Video Agent</p>
          <h1>Good morning,</h1>
          <p className="video-agent-greeting-muted">what shall we create?</p>
        </div>

        <section className="video-agent-slot-grid" aria-label="Video agent modes">
          <div className="video-agent-slot" data-video-agent-slot="mode-one">
            <span>Placeholder for your first mode card</span>
          </div>
          <div className="video-agent-slot" data-video-agent-slot="mode-two">
            <span>Placeholder for your second mode card</span>
          </div>
        </section>

        <section className="video-agent-drafts-section" aria-labelledby="latest-drafts-heading">
          <div className="video-agent-section-heading">
            <h2 id="latest-drafts-heading">Latest drafts</h2>
            <span>View all</span>
          </div>
          <div className="video-agent-drafts-layout">
            <div className="video-agent-draft-slot" data-video-agent-slot="latest-draft">
              <span>Placeholder for your latest draft</span>
            </div>
            <div className="video-agent-project-slots">
              <div className="video-agent-project-slot" data-video-agent-slot="recent-project-one">
                <span>Recent project placeholder</span>
              </div>
              <div className="video-agent-project-slot" data-video-agent-slot="recent-project-two">
                <span>Recent project placeholder</span>
              </div>
              <div className="video-agent-history-slot" data-video-agent-slot="browse-history">
                <Clock className="size-3" /> Browse history
              </div>
            </div>
          </div>
        </section>

        <form className="video-agent-composer" onSubmit={(event) => { event.preventDefault(); void handleCreate(); }}>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create…"
            className="video-agent-composer-input"
            disabled={loading}
            autoFocus
          />
          <button type="submit" className="video-agent-send" aria-label="Create video" disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
          <div className="video-agent-composer-toolbar">
            <button type="button" onClick={() => setPrompt(EXAMPLE_PROMPTS[0])}><ImageIcon className="size-3" /> Image</button>
            <button type="button" onClick={() => setShowAdvanced((value) => !value)}><Mic className="size-3" /> Voice</button>
            <button type="button" onClick={() => setPrompt((value) => value ? `${value} ` : value)}><Paperclip className="size-3" /> Attach</button>
            <button type="button" onClick={() => setPrompt(EXAMPLE_PROMPTS[1])}><Globe className="size-3" /> Browse</button>
            <span className="video-agent-composer-spacer" />
            <span>{styleDescriptions[style]}</span>
          </div>
        </form>

        <details
          className="video-agent-settings"
          open={showAdvanced}
          onToggle={(event) => setShowAdvanced(event.currentTarget.open)}
        >
          <summary>
            Project settings
            {showAdvanced ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </summary>
          <div className="video-agent-settings-body">
            <div>
              <span>Visual direction</span>
              <select value={style} onChange={(event) => setStyle(event.target.value as VideoStyle)} disabled={loading}>
                <option value="cinematic">Cinematic</option>
                <option value="minimal">Clean & Modern</option>
                <option value="vibrant">Bold & Energetic</option>
                <option value="documentary">Documentary</option>
              </select>
            </div>
            <div>
              <span>Length</span>
              <div className="video-agent-setting-chips">
                {LENGTH_CHIPS.map((chip) => (
                  <button key={chip.value} type="button" onClick={() => setDuration(chip.value)} aria-pressed={duration === chip.value}>
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span>Voice-over</span>
              <select value={voice} onChange={(event) => setVoice(event.target.value as VideoVoice)} disabled={loading}>
                {(Object.keys(voiceLabels) as VideoVoice[]).map((value) => <option key={value} value={value}>{voiceLabels[value]}</option>)}
              </select>
            </div>
          </div>
        </details>

        {recent.length > 0 && (
          <div className="video-agent-recent-data" aria-live="polite">
            {recent.map((project) => (
              <Link key={project.id} to="/video-agent-edit" search={{ id: project.id }}>
                <Film className="size-3" /> {project.title} <Clock className="ml-1 size-3" /> {new Date(project.createdAt).toLocaleDateString()}
              </Link>
            ))}
          </div>
        )}
      </div>
      <p className="video-agent-disclaimer">Aurora can make mistakes. Verify critical output before shipping.</p>
    </main>
  );
}
