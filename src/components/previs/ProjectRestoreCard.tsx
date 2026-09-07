import { Clock, Film, ChevronRight, Loader2 } from "lucide-react";
import type { VideoAgentProjectDto } from "@/lib/video-agent-projects.functions";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

type ProjectRestoreCardProps = {
  project: VideoAgentProjectDto;
  onRestore: (project: VideoAgentProjectDto) => void;
  loading: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  draft:      "text-ink-dim/60",
  editing:    "text-prime/80",
  queued:     "text-amber-400",
  processing: "text-amber-400",
  succeeded:  "text-emerald-400",
  failed:     "text-rec",
};

const STATUS_LABELS: Record<string, string> = {
  draft:      "Draft",
  editing:    "Storyboard ready",
  queued:     "Render queued",
  processing: "Rendering",
  succeeded:  "Video ready",
  failed:     "Failed",
};

export function ProjectRestoreCard({ project, onRestore, loading }: ProjectRestoreCardProps) {
  const thumb = project.scenes.find((s) => s.frame)?.frame ?? null;
  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.draft;
  const statusLabel = STATUS_LABELS[project.status] ?? project.status;
  const shotCount = project.scenes.length;
  const totalDuration = project.scenes.reduce((sum, s) => sum + (s.duration ?? 0), 0);

  return (
    <div
      className="previs-restore-card"
      role="article"
      data-testid={`project-restore-${project.id}`}
    >
      {/* Thumbnail */}
      <div className="previs-restore-thumb">
        {thumb ? (
          <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Film className="size-5 text-ink-dim/20" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="previs-restore-info">
        <p className="previs-restore-title">{project.title}</p>
        <div className="previs-restore-meta">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", statusStyle)}>
            {statusLabel}
          </span>
          {shotCount > 0 && (
            <>
              <span className="text-ink-dim/30">·</span>
              <span>{shotCount} scenes</span>
              {totalDuration > 0 && (
                <><span className="text-ink-dim/30">·</span><span>{totalDuration}s</span></>
              )}
            </>
          )}
          <span className="text-ink-dim/30">·</span>
          <span className="flex items-center gap-1">
            <Clock className="size-2.5" />
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="previs-restore-actions">
        <button
          type="button"
          onClick={() => onRestore(project)}
          disabled={loading}
          className="previs-restore-btn"
          aria-label={`Restore project: ${project.title}`}
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
          Restore
        </button>
        <Link
          to="/video-agent-edit"
          search={{ id: project.id }}
          className="previs-restore-edit-link"
          aria-label={`Open ${project.title} in Video Agent editor`}
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
