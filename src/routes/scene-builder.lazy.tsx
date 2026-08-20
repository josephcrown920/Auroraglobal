import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clapperboard, Camera, Upload, Sparkles, Video, RefreshCw, Plus, X, Smartphone, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  SLOT_LABELS,
  SLOT_HINTS,
  RE_ANGLE_CHIPS,
  SCENE_BUILDER_COST_BASE,
  SCENE_BUILDER_COST_REANGLE,
  buildBaseScenePrompt,
  buildReAnglePrompt,
} from "@/lib/scene-builder.templates";
import { generateBaseScene } from "@/lib/scene-builder.functions";
import { generatePerformanceShot, listGenerations } from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";
import { HiggsHero, StepGuide, type GuideStep } from "@/components/studio/HiggsLayout";
import { PhotoshootPresetLibrary } from "@/components/photoshoots/PhotoshootPresetLibrary";
import type { PhotoShootPreset } from "@/lib/photoshoot-presets";

export const Route = createLazyFileRoute("/scene-builder")({
  component: SceneBuilderPage,
});

const SLOT_COUNT = SLOT_LABELS.length;

type SceneSnapshot = {
  referenceUrls: string[];
  compositorPrompt: string;
};

type AngleTask = {
  label: string;
  cameraPrompt: string;
  chipId?: string;
};

type AngleJob = {
  generationId: string;
  label: string;
  chipId?: string;
};

// Convert a relative URL (e.g. watermark proxy "/api/public/...") to an
// absolute HTTPS URL so motion.tsx validateSearch (which requires ^https://)
// accepts it when an angle card links to /motion.
function toAbsoluteUrl(url: string): string {
  if (typeof url !== "string" || url.startsWith("http")) return url;
  if (typeof window !== "undefined") return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  return url;
}

async function uploadToStudio(userId: string, file: File, kind: "image" | "video" = "image"): Promise<string> {
  const maxMb = kind === "video" ? 200 : 20;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`${kind === "video" ? "Video" : "Image"} must be under ${maxMb} MB`);
  const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
  const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("studio").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data: signed, error: signErr } = await supabase.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL");
  return signed.signedUrl;
}

function SceneBuilderPage() {
  const { user } = useAuth();
  const [selectedPhotoShoot, setSelectedPhotoShoot] = useState<PhotoShootPreset | null>(null);

  // 5 labeled upload slots: Selfie, Outfit, Location, Pose, Prop/Car
  const [slots, setSlots] = useState<(string | null)[]>(Array(SLOT_COUNT).fill(null));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSlotIdx, setPendingSlotIdx] = useState<number>(0);

  // Phone Performance — optional phone video for motion control
  const [phoneVideoUrl, setPhoneVideoUrl] = useState<string | null>(null);
  const [phoneVideoUploading, setPhoneVideoUploading] = useState(false);
  const phoneVideoRef = useRef<HTMLInputElement>(null);

  // Swap fields for {outfit}, {location}, {prop} tokens
  const [outfit, setOutfit] = useState("");
  const [location, setLocation] = useState("");
  const [prop, setProp] = useState("");

  // Editable compositor prompt — starts from template, user can override
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const compositorPrompt = promptOverride ?? buildBaseScenePrompt(outfit, location, prop);

  // Base scene result
  const [baseResult, setBaseResult] = useState<{ url: string; generationId: string } | null>(null);
  const [sceneSnapshot, setSceneSnapshot] = useState<SceneSnapshot | null>(null);

  // Re-angle state
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [freeformAngle, setFreeformAngle] = useState("");
  // Each enqueued angle is tracked by its generation ID so we can poll for results.
  const [angleJobs, setAngleJobs] = useState<AngleJob[]>([]);

  const baseFn = useServerFn(generateBaseScene);
  const enqueueFn = useServerFn(generatePerformanceShot);
  const listFn = useServerFn(listGenerations);

  const isDone = (s: string) =>
    s === "done" || s === "completed" || s === "succeeded" || s === "complete";
  const isFailed = (s: string) => s === "error" || s === "failed";

  const hasActiveJobs = angleJobs.length > 0;

  // Poll listGenerations while there are tracked angle jobs. refetchInterval is a
  // function so it can inspect the query's own cached data and return false once
  // every tracked job has reached a terminal state — preventing an infinite poll.
  const { data: genData } = useQuery({
    queryKey: ["scene-builder-gens", user?.id],
    queryFn: () => listFn(),
    enabled: !!user && hasActiveJobs,
    refetchInterval: (query) => {
      if (!angleJobs.length) return false;
      type Item = { id: string; status: string };
      const items = (
        query.state.data as { items?: Item[] } | undefined
      )?.items;
      if (!items) return 3_000;
      const allTerminal = angleJobs.every((job) => {
        const gen = items.find((g) => g.id === job.generationId);
        if (!gen) return false;
        return isDone(gen.status) || isFailed(gen.status);
      });
      return allTerminal ? false : 3_000;
    },
    staleTime: 0,
  });

  // Derive per-angle card data by cross-referencing tracked jobs with live gens.
  const angleCards = angleJobs.map((job) => {
    const gen = (genData?.items as Array<{
      id: string; status: string;
      result_image_url: string | null; error: string | null;
    }> | undefined)?.find((g) => g.id === job.generationId);
    return {
      generationId: job.generationId,
      label: job.label,
      status: gen?.status ?? "queued",
      url: gen?.result_image_url ?? null,
      error: gen?.error ?? null,
    };
  });

  const filledSlots = slots.filter(Boolean).length;
  const presetNeedsSelfie = !!selectedPhotoShoot && !slots[0];

  const baseMut = useMutation({
    mutationFn: async () => {
      const snapshot: SceneSnapshot = {
        referenceUrls: slots.filter((s): s is string => !!s),
        compositorPrompt,
      };
      const result = await baseFn({ data: snapshot });
      return { result, snapshot };
    },
    onSuccess: ({ result: res, snapshot }) => {
      if (!res.ok) { toast.error(res.error); return; }
      setBaseResult({ url: res.url, generationId: res.generationId });
      setSceneSnapshot(snapshot);
      setAngleJobs([]);
      setSelectedChips(new Set());
      setFreeformAngle("");
      toast.success("Base scene ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const enqueueAngleTasks = async (tasks: AngleTask[]) => {
    if (!baseResult || !sceneSnapshot) {
      throw new Error("Generate a base scene before adding angles");
    }

    // Enqueue-only: one reserveGenerationJob call per angle (same path as
    // /colors bulk modes). Jobs survive tab navigation; results appear in the
    // Gallery once the tick worker renders them.
    const results = await Promise.allSettled(
      tasks.map((task) =>
        enqueueFn({
          data: {
            // Use the prompt captured for the successful base scene, rather
            // than any fields the user may have edited afterward.
            prompt: `[Scene Builder / ${task.label}]\n\n${sceneSnapshot.compositorPrompt}\n\n${buildReAnglePrompt(task.cameraPrompt)}`,
            imageUrls: [baseResult.url, ...sceneSnapshot.referenceUrls].slice(0, 6),
            motionVideoUrl: null,
            model: "google/gemini-3.1-flash-image-preview",
          },
        }),
      ),
    );

    // Pair each settled result with its task label/chip so cards and the
    // missing-angle list stay aligned even when one enqueue fails.
    const enqueued: AngleJob[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        enqueued.push({
          generationId: result.value.generationId,
          label: tasks[i].label,
          chipId: tasks[i].chipId,
        });
      }
    }
    if (enqueued.length === 0) {
      const first = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
      throw first?.reason instanceof Error ? first.reason : new Error("Could not queue angles");
    }
    return { enqueued, total: tasks.length };
  };

  const addQueuedAngles = ({
    enqueued,
    total,
  }: {
    enqueued: AngleJob[];
    total: number;
  }) => {
    setAngleJobs((prev) => [...prev, ...enqueued]);
    if (enqueued.length < total) {
      toast.warning(`${enqueued.length}/${total} angles queued — the rest failed`);
    } else {
      toast.success(
        `${enqueued.length} angle${enqueued.length > 1 ? "s" : ""} queued — rendering in the background`,
      );
    }
    setSelectedChips(new Set());
    setFreeformAngle("");
  };

  const angleMut = useMutation({
    mutationFn: async () => {
      const tasks: AngleTask[] = [
        ...Array.from(selectedChips).flatMap((chipId) => {
          const chip = RE_ANGLE_CHIPS.find((candidate) => candidate.id === chipId);
          return chip
            ? [{ label: chip.label, cameraPrompt: chip.cameraPrompt, chipId: chip.id }]
            : [];
        }),
        ...(freeformAngle.trim()
          ? [{ label: "Custom Angle", cameraPrompt: freeformAngle.trim() }]
          : []),
      ];
      return enqueueAngleTasks(tasks);
    },
    onSuccess: ({ enqueued, total }) => {
      addQueuedAngles({ enqueued, total });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Re-angle failed"),
  });

  const generatedChipIds = new Set(
    angleJobs.flatMap((job) => (job.chipId ? [job.chipId] : [])),
  );
  const remainingAngles = RE_ANGLE_CHIPS.filter((chip) => !generatedChipIds.has(chip.id));

  const moreAnglesMut = useMutation({
    mutationFn: () =>
      enqueueAngleTasks(
        remainingAngles.map((chip) => ({
          chipId: chip.id,
          label: chip.label,
          cameraPrompt: chip.cameraPrompt,
        })),
      ),
    onSuccess: ({ enqueued, total }) => {
      addQueuedAngles({ enqueued, total });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not generate more angles"),
  });

  const handleFileUpload = async (file: File, slotIdx: number) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (!user) { toast.error("Please sign in first"); return; }
    setUploadingIdx(slotIdx);
    try {
      const url = await uploadToStudio(user.id, file, "image");
      setSlots((prev) => { const next = [...prev]; next[slotIdx] = url; return next; });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingIdx(null);
    }
  };

  const handlePhoneVideoUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) { toast.error("Please upload a video file (MP4, MOV, WebM)"); return; }
    if (!user) { toast.error("Please sign in first"); return; }
    setPhoneVideoUploading(true);
    try {
      const url = await uploadToStudio(user.id, file, "video");
      setPhoneVideoUrl(url);
      toast.success("Phone video ready — tap Animate to go to Motion Control");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video upload failed");
    } finally {
      setPhoneVideoUploading(false);
    }
  };

  const applyPhotoShootPreset = (preset: PhotoShootPreset) => {
    setSelectedPhotoShoot(preset);
    setLocation(preset.location);
    setOutfit(preset.outfit);
    setProp(preset.prop);
    setPromptOverride(preset.prompt);
    setSlots((prev) => {
      const next = [...prev];
      // The Location slot is a real scene reference; keeping it separate from
      // the Selfie slot lets an artist swap themselves into the chosen preset.
      next[2] = `${window.location.origin}${preset.image}`;
      return next;
    });
    toast.success(`${preset.title} loaded — add your photo to the Selfie slot`);
  };

  const anglesOrFreeform = selectedChips.size > 0 || freeformAngle.trim().length > 0;
  const angleCount = selectedChips.size + (freeformAngle.trim() ? 1 : 0);
  const angleMutating = angleMut.isPending || moreAnglesMut.isPending;

  return (
    <div className="aurora-page-shell lg:flex lg:flex-row lg:h-[100dvh] lg:overflow-hidden">
      <div className="aurora-ambient" />

      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col w-full lg:w-[320px] lg:shrink-0 lg:h-full lg:overflow-y-auto lg:border-r lg:border-white/8 scrollbar-none min-h-[100dvh] lg:min-h-0 pb-24 lg:pb-8">
        {/* Header */}
        <div className="px-4 pt-4 pb-4 flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold tracking-widest uppercase text-primary">
            Directors ROOM
          </span>
        </div>

        {/* ── Sub-tools: Scene Weaver + Storyboard ────────────────────── */}
        <div className="px-4 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Also in Directors ROOM</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/scene-weaver"
              className="group relative overflow-hidden rounded-xl no-underline"
              style={{ background: "oklch(0.12 0.016 272)", border: "1px solid oklch(1 0 0 / 0.07)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-3.5 flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Camera className="size-4 text-primary" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">Scene Weaver</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Weave cinematic shots from your references</p>
                </div>
              </div>
            </Link>
            <Link
              to="/storyboard"
              className="group relative overflow-hidden rounded-xl no-underline"
              style={{ background: "oklch(0.12 0.016 272)", border: "1px solid oklch(1 0 0 / 0.07)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-3.5 flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Clapperboard className="size-4 text-primary" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">Storyboard</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Plan and visualise your shot sequence</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="px-4 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Build Your Scene.</h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Drop your references — Aurora stages the cinematic world. Upload your selfie, outfit, location and prop, then generate. Optionally animate with your phone performance using Motion Control. Powered by <span className="text-white/80 font-medium">Seedance 5.9 · Kling · Gemini Omni · Grok Imagine</span>.
            </p>
            {/* Model badges */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {["Seedance 5.9", "Kling", "Gemini Omni", "Grok Imagine"].map((m) => (
                <span key={m} className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                  <span className="size-1 rounded-full bg-primary animate-pulse" />
                  {m}
                </span>
              ))}
            </div>
          </div>

          <PhotoshootPresetLibrary
            selectedId={selectedPhotoShoot?.id}
            onSelect={applyPhotoShootPreset}
          />

          {/* ── 5 Labeled upload slots ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Reference Images
              </span>
              <span className="text-xs text-white/30">{filledSlots} / {SLOT_COUNT} uploaded</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {SLOT_LABELS.map((label, idx) => (
                <div key={label} className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setPendingSlotIdx(idx);
                      fileInputRef.current?.click();
                    }}
                    disabled={uploadingIdx === idx}
                    className={cn(
                      "w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all overflow-hidden relative group",
                      slots[idx] ? "border-primary/40" : "border-white/20 bg-white/5 hover:border-white/35",
                    )}
                    style={{ aspectRatio: "3/4" }}
                  >
                    {uploadingIdx === idx ? (
                      <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                    ) : slots[idx] ? (
                      <>
                        <img
                          src={slots[idx]!}
                          alt={label}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSlots((prev) => { const next = [...prev]; next[idx] = null; return next; });
                          }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </>
                    ) : (
                      <Upload className="w-4 h-4 text-white/30" />
                    )}
                  </button>
                  <span className="text-[10px] font-semibold text-center text-white/50 truncate leading-tight">
                    {label}
                  </span>
                  {!slots[idx] && (
                    <span className="text-[9px] text-center text-white/25 leading-tight line-clamp-2">
                      {SLOT_HINTS[idx]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileUpload(f, pendingSlotIdx);
                e.target.value = "";
              }}
            />
          </section>

          {/* ── Swap fields: {outfit}, {location}, {prop} ── */}
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">
                Scene Token Fields
              </p>
              <p className="text-xs text-white/40 leading-relaxed">
                Fill in these fields — they replace the{" "}
                <code className="text-primary/80">{"{outfit}"}</code>,{" "}
                <code className="text-primary/80">{"{location}"}</code>, and{" "}
                <code className="text-primary/80">{"{prop}"}</code> tokens in the compositor prompt below.
              </p>
            </div>

            {(
              [
                { label: "Outfit", placeholder: "e.g. oversized denim jacket, white crop top, black cargo pants", value: outfit, set: setOutfit },
                { label: "Location", placeholder: "e.g. rooftop at golden hour, downtown street with neon signs", value: location, set: setLocation },
                { label: "Prop / Car", placeholder: "e.g. matte black sports car, vintage cassette player", value: prop, set: setProp },
              ] as const
            ).map(({ label, placeholder, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5">
                  {label}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    (set as (v: string) => void)(e.target.value);
                    setPromptOverride(null);
                  }}
                  placeholder={placeholder}
                  className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            ))}
          </section>

          {/* ── Compositor prompt — fully editable ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Compositor Prompt
              </span>
              {promptOverride !== null && (
                <button
                  onClick={() => setPromptOverride(null)}
                  className="text-[10px] text-primary/70 hover:text-primary underline"
                >
                  Reset to template
                </button>
              )}
            </div>
            <textarea
              value={compositorPrompt}
              onChange={(e) => setPromptOverride(e.target.value)}
              rows={10}
              maxLength={3000}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-xs text-white/80 resize-none focus:outline-none focus:border-primary/60 transition-colors leading-relaxed"
            />
            <p className="text-xs text-white/25 mt-1 text-right">
              {compositorPrompt.length}/3000
            </p>
          </section>

          {/* ── Generate Base Scene ── */}
          <section className="space-y-4">
            {selectedPhotoShoot && (
              <div className="rounded-2xl border border-primary/30 bg-primary/[0.07] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Photoshoot loaded
                </p>
                <p className="mt-1 text-xs font-semibold text-white">{selectedPhotoShoot.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                  The scene is now in the Location slot. Add your own image in
                  Selfie, then adjust the prompt or camera angles to make it yours.
                </p>
              </div>
            )}
            {baseResult && (
              <div className="relative rounded-2xl overflow-hidden">
                <img
                  src={baseResult.url}
                  alt="Base scene"
                  className="w-full object-cover"
                  style={{ aspectRatio: "9/16" }}
                />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between">
                  <p className="text-xs text-white/80 font-medium">Base scene ready ✓</p>
                  <Link
                    to="/motion"
                    search={{ image: baseResult.url }}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary/30 border border-primary/50 text-primary text-xs font-semibold hover:bg-primary/40 transition-colors"
                  >
                    <Video className="w-3 h-3" />
                    Animate
                  </Link>
                </div>
              </div>
            )}

            <Button
              variant={baseResult ? "glass" : "premium"}
              className="w-full"
              onClick={() => baseMut.mutate()}
              disabled={baseMut.isPending || filledSlots === 0 || presetNeedsSelfie}
            >
              {baseMut.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Generating base scene…
                </>
              ) : baseResult ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate Base Scene — {SCENE_BUILDER_COST_BASE} Aura
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Base Scene — {SCENE_BUILDER_COST_BASE} Aura
                </>
              )}
            </Button>

            {presetNeedsSelfie ? (
              <p className="text-xs text-center text-primary/80">
                Add your own image to the Selfie slot before generating this photoshoot.
              </p>
            ) : filledSlots === 0 && (
              <p className="text-xs text-center text-white/30">Upload at least one reference to generate</p>
            )}
          </section>

          {baseResult && (
            <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <a
                href={baseResult.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left no-underline transition hover:border-primary/50 hover:bg-primary/[0.06]"
              >
                <span className="block text-xs font-semibold text-white">Open or save this render</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-white/45">
                  Save the completed still when you want to use it as the starting
                  reference in another Aurora tool.
                </span>
              </a>
              <Link
                to="/scene-weaver"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left no-underline transition hover:border-primary/50 hover:bg-primary/[0.06]"
              >
                <span className="block text-xs font-semibold text-white">Angles + HD finish</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-white/45">
                  Upload this completed render in Scene Weaver to build alternate
                  camera views and use 2× or 4× upscaling when the source supports it.
                </span>
              </Link>
              <Link
                to="/video-agent"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left no-underline transition hover:border-primary/50 hover:bg-primary/[0.06]"
              >
                <span className="block text-xs font-semibold text-white">Build the music video</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-white/45">
                  Start a Video Agent project when you are ready to turn this visual
                  direction into storyboards, frames, and a finished video.
                </span>
              </Link>
            </section>
          )}

          {/* ── Phone Performance — optional motion control ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-primary/70" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Phone Performance
                </span>
                <span className="text-[10px] rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/35">Optional</span>
              </div>
              {phoneVideoUrl && (
                <button
                  type="button"
                  onClick={() => setPhoneVideoUrl(null)}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-white/35 leading-relaxed mb-3">
              Drop a 30-second phone recording of yourself performing. Once you have a scene generated above, tap <span className="text-primary/70">Animate with Motion Control</span> to transfer your real movement into the AI scene.
            </p>

            {/* Video upload / preview */}
            <button
              type="button"
              onClick={() => phoneVideoRef.current?.click()}
              disabled={phoneVideoUploading}
              className={cn(
                "w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all overflow-hidden relative",
                phoneVideoUrl
                  ? "border-primary/40 bg-primary/5 p-0"
                  : "border-white/20 bg-white/5 hover:border-white/35 py-8",
              )}
            >
              {phoneVideoUploading ? (
                <><RefreshCw className="w-6 h-6 text-primary animate-spin" /><span className="text-xs text-white/50">Uploading…</span></>
              ) : phoneVideoUrl ? (
                <video
                  src={phoneVideoUrl}
                  className="w-full rounded-xl"
                  style={{ maxHeight: 200, objectFit: "cover" }}
                  muted
                  playsInline
                  controls
                />
              ) : (
                <>
                  <Smartphone className="w-8 h-8 text-white/25" />
                  <span className="text-sm font-medium text-white/40">Tap to upload phone video</span>
                  <span className="text-[11px] text-white/25">30 s · MP4, MOV, WebM · up to 200 MB</span>
                </>
              )}
            </button>
            <input
              ref={phoneVideoRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePhoneVideoUpload(f);
                e.target.value = "";
              }}
            />

            {/* Animate button — enabled when base scene is ready */}
            {baseResult && (
              <Link
                to="/motion"
                search={{ image: toAbsoluteUrl(baseResult.url) }}
                className={cn(
                  "mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all",
                  "bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30",
                )}
              >
                <Play className="w-4 h-4" />
                Animate with Motion Control →
              </Link>
            )}
            {!baseResult && (
              <p className="mt-2 text-[11px] text-center text-white/25">
                Generate your base scene first, then animate it here
              </p>
            )}

            {/* Output video placeholder */}
            {baseResult && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-4 flex flex-col items-center gap-2">
                <Video className="w-6 h-6 text-white/20" />
                <p className="text-xs text-white/30 text-center leading-relaxed">
                  Your animated output video will appear in Motion Control after generation.
                  <br />
                  <Link to="/motion" className="text-primary/60 underline underline-offset-2">Open Motion Control →</Link>
                </p>
              </div>
            )}
          </section>

          {/* ── Add Angle — only visible after base scene is generated ── */}
          {baseResult && (
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">
                  Add Angle
                </p>
                <p className="text-xs text-white/40 leading-relaxed">
                  Re-angle this exact scene from a new camera position. The base scene image is the reference — only the framing changes.
                </p>
              </div>

              {/* Quick-add chips */}
              <div className="flex flex-wrap gap-2">
                {RE_ANGLE_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={generatedChipIds.has(chip.id) || angleMutating}
                    onClick={() =>
                      setSelectedChips((prev) => {
                        const next = new Set(prev);
                        if (next.has(chip.id)) next.delete(chip.id);
                        else next.add(chip.id);
                        return next;
                      })
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      generatedChipIds.has(chip.id)
                        ? "border-white/10 bg-white/5 text-white/25 cursor-not-allowed"
                        : selectedChips.has(chip.id)
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/20 bg-white/5 text-white/60 hover:border-white/35 hover:text-white/80",
                    )}
                  >
                    {generatedChipIds.has(chip.id) ? "✓ " : selectedChips.has(chip.id) ? "✓ " : ""}
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Freeform angle input */}
              <input
                type="text"
                value={freeformAngle}
                onChange={(e) => setFreeformAngle(e.target.value)}
                placeholder="Or describe any angle… e.g. bird's-eye looking straight down"
                maxLength={300}
                disabled={angleMutating}
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/60 transition-colors"
              />

              <Button
                variant="premium"
                className="w-full"
                onClick={() => angleMut.mutate()}
                disabled={angleMutating || !anglesOrFreeform}
              >
                {angleMut.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Generating {angleCount > 1 ? `${angleCount} angles` : "angle"}…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Generate {angleCount > 1 ? `${angleCount} Angles` : "Angle"}{" "}
                    — {angleCount * SCENE_BUILDER_COST_REANGLE} Aura
                  </>
                )}
              </Button>

              {/* Per-angle result cards — poll listGenerations every 3 s until all
                  enqueued jobs reach a terminal state (done / error). Each card
                  shows a spinner while queued/running, the rendered image when
                  done (with an "Animate in Motion Studio" deep-link), or an
                  error message if the worker rejected the job. */}
              {angleCards.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Angle Results
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {angleCards.map((card) => (
                      <div key={card.generationId} className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden bg-white/5">
                          {isDone(card.status) && card.url ? (
                            <img
                              src={card.url}
                              alt={card.label}
                              className="w-full object-cover"
                              style={{ aspectRatio: "9/16" }}
                            />
                          ) : isFailed(card.status) ? (
                            <div
                              className="w-full flex items-center justify-center bg-red-500/10 border border-red-500/20 rounded-xl"
                              style={{ aspectRatio: "9/16" }}
                            >
                              <p className="text-xs text-red-400/70 text-center px-2">
                                {card.error ?? "Failed"}
                              </p>
                            </div>
                          ) : (
                            <div
                              className="w-full flex flex-col items-center justify-center gap-2"
                              style={{ aspectRatio: "9/16" }}
                            >
                              <RefreshCw className="w-5 h-5 text-primary/60 animate-spin" />
                              <p className="text-xs text-white/50 text-center">{card.label}</p>
                              <p className="text-[10px] text-white/30">Rendering…</p>
                            </div>
                          )}
                          {isDone(card.status) && card.url && (
                            <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                              <p className="text-[10px] font-medium text-white/70">{card.label}</p>
                            </div>
                          )}
                        </div>
                        {isDone(card.status) && card.url && (
                          <Link
                            to="/motion"
                            search={{ image: toAbsoluteUrl(card.url) }}
                            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
                          >
                            <Video className="w-3 h-3" />
                            Animate in Motion Studio
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {remainingAngles.length > 0 && (
                <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">
                        {angleJobs.length > 0 ? "More angles" : "Generate all angles"}
                      </p>
                      <span className="text-[10px] text-white/35">
                        {angleJobs.length > 0 ? `${remainingAngles.length} remaining` : `${RE_ANGLE_CHIPS.length} presets`}
                      </span>
                    </div>
                    <p className="text-xs text-white/45 leading-relaxed mt-1">
                      {angleJobs.length > 0
                        ? "Keep the same scene and generate every camera angle you have not tried yet."
                        : "Your base scene is ready. Generate all six preset camera angles without rebuilding it."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {remainingAngles.map((chip) => (
                      <span
                        key={chip.id}
                        className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/60"
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="glass"
                    className="w-full"
                    onClick={() => moreAnglesMut.mutate()}
                    disabled={angleMutating}
                  >
                    {moreAnglesMut.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        {angleJobs.length > 0 ? "Queuing remaining angles…" : "Queuing all angles…"}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        {angleJobs.length > 0 ? "Generate Remaining Angles" : "Generate All Angles"}{" "}
                        — {remainingAngles.length * SCENE_BUILDER_COST_REANGLE} Aura
                      </>
                    )}
                  </Button>
                </section>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ── Right panel: hero / result — desktop only ───────────────── */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:h-full lg:overflow-y-auto bg-zinc-900/40 scrollbar-none relative z-10">
        {baseResult ? (
          <div className="flex flex-1 h-full items-center justify-center p-8">
            <div className="relative max-w-full flex flex-col items-center gap-4">
              <img
                src={baseResult.url}
                alt="Base scene"
                className="max-h-[72vh] object-contain rounded-2xl shadow-2xl shadow-black/60"
              />
              <Link
                to="/motion"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors shadow-lg"
              >
                <Video className="w-4 h-4" />
                Animate with Motion Control →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <HiggsHero
              kicker="Directors ROOM"
              lines={["DIRECT ANYTHING", "YOU IMAGINE"]}
              bracketWord="YOU IMAGINE"
              description="Build cinematic scenes from your references. Upload your character, outfit, location, and prop — Aurora stages the world."
            />
            <StepGuide
              steps={[
                { icon: <Upload className="size-4" />, title: "UPLOAD REFERENCES", description: "Selfie, outfit, location, pose, and prop — up to 5 sources" },
                { icon: <Sparkles className="size-4" />, title: "GENERATE SCENE", description: "Aurora composites a cinema-quality scene using your references" },
                { icon: <Video className="size-4" />, title: "ANIMATE IT", description: "Send the result to Motion Control and add real movement" },
              ] as GuideStep[]}
            />
          </>
        )}
      </div>
    </div>
  );
}
