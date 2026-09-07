import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Wand2, Film, Clapperboard, Palette, UserCircle2, Flame, type LucideIcon } from "lucide-react";
import { EditableCopy } from "@/components/EditableCopy";
import { HiddenBadge, useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForRoute, type FeatureKey } from "@/lib/feature-visibility";
import {
  COST_TIKTOK_REMIX_CUT,
  COST_UGC_AD,
  computeCost,
  lipsyncEngineCost,
  ONBOARDING_BONUS_AURA,
} from "@/lib/pricing";

const PRICE_IMAGE = computeCost({ features: ["image"] }).total;
const PRICE_MOTION = computeCost({ features: ["motion"] }).total;
const PRICE_PERFORMANCE = computeCost({
  features: ["video", "motion"],
  model: "seedance-2.0-fast",
}).total;
const PRICE_VIDEO_AGENT = computeCost({
  features: ["video"],
  model: "heygen/video-agent",
}).total;
const PRICE_AVATAR = lipsyncEngineCost("heygen-photo");

const FEATURED_TOOLS: ReadonlyArray<{
  label: string;
  desc: string;
  to: string;
  icon: LucideIcon;
  price: string;
  feature?: FeatureKey;
}> = [
  {
    label: "Motion Control",
    desc: "Transfer your real 30-second performance into any AI scene.",
    to: "/motion",
    icon: Wand2,
    price: `From ${PRICE_MOTION} Aura`,
  },
  {
    label: "Perform Anywhere",
    desc: "Phone performance + avatar + outfit + scene → cinematic video, anywhere.",
    to: "/perform",
    icon: Film,
    price: `From ${PRICE_PERFORMANCE} Aura`,
  },
  {
    label: "Aurora Video Agent",
    desc: "Plan, storyboard, edit, and render a complete cinematic video.",
    to: "/video-agent",
    icon: Clapperboard,
    price: `From ${PRICE_VIDEO_AGENT} Aura`,
  },
  {
    label: "Colors Performance Sessions",
    desc: "Direct your palette across cyc, indoor and rooftop performance sets.",
    to: "/colors",
    icon: Palette,
    price: `From ${PRICE_IMAGE} Aura`,
  },
  {
    label: "Get Ready With Me",
    desc: "Outfit swap talking GRWM reels straight from a single selfie.",
    to: "/studio",
    icon: UserCircle2,
    price: `From ${COST_UGC_AD} Aura`,
    feature: "grwm",
  },
  {
    label: "TikTok30 UGC Factory",
    desc: "Create 30 campaign posts, animate any result, or send it to Motion Control.",
    to: "/spin",
    icon: Flame,
    price: `${COST_TIKTOK_REMIX_CUT} Aura`,
    feature: "spin",
  },
  {
    label: "Talking Avatar Studio",
    desc: "Write the script, choose the face and voice, then generate a camera-ready avatar video.",
    to: "/avatar",
    icon: UserCircle2,
    price: `From ${PRICE_AVATAR} Aura`,
    feature: "talking-avatars",
  },
];

function FeaturedToolRow({ tool }: { tool: (typeof FEATURED_TOOLS)[number] }) {
  const Icon = tool.icon;
  const { isHiddenFromUsers } = useFeatureVisibility();
  return (
    <Link
      to={tool.to}
      className="group relative min-h-40 overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/75 p-4 no-underline transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-zinc-900"
    >
      <span className="absolute -right-7 -top-7 size-28 rounded-full bg-[#8b5cf6]/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex h-full flex-col">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/6 ring-1 ring-white/10">
          <Icon className="size-4 text-zinc-200" />
        </span>
        <div className="mt-auto pt-6">
          <p className="text-sm font-semibold leading-tight text-zinc-100">{tool.label}<HiddenBadge show={isHiddenFromUsers(tool.feature ?? featureKeyForRoute(tool.to))} /></p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500">{tool.desc}</p>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/7 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b5cf6]">{tool.price}</span>
          <ArrowUpRight className="size-3.5 text-zinc-600 transition-colors group-hover:text-zinc-200" />
        </div>
      </div>
    </Link>
  );
}

export function FeaturedToolsSection() {
  const { showFeature } = useFeatureVisibility();
  const featuredTools = FEATURED_TOOLS.filter((t) => showFeature(t.feature ?? featureKeyForRoute(t.to)));

  return (
    <section id="services" className="border-t border-white/5 px-5 py-12">
      <div className="mb-7">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
          Every tool
        </span>
        <h2 className="mt-2 text-3xl font-semibold leading-tight">
          <EditableCopy copyKey="landing_tools_heading" fallback="The full studio." />
          <br />
          <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">
            <EditableCopy copyKey="landing_tools_subheading" fallback="Pay only for what you make." />
          </span>
        </h2>
        <p className="mt-2 max-w-[48ch] text-xs leading-relaxed text-zinc-400">
          <EditableCopy copyKey="landing_tools_blurb" fallback={`Every feature is credit based. No subscriptions required to start. ${ONBOARDING_BONUS_AURA} free Aura when you complete setup.`} />
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {featuredTools.map((tool) => (
          <FeaturedToolRow key={tool.label} tool={tool} />
        ))}
      </div>
      <div className="mt-5 text-center">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-200 transition-colors no-underline"
        >
          See all tools <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
