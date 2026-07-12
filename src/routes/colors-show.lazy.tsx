import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Upload, Sparkles, CheckCircle2, Video, Film, RefreshCw } from "lucide-react";
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
import { Button } from "@/components/ui/button";

export const Route = createLazyFileRoute("/colors-show")({
  component: ColorsShowPage,
});

type ShotResult = { url: string; generationId: string } | null;

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

function ColorsShowPage() {
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const totalSteps = COLORS_SHOW_STEPS.length;

  // Step 1
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [colorRefUrl, setColorRefUrl] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<"selfie" | "colorRef" | null>(null);

  // Step 2
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);

  // Step 3
  const [outfit, setOutfit] = useState("");

  // Steps 4 & 5
  const [wideResult, setWideResult] = useState<ShotResult>(null);
  const [closeupResult, setCloseupResult] = useState<ShotResult>(null);

  const selfieInputRef = useRef<HTMLInputElement>(null);
  const colorRefInputRef = useRef<HTMLInputElement>(null);

  const shotFn = useServerFn(generateColorsShowShot);

  const wideMut = useMutation({
    mutationFn: () =>
      shotFn({
        data: {
          selfieUrl: selfieUrl!,
          colorName: selectedColor.name,
          outfit: outfit.trim(),
          shotType: "wide",
          ...(colorRefUrl ? { colorRefUrl } : {}),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error); return; }
      setWideResult({ url: res.url, generationId: res.generationId });
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
          ...(colorRefUrl ? { colorRefUrl } : {}),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error); return; }
      setCloseupResult({ url: res.url, generationId: res.generationId });
      toast.success("Close-up ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const handleFileUpload = async (file: File, slot: "selfie" | "colorRef") => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (!user) { toast.error("Please sign in first"); return; }
    setUploadingSlot(slot);
    try {
      const url = await uploadToStudio(user.id, file);
      if (slot === "selfie") setSelfieUrl(url);
      else setColorRefUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  };

  const canAdvance = (): boolean => {
    const s = COLORS_SHOW_STEPS[step].id;
    if (s === "upload") return !!selfieUrl;
    if (s === "outfit") return outfit.trim().length >= 3;
    if (s === "wide") return !!wideResult;
    if (s === "closeup") return !!closeupResult;
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
              Colors Show Creator
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

              {/* Colors reference screenshot — optional */}
              <div>
                <div className="text-xs font-semibold tracking-wider uppercase text-white/50 mb-2">
                  Colors Reference Screenshot{" "}
                  <span className="text-white/30 normal-case font-normal">(optional)</span>
                </div>
                <button
                  onClick={() => colorRefInputRef.current?.click()}
                  disabled={uploadingSlot === "colorRef"}
                  className={cn(
                    "w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all overflow-hidden",
                    colorRefUrl ? "border-primary/50" : "border-white/20 bg-white/5 hover:border-white/40",
                  )}
                  style={{ aspectRatio: "3/4" }}
                >
                  {uploadingSlot === "colorRef" ? (
                    <RefreshCw className="w-7 h-7 text-primary animate-spin" />
                  ) : colorRefUrl ? (
                    <img src={colorRefUrl} alt="Colors reference" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-white/40" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-white/70">Colors reference screenshot</p>
                        <p className="text-xs text-white/40 mt-1">Wide + close-up angle refs from Colors Studio</p>
                      </div>
                    </>
                  )}
                </button>
                <input
                  ref={colorRefInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileUpload(f, "colorRef");
                    e.target.value = "";
                  }}
                />
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

              <Button
                variant={wideResult ? "glass" : "premium"}
                className="w-full"
                onClick={() => wideMut.mutate()}
                disabled={wideMut.isPending}
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

              <Button
                variant={closeupResult ? "glass" : "premium"}
                className="w-full"
                onClick={() => closeupMut.mutate()}
                disabled={closeupMut.isPending}
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

          {/* ── Step 7: Animate — deep-links with both images ── */}
          {currentStep.id === "animate" && (
            <div className="space-y-4">
              <div className="aurora-glass p-4 rounded-2xl border border-primary/20">
                <p className="text-sm text-white/70 leading-relaxed">
                  Open each still in Motion Control to animate it with your phone recording. Tap the button below each shot to begin.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {wideResult && (
                  <div className="flex flex-col gap-2">
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={wideResult.url}
                        alt="Wide shot"
                        className="w-full object-cover"
                        style={{ aspectRatio: "9/16" }}
                      />
                    </div>
                    <Link
                      to="/motion"
                      search={{ image: wideResult.url, ...(closeupResult ? { image2: closeupResult.url } : {}) }}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Animate Wide
                    </Link>
                  </div>
                )}
                {closeupResult && (
                  <div className="flex flex-col gap-2">
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={closeupResult.url}
                        alt="Close-up"
                        className="w-full object-cover"
                        style={{ aspectRatio: "9/16" }}
                      />
                    </div>
                    <Link
                      to="/motion"
                      search={{ image: closeupResult.url, ...(wideResult ? { image2: wideResult.url } : {}) }}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Animate Close-Up
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/gallery"
                className="flex items-center justify-center gap-2 w-full py-3 aurora-glass rounded-xl text-sm text-white/70 hover:text-white transition-colors"
              >
                View All Shots in Gallery
              </Link>
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
                : currentStep.id === "wide" && !wideResult
                ? "Generate to continue"
                : currentStep.id === "closeup" && !closeupResult
                ? "Generate to continue"
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
