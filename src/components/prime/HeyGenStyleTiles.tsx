// ─── HeyGen-style feature grid for the Video Agent workspace ─────────────────
// Colorful large tiles that route the user into Aurora's flagship features.
// Includes a Phone Performance tile: record yourself with your phone, upload as
// motion clip, and use motion control to transfer the pose onto your identity.
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForRoute } from "@/lib/feature-visibility";
import {
  UserSquare2,
  Video,
  Image as ImageIcon,
  Languages,
  Mic,
  Smartphone,
  Clapperboard,
  Sparkles,
} from "lucide-react";

type Tile = {
  title: string;
  cta: string;
  to: string;
  /** Optional search params for tab deep-linking (e.g. /avatar?tab=avatars). */
  search?: Record<string, string>;
  icon: LucideIcon;
  /** Tailwind gradient classes for the tile background. */
  gradient: string;
  /** Optional short badge (e.g. Premium). */
  badge?: string;
};

const TILES: readonly Tile[] = [
  {
    title: "Perform Anywhere",
    cta: "Direct your shoot →",
    to: "/orchestrate",
    icon: Clapperboard,
    gradient: "from-fuchsia-500 via-purple-600 to-indigo-700",
    badge: "Flagship",
  },
  {
    title: "Phone Performance",
    cta: "Motion Control from your phone →",
    to: "/orchestrate",
    icon: Smartphone,
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    badge: "New",
  },
  {
    title: "Create an Avatar",
    cta: "Go to Avatars →",
    to: "/avatar",
    search: { tab: "avatars" },
    icon: UserSquare2,
    gradient: "from-lime-300 via-emerald-400 to-emerald-600",
  },
  {
    title: "Photo to Video",
    cta: "Try it now →",
    to: "/studio",
    icon: ImageIcon,
    gradient: "from-rose-400 via-pink-500 to-fuchsia-600",
  },
  {
    title: "Translate any Video",
    cta: "Translate now →",
    to: "/live-studio",
    icon: Languages,
    gradient: "from-sky-400 via-blue-500 to-indigo-600",
  },
  {
    title: "Speech Cleanup",
    cta: "Create now →",
    to: "/photo-edit",
    icon: Mic,
    gradient: "from-amber-400 via-orange-500 to-rose-500",
  },

  {
    title: "Avatar Shots",
    cta: "Get started →",
    to: "/scene-builder",
    icon: Video,
    gradient: "from-slate-500 via-slate-700 to-slate-900",
  },
  {
    title: "Start from Scratch",
    cta: "Go to AI Studio →",
    to: "/canvas",
    icon: Sparkles,
    gradient: "from-yellow-300 via-amber-400 to-orange-500",
  },
];

export function HeyGenStyleTiles() {
  const { showFeature } = useFeatureVisibility();
  // Artist-only mode: drop tiles whose destination feature is gated (e.g.
  // "Create an Avatar" → /avatar) for regular users; admins keep them.
  const tiles = TILES.filter((t) => showFeature(featureKeyForRoute(t.to)));
  return (
    <section aria-label="Video Agent features" className="mt-2">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">Say it with video</h2>
        <span className="text-xs uppercase tracking-widest text-ink-dim">
          Aurora's all-in-one video agent
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <TileCard key={t.title} tile={t} />
        ))}
      </div>
    </section>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <Link
      to={tile.to}
      search={tile.search}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${tile.gradient} p-5 text-white shadow-lg ring-1 ring-white/10 transition-transform hover:scale-[1.015] hover:shadow-xl`}
      style={{ minHeight: 168 }}
    >
      {tile.badge && (
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
          {tile.badge}
        </span>
      )}
      <Icon
        className="absolute -bottom-4 -right-4 size-32 text-white/15 transition-transform duration-300 group-hover:scale-110"
        strokeWidth={1.5}
      />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <h3 className="max-w-[80%] text-xl font-black leading-tight drop-shadow-sm">
          {tile.title}
        </h3>
        <p className="text-sm font-semibold text-white/90">{tile.cta}</p>
      </div>
    </Link>
  );
}
