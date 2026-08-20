import { useState } from "react";
import {
  AuroraEmbed,
  type AuroraEmbedKind,
} from "@/components/embed/AuroraEmbed";
import { StudioPage } from "@/features/storyboard/studio/StudioPage";

type RoomSection = "storyboard" | AuroraEmbedKind;

type ToolDefinition = {
  kind: AuroraEmbedKind;
  label: string;
  description: string;
  envKey: string;
  src?: string;
};

const TOOLS: ToolDefinition[] = [
  {
    kind: "layers",
    label: "Aurora Layers",
    description: "Build layered compositions and keep the visual system in sync.",
    envKey: "VITE_AURORA_LAYERS_EMBED_URL",
    src: import.meta.env.VITE_AURORA_LAYERS_EMBED_URL?.trim() || undefined,
  },
  {
    kind: "scene-weaver",
    label: "Scene Weaver",
    description: "Shape scenes, transitions, and cinematic continuity in one editor.",
    envKey: "VITE_AURORA_SCENE_WEAVER_EMBED_URL",
    src: import.meta.env.VITE_AURORA_SCENE_WEAVER_EMBED_URL?.trim() || undefined,
  },
  {
    kind: "presets-engine",
    label: "Presets Engine",
    description: "Create and tune reusable looks for the rest of the production.",
    envKey: "VITE_AURORA_PRESETS_ENGINE_EMBED_URL",
    src: import.meta.env.VITE_AURORA_PRESETS_ENGINE_EMBED_URL?.trim() || undefined,
  },
];

const SECTIONS: Array<{
  id: RoomSection;
  label: string;
  description: string;
}> = [
  {
    id: "storyboard",
    label: "Storyboard",
    description: "Direct shots, characters, renders, and the production board.",
  },
  ...TOOLS.map(({ kind, label, description }) => ({
    id: kind,
    label,
    description,
  })),
];

export function DirectorsRoomPage() {
  const [activeSection, setActiveSection] = useState<RoomSection>("storyboard");
  const activeTool =
    activeSection === "storyboard"
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
                Your creative production workspace
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
          activeSection === "storyboard"
            ? "Storyboard"
            : activeTool?.label
        }
        className="min-h-0 flex-1"
      >
        {activeSection === "storyboard" ? (
          <StudioPage embedded />
        ) : activeTool ? (
          <ToolPanel tool={activeTool} />
        ) : null}
      </div>
    </main>
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
    <div className="mx-auto flex min-h-[min(520px,calc(100vh-220px))] max-w-2xl items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center md:p-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
          Ready to connect
        </p>
        <h2 className="mt-3 text-xl font-semibold">
          {tool.label} is not configured yet
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Add the deployed tool&apos;s full <code>/embed</code> URL to Aurora
          Global&apos;s environment, then rebuild the app to open it here.
        </p>
        <code className="mt-5 inline-block max-w-full overflow-x-auto rounded-md bg-background px-3 py-2 text-left text-xs text-foreground shadow-sm">
          {tool.envKey}=https://your-tool-domain/embed
        </code>
      </div>
    </div>
  );
}
