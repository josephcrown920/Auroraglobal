import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { generateMimicMotion, listGenerations } from "@/lib/studio.functions";
import {
  generatePerformanceVariantPlate,
  loadPerformanceVariant,
  savePerformanceVariant,
  type PerformanceVariantPayload,
} from "@/lib/performance-variant.functions";
import { createPerformanceEditHandoff } from "@/lib/performance-workflow.functions";
import {
  PERFORMANCE_VARIANT_CATALOG,
  LUXURY_INTERIOR_PRESETS,
  REANGLE_PRESETS,
  VEHICLES,
  type PerformanceVariantKind,
} from "@/lib/performance-variant-workflows";
import { RecordingReferenceGuide, WorkflowVisualGuide } from "@/components/performance/WorkflowVisualGuide";

function initial(kind: PerformanceVariantKind, mode: "colors" | "anywhere"): PerformanceVariantPayload {
  const references = Object.fromEntries(PERFORMANCE_VARIANT_CATALOG[kind].references.map((item) => [item.id, null]));
  return {
    version: 1, kind, mode, references,
    settings: kind === "build_scene"
      ? { subject: "", outfit: "", location: "", pose: "", prop: "", lighting: "cinematic practical lighting", action: "performing to camera" }
      : { vehicle: "Maybach", interior: "", outfit: "Use outfit from identity reference", seatAngle: "rear seat, through-window camera", lighting: "soft cinematic night lighting", action: "controlled seated performance", context: "Performer rapping inside the vehicle" },
    selectedAngles: kind === "build_scene" ? REANGLE_PRESETS.slice(0, 3).map((item) => item.id) : LUXURY_INTERIOR_PRESETS.slice(0, 2).map((item) => item.id),
    base: null, angles: [], motions: [], phoneVideoUrl: null, angleVideoOverrides: {}, motionDirections: {}, audioUrl: null,
  };
}

export function PerformanceVariantWorkflow({ kind, mode }: { kind: PerformanceVariantKind; mode: "colors" | "anywhere" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const catalog = PERFORMANCE_VARIANT_CATALOG[kind];
  const [draft, setDraft] = useState(() => initial(kind, mode));
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const loadFn = useServerFn(loadPerformanceVariant);
  const saveFn = useServerFn(savePerformanceVariant);
  const generateFn = useServerFn(generatePerformanceVariantPlate);
  const motionFn = useServerFn(generateMimicMotion);
  const handoffFn = useServerFn(createPerformanceEditHandoff);
  const listFn = useServerFn(listGenerations);
  const generations = useQuery({
    queryKey: ["performance-variant-generations", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 4_000,
  });

  useEffect(() => {
    if (!user) return;
    loadFn({ data: { kind, mode } }).then((result) => {
      if (result.payload) setDraft(result.payload);
      setRevision(result.revision);
      setReady(true);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load workflow"));
  }, [user, kind, mode]);

  useEffect(() => {
    if (!ready || !user) return;
    const timer = setTimeout(() => {
      saveFn({ data: { expectedRevision: revision, payload: draft } }).then((result) => {
        if (!result.ok) {
          setDraft(result.payload);
          setRevision(result.revision);
          toast.error("This workflow changed elsewhere. Loaded the newest saved version.");
          return;
        }
        setRevision(result.revision);
        if (
          result.payload.base?.generationId !== draft.base?.generationId ||
          result.payload.angles.map((item) => item.generationId).join() !== draft.angles.map((item) => item.generationId).join()
        ) {
          setDraft(result.payload);
          toast.info("Changed inputs invalidated affected approvals.");
        }
      }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not save workflow"));
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, ready, user]);

  async function upload(file: File, slot: string, media: "image" | "video" | "audio") {
    if (!user) return;
    const extension = file.name.split(".").pop() || (media === "image" ? "jpg" : media === "audio" ? "mp3" : "mp4");
    const path = `${user.id}/performance-variants/${kind}/${slot}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data, error: signError } = await supabase.storage.from("studio").createSignedUrl(path, 60 * 60 * 24);
    if (signError) throw signError;
    if (media === "image") setDraft((value) => ({ ...value, references: { ...value.references, [slot]: data.signedUrl } }));
    else if (media === "video") setDraft((value) => slot === "original-performance"
      ? { ...value, phoneVideoUrl: data.signedUrl }
      : { ...value, angleVideoOverrides: { ...value.angleVideoOverrides, [slot]: data.signedUrl } });
    else setDraft((value) => ({ ...value, audioUrl: data.signedUrl }));
  }

  const plateMutation = useMutation({
    mutationFn: (presetId?: string) => generateFn({ data: { payload: draft, ...(presetId ? { presetId } : {}) } }),
    onSuccess: (result) => setDraft((value) => result.presetId
      ? {
          ...value,
          angles: [...value.angles.filter((item) => item.presetId !== result.presetId), { ...result, presetId: result.presetId!, approved: false }],
          motions: value.motions.filter((item) => item.presetId !== result.presetId),
        }
      : { ...value, base: { url: result.url, generationId: result.generationId, approved: false }, angles: [], motions: [] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Generation failed"),
  });

  const motionMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const plate = presetId === "base" ? draft.base : draft.angles.find((item) => item.presetId === presetId);
      if (!plate?.approved || !draft.phoneVideoUrl) throw new Error("Approve the plate and upload the original phone performance first");
      const prior = draft.motions.find((item) => item.presetId === presetId);
      const preview = prior?.previewId ? generations.data?.items.find((item) => item.id === prior.previewId) : undefined;
      const confirmedPreviewId = preview?.result_video_url && ["succeeded", "complete"].includes(preview.status ?? "")
        ? prior?.previewId
        : undefined;
      const settings = Object.entries(draft.settings).map(([key, value]) => `${key}: ${value}`).join("; ");
      return {
        presetId,
        result: await motionFn({ data: {
          imageUrl: plate.url, sourceGenerationId: plate.generationId,
          variantWorkflowKind: kind,
          variantMode: mode,
          variantPresetId: presetId,
          drivingVideoUrl: draft.angleVideoOverrides[presetId] ?? draft.phoneVideoUrl,
          prompt: `${draft.motionDirections[presetId] ?? "Faithfully preserve the recorded performance."} Context: ${settings}`,
          params: { motionType: "faithful", cameraMovement: "static" },
          confirmPreviewId: confirmedPreviewId,
        } }),
      };
    },
    onSuccess: ({ presetId, result }) => setDraft((value) => ({
      ...value,
      motions: [...value.motions.filter((item) => item.presetId !== presetId), {
        presetId, generationId: result.generationId, jobId: result.jobId,
        previewId: result.preview ? result.generationId : value.motions.find((item) => item.presetId === presetId)?.previewId ?? null,
      }],
    })),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Motion enqueue failed"),
  });
  const handoffMutation = useMutation({
    mutationFn: ({ generationId, label }: { generationId: string; label: string }) =>
      handoffFn({ data: { generationId, label, ...(draft.audioUrl ? { audioUrl: draft.audioUrl } : {}) } }),
    onSuccess: ({ sessionId }) => navigate({ to: "/video-editor", search: { session: sessionId } }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Editor handoff failed"),
  });

  const requiredReady = catalog.references.every((item) => draft.references[item.id]);
  return (
    <main className="aurora-page-shell text-foreground">
      <div className="relative z-10 mx-auto max-w-6xl space-y-8 px-5 py-10">
        <WorkflowVisualGuide kind={kind} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="aurora-kicker">{mode === "anywhere" ? "Perform Anywhere" : "Colors Studio"}</p><h1 className="text-3xl font-black">{catalog.label}</h1><p className="text-sm text-muted-foreground">{catalog.description}</p></div>
          <Link to="/colors-show" search={mode === "anywhere" ? { mode: "anywhere" } : {}}><Button variant="outline">Two-angle workflow</Button></Link>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          {catalog.references.map((reference) => (
            <button key={reference.id} onClick={() => fileRefs.current[reference.id]?.click()} className="rounded-2xl border border-border bg-card p-4 text-left">
              <input ref={(node) => { fileRefs.current[reference.id] = node; }} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, reference.id, "image"); }} />
              {draft.references[reference.id] ? <Check className="mb-3 size-5 text-emerald-400" /> : <Upload className="mb-3 size-5 text-primary" />}
              <p className="font-semibold">{reference.label} · required</p><p className="text-xs text-muted-foreground">{reference.guidance}</p>
            </button>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-bold">Personalize the scene</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(draft.settings).map(([key, value]) => key === "vehicle" ? (
              <label key={key} className="text-xs font-semibold capitalize">{key}<select value={value} onChange={(e) => setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: e.target.value } }))} className="mt-1 w-full rounded-xl border border-border bg-background p-3">{VEHICLES.map((vehicle) => <option key={vehicle}>{vehicle}</option>)}</select></label>
            ) : (
              <label key={key} className="text-xs font-semibold capitalize">{key}<input value={value} onChange={(e) => setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: e.target.value } }))} className="mt-1 w-full rounded-xl border border-border bg-background p-3" /></label>
            ))}
          </div>
        </section>

        {kind === "build_scene" && <section><h2 className="mb-3 text-lg font-bold">Choose 3–5 re-angles</h2><div className="flex flex-wrap gap-2">{REANGLE_PRESETS.map((preset) => <Button key={preset.id} size="sm" variant={draft.selectedAngles.includes(preset.id) ? "default" : "outline"} onClick={() => setDraft((d) => ({ ...d, selectedAngles: d.selectedAngles.includes(preset.id) ? d.selectedAngles.filter((id) => id !== preset.id) : d.selectedAngles.length < 5 ? [...d.selectedAngles, preset.id] : d.selectedAngles }))}>{preset.label}</Button>)}</div></section>}
        {kind === "luxury_interior" && <section><h2 className="mb-3 text-lg font-bold">Alternate interiors using the same identity and performance</h2><div className="flex flex-wrap gap-2">{LUXURY_INTERIOR_PRESETS.map((preset) => <Button key={preset.id} size="sm" variant={draft.selectedAngles.includes(preset.id) ? "default" : "outline"} onClick={() => setDraft((d) => ({ ...d, selectedAngles: d.selectedAngles.includes(preset.id) ? d.selectedAngles.filter((id) => id !== preset.id) : [...d.selectedAngles, preset.id] }))}>{preset.label}</Button>)}</div></section>}

        <section className="space-y-4">
          <p className="text-xs text-muted-foreground">Reference-safe image generation: automatic serving fallback is limited to image providers that receive the same role references and continuity prompt.</p>
          <Button disabled={!requiredReady || plateMutation.isPending} onClick={() => plateMutation.mutate(undefined)}>{plateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Generate base scene</Button>
          {draft.base && <PlateCard label="Base scene" plate={draft.base} motion={draft.motions.find((item) => item.presetId === "base")} generations={generations.data?.items ?? []} busy={motionMutation.isPending || handoffMutation.isPending} onApprove={() => setDraft((d) => ({ ...d, base: d.base && { ...d.base, approved: true } }))} onAnimate={() => motionMutation.mutate("base")} onEdit={(generationId) => handoffMutation.mutate({ generationId, label: `${catalog.label} · Base scene` })} />}
          {draft.base?.approved && draft.selectedAngles.map((id) => {
            const preset = [...REANGLE_PRESETS, ...LUXURY_INTERIOR_PRESETS].find((item) => item.id === id)!;
            const plate = draft.angles.find((item) => item.presetId === id);
            return plate ? <PlateCard key={id} label={preset.label} plate={plate} motion={draft.motions.find((item) => item.presetId === id)} generations={generations.data?.items ?? []} busy={motionMutation.isPending || handoffMutation.isPending} onApprove={() => setDraft((d) => ({ ...d, angles: d.angles.map((item) => item.presetId === id ? { ...item, approved: true } : item) }))} onAnimate={() => motionMutation.mutate(id)} onEdit={(generationId) => handoffMutation.mutate({ generationId, label: `${catalog.label} · ${preset.label}` })} /> : <Button key={id} variant="outline" disabled={plateMutation.isPending} onClick={() => plateMutation.mutate(id)}>Generate {preset.label}</Button>;
          })}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-bold">Original phone performance</h2>
          {kind === "luxury_interior" && <p className="my-2 text-sm text-amber-300">Record seated at the same angle and position. Keep gestures contained within the window frame. Mandatory context: performer rapping inside the vehicle.</p>}
          <RecordingReferenceGuide kind={kind} className="my-3 max-w-md" />
          <input type="file" accept="video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "original-performance", "video"); }} />
          <p className="mt-2 text-xs text-muted-foreground">The same recording animates every approved plate. Per-angle overrides are supported by the saved workflow contract.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {["base", ...draft.selectedAngles].map((id) => {
              const label = id === "base" ? "Base scene" : [...REANGLE_PRESETS, ...LUXURY_INTERIOR_PRESETS].find((item) => item.id === id)?.label ?? id;
              return <div key={id} className="rounded-xl border border-border p-3"><label className="text-xs font-semibold">{label} motion direction<input value={draft.motionDirections[id] ?? ""} placeholder="Faithfully follow gestures and timing…" onChange={(e) => setDraft((d) => ({ ...d, motionDirections: { ...d.motionDirections, [id]: e.target.value } }))} className="mt-1 w-full rounded-lg border border-border bg-background p-2" /></label><label className="mt-2 block text-[11px] text-muted-foreground">Optional performance override<input type="file" accept="video/*" className="mt-1 block w-full" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, id, "video"); }} /></label></div>;
            })}
          </div>
          <h3 className="mt-5 font-semibold">Optional soundtrack</h3>
          <input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, "soundtrack", "audio"); }} />
          <p className="mt-1 text-xs text-muted-foreground">Saved for the dedicated soundtrack export helper; never represented as motion-transfer lip-sync.</p>
        </section>
      </div>
    </main>
  );
}

function PlateCard({ label, plate, motion, generations, busy, onApprove, onAnimate, onEdit }: {
  label: string;
  plate: { url: string; approved: boolean };
  motion?: { generationId: string; previewId: string | null };
  generations: Array<{ id: string; status?: string | null; result_video_url?: string | null; error?: string | null }>;
  busy: boolean;
  onApprove: () => void;
  onAnimate: () => void;
  onEdit: (generationId: string) => void;
}) {
  const current = motion ? generations.find((item) => item.id === motion.generationId) : undefined;
  const preview = motion?.previewId ? generations.find((item) => item.id === motion.previewId) : undefined;
  const previewReady = !!preview?.result_video_url && ["succeeded", "complete"].includes(preview.status ?? "");
  const failed = current?.status === "failed";
  const processing = !!motion && !current?.result_video_url && !failed;
  const labelText = previewReady
    ? (motion?.generationId === motion?.previewId ? "Approve preview · render full" : failed ? "Retry full render" : "Render full again")
    : failed ? "Retry fresh preview" : processing ? "Motion rendering…" : "Generate motion preview";
  return <article className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[220px_1fr]"><img src={plate.url} alt={label} className="aspect-[9/16] w-full rounded-xl object-cover" /><div><h3 className="text-lg font-bold">{label}</h3><p className="mt-2 text-sm text-muted-foreground">{plate.approved ? "Approved for continuity and motion." : "Review this plate independently."}</p>{current?.result_video_url && <video src={current.result_video_url} controls playsInline className="mt-3 max-h-72 rounded-xl" />}{failed && <p className="mt-2 text-xs text-destructive">{current?.error ?? "Motion render failed; this angle can retry independently."}</p>}<div className="mt-4 flex flex-wrap gap-2">{!plate.approved && <Button onClick={onApprove}>Approve</Button>}<Button variant="outline" disabled={!plate.approved || busy || processing} onClick={onAnimate}>{labelText}</Button>{current?.result_video_url && motion?.generationId !== motion?.previewId && <Button disabled={busy} onClick={() => onEdit(motion!.generationId)}>Attach soundtrack &amp; edit/export</Button>}</div></div></article>;
}