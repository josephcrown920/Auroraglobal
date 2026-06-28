import { Link } from "@tanstack/react-router";
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
// One avatar, many shots — every tile below is the SAME creator identity,
// freshly AI-generated (still-* via image gen, clip-* via text-to-video).
import stillNeon from "@/assets/feed/generated/still-neon.png";
import stillStage from "@/assets/feed/generated/still-stage.png";
import stillRooftop from "@/assets/feed/generated/still-rooftop.png";
import stillAlley from "@/assets/feed/generated/still-street.png";
import clipNeon from "@/assets/feed/generated/clip-neon.mp4";
import clipStage from "@/assets/feed/generated/clip-stage.mp4";

const STATS = [
  { label: "Views generated", value: "120M+", icon: <Eye className="size-4" /> },
  { label: "Creator posts", value: "8,400+", icon: <Play className="size-4" /> },
  { label: "Avg. engagement", value: "14.7%", icon: <Heart className="size-4" /> },
  { label: "#AuroraStudio", value: "Trending", icon: <TrendingUp className="size-4" /> },
];

type Clip =
  | { handle: string; caption: string; likes: string; type: "video"; src: string; poster: string }
  | { handle: string; caption: string; likes: string; type: "image"; src: string };

// All @maya.aurora — one creator, one identity, four different shots.
const CLIPS: Clip[] = [
  {
    handle: "@maya.aurora",
    caption: "POV: my first single just dropped 🌌",
    likes: "412K",
    type: "video",
    src: clipNeon,
    poster: stillNeon,
  },
  {
    handle: "@maya.aurora",
    caption: "First night headlining the stage 🎤",
    likes: "1.2M",
    type: "video",
    src: clipStage,
    poster: stillStage,
  },
  {
    handle: "@maya.aurora",
    caption: "Rooftop golden hour, no filter needed",
    likes: "289K",
    type: "image",
    src: stillRooftop,
  },
  {
    handle: "@maya.aurora",
    caption: "Caught this one by the mural downtown",
    likes: "658K",
    type: "image",
    src: stillAlley,
  },
];

export function TikTokSection() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#0a0a14] via-[#120820] to-[#06070d]">
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(37,244,238,0.18), transparent 45%), radial-gradient(circle at 85% 80%, rgba(254,44,85,0.22), transparent 45%)",
        }}
      />
      <div className="relative px-6 py-14 md:px-12 md:py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-pink-200">
                <Flame className="size-3.5" /> On TikTok
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/70">
                <Music2 className="size-3.5" /> @aurorastudio
              </span>
            </div>
            <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
              Aurora is the{" "}
              <span className="bg-gradient-to-r from-[#25F4EE] via-white to-[#FE2C55] bg-clip-text text-transparent">
                For You page.
              </span>
            </h2>
            <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
              Creators are flooding TikTok with Aurora-made cuts, color-grades and lip-syncs. Follow
              along, grab the sounds, remix the templates.
            </p>
          </div>

          <a
            href="https://www.tiktok.com/@aurorastudio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-3 text-sm font-bold text-black no-underline shadow-lg shadow-white/10 hover:bg-white/90"
          >
            <TikTokGlyph className="size-4" />
            Follow on TikTok
            <ArrowRight className="size-4" />
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

        {/* Phone-mock clips */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CLIPS.map((c) => (
            <div
              key={c.caption}
              className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-black"
            >
              {c.type === "video" ? (
                <video
                  src={c.src}
                  poster={c.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <img
                  src={c.src}
                  alt={c.caption}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
              )}
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
                <Stat icon={<MessageCircle className="size-4" />} label="2.4K" />
                <Stat icon={<Share2 className="size-4" />} label="Share" />
              </div>

              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-xs font-bold text-white">{c.handle}</p>
                <p className="mt-0.5 text-[11px] text-white/85 line-clamp-2">{c.caption}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
                  <Music2 className="size-3" /> original sound — Aurora
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/tiktok"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] px-6 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
          >
            Remix one video into 30 cuts <ArrowRight className="size-4" />
          </Link>
          <a
            href="https://www.tiktok.com/tag/aurorastudio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-white/10"
          >
            #AuroraStudio on TikTok
          </a>
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
