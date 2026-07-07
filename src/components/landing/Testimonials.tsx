import { Star } from "lucide-react";

export function Testimonials() {
  return (
    <section className="relative z-10 py-10 px-6 border-y border-white/[0.06] text-center">
      <div className="flex items-center justify-center gap-1 mb-4 text-amber-300">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-3 fill-current" />
        ))}
        <span className="text-white/45 text-xs ml-2">4.9 · 2,400+ creators in 40+ countries</span>
      </div>
      <blockquote className="text-lg md:text-2xl font-semibold text-white max-w-2xl mx-auto leading-snug mb-3">
        "Aurora replaced a $4k photoshoot. Shot a full EP cover series on a Tuesday night."
      </blockquote>
      <figcaption className="text-sm text-white/45">
        Josh A. &mdash; Music artist &middot; Lagos 🇳🇬
      </figcaption>
    </section>
  );
}
