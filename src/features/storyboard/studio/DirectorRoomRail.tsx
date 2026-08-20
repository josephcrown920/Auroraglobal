import { Link } from "@tanstack/react-router";
import {
  Bot,
  Camera,
  Clapperboard,
  Grid2X2,
  Layers3,
  Music2,
  Palette,
  Scissors,
  Sparkles,
  Wand2,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DirectorRoomPanel =
  | "scenes"
  | "layers"
  | "storyboard"
  | "wardrobe"
  | "moodboard"
  | "flows";

type PanelTool = {
  kind: "panel";
  id: DirectorRoomPanel;
  label: string;
  icon: LucideIcon;
  tab: "canvas" | "characters";
};

type RouteTool = {
  kind: "route";
  label: string;
  icon: LucideIcon;
  to: "/edit" | "/canvas" | "/scene-weaver" | "/photo-edit" | "/puremix" | "/video-agent" | "/agent";
};

const PLANNING_TOOLS: Array<PanelTool | RouteTool> = [
  { kind: "panel", id: "wardrobe", label: "Wardrobe", icon: Camera, tab: "characters" },
  { kind: "panel", id: "scenes", label: "Scenes", icon: Clapperboard, tab: "canvas" },
  { kind: "panel", id: "layers", label: "Layers", icon: Layers3, tab: "canvas" },
  { kind: "route", label: "AutoCut", icon: Scissors, to: "/edit" },
  { kind: "panel", id: "storyboard", label: "Storyboard", icon: Grid2X2, tab: "canvas" },
  { kind: "panel", id: "moodboard", label: "Moodboard", icon: Palette, tab: "canvas" },
  { kind: "route", label: "Infinity Canvas", icon: Workflow, to: "/canvas" },
  { kind: "route", label: "Scene Weaver", icon: Wand2, to: "/scene-weaver" },
  { kind: "route", label: "Style Transfer", icon: Sparkles, to: "/photo-edit" },
  { kind: "route", label: "Soundweaver", icon: Music2, to: "/puremix" },
  { kind: "panel", id: "flows", label: "Flows", icon: Workflow, tab: "canvas" },
  { kind: "route", label: "Edits", icon: Scissors, to: "/edit" },
];

const AGENTS: RouteTool[] = [
  { kind: "route", label: "Video Agent Projects", icon: Clapperboard, to: "/video-agent" },
  { kind: "route", label: "Aurora AI Director", icon: Bot, to: "/agent" },
];

function RailHeading({ children }: { children: React.ReactNode }) {
  return <p className="director-room-rail-heading">{children}</p>;
}

export function DirectorRoomRail({
  activePanel,
  onPanelChange,
}: {
  activePanel: DirectorRoomPanel | null;
  onPanelChange: (panel: DirectorRoomPanel, tab: PanelTool["tab"]) => void;
}) {
  return (
    <aside aria-label="Director’s Room tools" className="director-room-rail">
      <div className="director-room-rail-inner">
        <div className="director-room-rail-brand">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Clapperboard className="size-4" />
          </span>
          <span>
            <strong>Director’s Room</strong>
            <small>Production tools</small>
          </span>
        </div>

        <RailHeading>Plan & build</RailHeading>
        <div className="director-room-rail-list">
          {PLANNING_TOOLS.map((tool) =>
            tool.kind === "panel" ? (
              <button
                key={`${tool.label}-${tool.id}`}
                type="button"
                onClick={() => onPanelChange(tool.id, tool.tab)}
                aria-current={activePanel === tool.id ? "page" : undefined}
                className={cn(
                  "director-room-rail-item",
                  activePanel === tool.id && "director-room-rail-item-active",
                )}
              >
                <tool.icon className="size-3.5 shrink-0" />
                <span>{tool.label}</span>
              </button>
            ) : (
              <Link key={tool.label} to={tool.to} className="director-room-rail-item">
                <tool.icon className="size-3.5 shrink-0" />
                <span>{tool.label}</span>
              </Link>
            ),
          )}
        </div>

        <RailHeading>Agents</RailHeading>
        <div className="director-room-rail-list">
          {AGENTS.map((agent) => (
            <Link key={agent.label} to={agent.to} className="director-room-rail-item director-room-agent-item">
              <agent.icon className="size-3.5 shrink-0" />
              <span>{agent.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}