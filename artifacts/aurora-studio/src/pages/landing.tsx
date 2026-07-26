import { Link } from "wouter";
import { Plus, Play, ArrowUpRight, Film, Wand2, Palette, Flame, Bot, Shirt } from "lucide-react";
import { useClerk } from "@clerk/react";

const HERO_SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1540324155974-7523202daa3f?auto=format&fit=crop&w=1920&q=80",
    alt: "Artist portrait",
    label: "Portrait",
  }
] as const;

const SERVICES = [
  { label: "Motion Control",              desc: "Transfer your real 30-second performance into any AI scene.",           to: "/motion",       icon: Wand2,   price: "From 30 Aura", tag: "Flagship" },
  { label: "Perform Anywhere",            desc: "Selfie + outfit + scene → cinematic performance video, anywhere.",       to: "/music-video",  icon: Film,    price: "From 20 Aura", tag: "Flagship" },
  { label: "Colors Performance Sessions", desc: "Direct your palette across cyc, indoor and rooftop performance sets.",   to: "/studio",       icon: Palette, price: "From 10 Aura", tag: "Flagship" },
  { label: "Video Agent",                 desc: "AI creative director, chat a shot, get a rendered video back.",         to: "/motion",       icon: Bot,     price: "From 8 Aura",  tag: "Signature" },
  { label: "Get Ready With Me",           desc: "Outfit swap talking GRWM reels straight from a single selfie.",          to: "/ugc",          icon: Shirt,   price: "From 5 Aura",  tag: "Signature" },
  { label: "TikTok30 UGC Factory",        desc: "Create 30 campaign posts, animate any result, or send it to Motion.",    to: "/ugc",          icon: Flame,   price: "85 Aura",      tag: "Premium" },
];

const TICKER_ITEMS = [
  "Album covers",
  "Music video stills",
  "Tour posters",
  "Press photos",
  "Spotify Canvas",
  "Social assets",
  "Concert reels",
];

const FAQS = [
  {
    q: "Who owns the rights to what I generate?",
    a: "You do. Every generation on Aurora is 100% owned by the artist who created it. Full commercial rights are included from your very first click.",
  },
  {
    q: "Is Aurora training on my uploads?",
    a: "No. Aurora runs a closed-loop model. Your references and prompts are never used for training unless you explicitly opt in to a private model for your project.",
  },
  {
    q: "Can I export 4K stills and video?",
    a: "Yes. Pro and Studio tiers include 4K stills and 4K/60fps motion exports for music-video backgrounds, tour visuals, and DSP canvas loops.",
  },
  {
    q: "Do I need any design or prompting experience?",
    a: "No. Aurora is a director first interface. Describe the shoot in plain language and drop references. It handles the technical craft.",
  },
];

export default function LandingPage() {
  const { user } = useClerk();
  const ctaTo = user ? "/dashboard" : "/sign-in";
  const ctaLabel = user ? "Open Studio" : "Start creating";

  return (
    <div className="w-full">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative flex min-h-[88dvh] flex-col justify-end overflow-hidden px-5 pb-16">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="relative h-full w-full">
            <img
              src={HERO_SLIDES[0].src}
              alt={HERO_SLIDES[0].alt}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/60 to-[#1A1A1A]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A]/90 via-[#1A1A1A]/40 to-transparent" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto w-full">
          <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#999999]">
            <span className="inline-block size-1.5 rounded-full bg-brand animate-pulse" />
            <span className="font-serif italic normal-case tracking-normal text-2xl font-semibold aurora-gradient-text drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">By Artists, for Artists</span>
          </div>
          <h1 className="text-[3.25rem] md:text-[5rem] font-display font-semibold leading-[0.95] tracking-tight text-white max-w-4xl">
            Direct your
            <br />
            <span className="font-serif italic text-white/90">visual identity.</span>
          </h1>
          <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-[#999999]">
            The AI performance studio built by artists, for artists. Drop your references,
            direct the shoot in plain language, and ship studio grade covers, promo, and
            cinematic performance reels in seconds, not weeks.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={ctaTo}
              className="inline-flex w-fit items-center rounded-full bg-brand py-3.5 pl-5 pr-6 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Plus className="size-4 mr-2 shrink-0" strokeWidth={2.5} />
              {ctaLabel}
            </Link>
            <span className="text-xs font-medium tracking-widest uppercase text-[#666666]">
              Credit card accepted · 5 free credits on signup
            </span>
          </div>
        </div>
      </header>

      {/* ── Ticker ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden border-y border-[#333333] bg-[#2A2A2A]/40 py-4">
        <div className="flex w-max animate-ticker gap-12 whitespace-nowrap px-6 text-xs font-bold tracking-[0.3em] text-[#999999] uppercase">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((label, i) => (
            <span key={i} className="flex items-center gap-12">
              <span>{label}</span>
              <span className="text-brand">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <section id="process" className="px-5 py-24 max-w-[1400px] mx-auto w-full">
        <div className="mb-16">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
            The studio flow
          </span>
          <h2 className="mt-3 text-4xl font-display font-semibold leading-tight text-white">
            Reference. Direction.{" "}
            <span className="font-serif italic">Delivered.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#999999]">
            Three steps between the sound in your head and the visual on your feed.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <ProcessCard
            step="01"
            label="Reference"
            title="Drop inspiration"
            body="A film scan, a moodboard, or a rough sketch. Aurora reads lighting, texture, and intent, not just objects."
          />
          <ProcessCard
            step="02"
            label="Direction"
            title="Direct the shoot"
            body="Write like a director. Wardrobe, camera angle, mood, grain. Iterate in plain language until it feels like you."
          />
          <ProcessCard
            step="03"
            label="Generate"
            title="Ship visuals"
            body="Studio-grade output ready for Spotify, Apple Music, DSP tiles, tour billboards, and everything in between."
          />
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────── */}
      <section id="services" className="border-t border-[#333333] px-5 py-24">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
              Every tool
            </span>
            <h2 className="mt-3 text-4xl font-display font-semibold leading-tight text-white">
              The full studio.<br />
              <span className="font-serif italic text-white/90">Pay only for what you make.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#999999]">
              Every feature is credit based. No subscriptions required to start. 5 free Aura on signup.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s) => (
              <ServiceCard key={s.label} s={s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Video Reel ──────────────────────────────────────────────────── */}
      <section className="px-5 py-24 max-w-[1400px] mx-auto w-full">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
              Motion generation
            </span>
            <h2 className="mt-3 text-4xl font-display font-semibold leading-tight text-white">
              From still to <span className="font-serif italic">cinema</span>.
            </h2>
          </div>
          <Link
            href="/music-video"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#999999] transition-colors hover:text-white"
          >
            See more <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-[#2A2A2A] border border-[#333333] aspect-video">
          <div className="absolute inset-0 bg-[#1A1A1A]/80 flex items-center justify-center">
            <Link
              href={ctaTo}
              className="flex size-20 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur-md transition-transform hover:scale-105"
            >
              <Play className="size-7 translate-x-0.5 text-white" fill="currentColor" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="px-5 py-24 border-t border-[#333333]">
        <div className="max-w-[800px] mx-auto w-full">
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
              Questions
            </span>
            <h2 className="mt-3 text-4xl font-display font-semibold tracking-tight text-white">
              Answered <span className="font-serif italic">honestly.</span>
            </h2>
          </div>
          <div className="divide-y divide-[#333333] border-y border-[#333333]">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ServiceCard({ s }: { s: typeof SERVICES[number] }) {
  const Icon = s.icon;
  const isPremium = s.tag === "Flagship" || s.tag === "Premium";
  return (
    <Link
      href={s.to}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-[#2A2A2A] p-6 border border-[#333333] transition-all hover:-translate-y-1 hover:border-[#555555] shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#1A1A1A] border border-[#333333]">
          <Icon className={`size-5 ${isPremium ? "text-[#f6d365]" : "text-white"}`} />
        </span>
        <span className="text-[11px] font-bold tabular-nums text-brand">
          {s.price}
        </span>
      </div>
      <div>
        <p className={`text-lg font-display font-semibold leading-tight ${isPremium ? "aurora-gradient-text" : "text-white"}`}>{s.label}</p>
        <p className="mt-2 text-sm leading-snug text-[#999999]">{s.desc}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.2em] text-[#666666] transition-colors group-hover:text-brand">
        Open <ArrowUpRight className="size-3.5" />
      </span>
    </Link>
  );
}

function ProcessCard({
  step,
  label,
  title,
  body,
}: {
  step: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-brand">{step}</span>
        <span className="text-xs font-medium uppercase tracking-widest text-[#666666]">{label}</span>
      </div>
      <h3 className="text-2xl font-display font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[#999999]">{body}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="py-6">
      <h3 className="text-lg font-display font-semibold text-white mb-2">{q}</h3>
      <p className="text-sm leading-relaxed text-[#999999]">{a}</p>
    </div>
  );
}
