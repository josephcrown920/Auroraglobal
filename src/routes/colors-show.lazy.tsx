import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Upload, Sparkles, CheckCircle2, Video, Film, RefreshCw, Download, Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { COLOR_PRESETS } from "@/lib/colors.presets";
import {
  COLORS_SHOW_STEPS,
  COLORS_SHOW_COST_PER_SHOT,
  RECORD_CHECKLIST,
} from "@/lib/colors-show.templates";
import { generateColorsShowShot } from "@/lib/colors-show.functions";
import { generateMimicMotion, listGenerations } from "@/lib/studio.functions";
import {
  createPerformanceEditHandoff,
  loadPerformanceWorkflowDraft,
  savePerformanceWorkflowDraft,
} from "@/lib/performance-workflow.functions";
import { saveAssetToDisk } from "@/lib/save";
import {
  clearPerformanceWorkflow,
  emptyPerformanceWorkflow,
  loadPerformanceWorkflow,
  savePerformanceWorkflow,
  type PerformanceAngle,
  type PerformanceClip,
  type PerformancePlate,
} from "@/lib/performance-workflow";
import { Button } from "@/components/ui/button";
import { PerformanceVariantWorkflow } from "@/components/performance/PerformanceVariantWorkflow";
import { WorkflowSelectorVisual } from "@/components/performance/WorkflowVisualGuide";

export const Route = createLazyFileRoute("/colors-show")({
  component: ColorsShowPage,
});

type ShotResult = PerformancePlate | null;

async function uploadToStudio(userId: string, file: File): Promise<string> {
  if (file.size > 100 * 1024 * 1024) throw new Error("File must be under 100 MB");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("studio").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data: signed, error: signErr } = await supabase.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL");
  return signed.signedUrl;
}

function ColorsShowPage() {
  const search = Route.useSearch();
  if (search.flow) {
    return <PerformanceVariantWorkflow kind={search.flow} mode={search.mode === "anywhere" ? "anywhere" : "colors"} />;
  }
  return <TwoAngleWorkflow />;
}

function TwoAngleWorkflow() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const totalSteps = COLORS_SHOW_STEPS.length;

  // Step 1
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [wideRefUrl, setWideRefUrl] = useState<string | null>(null);
  const [closeupRefUrl, setCloseupRefUrl] = useState<string | null>(null);
  const [outfitRefUrl, setOutfitRefUrl] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  // Step 2
  const [selectedColor, setSelectedColor] = useState(
    COLOR_PRESETS.find((preset) => preset.id === "obsidian") ?? COLOR_PRESETS[0],
  );

  // Step 3
  const [outfit, setOutfit] = useState("");
  const [location, setLocation] = useState("");

  // Steps 4 & 5
  const [wideResult, setWideResult] = useState<ShotResult>(null);
  const [closeupResult, setCloseupResult] = useState<ShotResult>(null);
  const [wideVideoUrl, setWideVideoUrl] = useState<string | null>(null);
  const [closeupVideoUrl, setCloseupVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [widePrompt, setWidePrompt] = useState("Preserve the real performance faithfully with natural body motion and locked camera framing.");
  const [closeupPrompt, setCloseupPrompt] = useState("Preserve facial identity and lip detail with subtle, faithful performance motion and locked framing.");
  const [wideClip, setWideClip] = useState<PerformanceClip | null>(null);
  const [closeupClip, setCloseupClip] = useState<PerformanceClip | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const revisionRef = useRef(0);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const selfieInputRef = useRef<HTMLInputElement>(null);
  const wideRefInputRef = useRef<HTMLInputElement>(null);
  const closeupRefInputRef = useRef<HTMLInputElement>(null);
  const outfitRefInputRef = useRef<HTMLInputElement>(null);
  const wideVideoInputRef = useRef<HTMLInputElement>(null);
  const closeupVideoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const shotFn = useServerFn(generateColorsShowShot);
  const motionFn = useServerFn(generateMimicMotion);
  const listFn = useServerFn(listGenerations);
  const loadDraftFn = useServerFn(loadPerformanceWorkflowDraft);
  const saveDraftFn = useServerFn(savePerformanceWorkflowDraft);
  const editHandoffFn = useServerFn(createPerformanceEditHandoff);

  useEffect(() => {
    if (!user || hydrated) return;
    let cancelled = false;
    const mode = search.mode === "anywhere" ? "anywhere" : "colors";
    void loadDraftFn({ data: { mode } })
      .then((remote) => {
        if (cancelled) return;
        const draft = remote.draft ?? loadPerformanceWorkflow(user.id) ?? emptyPerformanceWorkflow(mode);
        revisionRef.current = remote.revision;
        setStep(Math.min(draft.step, totalSteps - 1));
        setSelfieUrl(draft.subjectUrl);
        setWideRefUrl(draft.wideReferenceUrl);
        setCloseupRefUrl(draft.closeupReferenceUrl);
        setOutfitRefUrl(draft.outfitReferenceUrl);
        setSelectedColor(COLOR_PRESETS.find((preset) => preset.id === draft.colorId) ?? COLOR_PRESETS.find((preset) => preset.id === "obsidian") ?? COLOR_PRESETS[0]);
        setOutfit(draft.outfit);
        setLocation(draft.location);
        setWideResult(draft.widePlate);
        setCloseupResult(draft.closeupPlate);
        setWideVideoUrl(draft.wideVideoUrl);
        setCloseupVideoUrl(draft.closeupVideoUrl);
        setAudioUrl(draft.audioUrl);
        setWidePrompt(draft.widePrompt);
        setCloseupPrompt(draft.closeupPrompt);
        setWideClip(draft.wideClip);
        setCloseupClip(draft.closeupClip);
        setHydrated(true);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load saved workflow");
      });
    return () => { cancelled = true; };
  }, [hydrated, loadDraftFn, search.mode, totalSteps, user]);

  useEffect(() => {
    if (!user || !hydrated) return;
    const payload = {
      version: 1,
      step,
      mode: search.mode === "anywhere" ? "anywhere" : "colors",
      subjectUrl: selfieUrl,
      wideReferenceUrl: wideRefUrl,
      closeupReferenceUrl: closeupRefUrl,
      outfitReferenceUrl: outfitRefUrl,
      colorId: selectedColor.id,
      outfit,
      location,
      widePlate: wideResult,
      closeupPlate: closeupResult,
      wideVideoUrl,
      closeupVideoUrl,
      audioUrl,
      widePrompt,
      closeupPrompt,
      wideClip,
      closeupClip,
    } as const;
    savePerformanceWorkflow(user.id, payload);
    const timer = window.setTimeout(() => {
      saveChainRef.current = saveChainRef.current.then(async () => {
        const result = await saveDraftFn({ data: { expectedRevision: revisionRef.current, payload } });
        revisionRef.current = result.revision;
        if (!result.ok) {
          toast.error("This workflow changed in another tab. Reloaded the newer server version.");
          window.location.reload();
        }
      }).catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not save workflow");
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [audioUrl, closeupClip, closeupPrompt, closeupRefUrl, closeupResult, closeupVideoUrl, hydrated, location, outfit, outfitRefUrl, saveDraftFn, search.mode, selectedColor.id, selfieUrl, step, user, wideClip, widePrompt, wideRefUrl, wideResult, wideVideoUrl]);

  const wideMut = useMutation({
    mutationFn: () =>
      shotFn({
        data: {
          selfieUrl: selfieUrl!,
          colorName: selectedColor.name,
          outfit: outfit.trim(),
          shotType: "wide",
          wideRefUrl: wideRefUrl!,
          closeupRefUrl: closeupRefUrl!,
          ...(outfitRefUrl ? { outfitRefUrl } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error); return; }
      setWideResult({ url: res.url, generationId: res.generationId, approved: false });
      toast.success("Wide shot ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const closeupMut = useMutation({
    mutationFn: () =>
      shotFn({
        data: {
          selfieUrl: selfieUrl!,
          colorName: selectedColor.name,
          outfit: outfit.trim(),
          shotType: "closeup",
          wideRefUrl: wideRefUrl!,
          closeupRefUrl: closeupRefUrl!,
          ...(outfitRefUrl ? { outfitRefUrl } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error); return; }
      setCloseupResult({ url: res.url, generationId: res.generationId, approved: false });
      toast.success("Close-up ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const { data: generations } = useQuery({
    queryKey: ["performance-workflow-generations"],
    queryFn: () => listFn(),
    enabled: !!user && !!(wideClip || closeupClip),
    refetchInterval: 5_000,
  });

  const enqueueTransfer = useMutation({
    mutationFn: async (angle: PerformanceAngle) => {
      const plate = angle === "wide" ? wideResult : closeupResult;
      const video = angle === "wide" ? wideVideoUrl : closeupVideoUrl;
      const existing = angle === "wide" ? wideClip : closeupClip;
      if (!plate?.approved) throw new Error(`Approve the ${angle} plate first`);
      if (!video) throw new Error(`Upload the ${angle} phone performance`);
      const previewRow = existing?.previewId
        ? generations?.items.find((item) => item.id === existing.previewId)
        : undefined;
      const confirmedPreviewId = previewRow?.result_video_url &&
        ["succeeded", "complete"].includes(previewRow.status ?? "")
        ? existing?.previewId
        : undefined;
      const out = await motionFn({
        data: {
          imageUrl: plate.url,
          drivingVideoUrl: video,
          sourceGenerationId: plate.generationId,
          workflowMode: search.mode === "anywhere" ? "anywhere" : "colors",
          workflowAngle: angle,
          prompt: angle === "wide" ? widePrompt : closeupPrompt,
          params: { motionType: "faithful", cameraMovement: "static" },
          confirmPreviewId: confirmedPreviewId,
        },
      });
      return { angle, out };
    },
    onSuccess: ({ angle, out }) => {
      const clip: PerformanceClip = {
        generationId: out.generationId,
        jobId: out.jobId,
        previewId: out.preview ? out.generationId : (angle === "wide" ? wideClip?.previewId : closeupClip?.previewId) ?? null,
      };
      if (angle === "wide") setWideClip(clip);
      else setCloseupClip(clip);
      queryClient.invalidateQueries({ queryKey: ["performance-workflow-generations"] });
      toast.success(out.preview ? `${angle} preview queued` : `${angle} full clip queued`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Motion transfer failed"),
  });

  const editHandoff = useMutation({
    mutationFn: ({ generationId, angle }: { generationId: string; angle: PerformanceAngle }) =>
      editHandoffFn({
        data: {
          generationId,
          label: angle === "wide" ? "Wide performance" : "Close-up performance",
          ...(audioUrl ? { audioUrl } : {}),
        },
      }),
    onSuccess: ({ sessionId }) => {
      void navigate({ to: "/video-editor", search: { session: sessionId } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not open editor"),
  });

  const generationFor = (clip: PerformanceClip | null) =>
    clip ? generations?.items.find((item) => item.id === clip.generationId) : undefined;
  const wideGeneration = generationFor(wideClip);
  const closeupGeneration = generationFor(closeupClip);

  const handleFileUpload = async (
    file: File,
    slot: "selfie" | "wideRef" | "closeupRef" | "outfitRef" | "wideVideo" | "closeupVideo" | "audio",
  ) => {
    const expectsImage = ["selfie", "wideRef", "closeupRef", "outfitRef"].includes(slot);
    const expectsVideo = ["wideVideo", "closeupVideo"].includes(slot);
    if (expectsImage && !file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (expectsVideo && !file.type.startsWith("video/")) { toast.error("Please upload a video file"); return; }
    if (slot === "audio" && !file.type.startsWith("audio/")) { toast.error("Please upload an audio file"); return; }
    if (!user) { toast.error("Please sign in first"); return; }
    setUploadingSlot(slot);
    try {
      const url = await uploadToStudio(user.id, file);
      if (slot === "selfie") setSelfieUrl(url);
      else if (slot === "wideRef") setWideRefUrl(url);
      else if (slot === "closeupRef") setCloseupRefUrl(url);
      else if (slot === "outfitRef") setOutfitRefUrl(url);
      else if (slot === "wideVideo") setWideVideoUrl(url);
      else if (slot === "closeupVideo") setCloseupVideoUrl(url);
      else setAudioUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  };

  const canAdvance = (): boolean => {
    const s = COLORS_SHOW_STEPS[step].id;
    if (s === "upload") return !!selfieUrl && !!wideRefUrl && !!closeupRefUrl;
    if (s === "outfit") return outfit.trim().length >= 3 && (search.mode !== "anywhere" || location.trim().length >= 10);
    if (s === "wide") return !!wideResult?.approved;
    if (s === "closeup") return !!closeupResult?.approved;
    if (s === "record") return !!wideVideoUrl && !!closeupVideoUrl;
    return true;
  };

  const costPerShot = COLORS_SHOW_COST_PER_SHOT;
  const currentStep = COLORS_SHOW_STEPS[step];

  return (
    <div className="aurora-page-shell">
      <div className="aurora-ambient" />

      <div className="relative z-10 flex flex-col min-h-[100dvh]">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <button
            onClick={() => { if (step > 0) setStep(step - 1); }}
            className={cn(
              "p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors",
              step === 0 && "opacity-0 pointer-events-none",
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Film className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold tracking-widest uppercase text-primary truncate">
              {search.mode === "anywhere" ? "Perform Anywhere · Guided" : "Colors Show Creator"}
            </span>
          </div>
        </div>

        {/* Step dots */}
        <div className="px-4 pb-4 flex items-center gap-1.5">
          {COLORS_SHOW_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { if (i < step) setStep(i); }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-8 bg-primary" : i < step ? "w-3 bg-primary/50" : "w-3 bg-white/20",
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto">
          <h1 className="text-2xl font-bold text-white mb-1">{currentStep.title}</h1>
          <p className="text-sm text-white/60 mb-6">{currentStep.subtitle}</p>

          {/* ── Step 1: Upload selfie + optional Colors reference ── */}
          {currentStep.id === "upload" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <Link to="/colors-show" search={{ ...(search.mode === "anywhere" ? { mode: "anywhere" as const } : {}), flow: "build_scene" as const }} className="rounded-xl border border-white/10 p-3 text-left no-underline hover:border-primary/50">
                  <WorkflowSelectorVisual kind="build_scene" />
                  <span className="block text-xs font-bold text-white">Build a Scene</span>
                  <span className="text-[10px] text-white/50">5 role references + 3–5 re-angles</span>
                </Link>
                <Link to="/colors-show" search={{ ...(search.mode === "anywhere" ? { mode: "anywhere" as const } : {}), flow: "luxury_interior" as const }} className="rounded-xl border border-white/10 p-3 text-left no-underline hover:border-primary/50">
                  <WorkflowSelectorVisual kind="luxury_interior" />
                  <span className="block text-xs font-bold text-white">Luxury Interior</span>
                  <span className="text-[10px] text-white/50">3 role references + seated performance</span>
                </Link>
              </div>
              {/* Selfie — required */}
              <div>
                <div className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-2">
                  Selfie <span className="text-primary">*</span>
                </div>
                <button
                  onClick={() => selfieInputRef.current?.click()}
                  disabled={uploadingSlot === "selfie"}
                  className={cn(
                    "w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all overflow-hidden",
                    selfieUrl ? "border-primary/50" : "border-white/20 bg-white/5 hover:border-white/40",
                  )}
                  style={{ aspectRatio: "3/4" }}
                >
                  {uploadingSlot === "selfie" ? (
                    <RefreshCw className="w-7 h-7 text-primary animate-spin" />
                  ) : selfieUrl ? (
                    <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-white/40" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-white/70">Tap to upload your selfie</p>
                        <p className="text-xs text-white/40 mt-1">Front-facing photo · JPEG or PNG · up to 20 MB</p>
                      </div>
                    </>
                  )}
                </button>
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileUpload(f, "selfie");
                    e.target.value = "";
                  }}
                />
              </div>

              <div>
                <div className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-2">
                  Composition references <span className="text-white/30 normal-case font-normal">(recommended)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["wideRef", "Wide / full body", wideRefUrl, wideRefInputRef],
                    ["closeupRef", "Medium close-up", closeupRefUrl, closeupRefInputRef],
                    ["outfitRef", "Outfit photo", outfitRefUrl, outfitRefInputRef],
                  ] as const).map(([slot, label, value, ref]) => (
                    <div key={slot}>
                      <button
                        type="button"
                        onClick={() => ref.current?.click()}
                        disabled={uploadingSlot === slot}
                        className={cn(
                          "w-full aspect-[3/4] rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 overflow-hidden text-center",
                          value ? "border-primary/50" : "border-white/20 bg-white/5 hover:border-white/40",
                        )}
                      >
                        {uploadingSlot === slot ? <RefreshCw className="size-5 animate-spin text-primary" /> :
                          value ? <img src={value} alt={label} className="size-full object-cover" /> :
                          <><Upload className="size-5 text-white/40" /><span className="px-1 text-[11px] text-white/60">{label}</span></>}
                      </button>
                      <input
                        ref={ref}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleFileUpload(file, slot);
                          event.target.value = "";
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                  Each angle uses its matching composition reference. Your subject photo remains the identity source for both.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Color picker ── */}
          {currentStep.id === "color" && (
            <div className="grid grid-cols-3 gap-3">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedColor(c)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                    selectedColor.id === c.id
                      ? "border-primary bg-primary/10"
                      : "border-white/10 bg-white/5 hover:border-white/25",
                  )}
                >
                  <div
                    className="w-10 h-10 rounded-full border-2 border-white/20"
                    style={{ background: c.swatch }}
                  />
                  <span className="text-xs font-medium text-white/80 text-center leading-tight">
                    {c.name}
                  </span>
                  {selectedColor.id === c.id && (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Step 3: Outfit description with inline editable fields ── */}
          {currentStep.id === "outfit" && (
            <div className="space-y-4">
              <div className="aurora-glass p-4 rounded-2xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Color Theme
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border border-white/30 shrink-0"
                    style={{ background: selectedColor.swatch }}
                  />
                  <span className="text-sm font-medium text-white">{selectedColor.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Outfit Description <span className="text-primary">*</span>
                </label>
                <textarea
                  value={outfit}
                  onChange={(e) => setOutfit(e.target.value)}
                  rows={4}
                  maxLength={300}
                  placeholder="e.g. oversized vintage denim jacket, white crop top, baggy black cargo pants, chunky white sneakers"
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-primary/60 transition-colors"
                />
                <p className="text-xs text-white/30 mt-1 text-right">{outfit.length}/300</p>
              </div>

              {search.mode === "anywhere" ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                    Custom location / set <span className="text-primary">*</span>
                  </label>
                  <textarea
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="Describe the exact location, set dressing, lighting and atmosphere to preserve across both angles."
                    className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>
              ) : (
                <div className="aurora-glass p-3 rounded-xl border border-white/10">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Default set: a monochrome seamless cyclorama floor and background, open wide platform, and the same hanging vintage silver microphone in both angles. Change the hue above at any time.
                  </p>
                </div>
              )}

              <div className="aurora-glass p-3 rounded-xl">
                <p className="text-xs text-white/50 leading-relaxed">
                  Be specific — the AI embeds this description word-for-word into both shot prompts to keep the outfit consistent across wide and close-up angles.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 4: Generate wide shot ── */}
          {currentStep.id === "wide" && (
            <div className="space-y-4">
              <div className="aurora-glass p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                    style={{ background: selectedColor.swatch }}
                  />
                  <span className="text-sm text-white/80">{selectedColor.name} Cyclorama Studio</span>
                </div>
                <p className="text-xs text-white/40">Full body · 9:16 vertical · Hanging vintage mic · {costPerShot} Aura</p>
              </div>

              {wideResult ? (
                <div className="relative rounded-2xl overflow-hidden">
                  <img
                    src={wideResult.url}
                    alt="Wide shot"
                    className="w-full object-cover"
                    style={{ aspectRatio: "9/16" }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs text-white/80 font-medium">Wide shot ready ✓</p>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center"
                  style={{ aspectRatio: "9/16" }}
                >
                  <p className="text-white/30 text-sm">Your wide shot will appear here</p>
                </div>
              )}

              {wideResult && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={wideResult.approved ? "premium" : "outline"}
                    onClick={() => setWideResult({ ...wideResult, approved: true })}
                  >
                    <CheckCircle2 className="mr-2 size-4" /> {wideResult.approved ? "Wide approved" : "Approve wide"}
                  </Button>
                  <Button variant="outline" onClick={() => wideMut.mutate()} disabled={wideMut.isPending}>
                    <RefreshCw className="mr-2 size-4" /> Retry
                  </Button>
                </div>
              )}

              <Button
                variant={wideResult ? "glass" : "premium"}
                className="w-full"
                onClick={() => wideMut.mutate()}
                disabled={wideMut.isPending || !selfieUrl || !wideRefUrl || !closeupRefUrl}
              >
                {wideMut.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Generating…
                  </>
                ) : wideResult ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate Wide Shot
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Wide Shot — {costPerShot} Aura
                  </>
                )}
              </Button>
            </div>
          )}

          {/* ── Step 5: Generate close-up shot ── */}
          {currentStep.id === "closeup" && (
            <div className="space-y-4">
              <div className="aurora-glass p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                    style={{ background: selectedColor.swatch }}
                  />
                  <span className="text-sm text-white/80">{selectedColor.name} Cyclorama Studio</span>
                </div>
                <p className="text-xs text-white/40">Upper chest to crown · 85mm portrait · Mic blurred in bg · {costPerShot} Aura</p>
              </div>

              {closeupResult ? (
                <div className="relative rounded-2xl overflow-hidden">
                  <img
                    src={closeupResult.url}
                    alt="Close-up shot"
                    className="w-full object-cover"
                    style={{ aspectRatio: "9/16" }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs text-white/80 font-medium">Close-up ready ✓</p>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center"
                  style={{ aspectRatio: "9/16" }}
                >
                  <p className="text-white/30 text-sm">Your close-up will appear here</p>
                </div>
              )}

              {closeupResult && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={closeupResult.approved ? "premium" : "outline"}
                    onClick={() => setCloseupResult({ ...closeupResult, approved: true })}
                  >
                    <CheckCircle2 className="mr-2 size-4" /> {closeupResult.approved ? "Close-up approved" : "Approve close-up"}
                  </Button>
                  <Button variant="outline" onClick={() => closeupMut.mutate()} disabled={closeupMut.isPending}>
                    <RefreshCw className="mr-2 size-4" /> Retry
                  </Button>
                </div>
              )}

              <Button
                variant={closeupResult ? "glass" : "premium"}
                className="w-full"
                onClick={() => closeupMut.mutate()}
                disabled={closeupMut.isPending || !selfieUrl || !wideRefUrl || !closeupRefUrl}
              >
                {closeupMut.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Generating…
                  </>
                ) : closeupResult ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate Close-Up
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Close-Up — {costPerShot} Aura
                  </>
                )}
              </Button>
            </div>
          )}

          {/* ── Step 6: Now Record — instructional card + checklist ── */}
          {currentStep.id === "record" && (
            <div className="space-y-4">
              <div className="aurora-glass p-4 rounded-2xl border border-primary/20">
                <p className="text-sm text-white/80 font-medium mb-1">Your AI stills are ready.</p>
                <p className="text-sm text-white/60 leading-relaxed">
                  Now record your real phone footage matching each angle. Aurora will composite your live video with the generated looks in Motion Control.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([
                  ["wideVideo", "Wide performance", wideVideoUrl, wideVideoInputRef],
                  ["closeupVideo", "Close-up performance", closeupVideoUrl, closeupVideoInputRef],
                ] as const).map(([slot, label, value, ref]) => (
                  <div key={slot}>
                    <button
                      type="button"
                      onClick={() => ref.current?.click()}
                      className={cn(
                        "w-full aspect-[9/16] rounded-2xl border border-dashed overflow-hidden flex flex-col items-center justify-center gap-2",
                        value ? "border-primary/50" : "border-white/20 bg-white/5",
                      )}
                    >
                      {uploadingSlot === slot ? <RefreshCw className="size-6 animate-spin text-primary" /> :
                        value ? <video src={value} muted playsInline className="size-full object-cover" /> :
                        <><Video className="size-6 text-white/40" /><span className="px-2 text-xs text-white/60">{label}</span><span className="text-[10px] text-white/35">3–30 seconds</span></>}
                    </button>
                    <input
                      ref={ref}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFileUpload(file, slot);
                        event.target.value = "";
                      }}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-left"
              >
                <span className="text-xs font-semibold text-white/70">Optional song audio</span>
                <span className="block mt-1 text-[11px] text-white/40">{audioUrl ? "Bound to editor handoff as reference playback; not applied to motion transfer or lip-sync" : "Upload a song for reference playback in the editor; no automatic lip-sync or export mix"}</span>
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFileUpload(file, "audio");
                  event.target.value = "";
                }}
              />

              <div className="space-y-3">
                {RECORD_CHECKLIST.map((item) => (
                  <div key={item.label} className="aurora-glass p-4 rounded-xl flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5 shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {(wideResult || closeupResult) && (
                <div className="grid grid-cols-2 gap-3">
                  {wideResult && (
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={wideResult.url}
                        alt="Wide shot"
                        className="w-full object-cover"
                        style={{ aspectRatio: "9/16" }}
                      />
                      <div className="absolute bottom-0 inset-x-0 p-2 text-center text-xs font-medium text-white bg-black/60">
                        Wide
                      </div>
                    </div>
                  )}
                  {closeupResult && (
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={closeupResult.url}
                        alt="Close-up"
                        className="w-full object-cover"
                        style={{ aspectRatio: "9/16" }}
                      />
                      <div className="absolute bottom-0 inset-x-0 p-2 text-center text-xs font-medium text-white bg-black/60">
                        Close-Up
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 7: real motion transfer + independent review ── */}
          {currentStep.id === "animate" && (
            <div className="space-y-4">
              <div className="aurora-glass p-4 rounded-2xl border border-primary/20">
                <p className="text-sm text-white/70 leading-relaxed">
                  Each approved plate is driven by its matching phone video. Aurora queues a real motion-transfer preview first—never text-to-video. One angle can succeed even if the other needs a retry.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ["wide", wideResult, wideVideoUrl, widePrompt, setWidePrompt, wideClip, wideGeneration],
                  ["closeup", closeupResult, closeupVideoUrl, closeupPrompt, setCloseupPrompt, closeupClip, closeupGeneration],
                ] as const).map(([angle, plate, phoneVideo, prompt, setPrompt, clip, generation]) => {
                  if (!plate) return null;
                  const resultUrl = generation?.result_video_url;
                  const failed = generation?.status === "failed" || !!generation?.error;
                  const complete = !!resultUrl;
                  const processing = !!clip && !complete && !failed;
                  const previewGeneration = clip?.previewId
                    ? generations?.items.find((item) => item.id === clip.previewId)
                    : undefined;
                  const previewReady = !!previewGeneration?.result_video_url &&
                    ["succeeded", "complete"].includes(previewGeneration.status ?? "");
                  const showingPreview = !!clip?.previewId && clip.generationId === clip.previewId;
                  return (
                    <article key={angle} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <img src={plate.url} alt={`${angle} approved plate`} className="aspect-[9/16] w-full rounded-xl object-cover" />
                        {resultUrl ? (
                          <video src={resultUrl} controls playsInline className="aspect-[9/16] w-full rounded-xl bg-black object-cover" />
                        ) : phoneVideo ? (
                          <video src={phoneVideo} muted playsInline className="aspect-[9/16] w-full rounded-xl bg-black object-cover opacity-70" />
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold capitalize text-white">{angle === "closeup" ? "Close-up" : "Wide"} clip</p>
                        <span className={cn(
                          "rounded-full px-2 py-1 text-[10px] font-semibold",
                          complete ? "bg-emerald-500/15 text-emerald-300" :
                            failed ? "bg-red-500/15 text-red-300" :
                              processing ? "bg-amber-500/15 text-amber-200" : "bg-white/10 text-white/50",
                        )}>
                          {complete ? "Ready" : failed ? "Failed" : processing ? generation?.status ?? "Queued" : "Not started"}
                        </span>
                      </div>
                      <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        rows={3}
                        maxLength={800}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75 resize-none"
                        aria-label={`${angle} motion direction`}
                      />
                      {failed && <p className="text-xs text-red-300">{generation?.error ?? "This angle failed. Retry it independently."}</p>}
                      <Button
                        variant="premium"
                        className="w-full"
                        disabled={enqueueTransfer.isPending || processing || !phoneVideo}
                        onClick={() => enqueueTransfer.mutate(angle)}
                      >
                        {enqueueTransfer.isPending && enqueueTransfer.variables === angle ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Video className="mr-2 size-4" />}
                        {previewReady ? (failed ? "Retry full render" : showingPreview ? "Approve preview · render full" : complete ? "Render full again" : "Render full") : failed ? "Retry fresh preview" : clip ? "Preview rendering…" : "Generate motion preview"}
                      </Button>
                      {resultUrl && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => void saveAssetToDisk(resultUrl, `aurora-${angle}-performance.mp4`)}>
                            <Download className="mr-2 size-4" /> Export
                          </Button>
                          <Button
                            variant="outline"
                            disabled={editHandoff.isPending}
                            onClick={() => editHandoff.mutate({ generationId: generation.id, angle })}
                          >
                            <Pencil className="mr-2 size-4" /> Edit
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link to="/gallery" className="flex items-center justify-center gap-2 w-full py-3 aurora-glass rounded-xl text-sm text-white/70 hover:text-white transition-colors">
                  Review in Gallery
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!user) return;
                    clearPerformanceWorkflow(user.id);
                    const next = emptyPerformanceWorkflow(search.mode === "anywhere" ? "anywhere" : "colors");
                    setStep(next.step);
                    setSelfieUrl(null);
                    setWideRefUrl(null);
                    setCloseupRefUrl(null);
                    setOutfitRefUrl(null);
                    setWideResult(null);
                    setCloseupResult(null);
                    setWideVideoUrl(null);
                    setCloseupVideoUrl(null);
                    setAudioUrl(null);
                    setWideClip(null);
                    setCloseupClip(null);
                  }}
                >
                  <RotateCcw className="mr-2 size-4" /> New workflow
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Next / advance button */}
        {currentStep.id !== "animate" && (
          <div className="px-4 pb-8 pt-2 border-t border-white/8">
            <Button
              variant="premium"
              className="w-full"
              disabled={!canAdvance()}
              onClick={() => setStep(step + 1)}
            >
              {currentStep.id === "upload" && !selfieUrl
                ? "Upload selfie to continue"
                : currentStep.id === "wide" && !wideResult?.approved
                ? wideResult ? "Approve wide plate to continue" : "Generate to continue"
                : currentStep.id === "closeup" && !closeupResult?.approved
                ? closeupResult ? "Approve close-up plate to continue" : "Generate to continue"
                : currentStep.id === "record" && (!wideVideoUrl || !closeupVideoUrl)
                ? "Upload both angle performances"
                : step === totalSteps - 2
                ? "Animate my shots"
                : "Next"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
