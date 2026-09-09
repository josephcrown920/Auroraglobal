import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCircle2, Clapperboard, Download, ExternalLink, Film, Loader2, LockKeyhole, Save } from "lucide-react";
import { toast } from "sonner";
import { authNextSearch } from "@/lib/auth-return-path";
import { useAuth } from "@/hooks/use-auth";
import {
  adoptFilmStudioPlan,
  approveFilmStudioRender,
  getVideoAgentProject,
  updateFilmStudioContinuity,
  type FilmPlanRecord,
} from "@/lib/video-agent-projects.functions";
import { reviseCinematicPlan } from "@/lib/video-agent.functions";
import type { VideoPlan } from "@/lib/video-agent-skills";

type PlannerMetadata = FilmPlanRecord["planner"];
type Continuity = FilmPlanRecord["continuity"];
type FilmPlanEnvelope = VideoPlan & {
  continuity?: Partial<Continuity>;
  planner?: Partial<PlannerMetadata>;
  metadata?: {
    planner?: string;
    provider?: string;
    model?: string;
    modelKey?: string;
    plannerVersion?: string;
    generatedAt?: string;
  };
};

type RenderAspect = FilmPlanRecord["renderPlan"]["aspectRatio"];
const SUPPORTED_RENDER_ASPECTS: RenderAspect[] = ["16:9", "9:16", "1:1"];

const REFERENCE_IMAGES = [
  { src: "/prime/shot-neon-face.jpg", label: "Lighting reference" },
  { src: "/prime/shot-highway.jpg", label: "Scale reference" },
  { src: "/prime/shot-chef.jpg", label: "Blocking reference" },
] as const;

function scriptFromPlan(plan: FilmPlanEnvelope): string {
  if (!plan.screenplay) return "";
  return [
    plan.screenplay.synopsis,
    ...plan.screenplay.beats.map((beat) => [
      `${beat.timing} · ${beat.visual}`,
      beat.action,
      beat.dialogue ? `Dialogue: ${beat.dialogue}` : "",
      beat.voiceover ? `Voice-over: ${beat.voiceover}` : "",
      beat.audio ? `Audio: ${beat.audio}` : "",
    ].filter(Boolean).join("\n")),
  ].join("\n\n");
}

function plannerFromPlan(plan: FilmPlanEnvelope): PlannerMetadata | null {
  const source = plan.planner ?? plan.metadata;
  if (source?.planner && source.provider && source.model) {
    return {
      planner: source.planner,
      provider: source.provider,
      model: source.model,
      ...(source.modelKey ? { modelKey: source.modelKey } : {}),
      ...(source.plannerVersion ? { plannerVersion: source.plannerVersion } : {}),
      ...(source.generatedAt ? { generatedAt: source.generatedAt } : {}),
      provenanceTrust: "client-supplied",
    };
  }
  if (!plan.provenance?.provider || !plan.provenance.model) return null;
  return {
    planner: "film-planner",
    provider: plan.provenance.provider,
    model: plan.provenance.model,
    plannerVersion: plan.provenance.schema_version,
    generatedAt: plan.provenance.generated_at,
    fallbackCount: plan.provenance.fallback_count,
    latencyMs: plan.provenance.latency_ms,
    planningMode: plan.provenance.planning_mode,
    provenanceTrust: "client-supplied",
  };
}

function initialContinuity(plan: FilmPlanEnvelope): Continuity {
  const ledger = plan.continuity_ledger;
  return {
    identityAnchor: plan.continuity?.identityAnchor ?? ledger?.identity.join("\n") ?? plan.brief?.identity_anchor ?? "",
    wardrobe: plan.continuity?.wardrobe ?? ledger?.wardrobe.join("\n") ?? "",
    environment: plan.continuity?.environment ?? [
      ...(ledger?.location ?? []),
      ...(ledger?.time ?? []),
      ...(ledger?.props ?? []),
    ].join("\n"),
    cameraRules: plan.continuity?.cameraRules ?? [
      ...(ledger?.screen_direction ?? []),
      plan.direction?.camera_movement ?? "",
    ].filter(Boolean).join("\n"),
    colorRules: plan.continuity?.colorRules ?? [
      ...(ledger?.lighting ?? []),
      plan.brief?.mood ?? "",
    ].filter(Boolean).join("\n"),
  };
}

export function FilmStudioPlan({
  plan,
  idea,
  onPlanChange,
}: {
  plan: VideoPlan;
  idea: string;
  onPlanChange: (plan: VideoPlan) => void;
}) {
  const envelope = plan as FilmPlanEnvelope;
  const { user } = useAuth();
  const navigate = useNavigate();
  const adoptFn = useServerFn(adoptFilmStudioPlan);
  const getFn = useServerFn(getVideoAgentProject);
  const saveContinuityFn = useServerFn(updateFilmStudioContinuity);
  const approveFn = useServerFn(approveFilmStudioRender);
  const reviseFn = useServerFn(reviseCinematicPlan);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revisionRequest, setRevisionRequest] = useState("");
  const [continuity, setContinuity] = useState<Continuity>(() => initialContinuity(envelope));
  const [renderAspect, setRenderAspect] = useState<RenderAspect | "">(
    SUPPORTED_RENDER_ASPECTS.includes(envelope.brief?.format as RenderAspect)
      ? envelope.brief!.format as RenderAspect
      : "",
  );
  const [resolution, setResolution] = useState<"480p" | "720p">("720p");

  useEffect(() => {
    setProjectId(null);
    setContinuity(initialContinuity(envelope));
    setRenderAspect(
      SUPPORTED_RENDER_ASPECTS.includes(envelope.brief?.format as RenderAspect)
        ? envelope.brief!.format as RenderAspect
        : "",
    );
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setProjectId(null);
  }, [user?.id]);

  const projectQuery = useQuery({
    queryKey: ["film-studio-project", user?.id, projectId],
    queryFn: () => getFn({ data: { id: projectId! } }),
    enabled: !!user && !!projectId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "processing" ? 4_000 : false;
    },
  });
  const project = projectQuery.data ?? null;
  const planner = plannerFromPlan(envelope);
  const displayPlanner = project?.filmPlan?.planner ?? planner;
  const script = scriptFromPlan(envelope);
  const shots = useMemo(() => envelope.shots ?? [], [envelope.shots]);
  const format = envelope.brief?.format ?? "16:9";
  const isApproved = !!project?.filmPlan?.renderApproval?.approved;
  const invalidDurationShots = shots.filter((shot) => !Number.isInteger(shot.duration_s) || shot.duration_s < 4 || shot.duration_s > 15);
  const planningBlocked = envelope.stages
    ? Object.values(envelope.stages).some((stage) => stage.status === "blocked")
    : false;
  const continuityDirty = !!project?.filmPlan &&
    JSON.stringify(continuity) !== JSON.stringify(project.filmPlan.continuity);

  const stages = useMemo(() => [
    { label: "Brief", done: envelope.stages ? envelope.stages.brief.status === "complete" : !!envelope.brief },
    { label: "Script", done: envelope.stages ? envelope.stages.script.status === "complete" : !!script || shots.every((shot) => !!shot.action) },
    { label: "Continuity", done: envelope.stages ? envelope.stages.continuity.status === "complete" : Object.values(continuity).some(Boolean) },
    { label: "Shot list", done: envelope.stages ? envelope.stages.shots.status === "complete" : shots.length > 0 },
    { label: "Render plan", done: envelope.stages ? envelope.stages.render_plan.status === "complete" : !!envelope.render_plan },
    { label: "Render", done: project?.status === "succeeded" },
    { label: "Assembly + export", done: !!project?.exportUrl },
  ], [continuity, envelope.brief, envelope.render_plan, envelope.stages, project?.exportUrl, project?.status, script, shots]);

  async function adopt() {
    if (!user) {
      await navigate({ to: "/auth", search: authNextSearch() });
      return;
    }
    if (!planner) {
      toast.error("Planner provenance is missing. Re-run analysis after the film planner metadata update.");
      return;
    }
    if (!renderAspect) {
      toast.error("Choose a Seedance-supported render aspect before adoption.");
      return;
    }
    if (invalidDurationShots.length) {
      toast.error("Revise shots to integer durations from 4–15 seconds before adoption.");
      return;
    }
    if (planningBlocked) {
      toast.error("Resolve blocked Film Planner stages before adopting this plan.");
      return;
    }
    if (!envelope.brief || !shots.length) return;
    setAdopting(true);
    try {
      const created = await adoptFn({
        data: {
          prompt: idea,
          originalPlan: plan,
          renderSettings: {
            rendererModel: "byteplus/seedance-2.5",
            aspectRatio: renderAspect,
            resolution,
            // Durable Film Studio assembly is currently verified at 24fps.
            fps: 24,
            generateAudio: true,
            watermark: false,
          },
        },
      });
      setProjectId(created.id);
      toast.success("Film plan adopted into a durable project");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not adopt film plan");
    } finally {
      setAdopting(false);
    }
  }

  async function revise() {
    const request = revisionRequest.trim();
    if (!request) return;
    if (project && !confirm("Revision creates a NEW PROJECT FORK. The adopted project and its approval will remain unchanged. Continue?")) return;
    setRevising(true);
    try {
      const revised = await reviseFn({ data: { previousPlan: plan, revisionRequest: request } });
      onPlanChange(revised);
      setRevisionRequest("");
      toast.success(project ? "New project fork created; the adopted project was not changed" : "Plan revised; review the new provenance and stages");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revise plan");
    } finally {
      setRevising(false);
    }
  }

  async function saveContinuity() {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await saveContinuityFn({
        data: { id: project.id, expectedVersion: project.version, continuity },
      });
      projectQuery.refetch();
      setContinuity(updated.filmPlan?.continuity ?? continuity);
      toast.success("Continuity saved; render approval reset");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save continuity");
      await projectQuery.refetch();
    } finally {
      setSaving(false);
    }
  }

  async function approveRender() {
    if (!project) return;
    if (continuityDirty) {
      toast.error("Save visible continuity changes before approving.");
      return;
    }
    setApproving(true);
    try {
      await approveFn({ data: { id: project.id, expectedVersion: project.version } });
      await projectQuery.refetch();
      toast.success("Current shot and continuity fingerprint approved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve render");
      await projectQuery.refetch();
    } finally {
      setApproving(false);
    }
  }

  function exportPlanJson() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${envelope.brief?.title?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "film-plan"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4" aria-label="Film studio production plan">
      <div className="overflow-hidden rounded-sm border border-line bg-panel/60">
        <div className="grid grid-cols-3">
          {REFERENCE_IMAGES.map((image) => (
            <figure key={image.src} className="relative aspect-video overflow-hidden border-r border-line last:border-r-0">
              <img src={image.src} alt={image.label} className="h-full w-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 px-2 pb-1.5 pt-6 text-[10px] font-bold uppercase tracking-widest text-white">
                Studio reference · {image.label}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-prime">Film Studio · production contract</p>
              <h3 className="mt-1 text-xl font-black uppercase text-ink">{envelope.brief?.title}</h3>
              <p className="mt-1 max-w-2xl text-sm italic text-ink-dim">{envelope.brief?.logline}</p>
            </div>
            <div className="rounded-sm border border-line bg-canvas/60 px-3 py-2 text-right text-[10px] uppercase tracking-wider text-ink-dim">
              {displayPlanner ? (
                <>
                  <div className="text-ink">{displayPlanner.planner} · {displayPlanner.provider}</div>
                  <div>{displayPlanner.modelKey ?? displayPlanner.model}</div>
                  <div>{displayPlanner.fallbackCount ?? 0} fallback{displayPlanner.fallbackCount === 1 ? "" : "s"} · {displayPlanner.planningMode ?? "full"}</div>
                  <div className={displayPlanner.provenanceTrust === "server-verified" ? "text-prime" : "text-amber-400"}>
                    {displayPlanner.provenanceTrust === "server-verified" ? "Signed provenance verified" : "Provenance transport unverified"}
                  </div>
                </>
              ) : (
                <div className="max-w-52 text-amber-400">Planner metadata unavailable · adoption blocked</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-line bg-panel/40 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-ink-dim">Revise with Film Planner</span>
            <input
              value={revisionRequest}
              onChange={(event) => setRevisionRequest(event.target.value)}
              placeholder={invalidDurationShots.length ? "Set every shot to an integer duration between 4 and 15 seconds." : "Describe one precise story, continuity, or shot change…"}
              className="w-full rounded-sm border border-line bg-canvas/60 px-3 py-2 text-xs text-ink focus:border-prime focus:outline-none"
            />
          </label>
          <button onClick={() => void revise()} disabled={revising || !revisionRequest.trim()} className="flex items-center gap-2 rounded-sm border border-prime/50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-prime disabled:opacity-40">
            {revising ? <Loader2 className="size-3.5 animate-spin" /> : <Clapperboard className="size-3.5" />} {project ? "Revise as new project fork" : "Revise plan"}
          </button>
          <button onClick={exportPlanJson} className="flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink">
            <Download className="size-3.5" /> Plan JSON
          </button>
        </div>
      </div>

      <div className="rounded-sm border border-line bg-panel/40 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-dim">Shot list · visual review</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((shot, index) => {
            const reference = REFERENCE_IMAGES[index % REFERENCE_IMAGES.length];
            return (
              <article key={shot.id} className="overflow-hidden rounded-sm border border-line bg-canvas/50">
                <figure className="relative aspect-video overflow-hidden">
                  <img src={reference.src} alt={`${shot.id} studio visual reference`} className="h-full w-full object-cover" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 px-2 pb-1 pt-5 text-[9px] uppercase tracking-wider text-white">Studio reference · not generated frame</figcaption>
                </figure>
                <div className="space-y-1 p-2">
                  <div className="flex justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-prime"><span>{shot.id} · {shot.purpose}</span><span>{shot.duration_s}s</span></div>
                  <p className="text-xs text-ink">{shot.shot_type} · {shot.lens_mm}mm · {shot.camera}</p>
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-ink-dim">{shot.prompt}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {stages.map((stage, index) => (
          <li key={stage.label} className="flex items-center gap-2 rounded-sm border border-line bg-panel/40 px-2.5 py-2">
            <span className={`grid size-5 place-items-center rounded-full border text-[10px] ${stage.done ? "border-prime/60 bg-prime/10 text-prime" : "border-line text-ink-dim"}`}>
              {stage.done ? <Check className="size-3" /> : index + 1}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink">{stage.label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-line bg-panel/40 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-dim">Script</p>
          <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink">
            {script || "The planner supplied per-shot action copy; each action will be preserved as its scene script."}
          </p>
        </div>
        <div className="rounded-sm border border-line bg-panel/40 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-dim">Render contract</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-ink-dim">Renderer</dt><dd className="text-ink">byteplus/seedance-2.5 · configured, live access unverified</dd>
            <dt className="text-ink-dim">Planner suggestion</dt><dd className="text-ink">{envelope.render_plan?.model ?? "Not supplied"}</dd>
            <dt className="text-ink-dim">Output</dt>
            <dd className="flex flex-wrap gap-2 text-ink">
              <select value={renderAspect} onChange={(event) => setRenderAspect(event.target.value as RenderAspect | "")} disabled={!!project} className="rounded-sm border border-line bg-canvas px-1.5 py-0.5">
                <option value="">Choose supported aspect</option>
                {SUPPORTED_RENDER_ASPECTS.map((aspect) => <option key={aspect} value={aspect}>{aspect}</option>)}
              </select>
              <select value={resolution} onChange={(event) => setResolution(event.target.value as "480p" | "720p")} disabled={!!project} className="rounded-sm border border-line bg-canvas px-1.5 py-0.5">
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
              <span>· 24fps</span>
            </dd>
            <dt className="text-ink-dim">Boundary</dt><dd className="text-ink">{isApproved ? "Approved fingerprint" : "Approval required before paid render"}</dd>
          </dl>
          {!renderAspect && <p className="mt-2 text-[11px] text-amber-400">{format} is not a native Seedance 2.5 aspect. Choose a supported aspect explicitly; Aurora will not silently convert it.</p>}
          {!!invalidDurationShots.length && <p className="mt-2 text-[11px] text-amber-400">Blocked: {invalidDurationShots.map((shot) => `${shot.id} (${shot.duration_s}s)`).join(", ")}. Native shots require integer durations from 4–15 seconds.</p>}
        </div>
      </div>

      {!!envelope.warnings?.length && (
        <div className="rounded-sm border border-amber-400/30 bg-amber-400/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Planner warnings · review before adoption</p>
          <ul className="mt-2 space-y-1">
            {envelope.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="text-xs leading-relaxed text-ink">
                <span className="font-bold uppercase text-amber-400">{warning.code}</span> · {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {envelope.continuity_ledger && (
        <div className="rounded-sm border border-line bg-panel/40 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-dim">Structured continuity ledger · preserved in project</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(envelope.continuity_ledger).map(([category, entries]) => (
              <div key={category}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-prime">{category.replace("_", " ")}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-dim">{entries.length ? entries.join(" · ") : "No anchor supplied"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-sm border border-line bg-panel/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-dim">{project ? "Adopted continuity · user edits" : "Planner-authored continuity · adopt before editing"}</p>
          {project && (
            <button onClick={() => void saveContinuity()} disabled={saving || project.status === "queued" || project.status === "processing"} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-prime disabled:opacity-40">
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save continuity
            </button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(continuity) as Array<keyof Continuity>).map((key) => (
            <label key={key} className={key === "identityAnchor" ? "sm:col-span-2" : ""}>
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-dim">{key.replace(/([A-Z])/g, " $1")}</span>
              <textarea
                rows={2}
                value={continuity[key]}
                onChange={(event) => setContinuity((value) => ({ ...value, [key]: event.target.value }))}
                disabled={!project || project.status === "queued" || project.status === "processing"}
                className="w-full resize-none rounded-sm border border-line bg-canvas/60 px-2.5 py-2 text-xs text-ink focus:border-prime focus:outline-none disabled:opacity-50"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!project ? (
          <button onClick={() => void adopt()} disabled={adopting || !planner || !envelope.brief || !shots.length || !renderAspect || !!invalidDurationShots.length || planningBlocked} className="flex items-center gap-2 rounded-sm bg-prime px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40">
            {adopting ? <Loader2 className="size-3.5 animate-spin" /> : <Clapperboard className="size-3.5" />}
            Adopt plan into project
          </button>
        ) : (
          <>
            <button onClick={() => void approveRender()} disabled={approving || isApproved || continuityDirty || project.status === "queued" || project.status === "processing"} className="flex items-center gap-2 rounded-sm border border-prime/50 bg-prime/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-prime disabled:opacity-50">
              {approving ? <Loader2 className="size-3.5 animate-spin" /> : isApproved ? <CheckCircle2 className="size-3.5" /> : <LockKeyhole className="size-3.5" />}
              {isApproved ? "Render boundary approved" : continuityDirty ? "Save continuity before approval" : "Approve current render plan"}
            </button>
            <Link to="/video-agent-edit" search={{ id: project.id }} className="flex items-center gap-2 rounded-sm bg-prime px-4 py-2 text-xs font-bold uppercase tracking-widest text-white no-underline">
              <Film className="size-3.5" /> Open project assembly <ExternalLink className="size-3" />
            </Link>
          </>
        )}
        {project && <span className="text-[10px] uppercase tracking-wider text-ink-dim">{project.statusMessage}</span>}
      </div>
    </section>
  );
}