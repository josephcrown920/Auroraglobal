/**
 * ViralPresetsSection — Higgsfield-inspired viral presets landing block.
 * Dark/gold treatment. Tag cloud of Aurora preset names + two autoplay preview clips.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/tracking";

const PRESET_TAGS = [
  "Concert Lip-sync",
  "Music Video Mini",
  "Cinematic Selfie Reel",
  "Golden Hour Orbit",
  "Neon Night Move",
  "UGC Talking Ad",
  "Product Lifestyle Ad",
  "App Hero",
  "Product Promo",
  "Creator Walk & Talk",
  "Virtual Try-On",
  "Beat-Drop Reel",
  "Viral Spin",
  "Trend Remix",
  "Storybook Character",
  "Bedtime Reel",
  "Looping Officers",
  "AutoCut Hype",
  "AutoCut Cinematic",
  "Talking Head",
  "TikTok Hook",
  "Editorial Cover",
  "Neon Street",
  "Rooftop Golden",
  "Urban Alley",
  "Urban Subway",
  "Colors Wide",
  "Colors Close-Up",
  "Music Video Scene",
  "Urban Cut",
  "Get Ready With Me",
];

const PREVIEW_VIDEOS = [
  { src: "/viral-presets/preview-1.mp4", label: "Performance reel" },
  { src: "/viral-presets/preview-2.mp4", label: "Cinematic edit" },
];

function TagCloud() {
  return (
    <div className="relative px-5 py-4 overflow-hidden">
      {/* Row 1 */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mb-1.5">
        {PRESET_TAGS.slice(0, 11).map((t) => (
          <Link
            key={t}
            to="/templates"
            onClick={() => void track("viral_preset_tag_click", { tag: t })}
            className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55 hover:text-[#f0d060] transition-colors no-underline whitespace-nowrap"
          >
            {t}
          </Link>
        ))}
      </div>
      {/* Row 2 */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mb-1.5">
        {PRESET_TAGS.slice(11, 22).map((t) => (
          <Link
            key={t}
            to="/templates"
            onClick={() => void track("viral_preset_tag_click", { tag: t })}
            className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55 hover:text-[#f0d060] transition-colors no-underline whitespace-nowrap"
          >
            {t}
          </Link>
        ))}
      </div>
      {/* Row 3 */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
        {PRESET_TAGS.slice(22).map((t) => (
          <Link
            key={t}
            to="/templates"
            onClick={() => void track("viral_preset_tag_click", { tag: t })}
            className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55 hover:text-[#f0d060] transition-colors no-underline whitespace-nowrap"
          >
            {t}
          </Link>
        ))}
      </div>
    </div>
  );
}

function PreviewVideo({ src, label }: { src: string; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900 aspect-video">
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
        aria-label={label}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}

export function ViralPresetsSection() {
  return (
    <section className="relative z-10 overflow-hidden border-t border-white/5 bg-[#07060a] py-16">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(240,208,96,0.08), transparent 70%)",
        }}
      />

      <div className="relative px-5">
        {/* Eyebrow */}
        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-[#f0d060]/60">
          ✦ Aurora Templates
        </p>

        {/* Headline */}
        <h2
          className="mb-8 text-center font-black uppercase tracking-[-0.01em] text-[#f0d060]"
          style={{ fontSize: "clamp(2.4rem, 8vw, 4.5rem)", lineHeight: 0.95 }}
        >
          Viral Presets
        </h2>

        {/* Tag cloud */}
        <TagCloud />

        {/* Preview videos */}
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PREVIEW_VIDEOS.map((v) => (
            <PreviewVideo key={v.src} src={v.src} label={v.label} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 flex justify-center">
          <Link
            to="/templates"
            onClick={() => void track("viral_presets_cta")}
            className="inline-flex items-center gap-2 rounded-full border border-[#f0d060]/30 bg-[#f0d060]/10 px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-[#f0d060] no-underline transition hover:bg-[#f0d060]/20"
          >
            Browse all presets <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
