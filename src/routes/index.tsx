import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Play, ArrowUpRight, ChevronDown, Sparkles, Palette, Film, Wand2, Mic, Music2, Brush, Megaphone, UserCircle2, Workflow, Layers, Flame, Bot, Clapperboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [
      { rel: "preload", as: "image", href: "/landing/hero-artist.jpg", fetchPriority: "high" },
    ],
  }),
  component: LandingPage,
});

const SERVICES = [
  { label: "Image Generation", desc: "Studio-grade portraits, covers, and promo shots from a selfie and a prompt.", to: "/studio",       icon: Sparkles,    price: "1 Aura",    glowFrom: "from-violet-500/20" },
  { label: "Colors Studio",    desc: "Direct your color palette across cyclorama, indoor, and rooftop sets.",    to: "/colors",       icon: Palette,     price: "1 Aura",    glowFrom: "from-pink-500/20" },
  { label: "Video",            desc: "Cinematic music-video clips and motion backgrounds. Model-tiered pricing.", to: "/orchestrate",  icon: Film,        price: "From 10 Aura", glowFrom: "from-blue-500/20" },
  { label: "Motion Control",   desc: "Transfer your real 30-second performance into an AI-generated scene.",    to: "/motion",       icon: Wand2,       price: "From 30 Aura", glowFrom: "from-amber-500/20" },
  { label: "Lip Sync",         desc: "Frame-accurate sync in 8+ languages using Sync 1.9.",                      to: "/lipsync",      icon: Mic,         price: "3 Aura",    glowFrom: "from-emerald-500/20" },
  { label: "Lyric Video",      desc: "Full lyric-video renders synced to your audio track.",                     to: "/music-video",  icon: Clapperboard,price: "5 Aura",    glowFrom: "from-rose-500/20" },
  { label: "Photo Editor",     desc: "AI-powered edits: relight, restyle, inpaint, and upscale.",                to: "/photo-edit",   icon: Brush,       price: "1 Aura",    glowFrom: "from-cyan-500/20" },
  { label: "UGC Ads",          desc: "Talent + product → looping social ad in minutes.",                         to: "/ugc",          icon: Megaphone,   price: "From 1 Aura", glowFrom: "from-orange-500/20" },
  { label: "Talking Avatars",  desc: "Upload a photo, write a script, get a studio-quality talking-head video.", to: "/avatar",       icon: UserCircle2, price: "From 3 Aura", glowFrom: "from-teal-500/20" },
  { label: "Live Studios",     desc: "Real-time creative sessions with dynamic scene generation.",                to: "/live-studio",  icon: Music2,      price: "From 1 Aura", glowFrom: "from-indigo-500/20" },
  { label: "Content Line",     desc: "Full UGC ad script arcs, creator avatars, and visual variations.",        to: "/ugc-line",     icon: Layers,      price: "From 1 Aura", glowFrom: "from-fuchsia-500/20" },
  { label: "TikTok30",         desc: "30-second viral TikTok packs — spin, animate, caption, ship.",             to: "/spin",         icon: Flame,       price: "From 1 Aura", glowFrom: "from-red-500/20" },
  { label: "Scene Builder",    desc: "Composite AI scenes from layers: backdrop, talent, product, VFX.",         to: "/scene-builder",icon: Workflow,    price: "From 1 Aura", glowFrom: "from-lime-500/20" },
  { label: "Video Agent",      desc: "AI-directed talking-head videos with script enhancement and HeyGen rendering.", to: "/agent",   icon: Bot,         price: "From 3 Aura", glowFrom: "from-sky-500/20" },
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
    a: "No. Aurora is a director-first interface — describe the shoot in plain language and drop references. It handles the technical craft.",
  },
];

function LandingPage() {
  const { user } = useAuth();
  const ctaTo = user ? "/studio" : "/auth";
  const ctaLabel = user ? "Open Studio" : "Start creating free";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-display antialiased selection:bg-brand selection:text-white">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-brand" />
            <span className="text-lg font-semibold tracking-tighter uppercase italic">Aurora</span>
          </div>
          <div className="flex items-center gap-3">
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
                  className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center rounded-full bg-zinc-100 py-2 pl-2 pr-3 text-sm font-semibold text-zinc-950 transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative flex min-h-[88dvh] flex-col justify-end overflow-hidden pb-16 px-5">
        <div className="absolute inset-0 z-0">
          <img
            src="/landing/hero-artist.jpg"
            alt="Cinematic AI-generated artist portrait"
            width={1920}
            height={1200}
            className="h-full w-full object-cover"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/20 to-transparent" />
        </div>

        <div className="relative z-10">
          <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            <span className="inline-block size-1.5 rounded-full bg-brand animate-pulse" />
            Aurora Studio · Now in open beta
          </div>
          <h1 className="text-[3.25rem] font-semibold leading-[0.92] tracking-tight">
            Direct your
            <br />
            <span className="font-serif italic text-zinc-100">visual identity.</span>
          </h1>
          <p className="mt-5 max-w-[36ch] text-base leading-relaxed text-zinc-300">
            The AI performance studio built by artists, for artists. Drop your references,
            write your direction, and generate studio-grade covers, promo shots, and cinematic
            reels — in seconds, not weeks.
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
              No credit card · 5 free credits on signup
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
      <section id="process" className="py-20 px-5">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
            The studio flow
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Reference. Direction.{" "}
            <span className="font-serif italic">Delivered.</span>
          </h2>
          <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
            Three steps between the sound in your head and the visual on your feed.
          </p>
        </div>

        <div className="flex flex-col gap-12">
          <ProcessCard
            step="01"
            label="Reference"
            title="Drop inspiration"
            body="A film scan, a moodboard, or a rough sketch. Aurora reads lighting, texture, and intent — not just objects."
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
      <section id="services" className="py-20 px-5 border-t border-white/5">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand">
            Every tool
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            The full studio.<br />
            <span className="font-serif italic">Pay only for what you make.</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-[40ch] leading-relaxed">
            Every feature is credit-based. No subscriptions required to start — 5 free Aura on signup.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map((s) => (
            <ServiceCard key={s.label} s={s} />
          ))}
        </div>
      </section>

      {/* ── Gallery ─────────────────────────────────────────────────────── */}
      <section id="gallery" className="bg-zinc-900/30 py-20 border-y border-white/5">
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
      <section className="py-20 px-5">
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
            className="inline-flex items-center gap-1 text-sm font-medium text-zinc-400 hover:text-zinc-100 shrink-0 transition-colors"
          >
            See more <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/5">
          <img
            src="/landing/reel-poster.jpg"
            alt="Cinematic music video still — artist walking through neon rain"
            width={1920}
            height={1080}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Link
              to={ctaTo}
              aria-label="Start creating videos"
              className="flex size-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/30 transition-transform hover:scale-105"
            >
              <Play className="size-7 text-white translate-x-0.5" fill="currentColor" />
            </Link>
          </div>
          <div className="absolute bottom-4 left-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">
            Reel 001 · Motion v1
          </div>
        </div>
      </section>

      {/* ── Testimonial ─────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-y border-white/5">
        <div className="text-center">
          <p className="font-serif text-2xl italic leading-snug text-zinc-200">
            &ldquo;Aurora shifted how we handle visual rollouts. We went from three weeks of
            production to a single afternoon — without losing an ounce of soul.&rdquo;
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

      {/* ── Pricing CTA ─────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-5">
        <div className="rounded-3xl bg-zinc-100 px-6 py-14 text-zinc-950 text-center">
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
              <Plus className="size-5 mr-2 shrink-0" strokeWidth={2.5} />
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
      <section id="faq" className="py-20 px-5">
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
      <footer className="border-t border-white/5 pt-14 pb-8 px-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block size-2 rounded-full bg-brand" />
          <span className="text-lg font-semibold tracking-tighter uppercase italic">Aurora</span>
        </div>
        <p className="text-sm text-zinc-500 mb-10">
          The performance studio for the algorithmic age. Build your world with intent.
        </p>
        <div className="grid grid-cols-3 gap-6 mb-10">
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
          © {new Date().getFullYear()} Aurora Performance Studio. Built for the artist.
        </div>
      </footer>

      <div className="h-24" aria-hidden />
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
        <span className="text-[11px] font-bold text-brand tabular-nums">
          {s.price}
        </span>
      </div>
      <div className="relative">
        <p className="text-sm font-semibold text-zinc-100 leading-tight">{s.label}</p>
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
        <span className="text-xs font-bold text-brand uppercase tracking-[0.25em]">{step}</span>
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{label}</span>
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
      <div className="rounded-lg bg-zinc-800/80 px-3 py-2 text-[11px] text-zinc-300 ring-1 ring-white/10 w-4/5">
        Editorial fashion styling, deep shadow
      </div>
      <div className="rounded-lg bg-brand/15 px-3 py-2 text-[11px] text-brand ring-1 ring-brand/50 w-3/5 flex items-center gap-2">
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
        <span className="text-[9px] uppercase tracking-widest text-white/60">Aurora</span>
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
          className="text-sm text-zinc-500 hover:text-brand transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
