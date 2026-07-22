import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Sparkles,
  Loader2,
  Upload,
  Image as ImageIcon,
  Music,
  Crown,
  ArrowRight,
  Check,
  Layers,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { handleGenerationError } from "@/lib/error-toasts";
import { usePerformanceShotJobFn, useVideoFromImageJobFn, useLipSyncJobFn } from "@/lib/use-job-polling";
import { generateUGCAd, getGenerationStatus } from "@/lib/ugc-generation.functions";
import {
  templateCost,
  TEMPLATE_DEFAULTS,
  SPIN_PIECE_COUNT,
  type StudioTemplate,
} from "@/lib/template-studio";
import { expandTemplatePrompt } from "@/lib/prompt-optimizer.functions";

type UploadState = { url: string; name: string; preview?: string };

export function TemplateDrawer({
  template,
  locked,
  onClose,
}: {
  template: StudioTemplate;
  locked: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const genFn = usePerformanceShotJobFn();
  const vidFn = useVideoFromImageJobFn();
  const lipFn = useLipSyncJobFn();
  const ugcFn = useServerFn(generateUGCAd);
  const statusFn = useServerFn(getGenerationStatus);
  const optimizeFn = useServerFn(expandTemplatePrompt);
  const [optimizing, setOptimizing] = useState(false);

  const imageInputs = template.inputs.filter((i) => i.kind === "image");
  const imageInput = imageInputs[0];
  const image2Input = imageInputs[1]; // only present on templates with 2 image slots
  const audioInput = template.inputs.find((i) => i.kind === "audio");
  const textInput = template.inputs.find((i) => i.kind === "text");

  // Pre-populate from template.defaultImageUrl (public-dir path → absolute URL).
  const defaultImage = (() => {
    const u = template.defaultImageUrl;
    if (!u) return null;
    const abs = u.startsWith("/") && typeof window !== "undefined"
      ? `${window.location.origin}${u}`
      : u;
    return { url: abs, name: "Default reference", preview: u } satisfies UploadState;
  })();
  const [image, setImage] = useState<UploadState | null>(defaultImage);
  const [image2, setImage2] = useState<UploadState | null>(null);
  const [audio, setAudio] = useState<UploadState | null>(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState<"image" | "image2" | "audio" | null>(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const cost = templateCost(template);

  async function uploadFile(kind: "image" | "image2" | "audio", file: File) {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setError(null);
    setUploading(kind);
    try {
      const path = `${user.id}/templates/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("studio")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 60 * 60);
      if (signErr || !signed?.signedUrl) {
        toast.error(signErr?.message ?? "Could not prepare the file");
        return;
      }
      const state: UploadState = {
        url: signed.signedUrl,
        name: file.name,
        preview: (kind === "image" || kind === "image2") ? URL.createObjectURL(file) : undefined,
      };
      if (kind === "image") setImage(state);
      else if (kind === "image2") setImage2(state);
      else setAudio(state);
    } finally {
      setUploading(null);
    }
  }

  const missingRequired =
    (!!imageInput?.required && !image) ||
    (!!image2Input?.required && !image2) ||
    (!!audioInput?.required && !audio) ||
    (!!textInput?.required && !text.trim());

  const canRun = !locked && !running && !uploading && !missingRequired;

  function buildImagePrompt(): string {
    const base = template.imagePrompt ?? "";
    const extra = text.trim();
    if (!extra) return base;
    return `${base} Scene: ${extra}.`;
  }

  // Poll an async generation (UGC) until it terminates. Bounded so a stuck job
  // never hangs the drawer forever — on timeout we surface an error, but the job
  // keeps running server-side and its result will appear in the gallery later.
  async function pollGeneration(generationId: string) {
    const deadline = Date.now() + 4 * 60 * 1000; // 4 minutes
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = await statusFn({ data: { generationId } });
      if (s.status === "succeeded" || s.status === "complete" || s.status === "completed") return;
      if (s.status === "failed" || s.status === "error") {
        throw new Error(s.error ?? "Generation failed");
      }
    }
    throw new Error("This is taking longer than expected — check your gallery in a moment.");
  }

  async function run() {
    // Spin is public and just launches the existing /spin experience.
    if (template.dispatch === "spin") {
      const idea = text.trim();
      if (!idea) {
        setError("Describe your idea to spin.");
        return;
      }
      const prompt = template.spinPreset ? `${template.spinPreset}. ${idea}` : idea;
      navigate({ to: "/spin", search: { prompt, jobId: undefined } });
      return;
    }

    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!image) {
      setError("Upload a photo to get started.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      // UGC ad — reserve + enqueue the async job, then poll to completion.
      if (template.dispatch === "ugc") {
        if (!text.trim()) throw new Error("Tell us what you're promoting.");
        setStage("Starting your ad…");
        const res = await ugcFn({
          data: {
            avatarImageUrl: image.url,
            productPrompt: text.trim(),
            aspect: template.ugcAspect ?? "9:16",
            duration: template.durationSeconds ?? 8,
          },
        });
        setStage("Rendering your ad…");
        await pollGeneration(res.generationId);
        toast.success("Done! Opening your gallery…");
        navigate({ to: "/gallery" });
        return;
      }

      // Studio pipeline — image → (video) → (lipsync), gated by the manifest kinds.
      setStage("Creating your image…");
      // Build image reference list: primary photo, optional second uploaded image, optional bg ref.
      const bgRef = template.backgroundImageUrl
        ? template.backgroundImageUrl.startsWith("/") && typeof window !== "undefined"
          ? `${window.location.origin}${template.backgroundImageUrl}`
          : template.backgroundImageUrl
        : null;
      const imageUrls = [
        image.url,
        ...(image2 ? [image2.url] : []),
        ...(bgRef ? [bgRef] : []),
      ];
      const img = await genFn({
        data: {
          prompt: buildImagePrompt(),
          imageUrls,
          motionVideoUrl: null,
          model: template.imageModel ?? TEMPLATE_DEFAULTS.imageModel,
        },
      });

      if (template.kinds.includes("video")) {
        setStage("Bringing it to life…");
        const vid = await vidFn({
          data: {
            imageUrl: img.resultUrl,
            prompt: template.videoPrompt ?? "natural cinematic movement",
            duration: template.durationSeconds ?? TEMPLATE_DEFAULTS.durationSeconds,
            resolution: template.resolution ?? TEMPLATE_DEFAULTS.resolution,
            modelKey: template.videoModel ?? TEMPLATE_DEFAULTS.videoModel,
            cameraMovement: template.cameraMovement ?? "static",
            endFrameUrl: null,
          },
        });

        if (template.kinds.includes("lipsync")) {
          if (!audio) throw new Error("Add an audio clip to lip-sync.");
          setStage("Lip-syncing to your audio…");
          await lipFn({
            data: {
              videoUrl: vid.videoUrl,
              audioUrl: audio.url,
              model: (template.lipsyncModel ?? TEMPLATE_DEFAULTS.lipsyncModel) as
                | "fal-ai/sync-lipsync/v2"
                | "fal-ai/wav2lip"
                | "latentsync",
            },
          });
        }
      }

      toast.success("Done! Opening your gallery…");
      navigate({ to: "/gallery" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      handleGenerationError(e);
    } finally {
      setRunning(false);
      setStage("");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        className={`relative z-10 w-full max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-border bg-background/95 backdrop-blur-2xl shadow-[0_-20px_60px_oklch(0_0_0/0.6)] transition-transform duration-300 ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Grab handle */}
        <div className="sticky top-0 z-10 flex justify-center pt-2.5 pb-1 bg-background/95">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
              <img src={template.thumbnail} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] uppercase tracking-[0.14em] text-primary">
                  {template.category}
                </span>
                {template.premium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">
                    <Crown className="size-2.5" /> Pro
                  </span>
                )}
              </div>
              <h2 className="mt-0.5 text-lg font-semibold leading-tight">{template.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{template.blurb}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {locked ? (
            <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/[0.06] p-5 text-center">
              <Crown className="mx-auto size-7 text-primary" />
              <h3 className="mt-2 text-base font-semibold">This is a Pro template</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade to Aurora Pro to unlock lip-sync music videos and every premium template.
              </p>
              <Link
                to="/billing"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-[var(--shadow-glow-soft)] hover:brightness-110"
              >
                <Crown className="size-4" /> Upgrade to Pro
              </Link>
            </div>
          ) : (
            <>
              {/* Inputs */}
              <div className="mt-5 space-y-4">
                {imageInput && (
                  <FileField
                    icon={<ImageIcon className="size-4" />}
                    label={imageInput.label}
                    hint={imageInput.hint}
                    required={imageInput.required}
                    accept={imageInput.accept}
                    busy={uploading === "image"}
                    value={image}
                    onPick={(f) => uploadFile("image", f)}
                  />
                )}
                {image2Input && (
                  <FileField
                    icon={<ImageIcon className="size-4" />}
                    label={image2Input.label}
                    hint={image2Input.hint}
                    required={image2Input.required}
                    accept={image2Input.accept}
                    busy={uploading === "image2"}
                    value={image2}
                    onPick={(f) => uploadFile("image2", f)}
                  />
                )}
                {audioInput && (
                  <FileField
                    icon={<Music className="size-4" />}
                    label={audioInput.label}
                    hint={audioInput.hint}
                    required={audioInput.required}
                    accept={audioInput.accept}
                    busy={uploading === "audio"}
                    value={audio}
                    onPick={(f) => uploadFile("audio", f)}
                  />
                )}
                {textInput && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        {textInput.label}
                        {textInput.required && <span className="text-primary"> *</span>}
                      </label>
                      {text.trim().length > 2 && (
                        <button
                          type="button"
                          disabled={optimizing}
                          onClick={async () => {
                            setOptimizing(true);
                            try {
                              const result = await optimizeFn({
                                data: { userText: text, templateTitle: template.title },
                              });
                              setText(result.expanded);
                            } catch {
                              toast.error("Prompt optimizer unavailable");
                            } finally {
                              setOptimizing(false);
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                        >
                          {optimizing
                            ? <><Loader2 className="size-3 animate-spin" /> Enhancing…</>
                            : <><Wand2 className="size-3" /> Enhance</>}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={3}
                      maxLength={600}
                      placeholder={textInput.hint}
                      className="mt-1.5 w-full resize-none rounded-xl border border-border bg-black/30 px-3.5 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-primary/60"
                    />
                  </div>
                )}
              </div>

              {/* Cost — templateCost() is the single source of truth shared with the
                  charging backend; the number shown here is exactly what is reserved.
                  Spin dispatch is Free here: it navigates to /spin where the user
                  explicitly pays 300 Aura when they click "Spin 30 posts". */}
              <div className="mt-5 rounded-xl border border-border bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {template.dispatch === "spin"
                      ? `${SPIN_PIECE_COUNT} posts · 300 Aura charged on /spin`
                      : "This render uses"}
                  </span>
                  {cost === 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                      Free
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <Sparkles className="size-4" /> {cost} Aura
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {error}
                </p>
              )}

              {/* Generate */}
              <button
                type="button"
                onClick={run}
                disabled={!canRun}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-hero)] px-5 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-glow-soft)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {stage || "Working…"}
                  </>
                ) : template.dispatch === "spin" ? (
                  <>
                    <Layers className="size-4" /> Open Spin · Free{" "}
                    <ArrowRight className="size-4" />
                  </>
                ) : !user ? (
                  <>
                    Sign in to generate <ArrowRight className="size-4" />
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Generate · {cost} Aura
                  </>
                )}
              </button>
              {running && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Keep this open — your render lands in the gallery when it's ready.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FileField({
  icon,
  label,
  hint,
  required,
  accept,
  busy,
  value,
  onPick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  required: boolean;
  accept?: string;
  busy: boolean;
  value: UploadState | null;
  onPick: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </label>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="mt-1.5 flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-black/20 px-4 py-3 text-left hover:border-primary/50 disabled:opacity-60"
      >
        {value?.preview ? (
          <img src={value.preview} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : value ? (
              <Check className="size-4" />
            ) : (
              icon
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          {value ? (
            <span className="block truncate text-sm font-medium text-foreground">{value.name}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Upload className="size-3.5" /> {busy ? "Uploading…" : "Tap to upload"}
            </span>
          )}
          {hint && !value && <span className="block text-sm text-white/35">{hint}</span>}
          {value && <span className="block text-sm text-primary">Tap to replace</span>}
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
