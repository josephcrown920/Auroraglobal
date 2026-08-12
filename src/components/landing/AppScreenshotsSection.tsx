import { Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Mic2, Scissors, Code2, Sparkles, Image } from "lucide-react";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForRoute } from "@/lib/feature-visibility";

type Screen = {
  src: string;
  label: string;
  kicker: string;
  to: string;
  icon: React.ReactNode;
  /** tall = 9:16 portrait (phone screenshot), wide = landscape card */
  aspect?: "portrait" | "landscape";
};

const SCREENS: Screen[] = [
  {
    src: "/screenshots/tiktok30-templates.png",
    label: "One prompt. 30 unique posts.",
    kicker: "TikTok30",
    to: "/spin",
    icon: <Flame className="size-3" />,
    aspect: "portrait",
  },
  {
    src: "/screenshots/lipsync-studio.png",
    label: "Make any face sing your hook.",
    kicker: "Lip Sync Studio",
    to: "/lipsync",
    icon: <Mic2 className="size-3" />,
    aspect: "portrait",
  },
  {
    src: "/screenshots/autocut.png",
    label: "AI-cut video from your raw clips.",
    kicker: "AutoCut",
    to: "/tiktok",
    icon: <Scissors className="size-3" />,
    aspect: "portrait",
  },
  {
    src: "/screenshots/playground-desktop.png",
    label: "Script the studio with code.",
    kicker: "Playground",
    to: "/editor",
    icon: <Code2 className="size-3" />,
    aspect: "landscape",
  },
  {
    src: "/screenshots/studio-screen.png",
    label: "Your face. Any world.",
    kicker: "Studio",
    to: "/studio",
    icon: <Sparkles className="size-3" />,
    aspect: "portrait",
  },
  {
    src: "/screenshots/gallery-screen.jpeg",
    label: "Every render, saved and shareable.",
    kicker: "Gallery",
    to: "/gallery",
    icon: <Image className="size-3" />,
    aspect: "landscape",
  },
];

export function AppScreenshotsSection() {
  const { showFeature } = useFeatureVisibility();
  // Artist-only mode: drop screenshot cards whose destination route is gated
  // (e.g. TikTok30 → /spin) for regular users; admins still see them.
  const screens = SCREENS.filter((s) => showFeature(featureKeyForRoute(s.to)));
  return (
    <section className="relative z-10 border-y border-white/8 bg-[#070612] px-5 py-16">
      {/* Subtle violet radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.35 0.18 295 / 0.18), transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            Inside Aurora
          </span>
          <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-white">
            Every tool you need.{" "}
            <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text text-transparent">
              One balance.
            </span>
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            From one-tap viral posts to frame-accurate lip syncs and AI video edits — Aurora ships them all, credit by credit.
          </p>
        </div>

        {/* Compact 2-column screenshot grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {screens.map((screen) => {
            const aspectClass =
              screen.aspect === "landscape" ? "aspect-[4/3]" : "aspect-[9/16]";

            return (
              <Link
                key={screen.src}
                to={screen.to}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 no-underline transition-transform duration-200 hover:-translate-y-0.5"
              >
                {/* Screenshot */}
                <div className={`relative ${aspectClass} w-full overflow-hidden`}>
                  <img
                    src={screen.src}
                    alt={screen.label}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                </div>

                {/* Label */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-[#8b5cf6]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#c4b5fd]">
                    {screen.icon}
                    {screen.kicker}
                  </span>
                  <p className="text-[12px] font-semibold leading-snug text-white/90">
                    {screen.label}
                  </p>
                </div>

                {/* Hover arrow */}
                <div className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
                  <ArrowRight className="size-3.5 text-white" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-6 text-center">
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 no-underline transition-colors hover:text-zinc-200"
          >
            See all Aurora tools <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
