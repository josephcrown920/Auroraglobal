import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Clapperboard,
  Film,
  ImagePlus,
  Loader2,
  MicOff,
  Music,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GeminiMultishotDirector } from "./GeminiMultishotDirector";
import {
  approveMultishotPreview,
  approveMultishotTemporalPreview,
  createMultishotProject,
  generateMultishotBatchPreviews,
  getMultishotCapabilities,
  listMultishotProjects,
  MULTISHOT_ENGINES,
  MULTISHOT_GOOGLE_VIDEO_COST,
  MULTISHOT_IMAGE_COST,
  MULTISHOT_VIDEO_COST,
  promoteMultishotShot,
  finalizeMultishotShot,
  retryMultishotPreview,
  updateMultishotShot,
  type MultishotProjectDto,
} from "@/lib/multishot.functions";

type DraftShot = { id: string; prompt: string; engine: typeof MULTISHOT_ENGINES.google.id | typeof MULTISHOT_ENGINES.modelark.id };

const newShot = (index: number): DraftShot => ({
  id: crypto.randomUUID(),
  prompt: `Shot ${index + 1}: describe subject action, camera, composition, lighting, and continuity.`,
  engine: MULTISHOT_ENGINES.google.id,
});

export function MultishotStudio({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createMultishotProject);
  const listFn = useServerFn(listMultishotProjects);
  const capabilitiesFn = useServerFn(getMultishotCapabilities);
  const batchFn = useServerFn(generateMultishotBatchPreviews);
  const retryFn = useServerFn(retryMultishotPreview);
  const updateFn = useServerFn(updateMultishotShot);
  const approveFn = useServerFn(approveMultishotPreview);
  const promoteFn = useServerFn(promoteMultishotShot);
  const approveTemporalFn = useServerFn(approveMultishotTemporalPreview);
  const finalizeFn = useServerFn(finalizeMultishotShot);
  const [active, setActive] = useState<MultishotProjectDto | null>(null);
  const [title, setTitle] = useState("Untitled Multishot");
  const [style, setStyle] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [identityAnchor, setIdentityAnchor] = useState("");
  const [strictGoogleOnly, setStrictGoogleOnly] = useState(false);
  const [refs, setRefs] = useState<string[]>([]);
  const [audioReferenceUrl, setAudioReferenceUrl] = useState<string | null>(null);
  const [shots, setShots] = useState<DraftShot[]>([newShot(0), newShot(1), newShot(2)]);
  const [busy, setBusy] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const projects = useQuery({
    queryKey: ["multishot-projects", userId],
    queryFn: () => listFn(),
    staleTime: 20_000,
  });
  const capabilities = useQuery({
    queryKey: ["multishot-capabilities", userId],
    queryFn: () => capabilitiesFn(),
    staleTime: 60_000,
  });
  const successes = useMemo(
    () => active?.shots.filter((shot) => shot.previewStatus === "succeeded").length ?? 0,
    [active],
  );
  const motionCost = active?.strictGoogleOnly
    ? MULTISHOT_GOOGLE_VIDEO_COST
    : MULTISHOT_VIDEO_COST;
  const motionCapability = active?.strictGoogleOnly
    ? capabilities.data?.motion.veo
    : capabilities.data?.motion.seedance;

  async function uploadReferences(files: FileList | null) {
    if (!files?.length) return;
    if (refs.length + files.length > 8) return toast.error("Use up to 8 owned reference images");
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
          throw new Error(`${file.name}: use an image under 20MB`);
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("studio").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        const { data, error: signError } = await supabase.storage.from("studio").createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signError || !data.signedUrl) throw signError ?? new Error("Could not sign reference");
        uploaded.push(data.signedUrl);
      }
      setRefs((current) => [...current, ...uploaded]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reference upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function uploadAudio(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("audio/") || file.size > 50 * 1024 * 1024) {
      toast.error("Use an audio file under 50MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("studio").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data, error: signError } = await supabase.storage.from("studio").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signError || !data.signedUrl) throw signError ?? new Error("Could not sign audio reference");
      setAudioReferenceUrl(data.signedUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audio upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function createProject() {
    setBusy("create");
    try {
      const project = await createFn({
        data: {
          title,
          style,
          aspectRatio: aspectRatio as "16:9",
          referenceUrls: refs,
          audioReferenceUrl,
          identityAnchor,
          strictGoogleOnly,
          shots: shots.map(({ prompt, engine }) => ({ prompt, engine })),
        },
      });
      setActive(project);
      await queryClient.invalidateQueries({ queryKey: ["multishot-projects", userId] });
      toast.success("Durable Multishot project created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setBusy(null);
    }
  }

  async function refreshActive() {
    const result = await projects.refetch();
    const refreshed = result.data?.find((project) => project.id === active?.id);
    if (refreshed) setActive(refreshed);
  }

  async function generateBatch() {
    if (!active || batchBusy) return;
    setBatchBusy(true);
    setActive({
      ...active,
      shots: active.shots.map((shot) => ({ ...shot, previewStatus: "processing" as const, previewError: null })),
    });
    const progressTimer = window.setInterval(() => {
      void refreshActive();
    }, 2_000);
    try {
      const response = await batchFn({ data: { projectId: active.id } });
      await refreshActive();
      const failed = response.results.filter((result) => !result.ok).length;
      if (failed) toast.warning(`${response.results.length - failed} previews ready; ${failed} failed and can be retried independently`);
      else toast.success("All coordinated previews are ready");
    } catch (error) {
      await refreshActive();
      toast.error(error instanceof Error ? error.message : "Batch preview failed");
    } finally {
      window.clearInterval(progressTimer);
      setBatchBusy(false);
    }
  }

  async function mutateShot(shotId: string, action: () => Promise<unknown>, success: string) {
    setBusy(shotId);
    try {
      await action();
      await refreshActive();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shot action failed");
    } finally {
      setBusy(null);
    }
  }

  if (!active) {
    return (
      <section className="mx-auto max-w-6xl space-y-5 p-4 md:p-8" data-testid="multishot-studio">
        <div className="rounded-2xl border border-line/50 bg-panel/60 p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="previs-badge">Multishot Studio</span>
              <h1 className="mt-3 text-2xl font-semibold text-ink">Coordinate 2–8 shots before spending</h1>
              <p className="mt-1 max-w-2xl text-sm text-ink-dim">
                Choose every engine explicitly. Aurora pins that exact model and fails visibly instead of silently swapping providers.
              </p>
            </div>
            <div className="max-w-sm rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-ink-dim">
              <div className="flex items-center gap-2 font-semibold text-amber-300"><MicOff className="size-3" /> Native-audio video unavailable</div>
              <p className="mt-1">{capabilities.data?.nativeAudio.reason ?? "Capability status is loading."} Live Voice direction is a separate direct Google session below.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="previs-field-group"><span className="previs-field-label">Project title</span>
              <input className="previs-editable-input w-full" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="previs-field-group"><span className="previs-field-label">Aspect ratio</span>
              <select className="previs-editable-input w-full" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
                {["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].map((ratio) => <option key={ratio}>{ratio}</option>)}
              </select>
            </label>
            <label className="previs-field-group md:col-span-2"><span className="previs-field-label">Shared visual style</span>
              <textarea className="previs-editable-textarea" rows={2} value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Palette, lens language, lighting, production design…" />
            </label>
            <label className="previs-field-group md:col-span-2"><span className="previs-field-label">Identity anchor</span>
              <textarea className="previs-editable-textarea" rows={2} value={identityAnchor} onChange={(event) => setIdentityAnchor(event.target.value)} placeholder="Features and wardrobe that must remain unchanged across shots…" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="previs-plate-action-btn cursor-pointer">
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
              Add owned references
              <input className="hidden" type="file" accept="image/*" multiple onChange={(event) => void uploadReferences(event.target.files)} />
            </label>
            <span className="text-xs text-ink-dim">{refs.length}/8 shared references</span>
            <label className="previs-plate-action-btn cursor-pointer">
              <Music className="size-3" /> {audioReferenceUrl ? "Replace audio reference" : "Add audio reference"}
              <input className="hidden" type="file" accept="audio/*" onChange={(event) => void uploadAudio(event.target.files?.[0])} />
            </label>
            <label className="ml-auto flex items-center gap-2 text-xs text-ink-dim">
              <input type="checkbox" checked={strictGoogleOnly} onChange={(event) => {
                setStrictGoogleOnly(event.target.checked);
                if (event.target.checked) setShots((current) => current.map((shot) => ({ ...shot, engine: MULTISHOT_ENGINES.google.id })));
              }} />
              Strict Google-only
            </label>
          </div>
          {audioReferenceUrl && <div className="mt-3 rounded-lg border border-line/40 p-3">
            <audio controls src={audioReferenceUrl} className="w-full" />
            <p className="mt-1 text-[11px] text-ink-dim">Shared direction reference only. It is not represented as native model audio.</p>
          </div>}
          {refs.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{refs.map((url, index) => (
            <button key={url} type="button" className="relative shrink-0" onClick={() => setRefs((current) => current.filter((_, i) => i !== index))} aria-label="Remove reference">
              <img src={url} alt="" className="size-16 rounded-lg border border-line object-cover" /><Trash2 className="absolute right-1 top-1 size-3 text-white drop-shadow" />
            </button>
          ))}</div>}
        </div>

        <GeminiMultishotDirector
          style={style}
          identityAnchor={identityAnchor}
          aspectRatio={aspectRatio}
          shotCount={shots.length}
          referenceUrls={refs}
          audioReferenceUrl={audioReferenceUrl}
          onApply={(plan) => {
            setShots((current) => current.map((shot, index) => ({
              ...shot,
              prompt: plan.shots[index]?.prompt ?? shot.prompt,
            })));
            if (!style.trim() && plan.continuity.trim()) setStyle(plan.continuity);
          }}
        />

        <div className="space-y-3">
          {shots.map((shot, index) => (
            <article key={shot.id} className="rounded-xl border border-line/50 bg-panel/40 p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="previs-shot-num">{String(index + 1).padStart(2, "0")}</span>
                <strong className="text-sm text-ink">Shot {index + 1}</strong>
                {shots.length > 2 && <button className="ml-auto text-ink-dim hover:text-rec" onClick={() => setShots((current) => current.filter((item) => item.id !== shot.id))}><Trash2 className="size-4" /></button>}
              </div>
              <textarea className="previs-editable-textarea" rows={3} value={shot.prompt} onChange={(event) => setShots((current) => current.map((item) => item.id === shot.id ? { ...item, prompt: event.target.value } : item))} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[MULTISHOT_ENGINES.google, MULTISHOT_ENGINES.modelark].map((engine) => {
                  const disabled = strictGoogleOnly && engine.id !== MULTISHOT_ENGINES.google.id;
                  return <button key={engine.id} type="button" disabled={disabled} onClick={() => setShots((current) => current.map((item) => item.id === shot.id ? { ...item, engine: engine.id } : item))}
                    className={`rounded-lg border p-3 text-left text-xs ${shot.engine === engine.id ? "border-prime bg-prime/10 text-ink" : "border-line text-ink-dim"} disabled:opacity-35`}>
                    <span className="block font-semibold">{engine.provider}</span><span>{engine.label}</span>
                  </button>;
                })}
              </div>
            </article>
          ))}
          {shots.length < 8 && <button className="previs-add-shot-btn" onClick={() => setShots((current) => [...current, newShot(current.length)])}><Plus className="size-4" /> Add shot</button>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/50 bg-panel/50 p-4">
          <p className="text-xs text-ink-dim">Preview estimate: {shots.length * MULTISHOT_IMAGE_COST} Aura. Vast / ComfyUI is unavailable here until an image workflow-capable worker is online and verified.</p>
          <button className="previs-analyze-btn" disabled={busy === "create" || shots.some((shot) => shot.prompt.trim().length < 10)} onClick={() => void createProject()}>
            {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />} Save project
          </button>
        </div>

        {(projects.data?.length ?? 0) > 0 && <div>
          <h2 className="previs-section-title mb-3">Your Multishot projects</h2>
          <div className="grid gap-2 md:grid-cols-2">{projects.data?.map((project) => (
            <button key={project.id} onClick={() => setActive(project)} className="rounded-xl border border-line/50 bg-panel/40 p-4 text-left hover:border-prime/40">
              <strong className="text-sm text-ink">{project.title}</strong>
              <span className="mt-1 block text-xs text-ink-dim">{project.shots.length} shots · {project.strictGoogleOnly ? "Google-only" : "Hybrid"}</span>
            </button>
          ))}</div>
        </div>}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-4 p-4 md:p-8" data-testid="multishot-project">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><span className="previs-badge">{active.strictGoogleOnly ? "Google-only" : "Hybrid"}</span><h1 className="mt-2 text-2xl font-semibold text-ink">{active.title}</h1>
          <p className="text-xs text-ink-dim">{successes}/{active.shots.length} previews ready · {active.aspectRatio}</p>
        </div>
        <div className="flex gap-2">
          <button className="previs-plate-action-btn" onClick={() => setActive(null)}>Projects</button>
          <button className="previs-analyze-btn" disabled={batchBusy} onClick={() => void generateBatch()}>
            {batchBusy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Generate all previews · {active.shots.length * MULTISHOT_IMAGE_COST} Aura
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {active.shots.map((shot) => (
          <article key={shot.id} className="overflow-hidden rounded-2xl border border-line/50 bg-panel/50">
            <div className="relative aspect-video bg-black/30">
              {shot.previewUrl ? <img src={shot.previewUrl} alt={`Shot ${shot.position + 1} preview`} className="size-full object-cover" /> :
                <div className="flex size-full items-center justify-center text-ink-dim">{shot.previewStatus === "processing" ? <Loader2 className="size-7 animate-spin text-prime" /> : <Film className="size-7" />}</div>}
              {shot.previewStatus === "processing" && shot.previewUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/65 text-xs text-white">
                  <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin text-prime" /> Refreshing preview</span>
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] text-white">SHOT {shot.position + 1}</span>
            </div>
            <div className="space-y-3 p-4">
              <textarea className="previs-editable-textarea" defaultValue={shot.prompt} onBlur={(event) => {
                if (event.target.value !== shot.prompt) void mutateShot(shot.id, () => updateFn({ data: { projectId: active.id, shotId: shot.id, prompt: event.target.value, expectedVersion: shot.version } }), "Shot updated; approval cleared");
              }} />
              <select className="previs-editable-input w-full" value={shot.engine} disabled={active.strictGoogleOnly || busy === shot.id} onChange={(event) => void mutateShot(shot.id, () => updateFn({ data: { projectId: active.id, shotId: shot.id, engine: event.target.value as typeof shot.engine, expectedVersion: shot.version } }), "Engine changed; approval cleared")}>
                <option value={MULTISHOT_ENGINES.google.id}>Google · {MULTISHOT_ENGINES.google.label}</option>
                <option value={MULTISHOT_ENGINES.modelark.id}>ModelArk · {MULTISHOT_ENGINES.modelark.label}</option>
              </select>
              <div className="rounded-lg border border-line/40 bg-black/10 p-2 text-[11px] text-ink-dim">
                <div>Requested: <strong className="text-ink">{shot.requestedModel ?? shot.engine}</strong></div>
                <div>Actually served: <strong className="text-ink">{shot.servingModel ?? "Not rendered yet"}</strong></div>
                {shot.fallbackUsed && <div className="mt-1 text-amber-300">Transparent compatible fallback used. This exact result must be approved.</div>}
              </div>
              {shot.previewError && <p className="flex gap-2 text-xs text-rec"><AlertCircle className="size-4 shrink-0" />{shot.previewError}</p>}
              <div className="flex flex-wrap gap-2">
                <button className="previs-plate-action-btn" disabled={busy === shot.id || (shot.previewStatus === "processing" && Boolean(shot.previewLeaseUntil) && Date.parse(shot.previewLeaseUntil!) > Date.now())} onClick={() => void mutateShot(shot.id, () => retryFn({ data: { projectId: active.id, shotId: shot.id } }), "Preview ready")}>
                  <RefreshCw className="size-3" /> Retry only this shot
                </button>
                {shot.previewGenerationId && shot.previewStatus === "succeeded" && !shot.approved && <button className="previs-plate-action-btn previs-plate-action-btn--premium" disabled={busy === shot.id} onClick={() => void mutateShot(shot.id, () => approveFn({ data: { projectId: active.id, shotId: shot.id, previewGenerationId: shot.previewGenerationId! } }), "Exact preview approved")}>
                  <ShieldCheck className="size-3" /> Approve exact preview
                </button>}
                {shot.approved && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="size-3" /> Cryptographically bound approval</span>}
              </div>
              {shot.previewGenerationId && shot.previewStatus === "succeeded" && <label className="flex items-center gap-2 text-xs text-ink-dim">
                <input type="checkbox" checked={shot.selected} disabled={!shot.approved || busy === shot.id} onChange={(event) => void mutateShot(shot.id, () => updateFn({ data: { projectId: active.id, shotId: shot.id, selected: event.target.checked, expectedVersion: shot.version } }), event.target.checked ? "Preview selected" : "Preview unselected")} />
                Select this approved preview for promotion
              </label>}
              {shot.selected && shot.approved && !shot.temporalUrl && motionCapability?.implemented !== false && <button className="previs-analyze-btn w-full" disabled={busy === shot.id || motionCapability?.access !== "validated_on_render"} onClick={() => void mutateShot(shot.id, () => promoteFn({ data: { projectId: active.id, shotId: shot.id } }), "480p temporal preview ready")}>
                {busy === shot.id ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />} Preview motion with {active.strictGoogleOnly ? "Google Veo 3.1 Fast" : "Seedance 2.0 Fast"} · 480p · {motionCost} Aura
              </button>}
              {shot.selected && shot.approved && motionCapability?.access !== "validated_on_render" &&
                <p className="text-xs text-amber-300">{motionCapability?.reason}</p>}
              {shot.temporalUrl && <div className="space-y-2">
                <video controls src={shot.temporalUrl} className="aspect-video w-full rounded-lg bg-black" />
                <p className="text-[11px] text-ink-dim">Temporal preview actually served: {shot.temporalServingModel}</p>
                {!shot.temporalApproved && shot.temporalGenerationId && <button className="previs-plate-action-btn previs-plate-action-btn--premium" disabled={busy === shot.id} onClick={() => void mutateShot(shot.id, () => approveTemporalFn({ data: { projectId: active.id, shotId: shot.id, generationId: shot.temporalGenerationId! } }), "Exact temporal preview approved")}>
                  <ShieldCheck className="size-3" /> Approve exact motion preview
                </button>}
                {shot.temporalApproved && !shot.promotedUrl && <button className="previs-analyze-btn w-full" disabled={busy === shot.id} onClick={() => void mutateShot(shot.id, () => finalizeFn({ data: { projectId: active.id, shotId: shot.id } }), "Final shot ready")}>
                  <Film className="size-4" /> Render bound 720p final · {MULTISHOT_VIDEO_COST} Aura
                </button>}
              </div>}
              {shot.promotedUrl && <div><video controls src={shot.promotedUrl} className="aspect-video w-full rounded-lg bg-black" /><p className="mt-1 text-[11px] text-ink-dim">Actually served: {shot.promotedModel}</p></div>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}