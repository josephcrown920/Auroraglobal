import { useEffect, useState } from "react";
import {
  AuroraEmbed,
  type AuroraEmbedKind,
} from "@/components/embed/AuroraEmbed";
import { StudioPage } from "@/features/storyboard/studio/StudioPage";

type NativeToolId =
  | "moodboard"
  | "infinity-canvas"
  | "style-transfer"
  | "soundweaver"
  | "flows"
  | "video-agent-xx"
  | "video-agent"
  | "video-agent-aura-ai";

type RoomSection = "overview" | "storyboard" | AuroraEmbedKind | NativeToolId;

type DemoMedia =
  | {
      type: "image";
      src: string;
      alt: string;
    }
  | {
      type: "video";
      src: string;
      poster: string;
      alt: string;
    };

type RoomFeature = {
  id: RoomSection;
  category: string;
  label: string;
  description: string;
  bestFor: string;
  media: DemoMedia;
};

type EmbeddedToolDefinition = RoomFeature & {
  kind: AuroraEmbedKind;
  envKey: string;
  src?: string;
};

type NativeToolDefinition = RoomFeature & {
  id: NativeToolId;
  href: string;
  actionLabel: string;
  capabilities: [string, string];
};

const STORYBOARD_FEATURE: RoomFeature = {
  id: "storyboard",
  category: "Narrative direction",
  label: "Storyboard",
  description:
    "Map scenes, develop the cast, direct the sequence, and send finished shots to render.",
  bestFor: "locking a visual narrative, shot order, and creative intent before production.",
  media: {
    type: "image",
    src: "/screenshots/studio-screen.png",
    alt: "Aurora production studio showing a visual project workspace",
  },
};

const NATIVE_TOOLS: NativeToolDefinition[] = [
  {
    id: "moodboard",
    category: "Visual development",
    label: "Moodboard",
    description:
      "Turn reference stills into a cohesive cinematic moodboard with a usable color script.",
    bestFor: "choosing the palette, visual references, and atmosphere before you lock shots.",
    media: {
      type: "image",
      src: "/spotlight/drift-moodboard.png",
      alt: "Cinematic Drift Moodboard visual reference board",
    },
    href: "/workflows",
    actionLabel: "Open Moodboard flow",
    capabilities: [
      "Builds a four-still visual direction",
      "Carries the selected color script into the workflow",
    ],
  },
  {
    id: "infinity-canvas",
    category: "Creative systems",
    label: "Infinity Canvas",
    description:
      "A node-based visual workspace for composing, running, and saving creative systems.",
    bestFor: "connecting multiple image, video, and AI steps into one repeatable production graph.",
    media: {
      type: "image",
      src: "/nav-previews/canvas.jpg",
      alt: "Aurora's node-based Infinity Canvas workspace",
    },
    href: "/canvas",
    actionLabel: "Open Infinity Canvas",
    capabilities: [
      "Connects multi-step creative nodes",
      "Loads and saves reusable production graphs",
    ],
  },
  {
    id: "style-transfer",
    category: "Look development",
    label: "Style Transfer",
    description:
      "Carry the look of a chosen visual direction into a moving shot without discarding the performance.",
    bestFor: "transforming a base scene into a look-led music-video shot while retaining its motion intent.",
    media: {
      type: "image",
      src: "/landing-photo-studios-grid.png",
      alt: "Aurora visual styles shown across a creative photo grid",
    },
    href: "/motion",
    actionLabel: "Open Style Transfer",
    capabilities: [
      "Pairs visual direction with Motion Control",
      "Keeps a source performance central to the new look",
    ],
  },
  {
    id: "soundweaver",
    category: "Music direction",
    label: "Soundweaver",
    description:
      "Start from the song itself, then use its duration and lyric lines to shape a timed visual sequence.",
    bestFor: "artists who want the video structure to follow the track, lyrics, and vocal moments.",
    media: {
      type: "video",
      src: "/videos/face-sings-hero.mp4",
      poster: "/videos/thumbs/avatar-main.jpg",
      alt: "Aurora music performance visual synchronized to vocals",
    },
    href: "/music-video",
    actionLabel: "Open Soundweaver",
    capabilities: [
      "Reads uploaded audio duration",
      "Builds lyric-aware segments for the visual plan",
    ],
  },
  {
    id: "flows",
    category: "Repeatable production",
    label: "Flows",
    description:
      "Save, reuse, share, and rerun multi-model production graphs instead of rebuilding a process from scratch.",
    bestFor: "turning a successful music-video recipe into a repeatable team workflow.",
    media: {
      type: "image",
      src: "/nav-previews/templates.jpg",
      alt: "Aurora template gallery for reusable production flows",
    },
    href: "/workflows",
    actionLabel: "Open Flows",
    capabilities: [
      "Starts from reusable templates",
      "Saves a graph for future runs in Infinity Canvas",
    ],
  },
  {
    id: "video-agent-xx",
    category: "Autonomous director",
    label: "Video Agent XX",
    description:
      "The most hands-off director: it turns a brief into the full production package, from logline to delivery cuts.",
    bestFor: "a complete music-video direction when you want Aurora to plan the creative and production detail.",
    media: {
      type: "image",
      src: "/nav-previews/video-agent.jpg",
      alt: "Aurora Video Agent directing a video production",
    },
    href: "/agent",
    actionLabel: "Open Video Agent XX",
    capabilities: [
      "Builds script, shot list, storyboards, and model prompts",
      "Adds voice-over, captions, music brief, and platform cuts",
    ],
  },
  {
    id: "video-agent",
    category: "Project builder",
    label: "Video Agent",
    description:
      "A guided project builder that turns a creative brief into a structured plan, storyboard, and final MP4.",
    bestFor: "directing a focused video project with control over visual style, duration, voice, and reference context.",
    media: {
      type: "video",
      src: "/videos/landing-demo-reel.mp4",
      poster: "/videos/landing-demo-reel-poster.jpg",
      alt: "Aurora-generated cinematic video reel",
    },
    href: "/video-agent",
    actionLabel: "Open Video Agent",
    capabilities: [
      "Sets style, runtime, voice, and creative starting point",
      "Moves through plan, storyboard, frames, and final MP4",
    ],
  },
  {
    id: "video-agent-aura-ai",
    category: "Music-video intelligence",
    label: "Video Agent Aura AI",
    description:
      "The song-led Aurora agent that connects audio, lyric timing, visual direction, and generation-ready music-video scenes.",
    bestFor: "building an artist visual where the edit and scene rhythm should be anchored to the track.",
    media: {
      type: "image",
      src: "/nav-previews/music-video.jpg",
      alt: "Aurora music video creation preview",
    },
    href: "/music-video",
    actionLabel: "Open Aura AI",
    capabilities: [
      "Starts from song upload, genre, and lyric lines",
      "Transforms lyric timing into a visual scene plan",
    ],
  },
];

const EMBEDDED_TOOLS: EmbeddedToolDefinition[] = [
  {
    id: "layers",
    kind: "layers",
    category: "Composition",
    label: "Aurora Layers",
    description:
      "Build layered compositions and keep the visual system in sync across the production.",
    bestFor: "assembling an image-led direction from reusable visual elements.",
    envKey: "VITE_AURORA_LAYERS_EMBED_URL",
    media: {
      type: "image",
      src: "/screenshots/artist-tools-reference.jpeg",
      alt: "Aurora artist visual reference workspace",
    },
    src: import.meta.env.VITE_AURORA_LAYERS_EMBED_URL?.trim() || undefined,
  },
  {
    id: "scene-weaver",
    kind: "scene-weaver",
    category: "Scene construction",
    label: "Scene Weaver",
    description:
      "Clean a plate, build alternate camera angles, grade scenes, and send selected shots forward.",
    bestFor: "keeping one scene consistent while you explore production-ready coverage.",
    envKey: "VITE_AURORA_SCENE_WEAVER_EMBED_URL",
    media: {
      type: "image",
      src: "/nav-previews/scene-builder.jpg",
      alt: "Aurora scene-building workspace",
    },
    src: import.meta.env.VITE_AURORA_SCENE_WEAVER_EMBED_URL?.trim() || undefined,
  },
  {
    id: "presets-engine",
    kind: "presets-engine",
    category: "Reusable look",
    label: "Presets Engine",
    description:
      "Create and tune reusable looks that can carry across the rest of a production.",
    bestFor: "locking a repeatable visual treatment before you scale it to more shots.",
    envKey: "VITE_AURORA_PRESETS_ENGINE_EMBED_URL",
    media: {
      type: "video",
      src: "/viral-presets/preview-1.mp4",
      poster: "/nav-previews/templates.jpg",
      alt: "Aurora preset result preview",
    },
    src: import.meta.env.VITE_AURORA_PRESETS_ENGINE_EMBED_URL?.trim() || undefined,
  },
];

const OVERVIEW_FEATURES: RoomFeature[] = [
  STORYBOARD_FEATURE,
  ...NATIVE_TOOLS,
  ...EMBEDDED_TOOLS,
];

const SECTIONS: Array<{
  id: RoomSection;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Compare every Directors Room surface before entering it.",
  },
  ...OVERVIEW_FEATURES.map(({ id, label, description }) => ({
    id,
    label,
    description,
  })),
];

export function DirectorsRoomPage() {
  const [activeSection, setActiveSection] = useState<RoomSection>("overview");
  const activeEmbeddedTool = EMBEDDED_TOOLS.find(
    (tool) => tool.kind === activeSection,
  );
  const activeNativeTool = isNativeTool(activeSection)
    ? NATIVE_TOOLS.find((tool) => tool.id === activeSection)
    : undefined;

  return (
    <main className="flex h-[100dvh] min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">
              Aurora Global
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
                Directors Room
              </h1>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Compare your production surfaces before you direct
              </span>
            </div>
          </div>

          <nav
            aria-label="Directors Room tools"
            className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5"
          >
            {SECTIONS.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  title={section.description}
                  onClick={() => setActiveSection(section.id)}
                  className={
                    "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div
        role="region"
        aria-label={
          activeSection === "overview"
            ? "Directors Room overview"
            : activeSection === "storyboard"
              ? "Storyboard"
              : activeEmbeddedTool?.label ??
                activeNativeTool?.label ??
                "Directors Room tool"
        }
        className="min-h-0 flex-1"
      >
        {activeSection === "overview" ? (
          <DirectorsRoomOverview onOpen={setActiveSection} />
        ) : activeSection === "storyboard" ? (
          <StudioPage embedded />
        ) : activeEmbeddedTool ? (
          <EmbeddedToolPanel tool={activeEmbeddedTool} />
        ) : activeNativeTool ? (
          <NativeToolPanel tool={activeNativeTool} />
        ) : null}
      </div>
    </main>
  );
}

function DirectorsRoomOverview({
  onOpen,
}: {
  onOpen: (section: RoomSection) => void;
}) {
  return (
    <section className="h-full overflow-auto bg-background">
      <div className="mx-auto max-w-[1800px] px-4 py-5 md:px-6 md:py-8">
        <div className="grid overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="order-2 flex flex-col justify-center p-6 sm:p-8 lg:order-1 lg:p-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
              Choose the right kind of direction
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Build the cut with the right creative surface.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Directors Room is a visual production menu: story, reference,
              sound, scenes, systems, and three distinct agent personalities.
              Compare what each one does before opening it.
            </p>
            <button
              type="button"
              onClick={() => onOpen("storyboard")}
              className="mt-6 inline-flex w-fit items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start with Storyboard
            </button>
          </div>
          <FeatureMedia
            media={{
              type: "video",
              src: "/videos/landing-demo-reel.mp4",
              poster: "/videos/landing-demo-reel-poster.jpg",
              alt: "Aurora-generated cinematic video reel",
            }}
            priority
            className="order-1 aspect-[4/3] min-h-[260px] lg:order-2 lg:aspect-auto lg:min-h-full"
          />
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
              Production surfaces
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              See the strengths, then choose the tool
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Each visual card opens a capability brief
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {OVERVIEW_FEATURES.map((feature, index) => (
            <article
              key={feature.id}
              className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
            >
              <button
                type="button"
                aria-label={`Explore ${feature.label}`}
                onClick={() => onOpen(feature.id)}
                className="group block w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <FeatureMedia
                  media={feature.media}
                  className="aspect-[16/10] w-full"
                />
              </button>
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                  {String(index + 1).padStart(2, "0")} · {feature.category}
                </p>
                <h3 className="mt-2 text-base font-semibold tracking-tight">
                  {feature.label}
                </h3>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                  {feature.description}
                </p>
                <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-foreground">
                  <span className="font-semibold">Choose this for: </span>
                  {feature.bestFor}
                </p>
                <button
                  type="button"
                  onClick={() => onOpen(feature.id)}
                  className="mt-4 text-xs font-semibold text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Explore {feature.label} →
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmbeddedToolPanel({ tool }: { tool: EmbeddedToolDefinition }) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ToolHeader
        category={tool.category}
        label={tool.label}
        description={tool.description}
        bestFor={tool.bestFor}
      />

      <div className="min-h-0 flex-1 overflow-auto p-3 md:p-5">
        {tool.src ? (
          <div className="mx-auto min-h-full max-w-[1800px] overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <AuroraEmbed
              kind={tool.kind}
              src={tool.src}
              title={`${tool.label} editor`}
              initialHeight={760}
              minHeight={560}
              loading="eager"
            />
          </div>
        ) : (
          <MissingEmbedConfig tool={tool} />
        )}
      </div>
    </section>
  );
}

function NativeToolPanel({ tool }: { tool: NativeToolDefinition }) {
  return (
    <section className="h-full overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <FeatureMedia media={tool.media} priority className="aspect-[16/8] w-full" />
        <div className="p-6 md:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
            {tool.category}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            {tool.label}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            {tool.description}
          </p>
          <p className="mt-4 max-w-3xl rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-6">
            <span className="font-semibold">Choose this for: </span>
            {tool.bestFor}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {tool.capabilities.map((capability) => (
              <div
                key={capability}
                className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm"
              >
                {capability}
              </div>
            ))}
          </div>

          <a
            href={tool.href}
            className="mt-7 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tool.actionLabel} →
          </a>
        </div>
      </div>
    </section>
  );
}

function ToolHeader({
  category,
  label,
  description,
  bestFor,
}: Pick<RoomFeature, "category" | "label" | "description" | "bestFor">) {
  return (
    <div className="shrink-0 border-b border-border/60 px-4 py-4 md:px-6">
      <div className="mx-auto max-w-[1800px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
          {category}
        </p>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight md:text-xl">
              {label}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
            <p className="mt-2 text-xs text-foreground">
              <span className="font-semibold">Choose this for: </span>
              {bestFor}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Isolated editor view
          </span>
        </div>
      </div>
    </div>
  );
}

function MissingEmbedConfig({ tool }: { tool: EmbeddedToolDefinition }) {
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <FeatureMedia media={tool.media} className="aspect-[16/9] w-full" />
      <div className="p-6 text-center md:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
          Ready to connect
        </p>
        <h2 className="mt-3 text-xl font-semibold">
          {tool.label} is not configured yet
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          The preview above shows the visual work this tool adds to Directors
          Room. Add the deployed tool&apos;s full <code>/embed</code> URL to
          Aurora Global&apos;s environment, then rebuild the app to open the
          editor here.
        </p>
        <code className="mt-5 inline-block max-w-full overflow-x-auto rounded-md bg-background px-3 py-2 text-left text-xs text-foreground shadow-sm">
          {tool.envKey}=https://your-tool-domain/embed
        </code>
      </div>
    </div>
  );
}

function FeatureMedia({
  media,
  className,
  priority = false,
}: {
  media: DemoMedia;
  className?: string;
  priority?: boolean;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={`relative overflow-hidden bg-muted ${className ?? ""}`}>
      {media.type === "video" ? (
        <video
          className="h-full w-full object-cover"
          autoPlay={!reducedMotion}
          loop
          muted
          playsInline
          preload={priority ? "metadata" : "none"}
          poster={media.poster}
          aria-label={media.alt}
        >
          <source src={media.src} type="video/mp4" />
        </video>
      ) : (
        <img
          src={media.src}
          alt={media.alt}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      )}
    </div>
  );
}

function isNativeTool(section: RoomSection): section is NativeToolId {
  return NATIVE_TOOLS.some((tool) => tool.id === section);
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}