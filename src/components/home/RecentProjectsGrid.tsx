import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";

export type GenItem = {
  id: string;
  kind?: string | null;
  prompt?: string | null;
  status?: string | null;
  result_image_url?: string | null;
  result_video_url?: string | null;
  created_at?: string | null;
};

const KIND_BADGE: Record<string, string> = {
  image:       "COLORS",
  video:       "MOTION",
  lipsync:     "LIP SYNC",
  music_video: "MUSIC VIDEO",
  motion:      "MOTION",
  spin:        "TIKTOK UGC",
  ugc:         "UGC",
  lyric_video: "MUSIC VIDEO",
};

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function ProjectCard({ item }: { item: GenItem }) {
  const badge = KIND_BADGE[item.kind ?? ""] ?? null;
  const ago = timeAgo(item.created_at);

  return (
    <article>
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: "4/5",
          background: "oklch(0.10 0.012 272)",
          border: "1px solid oklch(1 0 0 / 0.06)",
        }}
      >
        {item.result_image_url ? (
          <img
            src={item.result_image_url}
            alt={item.prompt?.slice(0, 50) ?? ""}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : item.result_video_url ? (
          <AutoplayVideo
            src={item.result_video_url}
            className="h-full w-full object-cover"
            playsInline
            loop
            autoPlay={false}
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
          />
        ) : null}

        {/* Bottom gradient overlay */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{ background: "linear-gradient(to top, oklch(0.08 0.015 272 / 0.85), transparent)" }}
        />

        {/* Category badge */}
        {badge && (
          <span
            className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white/90"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-[12px] font-medium leading-tight text-zinc-300">
          {item.prompt?.slice(0, 36) || badge || "Generation"}
        </p>
        {ago && (
          <p className="mt-0.5 text-[10px] text-zinc-600">{ago}</p>
        )}
      </div>
    </article>
  );
}

interface RecentProjectsGridProps {
  items: GenItem[];
}

export function RecentProjectsGrid({ items }: RecentProjectsGridProps) {
  return (
    <section className="px-5 pb-12">
      <div className="mb-4 flex items-center justify-between">
        <p className="aurora-kicker" style={{ color: "oklch(0.58 0.22 25 / 0.6)" }}>
          Recent Projects
        </p>
        {items.length > 0 && (
          <Link
            to="/dashboard"
            className="text-[12px] text-muted-foreground/50 no-underline transition-colors hover:text-muted-foreground"
          >
            View all →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* ＋ New Project ghost card */}
        <Link
          to="/studio"
          className="no-underline"
          aria-label="New project"
        >
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl transition-all active:scale-[0.97]"
            style={{
              aspectRatio: "4/5",
              border: "1.5px dashed oklch(1 0 0 / 0.12)",
              background: "oklch(0.10 0.012 272)",
            }}
          >
            <span
              className="flex size-10 items-center justify-center rounded-full"
              style={{ background: "oklch(0.58 0.22 25 / 0.12)", border: "1px solid oklch(0.58 0.22 25 / 0.25)" }}
            >
              <Plus className="size-5 text-primary" />
            </span>
            <span className="text-[12px] font-medium text-muted-foreground/60">New Project</span>
          </div>
        </Link>

        {/* Recent generations */}
        {items.slice(0, 7).map((item) => (
          <ProjectCard key={item.id} item={item} />
        ))}
      </div>

      {items.length === 0 && (
        <p className="mt-3 text-center text-[13px] text-muted-foreground/40">
          Your creations will appear here.
        </p>
      )}
    </section>
  );
}
