import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Flame, Mic2, Camera, Film, Image as ImageIcon, Wand2, SplitSquareHorizontal, Palette } from "lucide-react";

type Workflow = {
  name: string;
  uses: string;
  icon: typeof Mic2;
  glow: string;
  nodes: string[];
  /** Optional canvas template id — if set, card deep-links to /canvas?template=... */
  template?: string;
  badge?: "PRESET" | "BLANK";
};

const WORKFLOWS: Workflow[] = [
  { name: "Lip-sync · NBA Josh preset", uses: "14.2k", icon: Mic2, glow: "from-emerald-500/40 to-teal-500/10", nodes: ["Selfie", "Audio", "Concert shot", "Sync 1.9"], template: "lipsync-preset", badge: "PRESET" },
  { name: "Lip-sync · Blank scaffold", uses: "6.8k", icon: Mic2, glow: "from-emerald-400/30 to-cyan-500/10", nodes: ["Selfie", "Audio", "Video", "Lip-sync"], template: "lipsync-blank", badge: "BLANK" },
  { name: "Colors · Blue Performance", uses: "9.7k", icon: Palette, glow: "from-blue-500/40 to-indigo-500/10", nodes: ["Selfie", "Royal-blue cyc", "Editorial portrait"], template: "colors-preset", badge: "PRESET" },
  { name: "Colors · Blank canvas", uses: "4.4k", icon: Palette, glow: "from-fuchsia-500/40 to-pink-500/10", nodes: ["Selfie", "Palette", "Scene"], template: "colors-blank", badge: "BLANK" },
  { name: "Editorial Cover Shoot", uses: "8.9k", icon: Camera, glow: "from-amber-500/40 to-rose-500/10", nodes: ["Selfie", "Outfit", "Rembrandt", "Cover crop"], template: "editorial-cover" },
  { name: "Split Reality", uses: "6.2k", icon: SplitSquareHorizontal, glow: "from-violet-500/40 to-fuchsia-500/10", nodes: ["Selfie", "Two grades", "Side-by-side"], template: "split-reality" },
  { name: "UGC Ad Loop", uses: "4.1k", icon: Film, glow: "from-cyan-500/40 to-blue-500/10", nodes: ["Product", "Talent", "Kling 3.0", "Caption"], template: "ugc-loop" },
  { name: "Music Video Mini", uses: "3.2k", icon: Wand2, glow: "from-pink-500/40 to-rose-500/10", nodes: ["Selfie", "Audio", "Video", "Lip-sync"], template: "music-video-mini" },
];

export function TrendingWorkflows() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-20">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-2 inline-flex items-center gap-1.5">
            <Flame className="size-3.5 text-rose-400" /> Trending workflows
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold">Start from a pipeline the community loves.</h2>
          <p className="text-white/60 text-sm mt-1 max-w-xl">One-click recipes on Canvas. Wire your selfie in, run, ship.</p>
        </div>
        <Link to="/canvas" className="hidden md:inline-flex items-center gap-1 text-sm text-white/70 hover:text-white no-underline">
          Browse all <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {WORKFLOWS.map((w) => {
          const Icon = w.icon;
          const href = w.template ? `/canvas?template=${w.template}` : "/canvas";
          return (
            <a
              key={w.name}
              href={href}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 overflow-hidden hover:border-white/30 hover:-translate-y-0.5 transition-all no-underline"
            >
              <div className={`absolute -inset-16 opacity-50 blur-3xl bg-gradient-to-br ${w.glow} group-hover:opacity-80 transition-opacity`} />
              <div className="relative flex items-center justify-between mb-3">
                <span className="size-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <Icon className="size-4 text-white" />
                </span>
                <div className="flex items-center gap-1.5">
                  {w.badge && (
                    <span className={`text-[9px] font-bold tracking-[0.15em] px-1.5 py-0.5 rounded ${
                      w.badge === "PRESET" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                      : "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                    }`}>{w.badge}</span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider text-white/50">{w.uses} runs</span>
                </div>
              </div>
              <p className="relative text-white font-medium text-sm leading-tight">{w.name}</p>
              <div className="relative mt-3 flex flex-wrap gap-1.5">
                {w.nodes.map((n) => (
                  <span key={n} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">{n}</span>
                ))}
              </div>
              <div className="relative mt-3 inline-flex items-center gap-1 text-[11px] text-violet-300 group-hover:text-violet-200">
                <Sparkles className="size-3" /> Open in Canvas <ArrowRight className="size-3" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

const FEATURES = [
  { name: "Performance Studio", desc: "Selfie → magazine-grade portrait in seconds.", to: "/studio", icon: Camera, glow: "from-violet-500/30 to-fuchsia-500/10" },
  { name: "Aurora Canvas", desc: "Node-graph orchestrator for image + video + lip-sync.", to: "/canvas", icon: Sparkles, glow: "from-fuchsia-500/30 to-pink-500/10" },
  { name: "Colors Studio", desc: "Direct your color palette across studio, indoor, rooftop scenes.", to: "/colors", icon: Palette, glow: "from-pink-500/30 to-rose-500/10" },
  { name: "Lip-sync", desc: "Frame-accurate Sync 1.9 in 8+ languages.", to: "/studio", icon: Mic2, glow: "from-emerald-500/30 to-teal-500/10" },
  { name: "Split Reality", desc: "Two cinematic grades, one render, side-by-side.", to: "/canvas", icon: SplitSquareHorizontal, glow: "from-cyan-500/30 to-blue-500/10" },
  { name: "UGC Ads", desc: "Talent + product → looping social ads.", to: "/ugc", icon: Film, glow: "from-amber-500/30 to-orange-500/10" },
  { name: "Gallery", desc: "Browse the community's best Aurora shots.", to: "/gallery", icon: ImageIcon, glow: "from-indigo-500/30 to-violet-500/10" },
  { name: "Gifts", desc: "Send Aurora credits to a friend.", to: "/gifts", icon: Wand2, glow: "from-rose-500/30 to-pink-500/10" },
];

export function FeaturesGrid() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-20">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-2">Everything in Aurora</p>
        <h2 className="text-2xl md:text-3xl font-semibold">One app. Every creative move.</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Link
              key={f.name}
              to={f.to}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 overflow-hidden hover:border-white/30 hover:-translate-y-0.5 transition-all no-underline"
            >
              <div className={`absolute -inset-12 opacity-40 blur-3xl bg-gradient-to-br ${f.glow} group-hover:opacity-70 transition-opacity`} />
              <Icon className="relative size-5 text-white/80 mb-2" />
              <p className="relative text-white font-medium text-sm leading-tight">{f.name}</p>
              <p className="relative text-white/55 text-xs mt-1 leading-snug">{f.desc}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
