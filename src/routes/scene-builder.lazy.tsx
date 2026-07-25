import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clapperboard, Upload, Sparkles, Video, RefreshCw, Plus, X, Smartphone, Play } from "lucide-react";
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

export const Route = createLazyFileRoute("/scene-builder")({
  component: SceneBuilderPage,
});

const SLOT_COUNT = SLOT_LABELS.length;

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

  // Re-angle state
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [freeformAngle, setFreeformAngle] = useState("");
  // Each enqueued angle is tracked by its generation ID so we can poll for results.
  const [angleJobs, setAngleJobs] = useState<{ generationId: string; label: string }[]>([]);

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

  const baseMut = useMutation({
    mutationFn: () =>
      baseFn({
        data: {
          referenceUrls: slots.filter((s): s is string => !!s),
          compositorPrompt,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error); return; }
      setBaseResult({ url: res.url, generationId: res.generationId });
      toast.success("Base scene ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const angleMut = useMutation({
    mutationFn: async () => {
      // Collect all angles to enqueue
      const tasks = [
        ...Array.from(selectedChips).map((chipId) => {
          const chip = RE_ANGLE_CHIPS.find((c) => c.id === chipId)!;
          return { label: chip.label, cameraPrompt: chip.cameraPrompt };
        }),
        ...(freeformAngle.trim()
          ? [{ label: "Custom Angle", cameraPrompt: freeformAngle.trim() }]
          : []),
      ];

      // Enqueue-only: one reserveGenerationJob call per angle (same path as
      // /colors bulk modes). Jobs survive tab navigation; results appear in
      // the Gallery once the tick worker renders them.
      const results = await Promise.allSettled(
        tasks.map((t) =>
          enqueueFn({
            data: {
              prompt: `[Scene Builder / ${t.label}]\n\n${buildReAnglePrompt(t.cameraPrompt)}`,
              imageUrls: [baseResult!.url],
              motionVideoUrl: null,
              model: "google/gemini-3.1-flash-image-preview",
            },
          }),
        ),
      );

      // Pair each settled result with its task label to track gen IDs for polling.
      const enqueued: { generationId: string; label: string }[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled") {
          enqueued.push({ generationId: r.value.generationId, label: tasks[i].label });
        }
      }
      if (enqueued.length === 0) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
        throw first?.reason instanceof Error ? first.reason : new Error("Could not queue angles");
      }
      return { enqueued, total: tasks.length };
    },
    onSuccess: ({ enqueued, total }) => {
      setAngleJobs((prev) => [...prev, ...enqueued]);
      if (enqueued.length < total) toast.warning(`${enqueued.length}/${total} angles queued — the rest failed`);
      else toast.success(`${enqueued.length} angle${enqueued.length > 1 ? "s" : ""} queued — rendering in the background`);
      setSelectedChips(new Set());
      setFreeformAngle("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Re-angle failed"),
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

  const anglesOrFreeform = selectedChips.size > 0 || freeformAngle.trim().length > 0;
  const angleCount = selectedChips.size + (freeformAngle.trim() ? 1 : 0);

  return (
    <div className="aurora-page-shell">
      <div className="aurora-ambient" />

      <div className="relative z-10 min-h-[100dvh] pb-24">
        {/* Header */}
        <div className="px-4 pt-4 pb-4 flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold tracking-widest uppercase text-primary">
            Directors ROOM
          </span>
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
              disabled={baseMut.isPending || filledSlots === 0}
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

            {filledSlots === 0 && (
              <p className="text-xs text-center text-white/30">Upload at least one reference to generate</p>
            )}
          </section>

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
                      selectedChips.has(chip.id)
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-white/20 bg-white/5 text-white/60 hover:border-white/35 hover:text-white/80",
                    )}
                  >
                    {selectedChips.has(chip.id) && "✓ "}
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
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/60 transition-colors"
              />

              <Button
                variant="premium"
                className="w-full"
                onClick={() => angleMut.mutate()}
                disabled={angleMut.isPending || !anglesOrFreeform}
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
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
