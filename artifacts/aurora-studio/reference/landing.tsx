import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Play, ArrowUpRight, ChevronDown, Film, Wand2, Palette, Flame, Bot, Shirt } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ShareButtons as ShareButtonsLazy } from "@/components/social/ShareButtons";
import heroNewOneAsset from "@/assets/uploads/IMG_3989.png.asset.json";
import heroNewTwoAsset from "@/assets/uploads/IMG_3999.png.asset.json";
import heroZeroAsset from "@/assets/uploads/IMG_0378.png.asset.json";
import heroZeroTwoAsset from "@/assets/uploads/E1011118-435B-47B5-BDCD-239378A8EB6B.png.asset.json";
import heroOneAsset from "@/assets/uploads/IMG_3987.png.asset.json";
import heroTwoAsset from "@/assets/uploads/IMG_3988.png.asset.json";
import heroThreeAsset from "@/assets/uploads/IMG_3986.png.asset.json";
import heroFourAsset from "@/assets/uploads/IMG_3985.png.asset.json";
import heroFiveAsset from "@/assets/uploads/IMG_3995.png.asset.json";

const HERO_SLIDES = [
  {
    src: heroZeroAsset.url,
    alt: "Artist in red futuristic eyewear against a vivid blue background",
    label: "Blue light portrait",
  },
  {
    src: heroZeroTwoAsset.url,
    alt: "Artist with red braids in a black leather jacket under neon blue studio lights",
    label: "Neon side profile",
  },
  {
    src: heroNewOneAsset.url,
    alt: "Artist with star hair clips holding a glitter star wand in a dreamy pastel scene",
    label: "Star wand portrait",
  },
  {
    src: heroNewTwoAsset.url,
    alt: "Performer center stage surrounded by dancers under yellow smoke and spotlights",
    label: "Stage ensemble",
  },
  {
    src: heroOneAsset.url,
    alt: "Two artists in dark editorial looks and sunglasses inside a grand lobby",
    label: "Editorial duo portrait",
  },
  {
    src: heroTwoAsset.url,
    alt: "Artist in profile wearing a glossy black jacket under sharp studio light",
    label: "Studio profile",
  },
  {
    src: heroThreeAsset.url,
    alt: "Artist in a blue varsity jacket and sunglasses backstage",
    label: "Backstage portrait",
  },
  {
    src: heroFourAsset.url,
    alt: "Artist reclining in a wicker chair on the sand in a black leather look",
    label: "Editorial lounge shot",
  },
  {
    src: heroFiveAsset.url,
    alt: "Performer on stage surrounded by dancers and golden smoke",
    label: "Live performance",
  },
] as const;



export const Route = createFileRoute("/")({
  head: () => ({
    title: "AURORA Performance Studio | AI visuals for artists",
    meta: [
      {
        name: "description",
        content:
          "AURORA Performance Studio helps artists create covers, promo stills, and cinematic performance visuals from references and plain-language direction.",
      },
      {
        property: "og:title",
        content: "AURORA Performance Studio | AI visuals for artists",
      },
      {
        property: "og:description",
        content:
          "Direct cover art, promo imagery, and performance visuals in plain language with AURORA's artist-first AI studio.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: heroOneAsset.url },
      { name: "twitter:image", content: heroOneAsset.url },
    ],
    links: HERO_SLIDES.map((slide, index) => ({
      rel: "preload",
      as: "image",
      href: slide.src,
      fetchPriority: index === 0 ? "high" : "auto",
    })),
  }),
  component: LandingPage,
});

// Flagship features only — ordered highest-revenue → lowest.
// First 3 render as flagship (larger card + ribbon).
const SERVICES = [
  { label: "Motion Control",              desc: "Transfer your real 30-second performance into any AI scene.",           to: "/motion",       icon: Wand2,   price: "From 30 Aura", tag: "Flagship",  glowFrom: "from-amber-500/30" },
  { label: "Perform Anywhere",            desc: "Selfie + outfit + scene → cinematic performance video, anywhere.",       to: "/orchestrate",  icon: Film,    price: "From 20 Aura", tag: "Flagship",  glowFrom: "from-violet-500/30" },
  { label: "Colors Performance Sessions", desc: "Direct your palette across cyc, indoor and rooftop performance sets.",   to: "/colors",       icon: Palette, price: "From 10 Aura", tag: "Flagship",  glowFrom: "from-pink-500/30" },
  { label: "Video Agent",                 desc: "AI creative director, chat a shot, get a rendered video back.",         to: "/agent",        icon: Bot,     price: "From 8 Aura",  tag: "Signature", glowFrom: "from-sky-500/20" },
  { label: "Get Ready With Me",           desc: "Outfit swap talking GRWM reels straight from a single selfie.",          to: "/grwm",         icon: Shirt,   price: "From 5 Aura",  tag: "Signature", glowFrom: "from-fuchsia-500/20" },
  { label: "TikTok30 UGC Factory",        desc: "Create 30 campaign posts, animate any result, or send it to Motion Control.", to: "/spin", icon: Flame, price: "85 Aura", tag: "Premium", glowFrom: "from-red-500/20" },

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

function LandingPage() {
  const { user } = useAuth();
  const ctaTo = user ? "/studio" : "/auth";
  const ctaLabel = user ? "Open Studio" : "Start creating";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-display antialiased selection:bg-brand selection:text-white">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-block size-2 shrink-0 rounded-full bg-brand" />
            <span className="truncate text-[11px] sm:text-sm font-display font-bold uppercase tracking-[0.18em] text-premium">
              <span className="sm:hidden">AURORA</span>
              <span className="hidden sm:inline">AURORA PERFORMANCE STUDIO</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {user ? (
              <Link
                to="/studio"
                className="inline-flex items-center rounded-full bg-zinc-100 py-2 pl-2 pr-3 text-sm font-semibold text-zinc-950 transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                Open Studio
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center rounded-full bg-zinc-100 py-2 pl-2 pr-3 text-sm font-semibold text-zinc-950 transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                  Start creating

                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative flex min-h-[88dvh] flex-col justify-end overflow-hidden px-5 pb-16">
        <HeroCarousel />

        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            <span className="inline-block size-1.5 rounded-full bg-brand animate-pulse" />
            <span className="font-serif italic normal-case tracking-normal text-2xl font-semibold text-premium drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">By Artists, for Artists</span>
          </div>
          <h1 className="text-[3.25rem] font-semibold leading-[0.92] tracking-tight">
            Direct your
            <br />
            <span className="font-serif italic text-zinc-100">visual identity.</span>
          </h1>
          <p className="mt-5 max-w-[36ch] text-base leading-relaxed text-zinc-300">
            The AI performance studio built by artists, for artists. Drop your references,
            direct the shoot in plain language, and ship studio grade covers, promo, and
            cinematic performance reels in seconds, not weeks.

          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              to={ctaTo}
              className="inline-flex w-fit items-center rounded-full bg-brand py-3.5 pl-5 pr-6 text-base font-semibold text-white ring-1 ring-brand/70 shadow-[0_10px_40px_-10px] shadow-brand/60 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Plus className="size-4 mr-2 shrink-0" strokeWidth={2.5} />
              {ctaLabel}
            </Link>
            <span className="text-xs font-medium tracking-widest uppercase text-zinc-500">
              Credit card accepted · 5 free credits on signup
            </span>

          </div>
        </div>
      </header>

      {/* ── Ticker ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden border-y border-white/5 bg-zinc-900/40 py-4">
        <div className="flex w-max animate-ticker gap-12 whitespace-nowrap px-6 text-xs font-bold tracking-[0.3em] text-zinc-500 uppercase">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((label, i) => (
            <span key={i} className="flex items-center gap-12">
              <span>{label}</span>
              <span className="text-brand">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <section id="process" className="px-5 py-20">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
            The studio flow
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Reference. Direction.{" "}
            <span className="font-serif italic">Delivered.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Three steps between the sound in your head and the visual on your feed.
          </p>
        </div>

        <div className="flex flex-col gap-12">
          <ProcessCard
            step="01"
            label="Reference"
            title="Drop inspiration"
            body="A film scan, a moodboard, or a rough sketch. Aurora reads lighting, texture, and intent, not just objects."
            image="/landing/step-reference.jpg"
            alt="Polaroid moodboard reference"
          />
          <ProcessCard
            step="02"
            label="Direction"
            title="Direct the shoot"
            body="Write like a director. Wardrobe, camera angle, mood, grain. Iterate in plain language until it feels like you."
            custom={<PromptMock />}
          />
          <ProcessCard
            step="03"
            label="Generate"
            title="Ship visuals"
            body="Studio-grade output ready for Spotify, Apple Music, DSP tiles, tour billboards, and everything in between."
            image="/landing/step-final.jpg"
            alt="Final rendered artist portrait"
          />
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────── */}
      <section id="services" className="border-t border-white/5 px-5 py-20">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
            Every tool
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            The full studio.<br />
            <span className="font-serif italic">Pay only for what you make.</span>
          </h2>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-zinc-400">
            Every feature is credit based. No subscriptions required to start. 5 free Aura on signup.

          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map((s) => (
            <ServiceCard key={s.label} s={s} />
          ))}
        </div>
      </section>

      {/* ── Gallery ─────────────────────────────────────────────────────── */}
      <section id="gallery" className="border-y border-white/5 bg-zinc-900/30 py-20">
        <div className="px-5">
          <div className="mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
              Output gallery
            </span>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">
              Real artists. Real outputs.{" "}
              <span className="font-serif italic">Zero stock.</span>
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              A curated feed of recent generations across covers, promo, and motion.
            </p>
          </div>
          <div className="columns-2 gap-3 space-y-3">
            <GalleryImg src="/landing/gallery-1.jpg" alt="Neon portrait" ratio="aspect-[2/3]" tag="Portrait" />
            <GalleryImg src="/landing/gallery-2.jpg" alt="Minimal album cover" ratio="aspect-square" tag="Cover art" />
            <GalleryImg src="/landing/gallery-3.jpg" alt="Cinematic stage" ratio="aspect-video" tag="Music video" />
            <GalleryImg src="/landing/gallery-4.jpg" alt="Streetwear promo" ratio="aspect-[4/5]" tag="Press photo" />
            <GalleryImg src="/landing/gallery-5.jpg" alt="Live mic close-up" ratio="aspect-[2/3]" tag="Editorial" />
          </div>
        </div>
      </section>

      {/* ── Video Reel ──────────────────────────────────────────────────── */}
      <section className="px-5 py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
              Motion generation
            </span>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              From still to <span className="font-serif italic">cinema</span>.
            </h2>
          </div>
          <Link
            to="/music-video"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
          >
            See more <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/5">
          <img
            src="/landing/reel-poster.jpg"
            alt="Cinematic music video still with an artist walking through neon rain"
            width={1920}
            height={1080}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Link
              to={ctaTo}
              aria-label="Start creating videos"
              className="flex size-20 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur-md transition-transform hover:scale-105"
            >
              <Play className="size-7 translate-x-0.5 text-white" fill="currentColor" />
            </Link>
          </div>
          <div className="absolute bottom-4 left-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">
            Reel 001 · Motion v1
          </div>
        </div>
      </section>

      {/* ── Testimonial ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 px-5 py-20">
        <div className="text-center">
          <p className="font-serif text-2xl italic leading-snug text-zinc-200">
            &ldquo;Aurora shifted how we handle visual rollouts. We went from three weeks of
            production to a single afternoon without losing an ounce of soul.&rdquo;

          </p>
          <div className="mt-8 flex flex-col items-center">
            <div className="size-11 rounded-full bg-gradient-to-br from-brand to-zinc-800 ring-1 ring-white/10" />
            <span className="mt-3 text-sm font-semibold uppercase tracking-widest">
              Marcus Vane
            </span>
            <span className="text-xs text-zinc-500">Creative Director · Nocturne Records</span>
          </div>
        </div>
      </section>

      {/* ── Social Share ────────────────────────────────────────────────── */}
      <section className="border-b border-white/5 px-5 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Spread the word</p>
          <h3 className="font-serif text-2xl italic text-zinc-100">Share Aurora with your artists</h3>
          <ShareButtonsLazy />
        </div>
      </section>

      {/* ── Pricing CTA ─────────────────────────────────────────────────── */}
      <section id="pricing" className="px-5 py-20">
        <div className="rounded-3xl bg-zinc-100 px-6 py-14 text-center text-zinc-950">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
            Free forever tier
          </span>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Direct your <span className="font-serif italic">next release.</span>
          </h2>
          <p className="mt-3 text-base text-zinc-600">
            Join 4,000+ independent artists and creative teams building their world with Aurora.
          </p>
          <div className="mt-8 flex flex-col items-center gap-5">
            <Link
              to={ctaTo}
              className="inline-flex items-center rounded-full bg-brand py-4 pl-5 pr-7 text-lg font-semibold text-white ring-1 ring-brand transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Plus className="mr-2 size-5 shrink-0" strokeWidth={2.5} />
              {ctaLabel}
            </Link>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <span>Free · 5 credits</span>
              <span>·</span>
              <span>Pro · Unlimited</span>
              <span>·</span>
              <span>Studio · API</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="px-5 py-20">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
            Questions
          </span>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Answered <span className="font-serif italic">honestly.</span>
          </h2>
        </div>
        <div className="divide-y divide-white/5 border-y border-white/5">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-5 pb-8 pt-14">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-brand" />
          <span className="text-lg font-semibold uppercase italic tracking-tighter">AURORA</span>
        </div>

        <p className="mb-10 text-sm text-zinc-500">
          The performance studio for the algorithmic age. Build your world with intent.
        </p>
        <div className="mb-10 grid grid-cols-3 gap-6">
          <FooterCol
            title="Product"
            links={[
              { label: "Studio", to: "/studio" },
              { label: "Canvas", to: "/canvas" },
              { label: "Video", to: "/music-video" },
              { label: "Pricing", to: "/billing" },
            ]}
          />
          <FooterCol
            title="Create"
            links={[
              { label: "Motion", to: "/motion" },
              { label: "Colors", to: "/colors" },
              { label: "Gallery", to: "/gallery" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacy", to: "/" },
              { label: "Terms", to: "/" },
            ]}
          />
        </div>
        <div className="border-t border-white/5 pt-6 text-xs text-zinc-600">
          © {new Date().getFullYear()} AURORA Performance Studio. Built for the artist.
        </div>
      </footer>

      <div className="h-24" aria-hidden />
    </div>
  );
}

function HeroCarousel() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.src}
          className={`absolute inset-0 transition-opacity duration-700 ${selectedIndex === index ? "opacity-100" : "opacity-0"}`}
          aria-hidden={selectedIndex !== index}
        >
          <div className="relative h-[88dvh] min-h-[88dvh] w-full">
            <img
              src={slide.src}
              alt={slide.alt}
              width={1920}
              height={1200}
              className="h-full w-full object-cover"
              fetchPriority={index === 0 ? "high" : undefined}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </div>
        </div>
      ))}
      <div className="hero-glitter" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/60" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/20 to-transparent" />
      <div className="absolute bottom-6 right-5 z-10 flex items-center gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur-sm ring-1 ring-white/10">
        {HERO_SLIDES.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setSelectedIndex(index)}
            aria-label={`Show ${slide.label}`}
            aria-pressed={selectedIndex === index}
            className={`h-1.5 rounded-full transition-all ${selectedIndex === index ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"}`}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceCard({ s }: { s: typeof SERVICES[number] }) {
  const Icon = s.icon;
  return (
    <Link
      to={s.to}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-zinc-900 p-4 ring-1 ring-white/5 transition-all hover:-translate-y-0.5 hover:ring-white/10 no-underline"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -inset-12 bg-gradient-to-br ${s.glowFrom} to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
      />
      <div className="relative flex items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
          <Icon className="size-4 text-zinc-200" />
        </span>
        <span className="text-[11px] font-bold tabular-nums text-brand">
          {s.price}
        </span>
      </div>
      <div className="relative">
        <p className="text-sm font-semibold leading-tight text-zinc-100">{s.label}</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">{s.desc}</p>
      </div>
      <span className="relative mt-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 transition-colors group-hover:text-brand">
        Open <ArrowUpRight className="size-3" />
      </span>
    </Link>
  );
}

function ProcessCard({
  step,
  label,
  title,
  body,
  image,
  alt,
  custom,
}: {
  step: string;
  label: string;
  title: string;
  body: string;
  image?: string;
  alt?: string;
  custom?: React.ReactNode;
}) {
  return (
    <div className="group">
      <div className="mb-5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/5">
        {image ? (
          <img
            src={image}
            alt={alt ?? ""}
            width={800}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          custom
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-brand">{step}</span>
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function PromptMock() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-3 p-6">
      <div className="rounded-lg bg-zinc-800/80 px-3 py-2 text-[11px] text-zinc-300 ring-1 ring-white/10">
        Vivid crimson studio lighting, 35mm grain…
      </div>
      <div className="w-4/5 rounded-lg bg-zinc-800/80 px-3 py-2 text-[11px] text-zinc-300 ring-1 ring-white/10">
        Editorial fashion styling, deep shadow
      </div>
      <div className="flex w-3/5 items-center gap-2 rounded-lg bg-brand/15 px-3 py-2 text-[11px] text-brand ring-1 ring-brand/50">
        <span className="inline-block size-1.5 rounded-full bg-brand animate-pulse" />
        Directing shoot…
      </div>
      <div className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-[10px] text-zinc-500 ring-1 ring-white/5">
        Aurora · v1.2 · 4K
      </div>
    </div>
  );
}

function GalleryImg({
  src,
  alt,
  ratio,
  tag,
}: {
  src: string;
  alt: string;
  ratio: string;
  tag: string;
}) {
  return (
    <div className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl ring-1 ring-white/5">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`w-full ${ratio} object-cover transition-transform duration-700 group-hover:scale-[1.03]`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white">{tag}</span>
        <span className="text-[9px] uppercase tracking-widest text-white/60">AURORA</span>
      </div>

    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left text-sm font-semibold uppercase tracking-widest text-zinc-100"
      >
        <span>{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
      )}
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-100">{title}</span>
      {links.map((l) => (
        <Link
          key={l.label}
          to={l.to}
          className="text-sm text-zinc-500 transition-colors hover:text-brand"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

