import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  RE_ANGLE_CHIPS,
  SCENE_BUILDER_SLOT_COUNT,
  SCENE_BUILDER_COST_PER_ANGLE,
  DEFAULT_COMPOSITOR_PROMPT,
  type ReAngleChip,
} from "@/lib/scene-builder.templates";
import {
  generateSceneBuilder,
  type SceneBuilderResult,
} from "@/lib/scene-builder.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
  X,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAssetToDisk } from "@/lib/save";

export const Route = createLazyFileRoute("/scene-builder")({ component: SceneBuilderPage });

// ─── Reference slot uploader ─────────────────────────────────────────────────
function ReferenceSlot({
  index,
  userId,
  value,
  onChange,
}: {
  index: number;
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Max 20 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("studio")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 60 * 60);
      if (signErr || !signed?.signedUrl)
        throw signErr ?? new Error("Could not sign upload URL");
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
          "group relative aspect-square w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden",
          value
            ? "border-primary/30 bg-card/60"
            : "border-border bg-card/30 hover:border-primary/50",
        )}
      >
        {value ? (
          <img
            src={value}
            alt={`Reference ${index + 1}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground group-hover:text-primary transition-colors">
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span className="text-[10px] font-medium">Ref {index + 1}</span>
          </div>
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive transition-colors"
        >
          <X className="size-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Re-angle chip ────────────────────────────────────────────────────────────
function AngleChip({
  chip,
  active,
  onToggle,
}: {
  chip: ReAngleChip;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
        active
          ? "border-primary bg-primary/20 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {active && <Check className="size-3" />}
      {chip.label}
    </button>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({ result }: { result: SceneBuilderResult }) {
  const handleDownload = () => {
    if (result.url)
      saveAssetToDisk(result.url, `aurora-scene-${result.angleId}.jpg`);
  };

  if (result.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
        <span className="text-sm font-medium text-destructive">
          {result.label} failed
        </span>
        {result.error && (
          <span className="text-xs text-muted-foreground">{result.error}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-card/40">
        {result.url && (
          <img
            src={result.url}
            alt={result.label}
            className="size-full object-cover"
          />
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
            {result.label}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        {result.url && (
          <Link to="/motion" search={{ image: result.url }} className="flex-1">
            <Button variant="premium" size="sm" className="w-full gap-1.5">
              <Wand2 className="size-3.5" /> Animate
            </Button>
          </Link>
        )}
        <Button
          variant="glass"
          size="sm"
          onClick={handleDownload}
          className="shrink-0"
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function SceneBuilderPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [refs, setRefs] = useState<(string | null)[]>(
    Array.from({ length: SCENE_BUILDER_SLOT_COUNT }, () => null),
  );
  const [prompt, setPrompt] = useState(DEFAULT_COMPOSITOR_PROMPT);
  const [selectedAngles, setSelectedAngles] = useState<string[]>(["wide", "closeup"]);
  const [results, setResults] = useState<SceneBuilderResult[] | null>(null);

  const generateFn = useServerFn(generateSceneBuilder);
  const mutation = useMutation({
    mutationFn: () => {
      const referenceUrls = refs.filter((r): r is string => !!r);
      return generateFn({
        data: {
          referenceUrls,
          compositorPrompt: prompt,
          selectedAngles,
        },
      });
    },
    onSuccess: (data) => {
      setResults(data.results);
      const failed = data.results.filter((r) => r.status === "failed");
      if (failed.length === data.results.length) {
        toast.error("All angles failed — check credits and try again.");
      } else if (failed.length > 0) {
        toast.warning(
          `${data.results.length - failed.length} angle(s) succeeded, ${failed.length} failed.`,
        );
      } else {
        toast.success("Scene built!");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const uploadedCount = refs.filter(Boolean).length;
  const totalCost = selectedAngles.length * SCENE_BUILDER_COST_PER_ANGLE;
  const canGenerate =
    uploadedCount >= 1 && selectedAngles.length >= 1 && prompt.trim().length >= 10;

  function toggleAngle(id: string) {
    setSelectedAngles((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  // ─── Results screen ─────────────────────────────────────────────────────
  if (results) {
    return (
      <div className="aurora-page-shell">
        <span aria-hidden className="aurora-ambient" />
        <div className="relative z-10 mx-auto max-w-xl px-4 pb-24 pt-16">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setResults(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          </div>

          <h1 className="mb-6 text-lg font-bold">Your Scene</h1>

          <div className="grid gap-6">
            {results.map((r) => (
              <ResultCard key={r.angleId} result={r} />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              variant="glass"
              className="w-full gap-2"
              onClick={() => {
                setResults(null);
                setRefs(Array.from({ length: SCENE_BUILDER_SLOT_COUNT }, () => null));
                setSelectedAngles(["wide", "closeup"]);
              }}
            >
              <Sparkles className="size-4" /> New scene
            </Button>
            <Link to="/gallery">
              <Button variant="ghost" className="w-full text-muted-foreground">
                View in Gallery
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Builder screen ──────────────────────────────────────────────────────
  return (
    <div className="aurora-page-shell">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto max-w-xl px-4 pb-28 pt-16">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/studio" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Scene Builder
            </span>
          </div>
        </div>

        <h1 className="mb-1 text-2xl font-bold tracking-tight">Build Your Scene</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Upload up to {SCENE_BUILDER_SLOT_COUNT} reference images, describe your scene, and pick
          camera angles — Aurora composites everything into cinematic stills.
        </p>

        {/* ── Reference slots ────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reference Images
            </h2>
            <span className="text-xs text-muted-foreground">
              {uploadedCount} / {SCENE_BUILDER_SLOT_COUNT} uploaded
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {refs.map((url, i) => (
              <ReferenceSlot
                key={i}
                index={i}
                userId={userId}
                value={url}
                onChange={(newUrl) =>
                  setRefs((prev) => prev.map((u, idx) => (idx === i ? newUrl : u)))
                }
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Portraits, outfit refs, set photos — any image that helps lock the scene.
          </p>
        </div>

        {/* ── Scene description ───────────────────────────────────────── */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scene Description
            </h2>
            <span
              className={cn(
                "text-[11px]",
                prompt.length > 1900 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {prompt.length} / 2000
            </span>
          </div>
          <textarea
            className="w-full rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none leading-relaxed"
            rows={6}
            maxLength={2000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the set, lighting, atmosphere, and what you want in the scene…"
          />
        </div>

        {/* ── Re-angle chips ──────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Camera Angles
            </h2>
            <span className="text-xs text-muted-foreground">
              {selectedAngles.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {RE_ANGLE_CHIPS.map((chip) => (
              <AngleChip
                key={chip.id}
                chip={chip}
                active={selectedAngles.includes(chip.id)}
                onToggle={() => toggleAngle(chip.id)}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Each angle is composited independently ({SCENE_BUILDER_COST_PER_ANGLE} Aura each).
          </p>
        </div>

        {/* ── Cost + Generate ─────────────────────────────────────────── */}
        {selectedAngles.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {selectedAngles.length} angle{selectedAngles.length !== 1 ? "s" : ""}
            </span>
            <span className="text-sm font-bold text-primary">{totalCost} Aura</span>
          </div>
        )}

        <Button
          variant="premium"
          size="lg"
          className="w-full gap-2"
          disabled={!canGenerate || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Building scene…
            </>
          ) : !canGenerate ? (
            uploadedCount === 0 ? (
              "Upload at least 1 reference"
            ) : selectedAngles.length === 0 ? (
              "Pick at least 1 angle"
            ) : (
              "Describe the scene"
            )
          ) : (
            <>
              <Sparkles className="size-4" />
              Build Scene · {totalCost} Aura
            </>
          )}
        </Button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          After generating, use Animate to bring any still to life with Motion Control.
        </p>
      </div>
    </div>
  );
}
