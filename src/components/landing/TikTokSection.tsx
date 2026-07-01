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
// One artist, one face — the SAME identity. The feed tiles are real
// AI video clips (clip-* via image-to-video); the still-* frames are their posters.
import stillNeon from "@/assets/josh/generated/still-01-neon-closeup.jpg";
import stillStage from "@/assets/josh/generated/still-03-stage-mic.jpg";
import clipNeon from "@/assets/josh/generated/clip-01-neon-closeup.mp4";
import clipStage from "@/assets/josh/generated/clip-03-stage-mic.mp4";

const HANDLE = "@aurora.music";

const STATS = [
  { label: "Streams generated", value: "120M+", icon: <Eye className="size-4" /> },
  { label: "Music videos this month", value: "240+", icon: <Play className="size-4" /> },
  { label: "Songs gone viral", value: "38", icon: <TrendingUp className="size-4" /> },
  { label: "#AuroraMusic", value: "Trending", icon: <Heart className="size-4" /> },
];

type Clip = {
  caption: string;
  likes: string;
  comments: string;
  src: string;
  poster: string;
};

// All one artist — @aurora.music — real AI video clips (image-to-video).
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
];

export function TikTokSection() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16">
      {/* Neon cyan→magenta gradient frame — the signature TikTok duo-tone — so this
          slab reads as a distinct "screen" and pops against the muted cards around it. */}
      <div className="relative rounded-[32px] bg-gradient-to-br from-[#25F4EE] via-fuchsia-500 to-[#FE2C55] p-[2px] shadow-[0_0_90px_-25px_rgba(254,44,85,0.7)]">
        <div className="relative overflow-hidden rounded-[30px] bg-[#050507]">
          {/* Bold dual-tone split glow — cyan corner vs. magenta corner. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 0% 0%, rgba(37,244,238,0.28), transparent 42%), radial-gradient(circle at 100% 100%, rgba(254,44,85,0.34), transparent 42%)",
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
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#FE2C55] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
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
                  className="w-0.5 origin-bottom rounded-full bg-[#25F4EE]"
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
                    <span>240+ music videos this month</span>
                    <span>Afrobeats · Trap · Drill</span>
                    <span>#AuroraMusic trending</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative px-6 py-14 md:px-12 md:py-20">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-pink-200">
                    <Flame className="size-3.5" /> On TikTok
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/70">
                    <Music2 className="size-3.5" /> {HANDLE}
                  </span>
                </div>
                <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
                  Aurora is the{" "}
                  <span className="bg-gradient-to-r from-[#25F4EE] via-white to-[#FE2C55] bg-clip-text text-transparent">
                    For You page.
                  </span>
                </h2>
                <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
                  One artist. One face. Every video on {HANDLE} is made with Aurora — no shoots, no
                  crew, no CapCut. Just drop your song and get a new visual for every single.
                </p>
              </div>

              <a
                href="https://www.tiktok.com/@aurora.music"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-white/10"
              >
                <TikTokGlyph className="size-4" />
                Follow {HANDLE}
              </a>
            </div>

            {/* Stats strip */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-pink-200">
                    {s.icon}
                    <span className="text-[11px] uppercase tracking-widest text-white/55">
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-1 text-2xl font-extrabold text-white">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Phone-mock clips — single-creator For You feed */}
            <div className="mt-10 grid grid-cols-2 gap-4">
              {CLIPS.map((c) => (
                <div
                  key={c.caption}
                  className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-black"
                >
                  <AutoplayVideo
                    src={c.src}
                    poster={c.poster}
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.20),transparent_60%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/90 backdrop-blur">
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
                to="/tiktok"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] px-6 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
              >
                Turn one song into a week of music videos <ArrowRight className="size-4" />
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
