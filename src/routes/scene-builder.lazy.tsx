import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Layers, Upload, Sparkles, Video, RefreshCw, Plus, X } from "lucide-react";
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
import { generatePerformanceShot } from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";

export const Route = createLazyFileRoute("/scene-builder")({
  component: SceneBuilderPage,
});

const SLOT_COUNT = SLOT_LABELS.length;

async function uploadToStudio(userId: string, file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Image must be under 20 MB");
  const ext = file.name.split(".").pop() || "jpg";
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
  const [queuedCount, setQueuedCount] = useState(0);

  const baseFn = useServerFn(generateBaseScene);
  const enqueueFn = useServerFn(generatePerformanceShot);

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

      const ok = results.filter((r) => r.status === "fulfilled").length;
      if (ok === 0) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
        throw first?.reason instanceof Error ? first.reason : new Error("Could not queue angles");
      }
      return { ok, total: tasks.length };
    },
    onSuccess: ({ ok, total }) => {
      setQueuedCount((prev) => prev + ok);
      if (ok < total) toast.warning(`${ok}/${total} angles queued — the rest failed`);
      else toast.success(`${ok} angle${ok > 1 ? "s" : ""} queued — they'll appear in your Gallery when ready`);
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
      const url = await uploadToStudio(user.id, file);
      setSlots((prev) => { const next = [...prev]; next[slotIdx] = url; return next; });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingIdx(null);
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
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold tracking-widest uppercase text-primary">
            Scene Builder
          </span>
        </div>

        <div className="px-4 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Build Your Scene</h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Upload up to 5 labeled references, fill in the outfit, location, and prop fields — Aurora composites everything into a cinematic still.
            </p>
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
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-xs text-white/80 resize-none focus:outline-none focus:border-primary/60 transition-colors font-mono leading-relaxed"
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

              {/* Queued-angles status — results render in the background and
                  appear in the Gallery once the tick worker completes them. */}
              {queuedCount > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/80">
                      {queuedCount} angle{queuedCount > 1 ? "s" : ""} rendering in the background
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      They'll appear in your Gallery when ready
                    </p>
                  </div>
                  <Link
                    to="/gallery"
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                  >
                    View Gallery
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
