import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

export const Route = createLazyFileRoute("/tools")({ component: ToolsPage });

const TOOLS = [
  {
    num: "00",
    name: "PERFORM ANYWHERE",
    badge: "FLAGSHIP",
    badgeColor: "bg-[#a3e635] text-black",
    desc: "Phone performance → cinematic scene",
    cost: "FROM 400 AURA",
    costColor: "bg-[#a3e635] text-black",
    to: "/motion",
    img: "/hero/hero-perform-anywhere.png",
  },
  {
    num: "01",
    name: "COLORS",
    badge: null,
    badgeColor: "",
    desc: "Performance photo generation",
    cost: "FROM 2 AURA",
    costColor: "bg-white/10 text-white",
    to: "/colors",
    img: "/hero/hero-colors.png",
  },
  {
    num: "02",
    name: "TIKTOK30",
    badge: null,
    badgeColor: "",
    desc: "UGC campaign engine",
    cost: "FROM 6 AURA",
    costColor: "bg-white/10 text-white",
    to: "/spin",
    img: "/hero/hero-tiktok30.jpg",
  },
  {
    num: "03",
    name: "HEYGEN AGENT",
    badge: null,
    badgeColor: "",
    desc: "AI presenter videos with HeyGen",
    cost: "FROM 480 AURA",
    costColor: "bg-white/10 text-white",
    to: "/agent",
    img: "/hero/hero-1.png",
  },
  {
    num: "03A",
    name: "AURORA VIDEO AGENT",
    badge: "AURORA",
    badgeColor: "bg-violet-500/30 text-violet-300 border border-violet-500/40",
    desc: "Plan, storyboard, edit, then render",
    cost: "FROM 24 AURA",
    costColor: "bg-white/10 text-white",
    to: "/video-agent",
    img: "/landing/step-reference.jpg",
  },
  {
    num: "04",
    name: "MUSIC VIDEO",
    badge: "SUITE",
    badgeColor: "bg-violet-500/30 text-violet-300 border border-violet-500/40",
    desc: "Cinematic visual studio",
    cost: "FROM 12 AURA",
    costColor: "bg-white/10 text-white",
    to: "/music-video",
    img: "/hero/hero-2.png",
  },
  {
    num: "05",
    name: "LIP SYNC",
    badge: null,
    badgeColor: "",
    desc: "Audio-synced video",
    cost: "FROM 8 AURA",
    costColor: "bg-white/10 text-white",
    to: "/lipsync",
    img: "/hero/hero-3.png",
  },
  {
    num: "06",
    name: "MOTION CONTROL",
    badge: "FLAGSHIP",
    badgeColor: "bg-[#a3e635] text-black",
    desc: "Motion transfer and performance reskin",
    cost: "FROM 300 AURA",
    costColor: "bg-white/10 text-white",
    to: "/motion",
    img: "/hero/hero-4.png",
  },
] as const;

function ToolsPage() {
  const [hovered, setHovered] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090712] text-white font-sans">
      {/* Full-bleed background image that crossfades on hover */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {TOOLS.map((t, i) => (
          <div
            key={t.num}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
            style={{
              backgroundImage: `url(${t.img})`,
              opacity: hovered === i ? 0.18 : 0,
            }}
          />
        ))}
        {/* Always-on dark vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0717]/80 via-[#0b0717]/55 to-[#08050e]/95" />
      </div>

      {/* Content */}
      <div ref={containerRef} className="relative z-10">
        {/* Header / hero text */}
        <header className="px-6 pt-14 pb-10 md:px-14 md:pt-20 md:pb-14">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.4em] text-violet-300 mb-5">
            <Sparkles className="size-3" /> Aurora toolkit
          </p>
          <h1
            className="font-black uppercase leading-[0.88] tracking-[-0.02em] text-white"
            style={{ fontSize: "clamp(52px, 11vw, 128px)" }}
          >
            MAKE THE<br />
            NEXT THING<br />
            REAL.
          </h1>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.35em] text-white/40">
             {TOOLS.length} Aurora tools · Built for creators
          </p>
        </header>

        {/* Tool list */}
        <div className="border-t border-white/10">
          {TOOLS.map((tool, i) => (
            <Link
              key={tool.num}
              to={tool.to}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="group relative flex items-center gap-4 px-6 md:px-14 py-6 md:py-7 border-b border-white/10 no-underline transition-colors hover:bg-white/[0.03]"
            >
              {/* Number */}
              <span className="shrink-0 w-9 text-sm font-bold text-white/30 tabular-nums">
                {tool.num}
              </span>

              {/* Name + badge */}
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <span
                  className="font-black uppercase leading-none tracking-tight text-white transition-colors group-hover:text-violet-300"
                  style={{ fontSize: "clamp(18px, 3.5vw, 40px)" }}
                >
                  {tool.name}
                </span>
                {tool.badge && (
                  <span className={`hidden sm:inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] ${tool.badgeColor}`}>
                    {tool.badge}
                  </span>
                )}
              </div>

              {/* Description (hidden on small) */}
              <span className="hidden lg:block shrink-0 text-sm text-white/40 w-52 text-right">
                {tool.desc}
              </span>

              {/* Cost */}
              <span className={`shrink-0 ml-auto lg:ml-4 rounded-sm px-2.5 py-1 text-[11px] font-bold tabular-nums ${tool.costColor}`}>
                {tool.cost}
              </span>

              {/* Open arrow */}
              <span className="shrink-0 ml-3 text-sm font-bold text-white/30 group-hover:text-white transition-colors">
                <ArrowUpRight className="size-4" aria-label="Open tool" />
              </span>
            </Link>
          ))}
        </div>

        {/* Bottom promo */}
        <section className="px-6 md:px-14 py-16 md:py-24 border-t border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300 mb-6">
            · Perform Anywhere · Motion Control
          </p>
          <h2
            className="font-black uppercase leading-[0.9] tracking-tight text-white max-w-3xl"
            style={{ fontSize: "clamp(32px, 6vw, 72px)" }}
          >
            Film yourself anywhere.<br />
            <span className="text-violet-300">Aurora builds</span> the world.
          </h2>
          <p className="mt-6 max-w-[44ch] text-base text-white/50 leading-relaxed">
            Motion Control reads your real movement from a 30-second phone clip and transfers it into your AI-generated scene — style, motion, energy. No studio, no crew, no budget.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/motion"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-black uppercase tracking-wide text-primary-foreground no-underline hover:scale-105 active:scale-95 transition-transform"
            >
              Try Perform Anywhere
            </Link>
            <Link
              to="/home"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-bold text-white no-underline hover:border-white/40 transition-colors"
            >
              ← Back to home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
