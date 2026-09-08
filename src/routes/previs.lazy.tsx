import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Plus, AlertCircle, ChevronUp, ChevronDown, Trash2,
  RefreshCw, Film, Clapperboard,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import {
  analyzeCinematicBrief,
} from "@/lib/video-agent.functions";
import {
  createVideoAgentProject,
  getVideoAgentProject,
  listVideoAgentProjects,
  updateVideoAgentProject,
  generateVideoAgentPrevisPlate,
  upgradeVideoAgentPlate,
  PREVIS_PLATE_COST,
  type VideoAgentProjectDto,
} from "@/lib/video-agent-projects.functions";
import { vaUid } from "@/lib/video-agent-shared";
import type { VideoPlan, VideoShot } from "@/lib/video-agent-skills";

import { PrevisHeader } from "@/components/previs/PrevisHeader";
import { BriefForm } from "@/components/previs/BriefForm";
import { BriefPanel } from "@/components/previs/BriefPanel";
import { ShotCard } from "@/components/previs/ShotCard";
import { SequenceBar } from "@/components/previs/SequenceBar";
import { ProjectRestoreCard } from "@/components/previs/ProjectRestoreCard";
import { HandoffPanel } from "@/components/previs/HandoffPanel";
import { MultishotStudio } from "@/components/previs/MultishotStudio";

export const Route = createLazyFileRoute("/previs")({ component: PrevisWorkspace });

// ── Helpers ───────────────────────────────────────────────────────────────

type SceneDraft = VideoAgentProjectDto["scenes"][number];

function shotToScene(shot: VideoShot, index: number): SceneDraft {
  return {
    id: shot.id ?? vaUid(),
    index,
    title: shot.purpose.charAt(0).toUpperCase() + shot.purpose.slice(1),
    script: shot.action ?? "",
    description: shot.prompt ?? "",
    duration: shot.duration_s ?? 5,
    frame: null,
    frameStatus: "idle",
    purpose: shot.purpose,
    shotType: shot.shot_type,
    lensMm: shot.lens_mm,
    camera: shot.camera,
    lighting: shot.lighting,
    modelPrompt: shot.prompt,
    negativePrompt: shot.negative_prompt,
    continuityNote: shot.chain_from ?? undefined,
  };
}

function planToProjectInput(plan: VideoPlan, idea: string) {
  const brief = plan.brief;
  const scenes: SceneDraft[] = (plan.shots ?? []).map((shot, i) => ({
    ...shotToScene(shot, i),
    aspectRatio: brief?.format ?? "16:9",
    visualDirection: [
      brief?.motion_language,
      brief?.mood,
      brief?.palette?.join(", "),
    ].filter(Boolean).join(" · "),
  }));
  return {
    prompt: idea,
    title: plan.brief?.title ?? "Untitled Previs",
    style: "cinematic" as const,
    voice: "narrator-warm" as const,
    targetDuration: Math.max(15, Math.min(120, Math.round(
      scenes.reduce((sum, scene) => sum + scene.duration, 0),
    ))),
    scenes,
  };
}

// Map a project's scenes back to the VideoShot shape for display
function sceneToShot(scene: SceneDraft): VideoShot {
  return {
    id: scene.id,
    purpose: (scene.purpose as VideoShot["purpose"]) ?? "context",
    shot_type: (scene.shotType as VideoShot["shot_type"]) ?? "MEDIUM",
    duration_s: scene.duration,
    lens_mm: scene.lensMm,
    camera: scene.camera,
    action: scene.script,
    lighting: scene.lighting,
    prompt: scene.modelPrompt ?? scene.description,
    negative_prompt: scene.negativePrompt ?? "warped face, extra fingers, plastic skin, text overlays, watermark",
    chain_from: scene.continuityNote ?? null,
  };
}

// ── Main workspace ────────────────────────────────────────────────────────

function PrevisWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const analyzeFn   = useServerFn(analyzeCinematicBrief);
  const createFn    = useServerFn(createVideoAgentProject);
  const getFn       = useServerFn(getVideoAgentProject);
  const listFn      = useServerFn(listVideoAgentProjects);
  const updateFn    = useServerFn(updateVideoAgentProject);
  const genFreeFn   = useServerFn(generateVideoAgentPrevisPlate);
  const upgradeFn   = useServerFn(upgradeVideoAgentPlate);

  // ── State ───────────────────────────────────────────────────────────────

  const [plan, setPlan]             = useState<VideoPlan | null>(null);
  const [analyzing, setAnalyzing]   = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [lastIdea, setLastIdea]     = useState("");
  const [lastFormat, setLastFormat] = useState("16:9");

  // Active persisted project
  const [project, setProject]       = useState<VideoAgentProjectDto | null>(null);
  const projectRef = useRef<VideoAgentProjectDto | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Per-shot plate loading states: { [sceneId]: "generating" | "upgrading" }
  const [plateOps, setPlateOps]     = useState<Record<string, "generating" | "upgrading">>({});

  // Export
  const [exporting, setExporting]   = useState(false);

  // Restore area
  const [restoring, setRestoring]   = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"multishot" | "classic">("multishot");

  // Projects list
  const projectsQuery = useQuery({
    queryKey: ["previs-projects", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const refetchProjects = projectsQuery.refetch;
  const projects = (projectsQuery.data ?? []).filter((p) => p.scenes.length > 0);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth", search: authNextSearch() });
  }, [authLoading, user, navigate]);

  // ── Analyze brief → plan ──────────────────────────────────────────────

  async function handleAnalyze(idea: string, format: string) {
    setLastIdea(idea);
    setLastFormat(format);
    setAnalyzing(true);
    setAnalysisError(null);
    setPlan(null);
    setProject(null);
    setSelectedIdx(0);
    try {
      const result = await Promise.race([
        analyzeFn({ data: { userIdea: idea, format: format as "16:9" | "9:16" | "1:1" | "2.39:1" } }),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Shot planning is taking too long. Your brief is safe — retry when the agent is available.")),
            75_000,
          );
        }),
      ]);
      setPlan(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed — try again";
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Create project from plan ──────────────────────────────────────────

  async function handleCreateProject() {
    if (!plan || creating) return;
    setCreating(true);
    try {
      const input = planToProjectInput(plan, lastIdea);
      const created = await createFn({ data: input });
      setProject(created);
      queryClient.invalidateQueries({ queryKey: ["previs-projects", user?.id] });
      toast.success("Shot plan saved as a Video Agent project");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save project");
    } finally {
      setCreating(false);
    }
  }

  // ── Restore a previous project ────────────────────────────────────────

  async function handleRestore(p: VideoAgentProjectDto) {
    setRestoring(p.id);
    try {
      setProject(p);
      // Rebuild a plan stub from the project for the brief panel
      setPlan({
        brief: {
          title: p.title,
          logline: p.prompt,
          genre: p.style,
          mood: p.scenes[0]?.visualDirection ?? p.style,
          palette: [],
          references: [],
          motion_language: "Cinematic Minimal",
          format: p.scenes[0]?.aspectRatio ?? "16:9",
        },
        shots: p.scenes.map(sceneToShot),
      });
      setSelectedIdx(0);
      toast.success(`${p.title} restored`);
    } finally {
      setRestoring(null);
    }
  }

  // ── Update a single scene field ───────────────────────────────────────

  const updateSceneRef = useRef(updateFn);
  updateSceneRef.current = updateFn;
  const getProjectRef = useRef(getFn);
  getProjectRef.current = getFn;
  projectRef.current = project;

  const handleFieldChange = useCallback(
    async (sceneId: string, field: string, value: string | number) => {
      const current = projectRef.current;
      if (!current) return;
      const nextScenes = current.scenes.map((s) =>
        s.id === sceneId ? { ...s, [field]: value } : s,
      );
      const optimistic = { ...current, scenes: nextScenes };
      projectRef.current = optimistic;
      setProject(optimistic);
      try {
        const updated = await updateSceneRef.current({
          data: { id: current.id, scenes: nextScenes, expectedVersion: current.version },
        });
        projectRef.current = updated;
        setProject(updated);
      } catch (err) {
        toast.error("Save failed — " + (err instanceof Error ? err.message : "unknown error"));
        void getProjectRef.current({ data: { id: current.id } }).then((latest) => {
          projectRef.current = latest;
          setProject(latest);
        }).catch(() => refetchProjects());
      }
    },
    [refetchProjects],
  );

  // ── Reorder shots ─────────────────────────────────────────────────────

  async function moveShot(fromIdx: number, toIdx: number) {
    if (!project) return;
    const scenes = [...project.scenes];
    const [moved] = scenes.splice(fromIdx, 1);
    scenes.splice(toIdx, 0, moved);
    const reindexed = scenes.map((s, i) => ({ ...s, index: i }));
    const optimistic = { ...project, scenes: reindexed };
    setProject(optimistic);
    setSelectedIdx(toIdx);
    try {
      const updated = await updateFn({ data: { id: project.id, scenes: reindexed, expectedVersion: project.version } });
      setProject(updated);
    } catch (err) {
      toast.error("Reorder failed");
      setProject(project);
      setSelectedIdx(fromIdx);
    }
  }

  // ── Add a shot ────────────────────────────────────────────────────────

  async function addShot() {
    if (!project) return;
    const newScene: SceneDraft = {
      id: vaUid(),
      index: project.scenes.length,
      title: `Shot ${project.scenes.length + 1}`,
      script: "Describe the action and blocking for this shot.",
      description: "A cinematic production keyframe for the new shot.",
      duration: 5,
      frame: null,
      frameStatus: "idle",
      purpose: "context",
      shotType: "MEDIUM",
      modelPrompt: "Cinematic production keyframe, medium shot, natural performance, coherent lighting.",
      negativePrompt: "warped face, extra fingers, text overlays, watermark",
    };
    const nextScenes = [...project.scenes, newScene];
    const optimistic = { ...project, scenes: nextScenes };
    setProject(optimistic);
    setSelectedIdx(nextScenes.length - 1);
    try {
      const updated = await updateFn({ data: { id: project.id, scenes: nextScenes, expectedVersion: project.version } });
      setProject(updated);
    } catch (err) {
      toast.error("Could not add shot");
      setProject(project);
    }
  }

  // ── Remove a shot ─────────────────────────────────────────────────────

  async function removeShot(sceneId: string) {
    if (!project || project.scenes.length <= 1) return;
    const nextScenes = project.scenes
      .filter((s) => s.id !== sceneId)
      .map((s, i) => ({ ...s, index: i }));
    const optimistic = { ...project, scenes: nextScenes };
    setProject(optimistic);
    setSelectedIdx((idx) => Math.max(0, idx - 1));
    try {
      const updated = await updateFn({ data: { id: project.id, scenes: nextScenes, expectedVersion: project.version } });
      setProject(updated);
    } catch (err) {
      toast.error("Could not remove shot");
      setProject(project);
    }
  }

  // ── Generate free plate ───────────────────────────────────────────────

  async function handleGenerateFree(sceneId: string) {
    if (!project) return;
    setPlateOps((prev) => ({ ...prev, [sceneId]: "generating" }));
    try {
      const result = await genFreeFn({ data: { id: project.id, sceneId } });
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === sceneId ? { ...s, frame: result.url, frameStatus: "done" } : s,
          ),
        };
      });
      toast.success("Free previs plate ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plate generation failed");
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === sceneId ? { ...s, frameStatus: "error" } : s,
          ),
        };
      });
    } finally {
      setPlateOps((prev) => {
        const next = { ...prev };
        delete next[sceneId];
        return next;
      });
    }
  }

  // ── Upgrade plate (premium) ───────────────────────────────────────────

  async function handleUpgrade(sceneId: string) {
    if (!project) return;
    if (!window.confirm(`Upgrade this plate for ${PREVIS_PLATE_COST} Aura? This uses the paid image pipeline.`)) {
      return;
    }
    setPlateOps((prev) => ({ ...prev, [sceneId]: "upgrading" }));
    try {
      const result = await upgradeFn({ data: { id: project.id, sceneId } });
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === sceneId ? { ...s, frame: result.url, frameStatus: "done" } : s,
          ),
        };
      });
      toast.success(`Premium plate rendered — ${result.cost} Aura used`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plate upgrade failed");
    } finally {
      setPlateOps((prev) => {
        const next = { ...prev };
        delete next[sceneId];
        return next;
      });
    }
  }

  // ── Export ────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!project) return;
    setExporting(true);
    try {
      // Build export package
      const { zipSync, strToU8 } = await import("fflate");

      const files: Record<string, Uint8Array> = {};
      const shots = project.scenes;

      // storyboard.md
      const lines: string[] = [
        `# ${project.title}`,
        ``,
        `Prompt: ${project.prompt}`,
        `Style: ${project.style} | Duration: ${project.targetDuration}s`,
        ``,
      ];
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i];
        lines.push(
          `## ${String(i + 1).padStart(2, "0")} · ${s.title}`,
          `- Purpose: ${s.purpose ?? "—"}`,
          `- Shot type: ${s.shotType ?? "—"}`,
          `- Duration: ${s.duration}s`,
          `- Camera: ${s.camera ?? "—"}${s.lensMm ? ` · ${s.lensMm}mm` : ""}`,
          `- Lighting: ${s.lighting ?? "—"}`,
          `- Action: ${s.script}`,
          `- Model prompt: ${s.modelPrompt ?? s.description}`,
          `- Negative prompt: ${s.negativePrompt ?? "—"}`,
          `- Plate: ${s.frame ?? "(not generated)"}`,
          ``,
        );
      }
      files["storyboard.md"] = strToU8(lines.join("\n"));

      // project.json
      files["project.json"] = strToU8(JSON.stringify(project, null, 2));

      // shots.csv
      const csvHeader = "index,id,title,purpose,shot_type,duration_s,camera,lens_mm,lighting,model_prompt,negative_prompt,frame_url";
      const csvRows = shots.map((s, i) =>
        [
          i + 1, s.id, s.title, s.purpose ?? "", s.shotType ?? "", s.duration,
          s.camera ?? "", s.lensMm ?? "", s.lighting ?? "",
          s.modelPrompt ?? s.description, s.negativePrompt ?? "", s.frame ?? "",
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      );
      files["shots.csv"] = strToU8([csvHeader, ...csvRows].join("\n"));

      // prompts.txt
      const promptLines = shots.map((s, i) =>
        `${String(i + 1).padStart(2, "0")} ${s.title}\nimage: ${s.modelPrompt ?? s.description}\nnegative: ${s.negativePrompt ?? "—"}\n`,
      );
      files["prompts.txt"] = strToU8(promptLines.join("\n"));

      // Download plates as blobs
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i];
        if (!s.frame) continue;
        try {
          const res = await fetch(s.frame);
          if (!res.ok) continue;
          const buf = new Uint8Array(await res.arrayBuffer());
          const type = res.headers.get("content-type") ?? "";
          const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
          files[`plates/${String(i + 1).padStart(2, "0")}-${s.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${ext}`] = buf;
        } catch {
          // plate unavailable — skip
        }
      }

      const zipped = zipSync(files, { level: 6 });
      const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${project.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "previs"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 2000);

      toast.success("Export package downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  // ── Reset (new brief) ─────────────────────────────────────────────────

  function handleNewProject() {
    setPlan(null);
    setProject(null);
    setSelectedIdx(0);
    setPlateOps({});
    setAnalysisError(null);
  }

  // ── Auth guard ─────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="previs-shell flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-prime" />
          <p className="text-xs text-ink-dim/50 uppercase tracking-widest">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (user && workspaceMode === "multishot") {
    return (
      <div className="previs-shell aurora-route-enter">
        <PrevisHeader
          onNewProject={() => undefined}
          exporting={false}
          hasProject={false}
        />
        <div className="mx-auto flex max-w-7xl gap-2 px-4 pt-4 md:px-8">
          <button type="button" className="previs-analyze-btn">Multishot</button>
          <button type="button" className="previs-plate-action-btn" onClick={() => setWorkspaceMode("classic")}>
            Classic previs
          </button>
        </div>
        <MultishotStudio userId={user.id} />
      </div>
    );
  }

  // ── Shots (from project or plan) ──────────────────────────────────────

  const activeShots: VideoShot[] = project
    ? project.scenes.map(sceneToShot)
    : (plan?.shots ?? []);
  const activeFormat = project
    ? (plan?.brief?.format ?? lastFormat)
    : (plan?.brief?.format ?? lastFormat);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="previs-shell aurora-route-enter">
      {/* Sticky header */}
      <PrevisHeader
        onNewProject={handleNewProject}
        onExport={project ? handleExport : undefined}
        exporting={exporting}
        hasProject={!!project}
      />
      <div className="mx-auto flex max-w-7xl gap-2 px-4 pt-4 md:px-8">
        <button type="button" className="previs-plate-action-btn" onClick={() => setWorkspaceMode("multishot")}>
          Multishot
        </button>
        <button type="button" className="previs-analyze-btn">Classic previs</button>
      </div>

      <div className="previs-layout">
        {/* ── Left: main workspace ── */}
        <main>
          {/* Brief form — shown until analysis or project loaded */}
          {!plan && !analyzing && (
            <BriefForm onAnalyze={handleAnalyze} loading={analyzing} />
          )}
          {analysisError && !analyzing && !plan && (
            <div className="previs-error-state mb-4" role="alert">
              <AlertCircle className="size-4 shrink-0 text-rec" />
              <div>
                <p className="text-xs font-semibold text-rec">Shot planning did not finish</p>
                <p className="mt-1 text-xs text-ink-dim">{analysisError}</p>
              </div>
            </div>
          )}

          {/* Analyzing skeleton */}
          {analyzing && (
            <div className="flex flex-col gap-3 mb-6">
              <div className="previs-badge w-fit">Analyzing brief…</div>
              <div className="previs-skeleton h-8 w-2/3" />
              <div className="previs-skeleton h-4 w-full" />
              <div className="previs-skeleton h-4 w-4/5" />
              <div className="flex gap-2 mt-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="previs-skeleton h-32 flex-1 rounded-xl" />
                ))}
              </div>
            </div>
          )}

          {/* Plan / project workspace */}
          {(plan || project) && !analyzing && (
            <div className="flex flex-col gap-4">
              {/* Plan loaded — create project CTA */}
              {plan && !project && (
                <div className="flex items-center justify-between gap-3 flex-wrap border border-line/30 rounded-xl bg-panel/30 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-ink-dim/70 uppercase tracking-widest">Shot plan ready</p>
                    <p className="text-sm text-ink mt-0.5">{plan.shots?.length ?? 0} shots · {(plan.shots ?? []).reduce((s, shot) => s + shot.duration_s, 0)}s total</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateProject()}
                    disabled={creating}
                    className="previs-analyze-btn"
                    data-testid="button-save-project"
                  >
                    {creating ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
                    Save to Video Agent
                  </button>
                </div>
              )}

              {/* Sequence timeline */}
              {activeShots.length > 0 && (
                <SequenceBar
                  shots={activeShots}
                  selectedIndex={selectedIdx}
                  onSelectShot={setSelectedIdx}
                  format={activeFormat}
                />
              )}

              {/* Shot list */}
              <div>
                <div className="previs-section-heading">
                  <h2 className="previs-section-title">
                    {activeShots.length} shots
                    {project ? " — editable" : " — review plan"}
                  </h2>
                  {project && (
                    <button
                      type="button"
                      onClick={() => void addShot()}
                      className="previs-add-shot-btn"
                      style={{ width: "auto", padding: "4px 12px", fontSize: "11px" }}
                      data-testid="button-add-shot"
                    >
                      <Plus className="size-3" /> Add shot
                    </button>
                  )}
                </div>

                <div className="previs-shots-list">
                  {activeShots.map((shot, i) => {
                    const scene = project?.scenes[i];
                    const plateOp = scene ? plateOps[scene.id] : undefined;
                    return (
                      <div key={shot.id ?? i} className="relative">
                        {/* Reorder controls */}
                        {project && activeShots.length > 1 && (
                          <div className="previs-reorder-controls absolute right-2 top-2 z-10">
                            <button
                              type="button"
                              disabled={i === 0}
                              onClick={() => void moveShot(i, i - 1)}
                              className="previs-reorder-btn"
                              aria-label="Move shot up"
                            >
                              <ChevronUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              disabled={i === activeShots.length - 1}
                              onClick={() => void moveShot(i, i + 1)}
                              className="previs-reorder-btn"
                              aria-label="Move shot down"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (scene) void removeShot(scene.id);
                              }}
                              className="previs-reorder-btn"
                              aria-label="Remove shot"
                              style={{ color: "oklch(0.62 0.18 24)" }}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        )}
                        <ShotCard
                          shot={shot}
                          index={i}
                          projectId={project?.id ?? ""}
                          sceneId={scene?.id ?? shot.id ?? String(i)}
                          frame={scene?.frame ?? null}
                          frameStatus={scene?.frameStatus}
                          isSelected={selectedIdx === i}
                          onClick={() => setSelectedIdx(selectedIdx === i ? -1 : i)}
                          onGenerateFree={async () => {
                            if (!scene || !project) return;
                            await handleGenerateFree(scene.id);
                          }}
                          onUpgradePremium={async () => {
                            if (!scene || !project) return;
                            await handleUpgrade(scene.id);
                          }}
                          onFieldChange={(field, value) => {
                            if (scene) void handleFieldChange(scene.id, field, value);
                          }}
                          previsPlatesCost={PREVIS_PLATE_COST}
                          generatingFree={plateOp === "generating"}
                          upgradingPremium={plateOp === "upgrading"}
                        />
                      </div>
                    );
                  })}

                  {project && (
                    <button
                      type="button"
                      onClick={() => void addShot()}
                      className="previs-add-shot-btn"
                      data-testid="button-add-shot-bottom"
                    >
                      <Plus className="size-3.5" />
                      Add another shot
                    </button>
                  )}
                </div>
              </div>

              {/* Re-analyze option */}
              {plan && !project && (
                <button
                  type="button"
                  onClick={() => { setPlan(null); }}
                  className="previs-plate-action-btn mx-auto"
                  style={{ fontSize: "11px", gap: "0.4rem" }}
                >
                  <RefreshCw className="size-3" /> Change brief
                </button>
              )}
            </div>
          )}

          {/* Previous projects (shown only on empty state) */}
          {!plan && !analyzing && projects.length > 0 && (
            <div className="mt-6">
              <div className="previs-section-heading">
                <h2 className="previs-section-title">Previous projects</h2>
              </div>
              {projectsQuery.isLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((n) => <div key={n} className="previs-skeleton h-14 w-full rounded-xl" />)}
                </div>
              ) : projectsQuery.isError ? (
                <div className="previs-error-state">
                  <AlertCircle className="size-4 text-rec" />
                  <p className="text-xs text-rec">Could not load projects</p>
                </div>
              ) : (
                <div className="previs-projects-list">
                  {projects.slice(0, 8).map((p) => (
                    <ProjectRestoreCard
                      key={p.id}
                      project={p}
                      onRestore={handleRestore}
                      loading={restoring === p.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Right sidebar ── */}
        <aside className="flex flex-col gap-0">
          {/* Brief panel */}
          {plan && <BriefPanel plan={plan} />}

          {/* Handoff panel */}
          {(plan || project) && (
            <HandoffPanel
              project={project}
              onExport={handleExport}
              exporting={exporting}
            />
          )}

          {/* Empty sidebar hint */}
          {!plan && !project && (
            <div className="previs-empty-state" style={{ paddingTop: "3rem" }}>
              <Film className="size-8 text-ink-dim/15" />
              <p className="text-xs text-ink-dim/40 leading-relaxed text-center max-w-48">
                Describe a concept above — Aurora will plan the shots, direction, and palette.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
