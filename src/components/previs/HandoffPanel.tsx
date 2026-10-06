import { ArrowRight, Download, Loader2, Film } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { VideoAgentProjectDto } from "@/lib/video-agent-projects.functions";
import { cn } from "@/lib/utils";

type HandoffPanelProps = {
  project: VideoAgentProjectDto | null;
  onExport: () => Promise<void>;
  exporting: boolean;
};

export function HandoffPanel({ project, onExport, exporting }: HandoffPanelProps) {
  const hasProject = !!project;
  const shotCount = project?.scenes.length ?? 0;
  const platedCount = project?.scenes.filter((s) => s.frame).length ?? 0;

  return (
    <div className="previs-handoff-panel">
      <div className="previs-handoff-header">
        <p className="previs-field-label">Ready to produce?</p>
        <p className="text-xs text-ink-dim/60 leading-relaxed mt-1">
          Export a package (storyboard, CSV, JSON, prompts, plates) or hand off directly to the Video Agent editor.
        </p>
      </div>

      {hasProject && (
        <div className="previs-handoff-stats">
          <div className="previs-handoff-stat">
            <span className="previs-handoff-stat-value">{shotCount}</span>
            <span className="previs-handoff-stat-label">scenes</span>
          </div>
          <div className="previs-handoff-stat">
            <span className="previs-handoff-stat-value">{platedCount}</span>
            <span className="previs-handoff-stat-label">plates</span>
          </div>
          <div className="previs-handoff-stat">
            <span className={cn("previs-handoff-stat-value text-xs", project?.status === "succeeded" ? "text-emerald-400" : "text-ink-dim/60")}>
              {project?.status ?? "—"}
            </span>
            <span className="previs-handoff-stat-label">status</span>
          </div>
        </div>
      )}

      <div className="previs-handoff-actions">
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={exporting || !hasProject}
          className="previs-handoff-btn previs-handoff-btn--export"
          data-testid="button-export-zip"
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export Package
        </button>

        {hasProject ? (
          <Link
            to="/video-agent-edit"
            search={{ id: project!.id }}
            className="previs-handoff-btn previs-handoff-btn--editor"
            data-testid="link-handoff-editor"
          >
            <Film className="size-4" />
            Open in Editor
            <ArrowRight className="size-3.5 ml-auto" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="previs-handoff-btn previs-handoff-btn--editor opacity-40 cursor-not-allowed"
          >
            <Film className="size-4" />
            Open in Editor
            <ArrowRight className="size-3.5 ml-auto" />
          </button>
        )}
      </div>
    </div>
  );
}
