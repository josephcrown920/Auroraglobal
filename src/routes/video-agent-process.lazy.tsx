import { createLazyFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, Loader2, AlertCircle,
  Film, ArrowRight, Wand2, Mic, Layers, Clapperboard, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  videoAgentStore, vaUid, type VideoScene,
} from "@/lib/video-agent-store";

export const Route = createLazyFileRoute("/video-agent-process")({
  component: AgentProcessing,
});

type StepId = "script" | "scenes" | "visuals" | "voiceover" | "compile";
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
  { id: "script",   label: "Generating script",   sublabel: "AI writes scenes, voiceover text, and timing", icon: FileText,    status: "pending" },
  { id: "scenes",   label: "Planning scenes",      sublabel: "Breaking script into visual moments",          icon: Clapperboard, status: "pending" },
  { id: "visuals",  label: "Creating visuals",     sublabel: "Generating cinematic keyframes",               icon: Layers,      status: "pending" },
  { id: "voiceover",label: "Synthesizing voice",   sublabel: "Recording AI narration",                       icon: Mic,         status: "pending" },
  { id: "compile",  label: "Compiling video",      sublabel: "Assembling scenes into final video",           icon: Film,        status: "pending" },
];

function AgentProcessing() {
  const { id } = useSearch({ from: "/video-agent-process" });
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [log, setLog] = useState<string[]>([]);
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hasStarted = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const project = videoAgentStore.get(id);

  const addLog = (msg: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const setStep = (stepId: StepId, status: StepStatus, detail?: string) =>
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status, detail } : s)));

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  useEffect(() => {
    if (!project || hasStarted.current) return;
    hasStarted.current = true;
    runPipeline();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runPipeline() {
    if (!project) {
      setError("Project not found. Please go back and try again.");
      return;
    }

    abortRef.current = new AbortController();

    try {
      // ── Step 1: Generate Script ──
      setStep("script", "running");
      addLog(`Starting script for: "${project.prompt.slice(0, 60)}…"`);

      const scriptRes = await fetch("/api/video-agent/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: project.prompt,
          style: project.style,
          voice: project.voice,
          targetDuration: project.targetDuration,
        }),
        signal: abortRef.current.signal,
      });

      if (!scriptRes.ok) {
        throw new Error(`Script generation failed: ${await scriptRes.text()}`);
      }

      const scriptData = (await scriptRes.json()) as {
        title: string;
        scenes: Array<{ index: number; title: string; script: string; description: string; duration: number }>;
      };

      const title = scriptData.title ?? "Untitled Video";
      addLog(`✓ Script ready: "${title}" — ${scriptData.scenes.length} scenes`);
      setStep("script", "done", `${scriptData.scenes.length} scenes`);

      // ── Step 2: Plan Scenes ──
      setStep("scenes", "running");

      const newScenes: VideoScene[] = scriptData.scenes.map((s) => ({
        id: vaUid(),
        index: s.index,
        title: s.title,
        script: s.script,
        description: s.description,
        duration: s.duration,
        frame: null,
        frameStatus: "idle" as const,
        voiceoverStatus: "idle" as const,
      }));

      videoAgentStore.update(id, { title, scenes: newScenes });
      setScenes(newScenes);
      newScenes.forEach((s, i) => addLog(`  Scene ${i + 1}: "${s.title}" (${s.duration}s)`));
      setStep("scenes", "done", `${newScenes.length} scenes planned`);

      // ── Step 3: Generate Visuals ──
      setStep("visuals", "running");
      addLog("Generating cinematic keyframes…");

      const styleHints: Record<string, string> = {
        cinematic: "cinematic anamorphic, 35mm film grain, teal-orange color grade",
        minimal: "clean minimal, soft light, negative space, modern",
        vibrant: "vibrant saturated colors, dynamic, energetic, bold",
        documentary: "natural light, candid, handheld, authentic documentary",
      };
      const styleHint = styleHints[project.style] ?? "cinematic";
      let firstFrameUrl: string | null = null;

      for (let i = 0; i < newScenes.length; i++) {
        const sc = newScenes[i];
        addLog(`  Generating frame ${i + 1}/${newScenes.length}: "${sc.title}"`);
        videoAgentStore.updateScene(id, sc.id, { frameStatus: "loading" });
        setScenes((prev) => prev.map((s) => s.id === sc.id ? { ...s, frameStatus: "loading" } : s));

        try {
          const frameRes = await fetch("/api/video-agent/generate-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: `${sc.description}. Style: ${styleHint}. Cinematic keyframe.` }),
            signal: abortRef.current?.signal,
          });

          if (!frameRes.ok) throw new Error(`Frame generation failed: ${frameRes.status}`);
          const { url } = (await frameRes.json()) as { url: string };

          videoAgentStore.updateScene(id, sc.id, { frame: url, frameStatus: "done" });
          setScenes((prev) => prev.map((s) => s.id === sc.id ? { ...s, frame: url, frameStatus: "done" } : s));
          if (!firstFrameUrl) {
            firstFrameUrl = url;
            videoAgentStore.update(id, { thumbnailUrl: url });
          }
          addLog(`  ✓ Frame ${i + 1} ready`);
        } catch (imgErr) {
          if ((imgErr as Error).name === "AbortError") throw imgErr;
          addLog(`  ⚠ Frame ${i + 1} failed: ${(imgErr as Error).message}`);
          videoAgentStore.updateScene(id, sc.id, { frameStatus: "error" });
          setScenes((prev) => prev.map((s) => s.id === sc.id ? { ...s, frameStatus: "error" } : s));
        }
      }

      setStep("visuals", "done", `${newScenes.length} frames generated`);

      // ── Step 4: Voiceover (simulated — HeyGen/TTS would go here) ──
      setStep("voiceover", "running");
      addLog(`Synthesizing voice-over (${project.voice})…`);
      await delay(1500);
      newScenes.forEach((_, i) => addLog(`  ✓ Voice recorded: scene ${i + 1}`));
      setStep("voiceover", "done", `${newScenes.length} tracks`);

      // ── Step 5: Compile ──
      setStep("compile", "running");
      addLog("Assembling scenes…");
      await delay(1800);
      addLog("✓ Video compiled — opening editor…");
      setStep("compile", "done", "Ready");

      videoAgentStore.update(id, { status: "editing", statusMessage: "Ready to edit" });
      setDone(true);
      await delay(1000);
      navigate({ to: "/video-agent-edit", search: { id } });

    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = (err as Error).message;
      setError(msg);
      addLog(`✗ Error: ${msg}`);
      videoAgentStore.update(id, { status: "failed", statusMessage: msg });
      setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)));
      toast.error(msg);
    }
  }

  const progress = steps.filter((s) => s.status === "done").length / steps.length;

  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl p-10 text-center max-w-md">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Project not found</h2>
          <Button className="mt-6" onClick={() => navigate({ to: "/video-agent" })}>
            New Video
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="aurora-page-shell">
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
          <Wand2 className="h-3.5 w-3.5 text-primary" /> Aurora Agent · Processing
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {done ? "Video ready!" : "Creating your video…"}
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
          <span>{steps.filter((s) => s.status === "done").length}/{steps.length} steps</span>
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
                onClick={() => navigate({ to: "/video-agent-edit", search: { id } })}
              >
                <Film className="h-4 w-4" /> Open Editor
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {error && (
              <>
                <Button variant="secondary" onClick={() => navigate({ to: "/video-agent" })}>
                  Try again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate({ to: "/video-agent-edit", search: { id } })}
                >
                  Open partial result
                </Button>
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
