import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Loader2,
  Plus,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  createVideoAgentProject,
  listVideoAgentProjects,
  type VideoAgentProjectDto,
} from "@/lib/video-agent-projects.functions";
import {
  styleDescriptions,
  voiceLabels,
  type VideoStyle,
  type VideoVoice,
} from "@/lib/video-agent-shared";

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
];

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

const STATUS_CHIP: Record<string, { label: string; tone: "muted" | "active" | "done" | "failed" }> = {
  draft: { label: "Draft", tone: "muted" },
  editing: { label: "Storyboard ready", tone: "muted" },
  queued: { label: "Queued", tone: "active" },
  processing: { label: "Rendering…", tone: "active" },
  succeeded: { label: "Video ready", tone: "done" },
  failed: { label: "Failed", tone: "failed" },
};

function DraftCard({ project }: { project: VideoAgentProjectDto }) {
  const chip = STATUS_CHIP[project.status] ?? STATUS_CHIP.draft;
  const thumb = project.thumbnailUrl ?? project.scenes.find((s) => s.frame)?.frame ?? null;
  // Unplanned drafts resume in the planner; everything else opens the editor.
  const target = project.status === "draft" && project.scenes.length === 0
    ? ("/video-agent-process" as const)
    : ("/video-agent-edit" as const);
  return (
    <Link
      to={target}
      search={{ id: project.id }}
      className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-2.5 transition hover:border-primary/40"
    >
      <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted/40">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="size-4 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{project.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={
              chip.tone === "active"
                ? "flex items-center gap-1 text-primary"
                : chip.tone === "done"
                  ? "flex items-center gap-1 text-primary"
                  : chip.tone === "failed"
                    ? "flex items-center gap-1 text-destructive"
                    : "flex items-center gap-1"
            }
          >
            {chip.tone === "active" && <Loader2 className="size-3 animate-spin" />}
            {chip.tone === "done" && <CheckCircle2 className="size-3" />}
            {chip.tone === "failed" && <XCircle className="size-3" />}
            {chip.label}
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

function VideoAgentHome() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const createProject = useServerFn(createVideoAgentProject);
  const listProjects = useServerFn(listVideoAgentProjects);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<VideoStyle>("cinematic");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voice, setVoice] = useState<VideoVoice>("narrator-warm");

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const projectsQuery = useQuery({
    queryKey: ["video-agent-projects", user?.id],
    queryFn: () => listProjects(),
    enabled: !!user,
  });
  const recent = (projectsQuery.data ?? []).slice(0, 4);

  async function handleCreate() {
    const trimmed = prompt.trim();
    if (!trimmed) return toast.error("Describe your video first");
    if (trimmed.length < 10) return toast.error("Add a bit more detail");

    setLoading(true);
    try {
      const project = await createProject({
        data: { prompt: trimmed, style, voice, targetDuration: duration },
      });
      await navigate({ to: "/video-agent-process", search: { id: project.id } });
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
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
          <Link to="/gallery" className="video-agent-header-icon" aria-label="Open your gallery">
            <Film className="size-4" />
          </Link>
        </div>
      </header>

      <div className="video-agent-content">
        <div className="video-agent-greeting">
          <p className="video-agent-eyebrow">Aurora Video Agent</p>
          <h1>{greetingForHour(new Date().getHours())}</h1>
          <p className="video-agent-greeting-muted">what shall we create?</p>
        </div>

        <form className="video-agent-composer" onSubmit={(event) => { event.preventDefault(); void handleCreate(); }}>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create…"
            className="video-agent-composer-input"
            disabled={loading}
            maxLength={4000}
            autoFocus
          />
          <button type="submit" className="video-agent-send" aria-label="Create video" disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
          <div className="video-agent-composer-toolbar">
            <button type="button" onClick={() => setShowAdvanced((value) => !value)}>
              Style & voice
            </button>
            <span className="video-agent-composer-spacer" />
            <span>{styleDescriptions[style]}</span>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Example ideas">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              className="rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>

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

        <section className="video-agent-drafts-section mt-6" aria-labelledby="latest-drafts-heading">
          <div className="video-agent-section-heading">
            <h2 id="latest-drafts-heading">Your projects</h2>
          </div>
          {projectsQuery.isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading projects…
            </div>
          ) : projectsQuery.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-card/40 p-4 text-sm text-destructive">
              Couldn't load your projects — {(projectsQuery.error as Error).message}
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
              No projects yet. Describe an idea above and the agent plans the whole video —
              script, storyboard, narration, final MP4.
            </div>
          ) : (
            <div className="grid gap-2">
              {recent.map((project) => <DraftCard key={project.id} project={project} />)}
            </div>
          )}
        </section>
      </div>
      <p className="video-agent-disclaimer">Aurora can make mistakes. Verify critical output before shipping.</p>
    </main>
  );
}
