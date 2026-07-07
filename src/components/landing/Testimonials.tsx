import { Star } from "lucide-react";

const QUOTES = [
  { name: "Josh A.", role: "Music artist · Lagos 🇳🇬", text: "Aurora replaced a $4k photoshoot. Shot a full cover art series on a Tuesday night." },
  { name: "Ife O.", role: "Creator · 1.2M · London 🇬🇧", text: "UGC ads with Aurora are converting 3× my last batch. The lip-sync is unreal." },
  { name: "Daniel K.", role: "Video director · Berlin 🇩🇪", text: "I previz two storylines for a client in 20 minutes. Split-reality renders are dangerous." },
  { name: "Tobi A.", role: "Afrobeats artist · Lagos 🇳🇬", text: "Dropped the visualizer the same night I mastered the track. Charting before I booked a shoot." },
  { name: "Camila V.", role: "Indie filmmaker · São Paulo 🇧🇷", text: "Pitched a Netflix short with Aurora previz. Got greenlit off the mood board alone." },
  { name: "Marcus D.", role: "Drill producer · London 🇬🇧", text: "Artists pick my beats for the Aurora visuals. Every type beat ships with a video now." },
  { name: "Jules P.", role: "Independent rapper · Atlanta 🇺🇸", text: "No label, no budget, no problem. Last three music videos were Aurora — views tripled." },
  { name: "Hiroshi M.", role: "Concept artist · Tokyo 🇯🇵", text: "The agent reads my brief in Japanese and returns shot lists I'd hire a director to write." },
  { name: "Kwame A.", role: "Afrobeats producer · Accra 🇬🇭", text: "Visualizers for every track on the album. The diaspora is paying attention now." },
  { name: "Olivia W.", role: "Creator · 3M · Sydney 🇦🇺", text: "Lip-sync that doesn't look uncanny. Finally. My TikTok views literally doubled." },
  { name: "Min-jun L.", role: "K-pop director · Seoul 🇰🇷", text: "Storyboarded an entire MV with the agent. My team thought I'd hired a second director." },
  { name: "Mateo G.", role: "Reggaeton artist · Medellín 🇨🇴", text: "Looks like a Bad Bunny budget. Costó nada." },
];

const ROW_A = QUOTES.slice(0, 6);
const ROW_B = QUOTES.slice(6);

function QuoteCard({ name, role, text }: { name: string; role: string; text: string }) {
  return (
    <figure className="flex-none w-72 aurora-glass rounded-xl px-4 py-3 mx-1.5">
      <blockquote className="text-sm font-medium text-white/90 leading-snug mb-2">"{text}"</blockquote>
      <figcaption className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold text-white">{name}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50 truncate">{role}</span>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  return (
    <section className="relative z-10 pb-14">
      <style>{`
        @keyframes marquee-fwd { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes marquee-rev { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .marquee-fwd { animation: marquee-fwd 38s linear infinite; }
        .marquee-rev { animation: marquee-rev 42s linear infinite; }
        .marquee-fwd:hover, .marquee-rev:hover { animation-play-state: paused; }
      `}</style>

      <div className="px-6 md:px-12 mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="aurora-kicker mb-1">Loved worldwide</p>
          <h2 className="text-xl md:text-2xl font-semibold">Creators in 40+ countries. One studio.</h2>
        </div>
        <div className="flex items-center gap-1 text-amber-300">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}
          <span className="text-white/55 text-xs ml-1.5">4.9 · 2,400+ creators</span>
        </div>
      </div>

      <div className="overflow-hidden space-y-2.5 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex marquee-fwd">
          {[...ROW_A, ...ROW_A].map((q, i) => <QuoteCard key={i} {...q} />)}
        </div>
        <div className="flex marquee-rev">
          {[...ROW_B, ...ROW_B].map((q, i) => <QuoteCard key={i} {...q} />)}
        </div>
      </div>
    </section>
  );
}
