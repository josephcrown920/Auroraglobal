import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Camera,
  Clapperboard,
  Flame,
  Layers3,
  Mic2,
  Music2,
  Palette,
  Wand2,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { TOOL_DIRECTORY, type ToolDirectoryItem } from "@/lib/tool-directory";
import { cn } from "@/lib/utils";

type Accent = {
  border: string;
  glow: string;
  chip: string;
  wash: string;
};

type StudioToolRow = {
  key: string;
  name: string;
  description: string;
  to: ToolDirectoryItem["to"] | "/director-room";
  price?: string;
  badge?: string;
  image: string;
  alt: string;
  icon: LucideIcon;
  accent: Accent;
};

const ACCENTS = {
  violet: {
    border: "border-violet-400/30 hover:border-violet-300/60",
    glow: "shadow-[0_16px_48px_-28px_rgba(167,139,250,0.9)]",
    chip: "bg-violet-400/15 text-violet-200",
    wash: "from-violet-500/35 via-violet-500/5 to-transparent",
  },
  lime: {
    border: "border-lime-300/30 hover:border-lime-200/60",
    glow: "shadow-[0_16px_48px_-28px_rgba(190,242,100,0.75)]",
    chip: "bg-lime-300/15 text-lime-200",
    wash: "from-lime-300/30 via-lime-300/5 to-transparent",
  },
  red: {
    border: "border-red-400/30 hover:border-red-300/60",
    glow: "shadow-[0_16px_48px_-28px_rgba(248,113,113,0.8)]",
    chip: "bg-red-400/15 text-red-200",
    wash: "from-red-400/30 via-red-400/5 to-transparent",
  },
  cyan: {
    border: "border-cyan-300/30 hover:border-cyan-200/60",
    glow: "shadow-[0_16px_48px_-28px_rgba(103,232,249,0.75)]",
    chip: "bg-cyan-300/15 text-cyan-200",
    wash: "from-cyan-300/30 via-cyan-300/5 to-transparent",
  },
  amber: {
    border: "border-amber-300/30 hover:border-amber-200/60",
    glow: "shadow-[0_16px_48px_-28px_rgba(252,211,77,0.75)]",
    chip: "bg-amber-300/15 text-amber-200",
    wash: "from-amber-300/30 via-amber-300/5 to-transparent",
  },
  pink: {
    border: "border-fuchsia-300/30 hover:border-fuchsia-200/60",
    glow: "shadow-[0_16px_48px_-28px_rgba(232,121,249,0.8)]",
    chip: "bg-fuchsia-300/15 text-fuchsia-200",
    wash: "from-fuchsia-400/35 via-fuchsia-400/5 to-transparent",
  },
  lavender: {
    border: "border-purple-300/30 hover:border-purple-200/60",
    glow: "shadow-[0_16px_48px_-28px_rgba(196,181,253,0.8)]",
    chip: "bg-purple-300/15 text-purple-200",
    wash: "from-purple-400/35 via-purple-400/5 to-transparent",
  },
} satisfies Record<string, Accent>;

const studioToolRows: StudioToolRow[] = [
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Perform Anywhere")!;
    return {
      key: "perform-anywhere",
      name: tool.name,
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "Flagship",
      image: "/nav-previews/perform-anywhere.jpg",
      alt: "Perform Anywhere cinematic performance preview",
      icon: Wand2,
      accent: ACCENTS.red,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Performance Studio")!;
    return {
      key: "performance-studio",
      name: tool.name,
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "Motion",
      image: "/nav-previews/perform-anywhere.jpg",
      alt: "Performance Studio motion transfer preview",
      icon: Wand2,
      accent: ACCENTS.violet,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Scene Builder")!;
    return {
      key: "scene-builder",
      name: tool.name,
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "5 References",
      image: "/nav-previews/music-video.jpg",
      alt: "Scene Builder five-reference cinematic setup preview",
      icon: Camera,
      accent: ACCENTS.amber,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Lip Sync")!;
    return {
      key: "lip-sync",
      name: tool.name,
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "Performance",
      image: "/nav-previews/lipsync.jpg",
      alt: "Lip Sync audio-synced performance preview",
      icon: Mic2,
      accent: ACCENTS.cyan,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Music Video")!;
    return {
      key: "music-video",
      name: tool.name,
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "Music Video",
      image: "/nav-previews/music-video.jpg",
      alt: "Music Video Studio cinematic production preview",
      icon: Music2,
      accent: ACCENTS.pink,
    };
  })(),
  {
    key: "directors-chair",
    name: "Director’s Chair",
    description: "Build the shot: wardrobe, scenes, storyboard, and final frames in one room.",
    to: "/director-room",
    badge: "Director",
    image: "/nav-previews/music-video.jpg",
    alt: "Director's Room cinematic shot planning preview",
    icon: Clapperboard,
    accent: ACCENTS.amber,
  },
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Aurora Video Agent")!;
    return {
      key: "video-agent",
      name: "Video Agent",
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "Agent",
      image: "/nav-previews/video-agent.jpg",
      alt: "Aurora Video Agent storyboard and production preview",
      icon: Clapperboard,
      accent: ACCENTS.violet,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Layers")!;
    return {
      key: "layers",
      name: tool.name,
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "Edit",
      image: "/nav-previews/music-video.jpg",
      alt: "Aurora Layers editable scene preview",
      icon: Layers3,
      accent: ACCENTS.lavender,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "TikTok30")!;
    return {
      key: "tiktok30",
      name: tool.name,
      description: tool.description,
      to: tool.to,
      price: tool.price,
      image: "/nav-previews/spin.jpg",
      alt: "TikTok30 social video campaign preview",
      icon: Flame,
      accent: ACCENTS.lime,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Colors")!;
    return {
      key: "colors-studio",
      name: "Colors Studio",
      description: tool.description,
      to: tool.to,
      price: tool.price,
      image: "/nav-previews/colors.jpg",
      alt: "Colors Studio performance world preview",
      icon: Palette,
      accent: ACCENTS.pink,
    };
  })(),
  (() => {
    const tool = TOOL_DIRECTORY.find((item) => item.name === "Canvas")!;
    return {
      key: "infinity-canvas",
      name: "Infinity Canvas",
      description: tool.description,
      to: tool.to,
      price: tool.price,
      badge: "Workflow",
      image: "/nav-previews/canvas.jpg",
      alt: "Infinity Canvas connected creative workflow preview",
      icon: Workflow,
      accent: ACCENTS.lavender,
    };
  })(),
];

export function StudioToolRows() {
  return (
    <section aria-labelledby="studio-tools-heading" className="border-t border-white/5 bg-zinc-950/95 px-4 pb-9 pt-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300/80">Your creative shortcuts</p>
          <h2 id="studio-tools-heading" className="mt-1 text-xl font-semibold tracking-tight text-white">
            Pick a direction.
          </h2>
        </div>
        <span className="pb-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-600">{studioToolRows.length} tools</span>
      </div>

      <div className="space-y-3">
        {studioToolRows.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.key}
              to={tool.to}
              className={cn(
                "group block overflow-hidden rounded-2xl border bg-zinc-900/80 no-underline transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5",
                tool.accent.border,
                tool.accent.glow,
              )}
            >
              <div className="relative h-36 overflow-hidden bg-zinc-900">
                <img
                  src={tool.image}
                  alt={tool.alt}
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="h-full w-full object-cover saturate-[0.85] transition duration-500 group-hover:scale-[1.04] group-hover:saturate-100"
                />
                <div className={cn("absolute inset-0 bg-gradient-to-r via-transparent to-transparent opacity-90", tool.accent.wash)} />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950/90 to-transparent" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur", tool.accent.chip)}>
                    <Icon className="size-3" />
                    {tool.badge ?? "Open tool"}
                  </span>
                  <ArrowUpRight className="size-4 text-white/65 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-100">{tool.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tool.description}</p>
                </div>
                {tool.price && <span className="shrink-0 pt-0.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{tool.price}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
