import type { ReactNode } from "react";
import type { DirectorRoomPanel } from "./DirectorRoomRail";

type AtmosphereKey = DirectorRoomPanel | "gpu";

const ATMOSPHERES: Record<AtmosphereKey, { src: string; label: string; position: string }> = {
  wardrobe: {
    src: "/director-room/streets-performance-close.png",
    label: "Close performance",
    position: "center 30%",
  },
  scenes: {
    src: "/director-room/streets-performance-hero.jpeg",
    label: "Street-scale scene",
    position: "center",
  },
  layers: {
    src: "/director-room/streets-performance-wide.png",
    label: "Wet street detail",
    position: "center 45%",
  },
  storyboard: {
    src: "/director-room/streets-performance-crowd.png",
    label: "Crowd performance",
    position: "center 35%",
  },
  moodboard: {
    src: "/director-room/streets-performance-hero.jpeg",
    label: "Visual language",
    position: "center 55%",
  },
  flows: {
    src: "/director-room/streets-performance-wide.png",
    label: "Movement flow",
    position: "center 35%",
  },
  gpu: {
    src: "/director-room/streets-performance-close.png",
    label: "Render energy",
    position: "center 25%",
  },
};

export function DirectorRoomAtmosphere({
  panel,
  children,
}: {
  panel: AtmosphereKey;
  children: ReactNode;
}) {
  const atmosphere = ATMOSPHERES[panel];

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <img
        src={atmosphere.src}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-25"
        style={{ objectPosition: atmosphere.position }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,rgba(7,6,18,0.94)_0%,rgba(7,6,18,0.76)_45%,rgba(7,6,18,0.88)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(141,84,255,0.18),transparent_36%)]"
      />
      <div className="relative z-10 flex size-full min-h-0 flex-col bg-background/35">
        <div className="pointer-events-none absolute right-4 top-3 z-20 hidden rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45 backdrop-blur-sm lg:block">
          {atmosphere.label}
        </div>
        {children}
      </div>
    </div>
  );
}