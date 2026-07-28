import { useGetDashboard } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Image as ImageIcon,
  Video,
  Mic,
  Music,
  Smartphone,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

const tools = [
  {
    href: "/studio",
    label: "Colors",
    desc: "High-fidelity performance photos",
    icon: ImageIcon,
    cost: 2,
    image:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=85&fit=crop&crop=center",
  },
  {
    href: "/motion",
    label: "Motion",
    desc: "Cinematic video snippets",
    icon: Video,
    cost: 10,
    image:
      "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=85&fit=crop&crop=center",
  },
  {
    href: "/lipsync",
    label: "Lip Sync",
    desc: "AI audio-synced performance",
    icon: Mic,
    cost: 8,
    image:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=85&fit=crop&crop=top",
  },
  {
    href: "/music-video",
    label: "Music Video",
    desc: "Full-length track production",
    icon: Music,
    cost: 12,
    image:
      "https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=800&q=85&fit=crop&crop=center",
  },
  {
    href: "/ugc",
    label: "TikTok30 UGC",
    desc: "Campaign batch generation",
    icon: Smartphone,
    cost: 6,
    image:
      "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=85&fit=crop&crop=top",
  },
];

type Generation = {
  id: string;
  type: string;
  thumbnailUrl?: string;
  createdAt: string;
};

export default function DashboardPage() {
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="size-5 animate-spin text-white/30" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-center max-w-sm mx-auto mt-20">
        <p className="text-white/50 text-sm mb-4">Failed to load dashboard.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16 space-y-12">
      {/* Header */}
      <header className="space-y-1 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FF3B30]">
          Aurora Studio
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
          Create something new.
        </h1>
        <p className="text-base text-white/40 italic font-serif">
          Select a tool to begin your next project.
        </p>
      </header>

      {/* Tool Cards — 2-col grid */}
      <section>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex flex-col rounded-2xl overflow-hidden bg-[#111] border border-white/5 hover:border-white/10 transition-all duration-300"
              >
                {/* Image */}
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={tool.image}
                    alt={tool.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    loading="lazy"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  {/* Overlaid bottom row */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <span className="flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                      <Icon className="size-3.5 text-white/90" />
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FF3B30] text-white leading-none">
                      {tool.cost} CR
                    </span>
                  </div>
                </div>

                {/* Text */}
                <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-1">
                  <p className="text-white font-semibold text-[15px] leading-snug">
                    {tool.label}
                  </p>
                  <p className="text-white/40 text-[12px] leading-snug hidden sm:block">
                    {tool.desc}
                  </p>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/30 group-hover:text-white/70 transition-colors flex items-center gap-0.5">
                    Open <ArrowUpRight className="size-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Projects */}
      {dashboard.recentActivity.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-white/40">
              Recent Projects
            </h2>
            <Link
              href="/gallery"
              className="text-[11px] font-semibold uppercase tracking-wider text-white/30 hover:text-white transition-colors flex items-center gap-0.5"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(dashboard.recentActivity as Generation[]).slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href="/gallery"
                className="group relative aspect-square rounded-xl overflow-hidden bg-[#111] border border-white/5 hover:border-white/15 transition-all"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.type}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="text-white/10" size={22} />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                  <div>
                    <p className="text-[11px] font-semibold text-white capitalize">
                      {item.type}
                    </p>
                    <p className="text-[10px] text-white/50">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {dashboard.recentActivity.length === 0 && (
        <section className="text-center py-12">
          <p className="text-white/20 text-sm mb-1">No projects yet.</p>
          <p className="text-white/10 text-xs">
            Pick a tool above to start creating.
          </p>
        </section>
      )}
    </div>
  );
}
