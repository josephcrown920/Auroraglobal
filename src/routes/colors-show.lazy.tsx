import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  COLORS_SHOW_STEPS,
  COLORS_SHOW_SHOTS,
  OUTFIT_OPTIONS,
  ENERGY_OPTIONS,
  DEFAULT_COLORS_SHOW_CONFIG,
  COLORS_SHOW_COST_PER_SHOT,
  type ColorsShowConfig,
  type ColorsShowStep,
} from "@/lib/colors-show.templates";
import { generateColorsShow, type ColorsShowResult } from "@/lib/colors-show.functions";
import { COLOR_PRESETS } from "@/lib/colors.presets";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
  X,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAssetToDisk } from "@/lib/save";

export const Route = createLazyFileRoute("/colors-show")({ component: ColorsShowPage });

// ─── Inline portrait uploader ────────────────────────────────────────────────
function PortraitUpload({
  userId,
  value,
  onChange,
}: {
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
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative mx-auto aspect-[3/4] w-full max-w-xs rounded-3xl border-2 border-dashed transition-all overflow-hidden",
          value
            ? "border-primary/40 bg-card/60"
            : "border-border bg-card/30 hover:border-primary/50",
        )}
      >
        {value ? (
          <img src={value} alt="Portrait" className="size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground group-hover:text-primary transition-colors p-6">
            {busy ? (
              <Loader2 className="size-8 animate-spin" />
            ) : (
              <ImagePlus className="size-8" />
            )}
            <span className="text-sm text-center font-medium">
              Tap to upload your portrait
            </span>
            <span className="text-xs text-center opacity-70">
              Front-facing photo works best. JPEG or PNG, up to 20 MB.
            </span>
          </div>
        )}
      </button>
      {value && (
        <div className="flex justify-center gap-3">
          <Button
            variant="glass"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange(null)}
          >
            <X className="size-3.5 mr-1" /> Clear
          </Button>
        </div>
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

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-5 h-2 bg-primary"
              : i < current
              ? "w-2 h-2 bg-primary/50"
              : "w-2 h-2 bg-muted-foreground/20",
          )}
        />
      ))}
    </div>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({ result }: { result: ColorsShowResult }) {
  const handleDownload = () => {
    if (result.url) saveAssetToDisk(result.url, `aurora-colors-show-${result.shotId}.jpg`);
  };

  if (result.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <span className="text-sm font-medium text-destructive">
          {result.label} failed
        </span>
        <span className="text-xs text-muted-foreground">{result.error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-card/40">
        {result.url && (
          <img
            src={result.url}
            alt={result.label}
            className="size-full object-cover"
          />
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            {result.label}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        {result.url && (
          <Link
            to="/motion"
            search={{ image: result.url }}
            className="flex-1"
          >
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
function ColorsShowPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [stepIdx, setStepIdx] = useState(0);
  const [config, setConfig] = useState<ColorsShowConfig>(DEFAULT_COLORS_SHOW_CONFIG);
  const [results, setResults] = useState<ColorsShowResult[] | null>(null);

  const generateFn = useServerFn(generateColorsShow);
  const mutation = useMutation({
    mutationFn: () =>
      generateFn({
        data: {
          portraitUrl: config.portraitUrl!,
          colorId: config.colorId,
          outfitOption: config.outfitOption,
          customOutfit: config.customOutfit,
          selectedShots: config.selectedShots,
          energyOption: config.energyOption,
          songTitle: config.songTitle,
        },
      }),
    onSuccess: (data) => {
      setResults(data.results);
      const failed = data.results.filter((r) => r.status === "failed");
      if (failed.length === data.results.length) {
        toast.error("All shots failed — check credits and try again.");
      } else if (failed.length > 0) {
        toast.warning(`${data.results.length - failed.length} shot(s) succeeded, ${failed.length} failed.`);
      } else {
        toast.success("Colors Show generated!");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const step = COLORS_SHOW_STEPS[stepIdx];
  const totalSteps = COLORS_SHOW_STEPS.length;
  const selectedColor = COLOR_PRESETS.find((c) => c.id === config.colorId) ?? COLOR_PRESETS[0];

  // ─── Validation per step ────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step.id === "portrait") return !!config.portraitUrl;
    if (step.id === "shots") return config.selectedShots.length > 0;
    return true;
  }

  function totalCost() {
    return config.selectedShots.length * COLORS_SHOW_COST_PER_SHOT;
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

          <div className="mb-2 flex items-center gap-2">
            <div
              className="size-3 rounded-full"
              style={{ background: selectedColor.swatch }}
            />
            <h1 className="text-lg font-bold">
              {selectedColor.name} — Colors Show
            </h1>
          </div>
          {config.songTitle && (
            <p className="mb-6 text-sm text-muted-foreground">"{config.songTitle}"</p>
          )}

          <div className="grid gap-6">
            {results.map((r) => (
              <ResultCard key={r.shotId} result={r} />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              variant="glass"
              className="w-full gap-2"
              onClick={() => {
                setResults(null);
                setStepIdx(0);
                setConfig(DEFAULT_COLORS_SHOW_CONFIG);
              }}
            >
              <Sparkles className="size-4" /> New shoot
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

  // ─── Wizard ─────────────────────────────────────────────────────────────
  return (
    <div className="aurora-page-shell">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto max-w-xl px-4 pb-28 pt-16">

        {/* Header */}
        <div className="mb-2 flex items-center gap-3">
          <Link to="/colors" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Film className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Colors Show Creator
            </span>
          </div>
        </div>

        <StepDots total={totalSteps} current={stepIdx} />

        {/* Step title */}
        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-bold tracking-tight">{step.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{step.subtitle}</p>
        </div>

        {/* ── Step content ─────────────────────────────────────────────── */}

        {/* Step 0 — Portrait */}
        {step.id === "portrait" && (
          <PortraitUpload
            userId={userId}
            value={config.portraitUrl}
            onChange={(url) => setConfig((c) => ({ ...c, portraitUrl: url }))}
          />
        )}

        {/* Step 1 — Color picker */}
        {step.id === "color" && (
          <div className="grid grid-cols-3 gap-3">
            {COLOR_PRESETS.map((preset) => {
              const active = config.colorId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, colorId: preset.id }))}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/40 hover:border-primary/40",
                  )}
                >
                  <span
                    className="size-10 rounded-full shadow-lg ring-2 ring-white/10"
                    style={{ background: preset.swatch }}
                  />
                  <span className="text-center text-[11px] font-medium leading-tight">
                    {preset.name}
                  </span>
                  {active && (
                    <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary">
                      <Check className="size-2.5 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2 — Outfit */}
        {step.id === "outfit" && (
          <div className="flex flex-col gap-3">
            {OUTFIT_OPTIONS.map((opt) => {
              const active = config.outfitOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, outfitOption: opt.id }))}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/40 hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {active && <Check className="size-3 text-white" />}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
            {config.outfitOption === "custom" && (
              <textarea
                className="mt-1 w-full rounded-xl border border-border bg-card/60 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                rows={3}
                maxLength={300}
                placeholder="e.g. Black leather jacket, white tee, ripped jeans, chunky boots"
                value={config.customOutfit}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, customOutfit: e.target.value }))
                }
              />
            )}
          </div>
        )}

        {/* Step 3 — Shot types */}
        {step.id === "shots" && (
          <div className="flex flex-col gap-3">
            {COLORS_SHOW_SHOTS.map((shot) => {
              const active = config.selectedShots.includes(shot.id);
              return (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      selectedShots: active
                        ? c.selectedShots.filter((s) => s !== shot.id)
                        : [...c.selectedShots, shot.id],
                    }))
                  }
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/40 hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border-2",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {active && <Check className="size-3 text-white" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{shot.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {shot.description}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {COLORS_SHOW_COST_PER_SHOT} Aura
                  </span>
                </button>
              );
            })}
            {config.selectedShots.length > 0 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                Total: {totalCost()} Aura for {config.selectedShots.length} shot
                {config.selectedShots.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Step 4 — Energy */}
        {step.id === "energy" && (
          <div className="flex flex-col gap-3">
            {ENERGY_OPTIONS.map((opt) => {
              const active = config.energyOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, energyOption: opt.id }))}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/40 hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {active && <Check className="size-3 text-white" />}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 5 — Song title */}
        {step.id === "title" && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-card/60 px-4 py-3.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              placeholder="e.g. Late Nights, Neon Dreams, Blue Feels"
              maxLength={100}
              value={config.songTitle}
              onChange={(e) => setConfig((c) => ({ ...c, songTitle: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground text-center">
              Optional — the title is worked into the shoot brief for consistent branding.
            </p>
          </div>
        )}

        {/* Step 6 — Review */}
        {step.id === "review" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card/40 divide-y divide-border overflow-hidden">
              {[
                {
                  label: "Portrait",
                  value: config.portraitUrl ? "Uploaded ✓" : "Missing",
                  warn: !config.portraitUrl,
                },
                { label: "Color", value: selectedColor.name },
                {
                  label: "Outfit",
                  value:
                    OUTFIT_OPTIONS.find((o) => o.id === config.outfitOption)?.label ?? "",
                },
                {
                  label: "Shots",
                  value: config.selectedShots
                    .map(
                      (id) =>
                        COLORS_SHOW_SHOTS.find((s) => s.id === id)?.label ?? id,
                    )
                    .join(", "),
                },
                {
                  label: "Energy",
                  value:
                    ENERGY_OPTIONS.find((o) => o.id === config.energyOption)?.label ?? "",
                },
                ...(config.songTitle
                  ? [{ label: "Song", value: `"${config.songTitle}"` }]
                  : []),
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex justify-between px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      warn ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total cost</span>
              <span className="text-sm font-bold text-primary">
                {totalCost()} Aura
              </span>
            </div>

            {!config.portraitUrl && (
              <p className="text-xs text-center text-destructive">
                Go back and upload your portrait to continue.
              </p>
            )}

            <Button
              variant="premium"
              size="lg"
              className="w-full gap-2 mt-2"
              disabled={!config.portraitUrl || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate {totalCost()} Aura
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── Nav buttons ─────────────────────────────────────────────── */}
        {step.id !== "review" && (
          <div className="mt-8 flex gap-3">
            {stepIdx > 0 && (
              <Button
                variant="glass"
                size="lg"
                className="flex-1 gap-2"
                onClick={() => setStepIdx((i) => i - 1)}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            <Button
              variant={canAdvance() ? "premium" : "glass"}
              size="lg"
              className="flex-1 gap-2"
              disabled={!canAdvance()}
              onClick={() => setStepIdx((i) => i + 1)}
            >
              {stepIdx === 0 && !config.portraitUrl ? "Upload to continue" : "Next"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
        {step.id === "review" && stepIdx > 0 && !mutation.isPending && !results && (
          <Button
            variant="glass"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setStepIdx((i) => i - 1)}
          >
            <ArrowLeft className="size-3.5 mr-1" /> Back
          </Button>
        )}
      </div>
    </div>
  );
}
