import { Star } from "lucide-react";

const PICKS = [
  {
    text: "Aurora replaced a $4k photoshoot. Shot a full EP cover series on a Tuesday night.",
    name: "Josh A.",
    role: "Music artist · Lagos 🇳🇬",
    accent: "border-violet-500",
  },
  {
    text: "My UGC ads are converting 3× my last batch. The lip-sync is genuinely unreal.",
    name: "Ife O.",
    role: "Creator · 1.2M followers · London 🇬🇧",
    accent: "border-amber-400",
  },
  {
    text: "Pitched a Netflix short with Aurora previz. Got greenlit off the mood board alone.",
    name: "Camila V.",
    role: "Indie filmmaker · São Paulo 🇧🇷",
    accent: "border-emerald-500",
  },
];

export function Testimonials() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-14">
      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="aurora-kicker mb-1">Loved worldwide</p>
          <h2 className="text-xl md:text-2xl font-semibold">Creators in 40+ countries.</h2>
        </div>
        <div className="flex items-center gap-1 text-amber-300">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}
          <span className="text-white/55 text-xs ml-1.5">4.9 · 2,400+ creators</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {PICKS.map((q) => (
          <figure key={q.name} className={`aurora-glass rounded-xl px-4 py-4 border-l-2 ${q.accent}`}>
            <blockquote className="text-sm font-semibold text-white/90 leading-snug mb-3">
              "{q.text}"
            </blockquote>
            <figcaption className="text-xs">
              <span className="font-medium text-white">{q.name}</span>
              <span className="text-white/45 ml-1.5">{q.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
