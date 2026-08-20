import { useEffect, useState } from "react";
import {
  AuroraEmbed,
  type AuroraEmbedKind,
} from "@/components/embed/AuroraEmbed";
import { StudioPage } from "@/features/storyboard/studio/StudioPage";

type RoomSection = "overview" | "storyboard" | AuroraEmbedKind;

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

type ToolDefinition = {
  kind: AuroraEmbedKind;
  label: string;
  description: string;
  envKey: string;
  media: DemoMedia;
  src?: string;
};

type RoomFeature = {
  id: RoomSection;
  label: string;
  description: string;
  media: DemoMedia;
};

const TOOLS: ToolDefinition[] = [
  {
    kind: "layers",
    label: "Aurora Layers",
    description: "Build layered compositions and keep the visual system in sync.",
    envKey: "VITE_AURORA_LAYERS_EMBED_URL",
    media: {
      type: "image",
      src: "/nav-previews/canvas.jpg",
      alt: "Aurora's visual composition workspace",
    },
    src: import.meta.env.VITE_AURORA_LAYERS_EMBED_URL?.trim() || undefined,
  },
  {
    kind: "scene-weaver",
    label: "Scene Weaver",
    description: "Shape scenes, transitions, and cinematic continuity in one editor.",
    envKey: "VITE_AURORA_SCENE_WEAVER_EMBED_URL",
    media: {
      type: "image",
      src: "/nav-previews/scene-builder.jpg",
      alt: "Aurora scene-building interface",
    },
    src: import.meta.env.VITE_AURORA_SCENE_WEAVER_EMBED_URL?.trim() || undefined,
  },
  {
    kind: "presets-engine",
    label: "Presets Engine",
    description: "Create and tune reusable looks for the rest of the production.",
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

const STORYBOARD_FEATURE: RoomFeature = {
  id: "storyboard",
  label: "Storyboard",
  description: "Map scenes, develop the cast, direct the sequence, and send finished shots to render.",
  media: {
    type: "image",
    src: "/screenshots/studio-screen.png",
    alt: "Aurora's visual production studio showing a project workspace",
  },
};

const OVERVIEW_FEATURES: RoomFeature[] = [
  STORYBOARD_FEATURE,
  ...TOOLS.map(({ kind, label, description, media }) => ({
    id: kind,
    label,
    description,
    media,
  })),
];

const SECTIONS: Array<{
  id: RoomSection;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "See the full Directors Room production workflow.",
  },
  ...OVERVIEW_FEATURES.map(({ id, label, description }) => ({
    id,
    label,
    description,
  })),
];

export function DirectorsRoomPage() {
  const [activeSection, setActiveSection] = useState<RoomSection>("overview");
  const activeTool =
    activeSection === "overview" || activeSection === "storyboard"
      ? undefined
      : TOOLS.find((tool) => tool.kind === activeSection);

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
                Your visual production workspace
              </span>
            </div>
          </div>

          <nav
            aria-label="Directors Room tools"
            role="tablist"
            className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5"
          >
            {SECTIONS.map((section) => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`directors-room-${section.id}`}
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
        id={`directors-room-${activeSection}`}
        role="tabpanel"
        aria-label={
          activeSection === "overview"
            ? "Directors Room overview"
            : activeSection === "storyboard"
              ? "Storyboard"
              : activeTool?.label ?? "Directors Room tool"
        }
        className="min-h-0 flex-1"
      >
        {activeSection === "overview" ? (
          <DirectorsRoomOverview onOpen={setActiveSection} />
        ) : activeSection === "storyboard" ? (
          <StudioPage embedded />
        ) : activeTool ? (
          <ToolPanel tool={activeTool} />
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
              A visual production system
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              See the cut before you make it.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Directors Room brings your shot plan, compositing, scene direction,
              and visual presets into one production flow. Explore a working
              surface, not a list of promises.
            </p>
            <button
              type="button"
              onClick={() => onOpen("storyboard")}
              className="mt-6 inline-flex w-fit items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open Storyboard
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

        <div className="mt-8 flex items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
              The room, in motion
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Every production surface, visually explained
            </h2>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">
            Select a card to open the tool
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {OVERVIEW_FEATURES.map((feature, index) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => onOpen(feature.id)}
              className="group overflow-hidden rounded-xl border border-border/60 bg-card text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FeatureMedia
                media={feature.media}
                className="aspect-[16/10] w-full"
              />
              <span className="block p-4">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-2 block text-base font-semibold tracking-tight">
                  {feature.label}
                </span>
                <span className="mt-1.5 block text-sm leading-5 text-muted-foreground">
                  {feature.description}
                </span>
                <span className="mt-4 block text-xs font-semibold text-foreground transition-transform group-hover:translate-x-1">
                  Explore tool →
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolPanel({ tool }: { tool: ToolDefinition }) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/60 px-4 py-4 md:px-6">
        <div className="mx-auto max-w-[1800px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
            Directors Room tool
          </p>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight md:text-xl">
                {tool.label}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {tool.description}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Isolated editor view
            </span>
          </div>
        </div>
      </div>

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
          <MissingToolConfig tool={tool} />
        )}
      </div>
    </section>
  );
}

function MissingToolConfig({ tool }: { tool: ToolDefinition }) {
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
          The preview above shows the kind of visual work this tool adds to
          Directors Room. Add the deployed tool&apos;s full <code>/embed</code>{" "}
          URL to Aurora Global&apos;s environment, then rebuild the app to open
          the editor here.
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