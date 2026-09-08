import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PerformanceVariantKind } from "@/lib/performance-variant-workflows";

/**
 * Focused, visual-first guidance for the guided performance workflows.
 *
 * All imagery under /workflow-guides is cropped from user-supplied reference
 * walkthroughs and is labelled as a "workflow reference example" — it is NOT
 * presented as output that Aurora itself generated. No new tokens, variants or
 * style systems are introduced; everything composes the existing Aurora glass
 * surfaces, spacing scale and semantic colours.
 */

type GuideImage = {
  src: string;
  alt: string;
  /** Tailwind aspect utility that matches the crop so lazy-load never reflows. */
  ratio: string;
};

type WorkflowGuideConfig = {
  eyebrow: string;
  headline: string;
  summary: string;
  before: GuideImage;
  after: GuideImage;
  beforeLabel: string;
  afterLabel: string;
};

const WORKFLOW_GUIDES: Record<PerformanceVariantKind, WorkflowGuideConfig> = {
  build_scene: {
    eyebrow: "Reference example",
    headline: "One base scene, then any camera angle",
    summary:
      "Five role references lock identity, outfit, location and prop into a single directed frame. Approve it, then spin off tighter re-angles that keep the same world.",
    before: {
      src: "/workflow-guides/reangle-input.webp",
      alt: "Workflow reference example: an approved base scene of a performer at a mic in front of a car.",
      ratio: "aspect-[16/9]",
    },
    after: {
      src: "/workflow-guides/reangle-output.webp",
      alt: "Workflow reference example: a tighter side-profile re-angle rendered from the same base scene.",
      ratio: "aspect-[16/9]",
    },
    beforeLabel: "Base scene",
    afterLabel: "Re-angle from the same scene",
  },
  luxury_interior: {
    eyebrow: "Reference example",
    headline: "Your couch becomes a luxury interior",
    summary:
      "Three references — composition, luxury interior and your identity — place a faithful seated performance inside the vehicle while preserving your face and outfit.",
    before: {
      src: "/workflow-guides/anywhere-phone.webp",
      alt: "Workflow reference example: the real seated phone recording used as the performance source.",
      ratio: "aspect-[4/3]",
    },
    after: {
      src: "/workflow-guides/luxury-result.webp",
      alt: "Workflow reference example: a rendered luxury vehicle interior scene matching the seated performance.",
      ratio: "aspect-[16/9]",
    },
    beforeLabel: "Your seated recording",
    afterLabel: "Rendered luxury interior",
  },
};

function GuideFigure({ image, label, highlighted }: { image: GuideImage; label: string; highlighted?: boolean }) {
  return (
    <figure className="min-w-0">
      <div
        className={cn(
          "aurora-hairline overflow-hidden rounded-2xl bg-card",
          highlighted && "aurora-glow-ring",
        )}
      >
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          className={cn("w-full object-cover", image.ratio)}
        />
      </div>
      <figcaption className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}

/**
 * Hero visual demonstration rendered ABOVE the workflow title. Shows a
 * before/after reference pairing so the artist immediately understands what
 * the selected guided workflow produces.
 */
export function WorkflowVisualGuide({ kind, className }: { kind: PerformanceVariantKind; className?: string }) {
  const guide = WORKFLOW_GUIDES[kind];
  return (
    <section className={cn("aurora-panel overflow-hidden rounded-2xl p-4 sm:p-5", className)} aria-label="Workflow reference example">
      <p className="aurora-kicker mb-3">{guide.eyebrow}</p>
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <GuideFigure image={guide.before} label={guide.beforeLabel} />
        <div className="flex items-center justify-center" aria-hidden="true">
          <span className="flex size-9 items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-glass-strong)] text-primary">
            <ArrowRight className="size-4 md:hidden" />
            <ArrowRight className="hidden size-4 md:block" />
          </span>
        </div>
        <GuideFigure image={guide.after} label={guide.afterLabel} highlighted />
      </div>
      <div className="mt-4">
        <h2 className="text-base font-bold text-foreground">{guide.headline}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.summary}</p>
      </div>
    </section>
  );
}

type RecordingRef = { src: string; alt: string; caption: string; ratio: string };

const RECORDING_REFS: Record<PerformanceVariantKind, RecordingRef[]> = {
  build_scene: [
    {
      src: "/workflow-guides/record-wide.webp",
      alt: "Workflow reference example: a phone recording framed as a wide, full-body angle.",
      caption: "Wide angle · full body",
      ratio: "aspect-[3/4]",
    },
    {
      src: "/workflow-guides/record-closeup.webp",
      alt: "Workflow reference example: a phone recording framed as a medium close-up.",
      caption: "Close-up · chest up",
      ratio: "aspect-[3/4]",
    },
  ],
  luxury_interior: [
    {
      src: "/workflow-guides/anywhere-phone.webp",
      alt: "Workflow reference example: a seated phone recording kept within the window frame.",
      caption: "Seated · match the angle",
      ratio: "aspect-[4/3]",
    },
    {
      src: "/workflow-guides/luxury-result.webp",
      alt: "Workflow reference example: the rendered luxury interior the recording is mapped into.",
      caption: "Same energy · new world",
      ratio: "aspect-[16/9]",
    },
  ],
};

/**
 * Compact recording reference shown next to the "Original phone performance"
 * uploader so artists know how to frame the clip that drives every plate.
 */
export function RecordingReferenceGuide({ kind, className }: { kind: PerformanceVariantKind; className?: string }) {
  const refs = RECORDING_REFS[kind];
  return (
    <div className={cn("aurora-glass rounded-2xl p-3", className)} aria-label="Recording reference example">
      <p className="aurora-kicker mb-2">Recording reference</p>
      <div className="grid grid-cols-2 gap-2">
        {refs.map((ref) => (
          <figure key={ref.src} className="min-w-0">
            <div className="aurora-hairline overflow-hidden rounded-xl bg-card">
              <img
                src={ref.src}
                alt={ref.alt}
                loading="lazy"
                decoding="async"
                className={cn("w-full object-cover", ref.ratio)}
              />
            </div>
            <figcaption className="mt-1.5 text-center text-[10px] font-medium leading-tight text-muted-foreground">
              {ref.caption}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Reference examples only — match the framing, then upload your own clip below.
      </p>
    </div>
  );
}

type SelectorVisual = { src: string; alt: string; ratio: string };

const SELECTOR_VISUALS: Record<"build_scene" | "luxury_interior", SelectorVisual> = {
  build_scene: {
    src: "/workflow-guides/build-scene-result.webp",
    alt: "Workflow reference example: a directed base scene built from five role references.",
    ratio: "aspect-[16/9]",
  },
  luxury_interior: {
    src: "/workflow-guides/luxury-result.webp",
    alt: "Workflow reference example: a rendered luxury vehicle interior performance scene.",
    ratio: "aspect-[16/9]",
  },
};

/**
 * Small visual demonstration for a workflow selection card. Rendered ABOVE the
 * card's title/short explanation so the choice is visual-first. Sits inside the
 * existing selector links without changing their navigation.
 */
export function WorkflowSelectorVisual({
  kind,
  className,
}: {
  kind: "build_scene" | "luxury_interior";
  className?: string;
}) {
  const visual = SELECTOR_VISUALS[kind];
  return (
    <div className={cn("aurora-hairline mb-2 overflow-hidden rounded-lg bg-card", className)}>
      <img
        src={visual.src}
        alt={visual.alt}
        loading="lazy"
        decoding="async"
        className={cn("w-full object-cover", visual.ratio)}
      />
    </div>
  );
}
