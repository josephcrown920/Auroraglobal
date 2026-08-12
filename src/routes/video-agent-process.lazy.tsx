import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, Loader2, AlertCircle,
  Film, ArrowRight, Wand2, Layers, Clapperboard, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getVideoAgentProject,
  updateVideoAgentProject,
  type VideoAgentProjectDto,
} from "@/lib/video-agent-projects.functions";
import { vaUid } from "@/lib/video-agent-shared";
import { useAuth } from "@/hooks/use-auth";

export const Route = createLazyFileRoute("/video-agent-process")({
  component: AgentProcessing,
});

type SceneDraft = VideoAgentProjectDto["scenes"][number];

type StepId = "script" | "scenes" | "frames";
type StepStatus = "pending" | "running" | "done" | "error";

type Step = {
  id: StepId;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  status: StepStatus;
  detail?: string;
};

const INITIAL_STEPS: Step[] = [
  { id: "script", label: "Writing script", sublabel: "AI writes scenes, narration, and timing", icon: FileText, status: "pending" },
  { id: "scenes", label: "Saving storyboard", sublabel: "Storing the plan to your account", icon: Clapperboard, status: "pending" },
  { id: "frames", label: "Sketching frames", sublabel: "Preview keyframes for each scene", icon: Layers, status: "pending" },
];

const STYLE_HINTS: Record<string, string> = {
  cinematic: "cinematic anamorphic, 35mm film grain, teal-orange color grade",
  minimal: "clean minimal, soft light, negative space, modern",
  vibrant: "vibrant saturated colors, dynamic, energetic, bold",
  documentary: "natural light, candid, handheld, authentic documentary",
};

function AgentProcessing() {
  const { id } = useSearch({ from: "/video-agent-process" });
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const getProject = useServerFn(getVideoAgentProject);
  const updateProject = useServerFn(updateVideoAgentProject);

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [log, setLog] = useState<string[]>([]);
  const [scenes, setScenes] = useState<SceneDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scenesPersisted, setScenesPersisted] = useState(false);
  const [done, setDone] = useState(false);
  const hasStarted = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth", search: authNextSearch() });
  }, [authLoading, user, navigate]);

  const projectQuery = useQuery({
    queryKey: ["video-agent-project", id],
    queryFn: () => getProject({ data: { id } }),
    enabled: !!user && !!id,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const addLog = (msg: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const setStep = (stepId: StepId, status: StepStatus, detail?: string) =>
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status, detail } : s)));

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  useEffect(() => {
    const project = projectQuery.data;
    if (!project || hasStarted.current) return;
    hasStarted.current = true;
    // A render (or finished storyboard) already lives on the server — this
    // page only plans brand-new drafts. Resume in the editor instead.
    if (project.scenes.length > 0 || ["queued", "processing", "succeeded", "failed"].includes(project.status)) {
      void navigate({ to: "/video-agent-edit", search: { id }, replace: true });
      return;
    }
    void runPipeline(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectQuery.data]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runPipeline(project: VideoAgentProjectDto) {
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      // ── Step 1: Script ──
      setStep("script", "running");
      addLog(`Writing script for: "${project.prompt.slice(0, 60)}…"`);

      const scriptRes = await fetch("/api/video-agent/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: project.prompt,
          style: project.style,
          voice: project.voice,
          targetDuration: project.targetDuration,
        }),
        signal,
      });
      if (!scriptRes.ok) {
        let detail = "";
        try { detail = ((await scriptRes.json()) as { error?: string }).error ?? ""; } catch { /* not json */ }
        throw new Error(detail || `Script generation failed (${scriptRes.status})`);
      }
      const scriptData = (await scriptRes.json()) as {
        title?: string;
        scenes: Array<{ title?: string; script?: string; description?: string; duration?: number }>;
      };

      const title = (scriptData.title ?? "").trim().slice(0, 160) || "Untitled Video";
      const cleaned: SceneDraft[] = scriptData.scenes
        .map((s, i) => ({
          id: vaUid(),
          index: i,
          title: (s.title ?? "").trim().slice(0, 160) || `Scene ${i + 1}`,
          script: (s.script ?? "").trim().slice(0, 2400),
          description: (s.description ?? "").trim().slice(0, 3000),
          duration: Math.max(3, Math.min(15, Math.round(Number(s.duration)) || 6)),
          frame: null,
          frameStatus: "idle" as const,
        }))
        .filter((s) => s.script && s.description)
        .slice(0, 12)
        .map((s, i) => ({ ...s, index: i }));
      if (!cleaned.length) {
        throw new Error("The script came back without usable scenes — try a more specific prompt.");
      }
      addLog(`✓ Script ready: "${title}" — ${cleaned.length} scenes`);
      setStep("script", "done", `${cleaned.length} scenes`);

      // ── Step 2: Persist the storyboard (durable — survives reloads) ──
      setStep("scenes", "running");
      await updateProject({ data: { id, title, scenes: cleaned } });
      setScenesPersisted(true);
      setScenes(cleaned);
      cleaned.forEach((s, i) => addLog(`  Scene ${i + 1}: "${s.title}" (${s.duration}s)`));
      setStep("scenes", "done", "Saved to your account");

      // ── Step 3: Preview frames (free storyboard sketches) ──
      setStep("frames", "running");
      addLog("Sketching storyboard frames…");
      const styleHint = STYLE_HINTS[project.style] ?? STYLE_HINTS.cinematic;

      let current = cleaned;
      let failures = 0;
      for (let i = 0; i < current.length; i++) {
        const sc = current[i];
        addLog(`  Frame ${i + 1}/${current.length}: "${sc.title}"`);
        current = current.map((s) => (s.id === sc.id ? { ...s, frameStatus: "loading" as const } : s));
        setScenes(current);
        try {
          const frameRes = await fetch("/api/video-agent/generate-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: `${sc.description}. Style: ${styleHint}. Cinematic keyframe.` }),
            signal,
          });
          if (!frameRes.ok) throw new Error(`Frame generation failed: ${frameRes.status}`);
          const { url } = (await frameRes.json()) as { url: string };
          current = current.map((s) => (s.id === sc.id ? { ...s, frame: url, frameStatus: "done" as const } : s));
          setScenes(current);
          await updateProject({ data: { id, scenes: current } });
          addLog(`  ✓ Frame ${i + 1} ready`);
        } catch (imgErr) {
          if ((imgErr as Error).name === "AbortError") throw imgErr;
          failures++;
          addLog(`  ⚠ Frame ${i + 1} failed: ${(imgErr as Error).message}`);
          current = current.map((s) => (s.id === sc.id ? { ...s, frameStatus: "error" as const } : s));
          setScenes(current);
        }
      }
      setStep(
        "frames",
        "done",
        failures ? `${current.length - failures}/${current.length} frames (retry the rest in the editor)` : `${current.length} frames`,
      );

      addLog("✓ Storyboard ready — opening editor…");
      setDone(true);
      await delay(900);
      await navigate({ to: "/video-agent-edit", search: { id }, replace: true });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = (err as Error).message;
      setError(msg);
      addLog(`✗ Error: ${msg}`);
      setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)));
      toast.error(msg);
    }
  }

  function retry() {
    setSteps(INITIAL_STEPS);
    setLog([]);
    setScenes([]);
    setError(null);
    setDone(false);
    setScenesPersisted(false);
    const project = projectQuery.data;
    if (project) void runPipeline(project);
  }

  const progress = steps.filter((s) => s.status === "done").length / steps.length;

  if (authLoading || !user || projectQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl p-10 text-center max-w-md">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Project not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            It may belong to another account, or it was created before projects were saved to your account.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/video-agent" })}>
            New Video
          </Button>
        </div>
      </div>
    );
  }

  const project = projectQuery.data;

  return (
    <div className="aurora-page-shell">
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
          <Wand2 className="h-3.5 w-3.5 text-primary" /> Aurora Agent · Planning
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {done ? "Storyboard ready!" : "Planning your video…"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{project.prompt}</p>

        {/* Progress bar */}
        <div className="mt-6 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress * 100)}% complete</span>
          <span>Nothing is charged during planning — you approve the final render in the editor.</span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Steps */}
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`glass rounded-xl p-3.5 flex items-start gap-3 transition ${
                  step.status === "running" ? "border-primary/50 bg-primary/5" : ""
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : step.status === "error" ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : step.status === "running" ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {step.label}
                    {step.status === "running" && (
                      <span className="text-[10px] text-primary animate-pulse">live</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {step.detail ?? step.sublabel}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Scene thumbnails + log */}
          <div className="space-y-4">
            {scenes.length > 0 && (
              <div className="glass rounded-xl p-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Scenes</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {scenes.map((sc, i) => (
                    <div
                      key={sc.id}
                      className="flex-shrink-0 w-24 rounded-lg overflow-hidden bg-muted/40 border border-border/50"
                    >
                      <div className="aspect-video relative">
                        {sc.frame ? (
                          <img
                            src={sc.frame}
                            alt={sc.title}
                            className={`h-full w-full object-cover transition-all duration-500 ${
                              sc.frameStatus === "done" ? "opacity-100" : "opacity-60"
                            }`}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            {sc.frameStatus === "loading" ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <span className="text-[9px] text-muted-foreground">#{i + 1}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="px-1.5 py-1 text-[9px] text-muted-foreground truncate">
                        {sc.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log */}
            <div className="glass rounded-xl p-3 font-mono text-xs h-56 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Agent log</div>
              {log.map((line, i) => (
                <div key={i} className="text-muted-foreground leading-relaxed">{line}</div>
              ))}
              {!error && !done && (
                <div className="flex items-center gap-1 text-primary animate-pulse"><span>▌</span></div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Actions */}
        {(done || error) && (
          <div className="mt-8 flex gap-3">
            {done && (
              <Button
                className="gap-2"
                onClick={() => navigate({ to: "/video-agent-edit", search: { id }, replace: true })}
              >
                <Film className="h-4 w-4" /> Open Editor
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {error && (
              <>
                <Button variant="secondary" onClick={retry}>
                  Try again
                </Button>
                {scenesPersisted && (
                  <Button
                    variant="ghost"
                    onClick={() => navigate({ to: "/video-agent-edit", search: { id } })}
                  >
                    Open saved storyboard
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 glass rounded-xl p-4 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
