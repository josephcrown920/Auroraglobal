import { createLazyFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download, Film, Loader2, Plus, Trash2, Wand2, LinkIcon,
  CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Eye, Pencil, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  getVideoAgentProject,
  updateVideoAgentProject,
  enqueueVideoAgentRender,
  upgradeVideoAgentPlate,
  VIDEO_AGENT_RENDER_COST,
  PREVIS_PLATE_COST,
  type VideoAgentProjectDto,
} from "@/lib/video-agent-projects.functions";
import { vaUid } from "@/lib/video-agent-shared";

export const Route = createLazyFileRoute("/video-agent-edit")({
  component: VideoEditor,
});

type SceneDraft = VideoAgentProjectDto["scenes"][number];
type Draft = { title: string; scenes: SceneDraft[] };

function sceneProblem(scenes: SceneDraft[]): string | null {
  if (!scenes.length) return "Add at least one scene before rendering";
  for (const s of scenes) {
    if (!s.script.trim()) return `Scene ${s.index + 1} ("${s.title}") needs narration text`;
    if (!s.description.trim()) return `Scene ${s.index + 1} ("${s.title}") needs a visual description`;
  }
  return null;
}

function sanitizeForSave(scenes: SceneDraft[]): SceneDraft[] {
  return scenes.slice(0, 12).map((s, i) => ({
    ...s,
    index: i,
    title: s.title.trim().slice(0, 160) || `Scene ${i + 1}`,
    script: s.script.trim().slice(0, 2400),
    description: s.description.trim().slice(0, 3000),
    duration: Math.max(3, Math.min(15, Math.round(s.duration) || 6)),
    frame: s.frame || null,
  }));
}

function VideoEditor() {
  const { id } = useSearch({ from: "/video-agent-edit" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const getProject = useServerFn(getVideoAgentProject);
  const updateProject = useServerFn(updateVideoAgentProject);
  const enqueueRender = useServerFn(enqueueVideoAgentRender);
  const upgradePlate = useServerFn(upgradeVideoAgentPlate);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "blocked" | "error">("idle");
  const [rendering, setRendering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [upgradeId, setUpgradeId] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const projectQuery = useQuery({
    queryKey: ["video-agent-project", id],
    queryFn: () => getProject({ data: { id } }),
    enabled: !!user && !!id,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "processing" ? 4000 : false;
    },
  });
  const project = projectQuery.data ?? null;
  const renderActive = project?.status === "queued" || project?.status === "processing";

  // Server state is the source of truth; local draft only diverges while the
  // user has unsaved edits. During an active render, editing is disabled so
  // every poll refresh (live status_message) flows straight through.
  useEffect(() => {
    if (!project) return;
    if (!dirtyRef.current) {
      setDraft({ title: project.title, scenes: project.scenes.map((s) => ({ ...s })) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectQuery.data]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  async function persistDraft(next: Draft): Promise<VideoAgentProjectDto | null> {
    if (sceneProblem(next.scenes)) {
      setSaveState("blocked");
      return null;
    }
    setSaveState("saving");
    try {
      const saved = await updateProject({
        data: {
          id,
          title: next.title.trim().slice(0, 160) || "Untitled Video",
          scenes: sanitizeForSave(next.scenes),
        },
      });
      dirtyRef.current = false;
      queryClient.setQueryData(["video-agent-project", id], saved);
      setSaveState("saved");
      return saved;
    } catch (err) {
      setSaveState("error");
      throw err;
    }
  }

  function scheduleSave(next: Draft) {
    dirtyRef.current = true;
    setDraft(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistDraft(next).catch(() => {
        /* surfaced via saveState; next edit retries */
      });
    }, 800);
  }

  function updateScene(sceneId: string, patch: Partial<SceneDraft>) {
    if (!draft || renderActive) return;
    scheduleSave({
      ...draft,
      scenes: draft.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    });
  }

  function updateTitle(title: string) {
    if (!draft || renderActive) return;
    scheduleSave({ ...draft, title });
  }

  function addScene() {
    if (!draft || renderActive) return;
    if (draft.scenes.length >= 12) return toast.error("A video can have at most 12 scenes");
    const scene: SceneDraft = {
      id: vaUid(),
      index: draft.scenes.length,
      title: `Scene ${draft.scenes.length + 1}`,
      script: "",
      description: "",
      duration: 5,
      frame: null,
      frameStatus: "idle",
    };
    scheduleSave({ ...draft, scenes: [...draft.scenes, scene] });
    setSelectedIdx(draft.scenes.length);
  }

  function removeScene(sceneId: string) {
    if (!draft || renderActive) return;
    if (draft.scenes.length <= 1) return toast.error("A video needs at least one scene");
    scheduleSave({
      ...draft,
      scenes: draft.scenes.filter((s) => s.id !== sceneId).map((s, i) => ({ ...s, index: i })),
    });
    setSelectedIdx((idx) => Math.max(0, idx - 1));
  }

  async function regenFrame(scene: SceneDraft) {
    if (renderActive) return;
    if (!scene.description.trim()) return toast.error("Add a visual description first");
    setRegenId(scene.id);
    abortRef.current = new AbortController();
    updateScene(scene.id, { frameStatus: "loading" });

    const styleHints: Record<string, string> = {
      cinematic: "cinematic anamorphic, 35mm film grain",
      minimal: "clean minimal, soft light",
      vibrant: "vibrant, bold, energetic",
      documentary: "natural light, candid",
    };
    const styleHint = styleHints[project?.style ?? "cinematic"] ?? "cinematic";

    try {
      const frameRes = await fetch("/api/video-agent/generate-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${scene.description}. Style: ${styleHint}. Cinematic keyframe.` }),
        signal: abortRef.current.signal,
      });
      if (!frameRes.ok) throw new Error(`Frame generation failed: ${frameRes.status}`);
      const { url } = (await frameRes.json()) as { url: string };
      updateScene(scene.id, { frame: url, frameStatus: "done" });
      toast.success("Frame regenerated");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error((err as Error).message);
        updateScene(scene.id, { frameStatus: "error" });
      }
    } finally {
      setRegenId(null);
    }
  }

  async function upgradePlateNow(scene: SceneDraft) {
    if (renderActive || upgradeId) return;
    if (!scene.description.trim()) return toast.error("Add a visual description first");
    // Flush any pending edits so the server upgrades the current description.
    if (draft && dirtyRef.current) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const saved = await persistDraft(draft).catch(() => null);
      if (!saved) return toast.error("Fix the storyboard before upgrading");
    }
    setUpgradeId(scene.id);
    updateScene(scene.id, { frameStatus: "loading" });
    try {
      const res = await upgradePlate({ data: { id, sceneId: scene.id } });
      updateScene(scene.id, { frame: res.url, frameStatus: "done" });
      dirtyRef.current = false;
      await projectQuery.refetch();
      toast.success(`Premium plate rendered — ${res.cost} Aura`);
    } catch (err) {
      const msg = (err as Error).message;
      updateScene(scene.id, { frameStatus: "error" });
      if (/aura|credit/i.test(msg)) {
        toast.error(msg, { action: { label: "Top up", onClick: () => void navigate({ to: "/billing" }) } });
      } else {
        toast.error(msg);
      }
    } finally {
      setUpgradeId(null);
    }
  }

  async function startRender() {
    if (!draft || renderActive || rendering) return;
    const problem = sceneProblem(draft.scenes);
    if (problem) return toast.error(problem);
    setRendering(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current) {
        const saved = await persistDraft(draft);
        if (!saved) throw new Error("Fix the storyboard before rendering");
      }
      const res = await enqueueRender({ data: { id } });
      toast.success(`Render started — ${res.cost} Aura reserved. Safe to close this page.`);
      await projectQuery.refetch();
    } catch (err) {
      const msg = (err as Error).message;
      if (/aura|credit/i.test(msg)) {
        toast.error(msg, {
          action: { label: "Top up", onClick: () => void navigate({ to: "/billing" }) },
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setRendering(false);
    }
  }

  async function downloadResult(url: string, title: string) {
    // The result lives in storage on another origin — a bare <a download> is
    // silently ignored cross-origin, so pull it through a Blob.
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${title.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "aurora-video"}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function copyResultLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Video link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  if (authLoading || !user || projectQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projectQuery.isError || !project || !draft) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-xl p-10 text-center max-w-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Project not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            It may belong to another account, or it was created before projects were saved to your account.
          </p>
          <Button className="mt-5" onClick={() => navigate({ to: "/video-agent" })}>
            Create new video
          </Button>
        </div>
      </div>
    );
  }

  const selectedScene = draft.scenes[Math.min(selectedIdx, draft.scenes.length - 1)];
  const saveLabel =
    saveState === "saving" ? "Saving…"
    : saveState === "saved" ? "Saved"
    : saveState === "blocked" ? "Not saved — every scene needs narration + visuals"
    : saveState === "error" ? "Save failed — edit again to retry"
    : "";

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 h-11 px-4 border-b border-border/50 glass flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/video-agent" })}
          className="gap-1 text-muted-foreground h-7 px-2 text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Video Agent
        </Button>
        <div className="w-px h-4 bg-border" />
        <Input
          value={draft.title}
          onChange={(e) => updateTitle(e.target.value)}
          maxLength={160}
          disabled={renderActive}
          className="h-7 w-52 text-sm font-medium glass border-transparent focus:border-border"
        />
        <div className="flex-1" />
        {saveLabel && (
          <span className={`text-[11px] hidden md:block ${saveState === "blocked" || saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            {saveLabel}
          </span>
        )}
        <div className="w-px h-4 bg-border hidden sm:block" />
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={startRender}
          disabled={renderActive || rendering}
        >
          {renderActive || rendering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {renderActive
            ? "Rendering…"
            : project.status === "succeeded"
              ? `Re-render · ${VIDEO_AGENT_RENDER_COST}✦`
              : `Render video · ${VIDEO_AGENT_RENDER_COST}✦`}
        </Button>
      </div>

      {/* Render status band */}
      {renderActive && (
        <div className="flex items-center gap-2.5 border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs flex-shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />
          <span className="font-medium text-primary">{project.statusMessage}</span>
          <span className="text-muted-foreground hidden sm:inline">
            — the render runs on our servers, you can safely close this page.
          </span>
        </div>
      )}
      {project.status === "failed" && (
        <div className="flex items-center gap-2.5 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs flex-shrink-0">
          <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          <span className="min-w-0 truncate text-destructive" title={project.error ?? undefined}>
            {project.statusMessage}{project.error ? ` · ${project.error}` : ""}
          </span>
          <Button size="sm" variant="secondary" className="ml-auto h-6 px-2 text-[11px] flex-shrink-0" onClick={startRender} disabled={rendering}>
            Try again · {VIDEO_AGENT_RENDER_COST}✦
          </Button>
        </div>
      )}

      {/* Final result */}
      {project.status === "succeeded" && project.exportUrl && (
        <div className="border-b border-border/50 bg-card/30 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-primary mb-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Final video ready
            <span className="text-muted-foreground">— edit the storyboard below and re-render anytime.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <video
              src={project.exportUrl}
              poster={project.thumbnailUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="h-36 rounded-lg border border-border/50 bg-black"
            />
            <div className="flex flex-col gap-2">
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => void downloadResult(project.exportUrl!, draft.title)} disabled={downloading}>
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download MP4
              </Button>
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs" onClick={() => void copyResultLink(project.exportUrl!)}>
                <LinkIcon className="h-3.5 w-3.5" /> Copy link
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scene strip / storyboard */}
      <div className="flex-shrink-0 border-b border-border/50 bg-background/60 px-4 py-2.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {draft.scenes.map((sc, i) => (
            <button
              key={sc.id}
              onClick={() => setSelectedIdx(i)}
              aria-label={`Scene ${i + 1}: ${sc.title}`}
              className={`flex-shrink-0 relative rounded-md overflow-hidden transition-all border ${
                i === selectedIdx
                  ? "border-primary ring-1 ring-primary/60"
                  : "border-border/40 hover:border-border/80 opacity-60 hover:opacity-100"
              }`}
              style={{ width: `${Math.max(72, sc.duration * 12)}px` }}
            >
              <div className="aspect-video bg-muted/30 relative">
                {sc.frame ? (
                  <img src={sc.frame} alt={sc.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    {sc.frameStatus === "loading" ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : (
                      <Film className="h-3 w-3 text-muted-foreground/30" />
                    )}
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-0.5">
                  <div className="text-[8px] text-white/80 truncate">{sc.title}</div>
                </div>
                {sc.frameStatus === "done" && (
                  <CheckCircle2 className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-primary" />
                )}
              </div>
            </button>
          ))}
          <button
            onClick={addScene}
            disabled={renderActive}
            className="flex-shrink-0 w-14 aspect-video rounded-md border border-dashed border-border/50 hover:border-primary/50 flex items-center justify-center transition disabled:opacity-40"
            aria-label="Add scene"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Main editor */}
      {selectedScene ? (
        <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_340px] overflow-hidden">
          {/* Preview panel */}
          <div className="relative flex flex-col min-h-0 bg-background/20 p-4 gap-3">
            <div className="flex gap-1 self-start">
              {(["preview", "edit"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "preview" ? <Eye className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 glass rounded-xl overflow-hidden relative">
              {selectedScene.frame ? (
                <img
                  src={selectedScene.frame}
                  alt={selectedScene.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Film className="h-10 w-10 opacity-20" />
                  <span className="text-xs">No frame yet — describe the scene and regenerate</span>
                </div>
              )}

              <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between">
                <Button size="sm" variant="secondary" className="h-7 w-7 p-0 glass"
                  disabled={selectedIdx === 0} onClick={() => setSelectedIdx(selectedIdx - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs glass px-2 py-0.5 rounded">
                  {Math.min(selectedIdx, draft.scenes.length - 1) + 1} / {draft.scenes.length}
                </span>
                <Button size="sm" variant="secondary" className="h-7 w-7 p-0 glass"
                  disabled={selectedIdx >= draft.scenes.length - 1}
                  onClick={() => setSelectedIdx(selectedIdx + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Scene edit panel */}
          <div className="border-l border-border/50 flex flex-col overflow-y-auto">
            <div className="flex-1 p-4 space-y-5">
              <div className="flex items-center gap-2">
                <Input
                  value={selectedScene.title}
                  onChange={(e) => updateScene(selectedScene.id, { title: e.target.value })}
                  maxLength={160}
                  disabled={renderActive}
                  className="font-medium glass text-sm"
                  placeholder="Scene title"
                />
                <Button size="sm" variant="ghost"
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  disabled={renderActive}
                  onClick={() => removeScene(selectedScene.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                  Voice-over
                </label>
                <Textarea
                  value={selectedScene.script}
                  onChange={(e) => updateScene(selectedScene.id, { script: e.target.value })}
                  placeholder="What the narrator says in this scene…"
                  maxLength={2400}
                  disabled={renderActive}
                  className="h-24 resize-none glass text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                  What the camera sees
                </label>
                <Textarea
                  value={selectedScene.description}
                  onChange={(e) => updateScene(selectedScene.id, { description: e.target.value })}
                  placeholder="Describe the shot: subject, setting, lighting, motion…"
                  maxLength={3000}
                  disabled={renderActive}
                  className="h-20 resize-none glass text-sm"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" className="w-full gap-1.5 text-xs"
                    onClick={() => void regenFrame(selectedScene)}
                    disabled={regenId === selectedScene.id || renderActive || upgradeId === selectedScene.id}>
                    {regenId === selectedScene.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    Free plate
                  </Button>
                  <Button size="sm" className="w-full gap-1.5 text-xs"
                    onClick={() => void upgradePlateNow(selectedScene)}
                    disabled={upgradeId === selectedScene.id || renderActive || regenId === selectedScene.id}>
                    {upgradeId === selectedScene.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Upgrade · {PREVIS_PLATE_COST}✦
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  Previs Pro — free plates are instant sketches. Upgrade renders a hero-quality plate through the paid pipeline.
                </p>
              </div>
            </div>

            <div className="border-t border-border/50 p-3 flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1 gap-1.5 text-xs"
                onClick={() => navigate({ to: "/video-agent" })}>
                New video
              </Button>
              <Button size="sm" className="flex-1 gap-1.5 text-xs"
                onClick={startRender} disabled={renderActive || rendering}>
                {renderActive || rendering ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {renderActive ? "Rendering…" : `Render · ${VIDEO_AGENT_RENDER_COST}✦`}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Film className="mx-auto h-8 w-8 opacity-20 mb-3" />
            <p className="text-sm">No scenes yet — add one to get started.</p>
            <Button className="mt-4 gap-1.5" onClick={addScene} disabled={renderActive}>
              <Plus className="h-4 w-4" /> Add scene
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
