import { Quote, Star } from "lucide-react";

const QUOTES = [
  {
    name: "Maya R.",
    role: "Music artist",
    location: "Lagos, Nigeria",
    flag: "🇳🇬",
    text: "I shot a full cover art series for my EP on a Tuesday night. Aurora replaced a $4k photoshoot.",
    color: "from-violet-500/30 to-fuchsia-500/10",
  },
  {
    name: "Daniel K.",
    role: "Music video director",
    location: "Berlin, Germany",
    flag: "🇩🇪",
    text: "Split-reality renders are dangerous. I previz two storylines for a client in 20 minutes.",
    color: "from-emerald-500/30 to-teal-500/10",
  },
  {
    name: "Ife O.",
    role: "Creator · 1.2M followers",
    location: "London, UK",
    flag: "🇬🇧",
    text: "The lip-sync is unreal. My UGC ads with Aurora are converting 3x my last batch.",
    color: "from-amber-500/30 to-rose-500/10",
  },
  {
    name: "Sara T.",
    role: "Brand lead",
    location: "New York, USA",
    flag: "🇺🇸",
    text: "Nano Banana Pro + Seedance in one canvas is everything we wanted Midjourney to be.",
    color: "from-cyan-500/30 to-blue-500/10",
  },
  {
    name: "Hiroshi M.",
    role: "Anime concept artist",
    location: "Tokyo, Japan",
    flag: "🇯🇵",
    text: "The agent reads my brief in Japanese and returns shot lists I'd hire a director to write. Insane.",
    color: "from-pink-500/30 to-rose-500/10",
  },
  {
    name: "Camila V.",
    role: "Indie filmmaker",
    location: "São Paulo, Brazil",
    flag: "🇧🇷",
    text: "Pitched a Netflix short with Aurora previz. Got greenlit off the mood board alone.",
    color: "from-orange-500/30 to-amber-500/10",
  },
  {
    name: "Arjun P.",
    role: "Ad creative",
    location: "Mumbai, India",
    flag: "🇮🇳",
    text: "We replaced three vendors with one canvas. Turnaround on UGC dropped from 2 weeks to 2 hours.",
    color: "from-yellow-500/30 to-orange-500/10",
  },
  {
    name: "Léa M.",
    role: "Fashion editor",
    location: "Paris, France",
    flag: "🇫🇷",
    text: "Editorial covers that look like Vogue without leaving my apartment. C'est fou.",
    color: "from-fuchsia-500/30 to-purple-500/10",
  },
  {
    name: "Kwame A.",
    role: "Afrobeats producer",
    location: "Accra, Ghana",
    flag: "🇬🇭",
    text: "Visualizers for every track on the album. The diaspora is paying attention now.",
    color: "from-emerald-500/30 to-lime-500/10",
  },
  {
    name: "Min-jun L.",
    role: "K-pop visual director",
    location: "Seoul, South Korea",
    flag: "🇰🇷",
    text: "Storyboarded an entire MV with the agent. My team thought I'd hired a second director.",
    color: "from-sky-500/30 to-indigo-500/10",
  },
  {
    name: "Olivia W.",
    role: "Creator · 3M followers",
    location: "Sydney, Australia",
    flag: "🇦🇺",
    text: "Lip-sync that doesn't look uncanny. Finally. My TikTok views literally doubled.",
    color: "from-teal-500/30 to-cyan-500/10",
  },
  {
    name: "Mateo G.",
    role: "Reggaeton artist",
    location: "Medellín, Colombia",
    flag: "🇨🇴",
    text: "Dropped a full visual EP on Aurora. Looks like a Bad Bunny budget. Costó nada.",
    color: "from-rose-500/30 to-red-500/10",
  },
];

export function Testimonials() {
  return (
    <section className="relative z-10 px-6 md:px-12 pb-24">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-2">Loved worldwide</p>
          <h2 className="text-2xl md:text-3xl font-semibold">Creators in 40+ countries. One studio.</h2>
          <p className="text-sm text-white/55 mt-2">Artists, directors and brands from Lagos to Seoul are shipping with Aurora.</p>
        </div>
        <div className="flex items-center gap-1 text-amber-300">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
          <span className="text-white/70 text-sm ml-2">4.9 · 2,400+ creators</span>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {QUOTES.map((q, i) => (
          <figure
            key={q.name}
            className="relative rounded-2xl border border-white/10 p-5 bg-white/[0.03] backdrop-blur-sm overflow-hidden animate-fade-in hover:-translate-y-1 transition"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`absolute -inset-16 blur-3xl opacity-50 bg-gradient-to-br ${q.color}`} />
            <div className="relative flex items-start justify-between mb-3">
              <Quote className="size-5 text-white/40" />
              <span className="text-2xl leading-none" aria-hidden>{q.flag}</span>
            </div>
            <blockquote className="relative text-sm text-white/85 leading-relaxed">"{q.text}"</blockquote>
            <figcaption className="relative mt-4 text-xs">
              <div className="font-medium text-white">{q.name}</div>
              <div className="text-white/50">{q.role}</div>
              <div className="text-white/40 text-[10px] mt-0.5">{q.location}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
