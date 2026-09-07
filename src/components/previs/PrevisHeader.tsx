import { Link } from "@tanstack/react-router";
import { Clapperboard, Plus, Film, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrevisHeaderProps = {
  onNewProject: () => void;
  onExport?: () => void;
  exporting?: boolean;
  hasProject: boolean;
};

export function PrevisHeader({ onNewProject, onExport, exporting, hasProject }: PrevisHeaderProps) {
  return (
    <header className="previs-header">
      <Link to="/previs" className="previs-brand" aria-label="Aurora Previs">
        <span className="previs-brand-mark">
          <Clapperboard className="size-3.5" />
        </span>
        <span className="previs-brand-name">Previs</span>
      </Link>

      <div className="previs-header-actions">
        {hasProject && onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-colors",
              "border-[oklch(1_0_0/11%)] bg-[oklch(1_0_0/3%)] text-[oklch(0.7_0.01_285)] hover:border-[oklch(1_0_0/20%)] hover:text-[oklch(0.88_0.01_285)]",
              "disabled:opacity-40",
            )}
            aria-label="Export storyboard package"
          >
            <Download className="size-3" />
            Export
          </button>
        )}
        <button
          type="button"
          onClick={onNewProject}
          className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(1_0_0/11%)] bg-[oklch(1_0_0/3%)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[oklch(0.7_0.01_285)] transition-colors hover:border-[oklch(1_0_0/20%)] hover:text-[oklch(0.88_0.01_285)]"
        >
          <Plus className="size-3" />
          New
        </button>
        <Link
          to="/video-agent"
          className="inline-flex size-8 items-center justify-center rounded-full border border-[oklch(1_0_0/11%)] bg-[oklch(1_0_0/3%)] text-[oklch(0.7_0.01_285)] transition-colors hover:border-[oklch(1_0_0/20%)] hover:text-[oklch(0.88_0.01_285)]"
          aria-label="Video Agent projects"
        >
          <Film className="size-4" />
        </Link>
      </div>
    </header>
  );
}
