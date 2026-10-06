import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getGuidedWorkflow } from "@/lib/guided-workflows.functions";
import {
  CATEGORY_LABELS,
  STEP_KIND_LABELS,
  fillPromptTemplate,
  type GuidedStep,
} from "@/lib/guided-workflows.schema";
import { usePerformanceShotJobFn, useVideoFromImageJobFn } from "@/lib/use-job-polling";
import { handleGenerationError } from "@/lib/error-toasts";
import { computeCost } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCopy,
  ImagePlus,
  Lightbulb,
  Link2,
  Loader2,
  Sparkles,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/guides/$slug")({
  component: GuideRunner,
});

const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const VIDEO_MODEL = "seedance-2.0-fast";

type StepResult = { imageUrl?: string; videoUrl?: string };

function SlotUpload({
  userId,
  label,
  description,
  required,
  value,
  onChange,
}: {
  userId: string;
  label: string;
  description?: string;
  required?: boolean;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
    setBusy(true);
    try {
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
      onChange(signed.signedUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex h-16 w-full items-center gap-3 overflow-hidden rounded-xl border border-dashed px-3 text-left transition-colors",
          value ? "border-primary/40 bg-card/60" : "border-border bg-card/30 hover:border-primary/40",
        )}
      >
        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background/60">
          {value ? (
            <img src={value} alt={label} className="size-full object-cover" />
          ) : busy ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="size-4 text-muted-foreground group-hover:text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
            {required && <span className="ml-1 text-primary">*</span>}
          </div>
          <div className="truncate text-xs text-foreground/80">
            {value ? "Uploaded" : description || "Tap to upload"}
          </div>
        </div>
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-1 text-muted-foreground hover:text-foreground"
          aria-label={`Remove ${label}`}
        >
          <X className="size-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function GuideRunner() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const getFn = useServerFn(getGuidedWorkflow);
  const genImageFn = usePerformanceShotJobFn();
  const genVideoFn = useVideoFromImageJobFn();

  const { data, isLoading, error } = useQuery({
    queryKey: ["guided-workflow", slug],
    queryFn: () => getFn({ data: { slug } }),
    staleTime: 5 * 60_000,
  });
  const workflow = data?.workflow;

  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [refs, setRefs] = useState<Record<string, Record<string, string | null>>>({});
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [previewTickets, setPreviewTickets] = useState<Record<string, string>>({});
  const [chainPrev, setChainPrev] = useState<Record<string, boolean>>({});
  const [variantIdx, setVariantIdx] = useState<Record<string, number>>({});

  const steps = useMemo(() => workflow?.steps ?? [], [workflow?.steps]);
  const step: GuidedStep | undefined = steps[stepIdx];

  const previousImage = useMemo(() => {
    for (let i = stepIdx - 1; i >= 0; i--) {
      const r = results[steps[i]?.id ?? ""];
      if (r?.imageUrl) return r.imageUrl;
    }
    return null;
  }, [results, steps, stepIdx]);

  const imageCost = computeCost({ features: ["image"] }).total;
  const videoPreviewCost = computeCost({
    features: ["video"],
    model: VIDEO_MODEL,
    durationSeconds: 5,
    resolution: "480p",
  }).total;
  const videoFullCost = computeCost({
    features: ["video"],
    model: VIDEO_MODEL,
    durationSeconds: 5,
    resolution: "720p",
  }).total;

  const stepValues = step ? (values[step.id] ?? {}) : {};
  const stepRefs = step ? (refs[step.id] ?? {}) : {};
  const selectedVariant = step ? (variantIdx[step.id] ?? -1) : -1;
  const template =
    step && selectedVariant >= 0 && step.variants[selectedVariant]
      ? step.variants[selectedVariant].prompt
      : (step?.promptTemplate ?? "");
  const filledPrompt = fillPromptTemplate(template, stepValues);
  const unfilled = filledPrompt.match(/\[[A-Z0-9_ /—-]+\]/g) ?? [];
  const usePrev = step ? (chainPrev[step.id] ?? true) : true;

  const collectRefUrls = (): string[] => {
    if (!step) return [];
    const urls: string[] = [];
    if (step.usesPreviousResult && usePrev && previousImage) urls.push(previousImage);
    for (const slot of step.referenceSlots) {
      const u = stepRefs[slot.key];
      if (u) urls.push(u);
    }
    return urls.slice(0, 6);
  };

  const missingRequired = step
    ? step.referenceSlots.filter((s) => s.required && !stepRefs[s.key])
    : [];

  const imageMut = useMutation({
    mutationFn: () =>
      genImageFn({
        data: {
          prompt: filledPrompt,
          imageUrls: collectRefUrls(),
          motionVideoUrl: null,
          model: IMAGE_MODEL,
        },
      }),
    onSuccess: (res) => {
      if (!step) return;
      setResults((prev) => ({ ...prev, [step.id]: { imageUrl: res.resultUrl } }));
      toast.success("Shot ready");
    },
    onError: handleGenerationError,
  });

  const videoSource =
    (step?.referenceSlots.length ? stepRefs[step.referenceSlots[0].key] : null) ??
    (usePrev ? previousImage : null);

  const videoMut = useMutation({
    mutationFn: (vars: { confirmPreviewId?: string }) => {
      if (!videoSource) throw new Error("Generate or upload the source image first");
      return genVideoFn({
        data: {
          imageUrl: videoSource,
          prompt: filledPrompt.slice(0, 2500),
          duration: 5,
          resolution: "720p",
          modelKey: VIDEO_MODEL,
          cameraMovement: "static",
          confirmPreviewId: vars.confirmPreviewId,
        },
      });
    },
    onSuccess: (res) => {
      if (!step) return;
      setResults((prev) => ({ ...prev, [step.id]: { videoUrl: res.videoUrl } }));
      if (res.preview) {
        setPreviewTickets((prev) => ({ ...prev, [step.id]: res.id }));
        toast.success("Preview ready — check the clip, then render full quality");
      } else {
        setPreviewTickets((prev) => {
          const next = { ...prev };
          delete next[step.id];
          return next;
        });
        toast.success("Full-quality clip ready");
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (step && msg.includes("Unsupported preview confirmation")) {
        setPreviewTickets((prev) => {
          const next = { ...prev };
          delete next[step.id];
          return next;
        });
        toast.error("That preview expired — render a fresh preview first.");
        return;
      }
      handleGenerationError(err);
    },
  });

  const requireAuth = (): boolean => {
    if (user) return true;
    navigate({ to: "/auth", search: authNextSearch() });
    return false;
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(filledPrompt);
      toast.success("Prompt copied");
    } catch {
      toast.error("Couldn't copy — select the text manually");
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="aurora-page-shell flex min-h-screen items-center justify-center text-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !workflow || !step) {
    return (
      <div className="aurora-page-shell flex min-h-screen items-center justify-center p-6 text-foreground">
        <div className="max-w-md space-y-4 text-center">
          <BookOpen className="mx-auto size-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Guide not found</h1>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "This playbook may have been unpublished."}
          </p>
          <Link
            to="/guides"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-2 text-sm font-medium hover:border-primary/50"
          >
            <ArrowLeft className="size-4" /> All guides
          </Link>
        </div>
      </div>
    );
  }

  const result = results[step.id];
  const ticket = previewTickets[step.id];
  const isPending = imageMut.isPending || videoMut.isPending;

  return (
    <div className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-28 pt-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/guides"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Viral Guides
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60 text-xl">
              {workflow.icon || "🎬"}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight">{workflow.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 font-medium uppercase tracking-wider">
                  {CATEGORY_LABELS[workflow.category]}
                </span>
                {workflow.sourceCredit && <span>Based on: {workflow.sourceCredit}</span>}
              </div>
            </div>
          </div>
          {workflow.description && (
            <p className="mt-3 text-sm text-muted-foreground">{workflow.description}</p>
          )}
        </div>

        {/* Step chips */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {steps.map((s, i) => {
            const done = !!results[s.id]?.imageUrl || !!results[s.id]?.videoUrl;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIdx(i)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  i === stepIdx
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : done
                      ? "border-primary/30 bg-card/40 text-foreground/80"
                      : "border-border bg-card/30 text-muted-foreground hover:border-primary/40",
                )}
              >
                {done ? <Check className="size-3" /> : <span>{i + 1}</span>}
                <span className="max-w-[10rem] truncate">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Current step card */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {STEP_KIND_LABELS[step.kind]}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Step {stepIdx + 1} of {steps.length}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
          {step.description && (
            <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{step.description}</p>
          )}

          {/* Variants */}
          {step.variants.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Prompt variant
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[{ label: "Base", prompt: step.promptTemplate }, ...step.variants].map((v, i) => {
                  const idx = i - 1;
                  return (
                    <button
                      key={`${idx}-${v.label}`}
                      type="button"
                      onClick={() => setVariantIdx((prev) => ({ ...prev, [step.id]: idx }))}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        selectedVariant === idx
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border bg-background/40 text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Placeholders */}
          {step.placeholders.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {step.placeholders.map((p) => (
                <label key={p.key} className="block">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {p.label}
                  </div>
                  <input
                    type="text"
                    value={stepValues[p.key] ?? ""}
                    placeholder={p.example || `[${p.key}]`}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [step.id]: { ...(prev[step.id] ?? {}), [p.key]: e.target.value },
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60"
                  />
                </label>
              ))}
            </div>
          )}

          {/* Reference uploads */}
          {step.referenceSlots.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Reference images
              </div>
              {user ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {step.referenceSlots.map((slot) => (
                    <SlotUpload
                      key={slot.key}
                      userId={user.id}
                      label={slot.label}
                      description={slot.description}
                      required={slot.required}
                      value={stepRefs[slot.key] ?? null}
                      onChange={(url) =>
                        setRefs((prev) => ({
                          ...prev,
                          [step.id]: { ...(prev[step.id] ?? {}), [slot.key]: url },
                        }))
                      }
                    />
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/auth", search: authNextSearch() })}
                  className="w-full rounded-xl border border-dashed border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground hover:border-primary/40"
                >
                  Sign in to upload reference images
                </button>
              )}
            </div>
          )}

          {/* Previous-result chaining */}
          {step.usesPreviousResult && (
            <div className="mt-4">
              {previousImage ? (
                <button
                  type="button"
                  onClick={() => setChainPrev((prev) => ({ ...prev, [step.id]: !usePrev }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                    usePrev ? "border-primary/40 bg-primary/5" : "border-border bg-card/30",
                  )}
                >
                  <img src={previousImage} alt="Previous result" className="size-10 rounded-lg object-cover" />
                  <div className="flex-1 text-xs">
                    <div className="font-medium">Use the previous step's image</div>
                    <div className="text-muted-foreground">{usePrev ? "Attached as a reference" : "Not attached"}</div>
                  </div>
                  <div
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      usePrev ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {usePrev && <Check className="size-3" />}
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/30 px-3 py-2 text-xs text-muted-foreground">
                  This step builds on an earlier result — generate the previous steps first.
                </div>
              )}
            </div>
          )}

          {/* Prompt preview */}
          {template && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Prompt</div>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary"
                >
                  <ClipboardCopy className="size-3" /> Copy
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-background/50 p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                {filledPrompt}
              </div>
              {unfilled.length > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Still to fill in: {Array.from(new Set(unfilled)).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Tips */}
          {step.tips.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Lightbulb className="size-3 text-primary" /> Tips
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {step.tips.map((t, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-primary">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Result */}
          {result && (result.imageUrl || result.videoUrl) && (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background/40">
              {result.videoUrl ? (
                <video
                  src={result.videoUrl}
                  controls
                  playsInline
                  className="max-h-96 w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={result.imageUrl}
                  alt={step.title}
                  className="max-h-96 w-full object-contain"
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {step.kind === "image" && (
              <Button
                disabled={isPending || !filledPrompt.trim() || missingRequired.length > 0}
                onClick={() => {
                  if (!requireAuth()) return;
                  if (missingRequired.length > 0) {
                    toast.error(`Upload: ${missingRequired.map((s) => s.label).join(", ")}`);
                    return;
                  }
                  imageMut.mutate();
                }}
                className="gap-2"
              >
                {imageMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {result?.imageUrl ? "Regenerate" : "Generate shot"} · {imageCost} Aura
              </Button>
            )}

            {step.kind === "video" && (
              <Button
                disabled={isPending || !filledPrompt.trim() || !videoSource}
                onClick={() => {
                  if (!requireAuth()) return;
                  videoMut.mutate(ticket ? { confirmPreviewId: ticket } : {});
                }}
                className="gap-2"
              >
                {videoMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
                {ticket
                  ? `Render full quality · ${videoFullCost} Aura`
                  : `Preview clip · 480p · ${videoPreviewCost} Aura`}
              </Button>
            )}

            {step.kind === "motion" && (
              <Button asChild className="gap-2">
                <Link
                  to="/motion"
                  search={{
                    image: previousImage ?? undefined,
                    prompt: filledPrompt.trim() ? filledPrompt.slice(0, 2000) : undefined,
                  }}
                >
                  <Wand2 className="size-4" /> Open Motion Control
                </Link>
              </Button>
            )}

            {step.kind === "lipsync" && (
              <Button asChild className="gap-2">
                <Link to="/lipsync" search={{ image: previousImage ?? undefined }}>
                  <Wand2 className="size-4" /> Open Lip Sync Studio
                </Link>
              </Button>
            )}

            {step.toolLink && (
              <Button asChild variant="outline" className="gap-2">
                <Link to={step.toolLink.to}>
                  <Link2 className="size-4" /> {step.toolLink.label}
                </Link>
              </Button>
            )}

            {step.kind === "video" && !videoSource && (
              <span className="text-[11px] text-muted-foreground">
                Generate the previous image step (or upload a source) first.
              </span>
            )}
          </div>
        </div>

        {/* Prev / next */}
        <div className="mt-5 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          {stepIdx < steps.length - 1 ? (
            <Button onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))} className="gap-1.5">
              Next step <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button asChild className="gap-1.5">
              <Link to="/gallery">
                Finish — view gallery <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
