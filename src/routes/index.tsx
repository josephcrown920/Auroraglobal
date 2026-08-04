import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  ArrowUp,
  ChevronRight,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Sparkles,
  Video,
} from "lucide-react";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/billing.functions";
import { track } from "@/lib/tracking";
import { EditableCopy } from "@/components/EditableCopy";
import { AuroraToolsSheet } from "@/components/AuroraToolsSheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      { name: "description", content: "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio, no waiting." },
      { property: "og:title", content: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      { property: "og:description", content: "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio, no waiting." },
      { property: "og:url", content: CANONICAL_ORIGIN },
    ],
    links: [{ rel: "canonical", href: CANONICAL_ORIGIN }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Who owns the rights to what I generate?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "You do. Every generation on Aurora is 100% owned by the artist who created it. Commercial rights are included on Creator and Pro plans from the first export.",
              },
            },
            {
              "@type": "Question",
              name: "What is the difference between Creator and Pro?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Creator ($25/month) gives you clean exports, full video access, and 1,000 Aura per month — enough for regular creators. Pro ($79/month) adds priority rendering, the highest-quality models, 5,000 Aura per month, and full commercial use rights.",
              },
            },
            {
              "@type": "Question",
              name: "Is Aurora training on my uploads?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. Aurora runs a closed-loop model. Your references and prompts are never used for training unless you explicitly opt in to a private model for your project.",
              },
            },
            {
              "@type": "Question",
              name: "Can I export 4K stills and video?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Creator and Pro plans include full-resolution exports for music-video backgrounds, tour visuals, and DSP canvas loops. Pro unlocks priority rendering and the highest-quality models.",
              },
            },
            {
              "@type": "Question",
              name: "Do I need any design or prompting experience?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. Aurora is a director-first interface — describe the shoot in plain language and drop references. It handles the technical craft.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: LandingPage,
});

// Real Aurora output stills shipped with the app — shown as the reels strip.
const REELS = [
  { src: "/landing-photo-1.jpeg", alt: "Aurora render — cinematic stage performance still", duration: "0:09" },
  { src: "/landing-photo-2.jpeg", alt: "Aurora render — music video frame with dramatic lighting" },
  { src: "/landing-photo-3.jpeg", alt: "Aurora render — editorial artist portrait" },
  { src: "/landing-photo-4.jpeg", alt: "Aurora render — color-world visual scene" },
];

// Every chip routes to a live Aurora tool — nothing aspirational.
const CHIPS = [
  { id: "directors-room", label: "Direct a scene like a pro", to: "/scene-builder" as const, search: undefined },
  { id: "lyric-video", label: "Turn my song into a lyric video", to: "/music-video" as const, search: undefined },
  { id: "tiktok30", label: "30 TikTok posts from one selfie", to: "/spin" as const, search: undefined },
  { id: "grwm", label: "GRWM outfit swap", to: "/studio" as const, search: { q: "Get ready with me style selfie video, mirror lighting, outfit focus" } },
];

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [idea, setIdea] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
  });
  const credits = profile?.credits ?? null;

  const submitIdea = () => {
    const text = idea.trim();
    void track("landing_composer_submit", { mode, hasText: text.length > 0 });
    if (mode === "video") {
      void navigate({ to: "/motion", search: text ? { prompt: text } : {} });
    } else {
      void navigate({ to: "/studio", search: text ? { q: text } : {} });
    }
  };

  return (
    <div className="min-h-dvh w-full" style={{ background: "var(--gradient-page)" }}>
      <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-56">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between pt-5">
          <button
            type="button"
            aria-label="All tools"
            onClick={() => setToolsOpen(true)}
            className="rounded-xl p-1.5 text-foreground"
          >
            <LayoutGrid className="size-6" strokeWidth={1.8} />
          </button>
          <Link
            to={user ? "/gallery" : "/auth"}
            aria-label={user ? "Your gallery" : "Sign in"}
            className="relative rounded-xl p-1.5 text-foreground"
          >
            <History className="size-6" strokeWidth={1.8} />
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-dot" />
          </Link>
        </header>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Sparkles className="size-4 text-brand-ink" />
          <span>Aurora · AI Creative Studio</span>
        </div>
        <h1 className="mt-3 text-[40px] font-extrabold leading-[1.06] tracking-tight text-foreground">
          <EditableCopy copyKey="landing_capcut_headline" fallback="Film yourself" />{" "}
          <span className="text-brand-ink">
            <EditableCopy copyKey="landing_capcut_headline_accent" fallback="anywhere." />
          </span>
        </h1>
        <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
          <EditableCopy
            copyKey="landing_capcut_sub"
            fallback="Record 30 seconds on your phone. Aurora turns it into cinematic music videos, performance shots, cover art and a month of content — no crew, no studio, no waiting."
          />
        </p>

        {/* ── Reels strip: real Aurora output ────────────────────────────── */}
        <section className="mt-7 rounded-3xl bg-card p-2.5 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-4 gap-2">
            {REELS.map((reel) => (
              <Link
                key={reel.src}
                to="/home"
                onClick={() => void track("landing_reel_click")}
                className="relative block aspect-[9/16] overflow-hidden rounded-xl bg-secondary"
              >
                <img src={reel.src} alt={reel.alt} loading="lazy" className="size-full object-cover" />
                {reel.duration ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {reel.duration}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
          <Link
            to="/tutorial"
            onClick={() => void track("landing_recipe_click")}
            className="mt-2.5 flex items-center justify-between rounded-2xl px-3 py-2.5 text-[15px] font-semibold text-foreground"
          >
            <span>See the recipe → see the result</span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        </section>

        {/* ── Idea chips → live tools ────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <Link
              key={chip.id}
              to={chip.to}
              search={chip.search}
              onClick={() => void track("landing_chip_click", { id: chip.id })}
              className="rounded-full border border-border bg-card/60 px-4 py-2 text-[13.5px] font-medium text-foreground no-underline"
            >
              {chip.label}
            </Link>
          ))}
        </div>

        {/* ── Primary CTA ────────────────────────────────────────────────── */}
        <Link
          to={user ? "/home" : "/auth"}
          onClick={() => void track("landing_primary_cta_click")}
          className="mt-7 flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-primary-foreground no-underline"
          style={{ background: "var(--gradient-cta)" }}
        >
          <Plus className="size-6 rounded-md bg-foreground/85 p-0.5 text-card" strokeWidth={3} />
          {user ? "Open your studio" : "Start creating free"}
        </Link>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="mt-10 border-t border-border pt-6">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            <Link to="/tutorial" className="no-underline hover:text-foreground">Tutorial</Link>
            <Link to="/guides" className="no-underline hover:text-foreground">Guides</Link>
            <Link to="/billing" className="no-underline hover:text-foreground">Pricing</Link>
            <Link to="/contact" className="no-underline hover:text-foreground">Contact</Link>
            <Link to="/privacy" className="no-underline hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="no-underline hover:text-foreground">Terms</Link>
          </nav>
          <p className="mt-4 text-[12px] text-muted-foreground/70">© 2026 Aurora. Made by artists, for artists.</p>
        </footer>
      </main>

      {/* ── Sticky composer (landing has no bottom nav) ──────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div
          className="mx-auto w-full max-w-[520px] rounded-t-3xl px-4 pt-3 backdrop-blur-xl"
          style={{
            background: "color-mix(in oklch, var(--background) 82%, transparent)",
            boxShadow: "var(--shadow-float)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center gap-2">
            <Link
              to={user ? "/billing" : "/auth"}
              className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[13px] font-bold text-foreground shadow-[var(--shadow-card)] no-underline"
            >
              <Sparkles className="size-4 text-brand-ink" />
              {user && credits !== null ? `${credits} Aura` : "5 free Aura"}
            </Link>
            <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-[var(--shadow-card)]">
              <button
                type="button"
                onClick={() => setMode("image")}
                aria-pressed={mode === "image"}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  mode === "image" ? "bg-brand text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <ImageIcon className="size-4" />
                Image
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                aria-pressed={mode === "video"}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  mode === "video" ? "bg-brand text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Video className="size-4" />
                Video
              </button>
            </div>
          </div>

          <form
            className="mt-2.5 flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-[var(--shadow-card)]"
            onSubmit={(e) => {
              e.preventDefault();
              submitIdea();
            }}
          >
            <button
              type="button"
              aria-label="Open the studio to add reference photos"
              onClick={() => void navigate({ to: "/studio" })}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground"
            >
              <Plus className="size-5" />
            </button>
            <input
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Enter your ideas"
              aria-label="Describe your idea"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label={mode === "video" ? "Create video" : "Create image"}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground"
              style={{ background: "var(--gradient-cta)" }}
            >
              <ArrowUp className="size-5" strokeWidth={2.4} />
            </button>
          </form>
        </div>
      </div>

      <AuroraToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
