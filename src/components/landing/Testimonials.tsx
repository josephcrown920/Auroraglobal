import { Star } from "lucide-react";

const QUOTES = [
  {
    name: "Josh A.",
    role: "Music artist · Lagos 🇳🇬",
    text: "I shot a full cover art series for my EP on a Tuesday night. Aurora replaced a $4k photoshoot.",
    color: "from-violet-500/40 to-fuchsia-500/10",
  },
  {
    name: "Daniel K.",
    role: "Video director · Berlin 🇩🇪",
    text: "Split-reality renders are dangerous. I previz two storylines for a client in 20 minutes.",
    color: "from-emerald-500/40 to-teal-500/10",
  },
  {
    name: "Ife O.",
    role: "Creator · 1.2M · London 🇬🇧",
    text: "The lip-sync is unreal. My UGC ads with Aurora are converting 3× my last batch.",
    color: "from-amber-500/40 to-rose-500/10",
  },
  {
    name: "Tobi A.",
    role: "Afrobeats artist · Lagos 🇳🇬",
    text: "Dropped the visualizer the same night I mastered the track. Charting before I could book a shoot.",
    color: "from-cyan-500/40 to-blue-500/10",
  },
  {
    name: "Hiroshi M.",
    role: "Concept artist · Tokyo 🇯🇵",
    text: "The agent reads my brief in Japanese and returns shot lists I'd hire a director to write.",
    color: "from-pink-500/40 to-rose-500/10",
  },
  {
    name: "Camila V.",
    role: "Indie filmmaker · São Paulo 🇧🇷",
    text: "Pitched a Netflix short with Aurora previz. Got greenlit off the mood board alone.",
    color: "from-orange-500/40 to-amber-500/10",
  },
  {
    name: "Marcus D.",
    role: "Drill producer · London 🇬🇧",
    text: "Every type beat I sell ships with an Aurora visual. Artists pick my beats for the videos.",
    color: "from-yellow-500/40 to-orange-500/10",
  },
  {
    name: "Jules P.",
    role: "Independent rapper · Atlanta 🇺🇸",
    text: "No label, no budget, no problem. My last three music videos were Aurora — views tripled.",
    color: "from-fuchsia-500/40 to-purple-500/10",
  },
  {
    name: "Kwame A.",
    role: "Afrobeats producer · Accra 🇬🇭",
    text: "Visualizers for every track on the album. The diaspora is paying attention now.",
    color: "from-emerald-500/40 to-lime-500/10",
  },
  {
    name: "Min-jun L.",
    role: "K-pop director · Seoul 🇰🇷",
    text: "Storyboarded an entire MV with the agent. My team thought I'd hired a second director.",
    color: "from-sky-500/40 to-indigo-500/10",
  },
  {
    name: "Olivia W.",
    role: "Creator · 3M · Sydney 🇦🇺",
    text: "Lip-sync that doesn't look uncanny. Finally. My TikTok views literally doubled.",
    color: "from-teal-500/40 to-cyan-500/10",
  },
  {
    name: "Mateo G.",
    role: "Reggaeton artist · Medellín 🇨🇴",
    text: "Dropped a full visual EP on Aurora. Looks like a Bad Bunny budget. Costó nada.",
    color: "from-rose-500/40 to-red-500/10",
  },
];

export function Testimonials() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-16">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="aurora-kicker mb-1">Loved worldwide</p>
          <h2 className="text-xl md:text-2xl font-semibold">Creators in 40+ countries. One studio.</h2>
        </div>
        <div className="flex items-center gap-1 text-amber-300">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}
          <span className="text-white/60 text-xs ml-1.5">4.9 · 2,400+ creators</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {QUOTES.map((q, i) => (
          <figure
            key={q.name}
            className="relative rounded-xl aurora-glass px-4 py-3 overflow-hidden hover:-translate-y-0.5 transition-transform animate-fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={`absolute -inset-8 blur-2xl opacity-60 bg-gradient-to-br ${q.color}`} />
            <blockquote className="relative text-sm font-medium text-white/90 leading-snug mb-2.5">
              "{q.text}"
            </blockquote>
            <figcaption className="relative flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white">{q.name}</span>
              <span className="text-white/30 text-xs">·</span>
              <span className="text-[11px] text-white/50 truncate">{q.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
