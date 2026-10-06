import { Link } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/landing/AutoplayVideo";
import {
  Flame,
  Play,
  TrendingUp,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  ArrowRight,
  Music2,
} from "lucide-react";
// One artist, many looks — the SAME identity across different outfits, poses and
// locations. All 6 tiles now play a real AI video clip (clip-* — image-to-video
// where available, text-to-video with a detailed identity-locked prompt
// otherwise); still-* frames are used only as <video> poster images.
import stillNeon from "@/assets/josh/generated/still-01-neon-closeup.jpg";
import stillStage from "@/assets/josh/generated/still-03-stage-mic.jpg";
import stillStreet from "@/assets/josh/generated/still-02-street-golden.jpg";
import stillStudio from "@/assets/josh/generated/still-05-studio-gel.jpg";
import stillRooftop from "@/assets/josh/generated/still-06-rooftop-sunset.jpg";
import stillCourt from "@/assets/josh/generated/still-13-court-ball.jpg";
import clipNeon from "@/assets/josh/generated/clip-01-neon-closeup.mp4";
import clipStage from "@/assets/josh/generated/clip-03-stage-mic.mp4";
import clipStudio from "@/assets/josh/generated/clip-05-studio-gel.mp4";
import clipRooftop from "@/assets/josh/generated/clip-06-rooftop-sunset.mp4";
import clipStreet from "@/assets/josh/generated/clip-02-street-golden.mp4";
import clipCourt from "@/assets/josh/generated/clip-13-court-ball.mp4";

const HANDLE = "@aurora.music";

const FEATURES = [
  { label: "Identity-locked across every look", icon: <Eye className="size-4" /> },
  { label: "New video per single, no crew needed", icon: <Play className="size-4" /> },
  { label: "Afrobeats · Trap · Drill · Pop", icon: <TrendingUp className="size-4" /> },
  { label: "Drop your song — get the visual", icon: <Heart className="size-4" /> },
];

type Clip = {
  caption: string;
  likes: string;
  comments: string;
  // Video tiles play a real AI clip; still-only tiles omit `src` and show the poster.
  src?: string;
  poster: string;
};

// One artist — @aurora.music — a varied For You feed: 6 real AI video clips
// (image-to-video and identity-locked text-to-video), each a different
// outfit / pose / location.
const CLIPS: Clip[] = [
  {
    caption: "POV: the Afrobeats single is finally out 🌌",
    likes: "412K",
    comments: "3.1K",
    src: clipNeon,
    poster: stillNeon,
  },
  {
    caption: "first time headlining 🎤 the drill set went off",
    likes: "1.2M",
    comments: "9.4K",
    src: clipStage,
    poster: stillStage,
  },
  {
    caption: "golden-hour rooftop for the deluxe cover 🌆",
    likes: "689K",
    comments: "5.2K",
    src: clipRooftop,
    poster: stillRooftop,
  },
  {
    caption: "runup clip before the sports anthem drops 🏀",
    likes: "903K",
    comments: "7.8K",
    src: clipCourt,
    poster: stillCourt,
  },
  {
    caption: "studio session → visualizer in one click 🎛️",
    likes: "254K",
    comments: "1.9K",
    src: clipStudio,
    poster: stillStudio,
  },
  {
    caption: "streetwear fit-check for the single art ✨",
    likes: "517K",
    comments: "4.4K",
    src: clipStreet,
    poster: stillStreet,
  },
];

export function TikTokSection() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16">
      {/* Aurora-branded card — dark surface with a faint violet border. */}
      <div className="relative rounded-[32px] border border-white/10 bg-[#050507] shadow-[0_0_80px_-30px_rgba(139,92,246,0.45)]">
        <div className="relative overflow-hidden rounded-[32px]">
          {/* Subtle violet corner glows — on-brand, not TikTok duo-tone. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 0% 0%, rgba(139,92,246,0.18), transparent 42%), radial-gradient(circle at 100% 100%, rgba(139,92,246,0.12), transparent 42%)",
            }}
          />
          {/* Faint scanlines give it a screen-like, in-app texture. */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 5px)",
            }}
          />

          {/* Top ticker strip — live dot + scrolling marquee = unmistakably TikTok. */}
          <div className="relative flex items-center gap-3 border-b border-white/10 bg-black/50 px-4 py-2">
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#8b5cf6] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
              <span
                className="size-1.5 rounded-full bg-white"
                style={{ animation: "mc-pulse 1.2s ease-in-out infinite" }}
              />
              Live
            </span>
            {/* Equalizer bars — the "sound on" motif. */}
            <span className="flex shrink-0 items-end gap-0.5" aria-hidden>
              {[0, 1, 2, 3, 4].map((b) => (
                <span
                  key={b}
                  className="w-0.5 origin-bottom rounded-full bg-[#8b5cf6]"
                  style={{
                    height: "12px",
                    animation: `mc-bar ${0.5 + b * 0.12}s ease-in-out ${b * 0.07}s infinite alternate`,
                  }}
                />
              ))}
            </span>
            <div className="flex-1 overflow-hidden">
              <div
                className="flex w-max gap-8 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.25em] text-white/45"
                style={{ animation: "tt-marquee 22s linear infinite" }}
              >
                {Array.from({ length: 2 }).map((_, dup) => (
                  <span key={dup} className="flex gap-8">
                    <span>For You · {HANDLE}</span>
                    <span>Original sound — your track</span>
                    <span>Identity-locked across every look</span>
                    <span>Afrobeats · Trap · Drill</span>
                    <span>#AuroraMusic</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative px-6 py-14 md:px-12 md:py-20">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-md bg-[#8b5cf6]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#c4b5fd]">
                    <Flame className="size-3.5" /> On TikTok
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/70">
                    <Music2 className="size-3.5" /> {HANDLE}
                  </span>
                </div>
                <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
                  Aurora is the{" "}
                  <span className="bg-gradient-to-r from-[#c4b5fd] via-white to-[#8b5cf6] bg-clip-text text-transparent">
                    For You page.
                  </span>
                </h2>
                <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
                  One artist, every look. New outfit, new set, new energy on every drop — each video
                  on {HANDLE} is made with Aurora. No shoots, no crew, no CapCut. Just drop your song
                  and get a fresh visual for every single.
                </p>
              </div>

              <a
                href="https://www.tiktok.com/@aurora.music"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 self-start rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-white/10"
              >
                <TikTokGlyph className="size-4" />
                Follow {HANDLE}
              </a>
            </div>

            {/* Feature-badge row */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex items-start gap-2.5"
                >
                  <span className="mt-0.5 shrink-0 text-[#8b5cf6]">{f.icon}</span>
                  <span className="text-[12px] leading-snug text-white/70">{f.label}</span>
                </div>
              ))}
            </div>

            {/* Phone-mock feed — one artist, many looks: a different outfit / pose / set per tile */}
            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
              {CLIPS.map((c) => (
                <div
                  key={c.caption}
                  className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-black"
                >
                  {c.src ? (
                    <AutoplayVideo
                      src={c.src}
                      poster={c.poster}
                      loop
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <img
                      src={c.poster}
                      alt={c.caption}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.20),transparent_60%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/90 backdrop-blur">
                      For You
                    </span>
                    <span className="grid place-items-center size-8 rounded-full bg-white/15 backdrop-blur">
                      <Play className="size-3.5 fill-white text-white" />
                    </span>
                  </div>

                  <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 text-white">
                    <Stat icon={<Heart className="size-4 fill-white" />} label={c.likes} />
                    <Stat icon={<MessageCircle className="size-4" />} label={c.comments} />
                    <Stat icon={<Share2 className="size-4" />} label="Share" />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-xs font-bold text-white">{HANDLE}</p>
                    <p className="mt-0.5 text-[11px] text-white/85 line-clamp-2">{c.caption}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
                      <Music2 className="size-3" /> original sound — your track
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* One primary CTA */}
            <div className="mt-10">
              <Link
                to="/lipsync"
                className="inline-flex items-center gap-2 rounded-xl bg-[#8b5cf6] px-6 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-[#8b5cf6]/30 hover:bg-[#7c3aed] transition-colors"
              >
                Lip-sync your track <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="grid place-items-center size-9 rounded-full bg-white/15 backdrop-blur">
        {icon}
      </span>
      <span className="text-[10px] font-bold">{label}</span>
    </div>
  );
}

function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M34.6 7.5c.6 3.6 2.6 6.3 6.4 7.2v6.1c-2.6.2-4.9-.5-7.6-2.2v9.7c0 5.9-3.1 10.7-9.2 11.5-6 .8-11.3-3.6-12.1-9.6-.7-5.9 3.6-11.3 9.5-12.1v6.5c-1.6.1-2.9 1.5-2.9 3.1 0 1.7 1.4 3.1 3.1 3.1 1.7 0 3.1-1.4 3.1-3.1V7.5h9.7z"
      />
    </svg>
  );
}
