import type { VideoPlan } from "@/lib/video-agent-skills";
import { cn } from "@/lib/utils";

type BriefPanelProps = {
  plan: VideoPlan;
};

const MOTION_LANGUAGE_COLOR: Record<string, string> = {
  "Cinematic Minimal": "text-sky-400",
  "Kinetic Energy": "text-amber-400",
  "Luxury/Editorial": "text-violet-300",
  "Documentary Realism": "text-emerald-400",
  "Music Video Maximal": "text-fuchsia-400",
  "Retro/Analog": "text-orange-300",
  "Product Ad Clean": "text-blue-400",
};

export function BriefPanel({ plan }: BriefPanelProps) {
  const { brief, direction, render_plan } = plan;
  if (!brief) return null;

  return (
    <aside className="previs-brief-panel">
      {/* Title + logline */}
      <div className="previs-brief-section previs-brief-title-block">
        <p className="previs-field-label">Title</p>
        <p className="previs-brief-title">{brief.title}</p>
        <p className="previs-brief-logline">{brief.logline}</p>
      </div>

      {/* Genre + Mood */}
      <div className="previs-brief-section previs-brief-meta-row">
        <div>
          <p className="previs-field-label">Genre</p>
          <p className="previs-field-value">{brief.genre}</p>
        </div>
        <div>
          <p className="previs-field-label">Mood</p>
          <p className="previs-field-value">{brief.mood}</p>
        </div>
        <div>
          <p className="previs-field-label">Format</p>
          <p className="previs-field-value">{brief.format}</p>
        </div>
      </div>

      {/* Motion language */}
      {brief.motion_language && (
        <div className="previs-brief-section">
          <p className="previs-field-label">Motion Language</p>
          <p className={cn("previs-field-value font-bold", MOTION_LANGUAGE_COLOR[brief.motion_language] ?? "text-prime")}>
            {brief.motion_language}
          </p>
        </div>
      )}

      {/* Palette */}
      {brief.palette && brief.palette.length > 0 && (
        <div className="previs-brief-section">
          <p className="previs-field-label">Palette</p>
          <div className="previs-palette-swatches">
            {brief.palette.map((entry) => (
              <div key={entry.hex} className="previs-swatch-item" title={`${entry.role}: ${entry.hex}`}>
                <span
                  className="previs-swatch"
                  style={{ background: entry.hex }}
                  aria-label={`${entry.role} color ${entry.hex}`}
                />
                <span className="previs-swatch-role">{entry.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* References */}
      {brief.references && brief.references.length > 0 && (
        <div className="previs-brief-section">
          <p className="previs-field-label">References</p>
          <ul className="previs-references">
            {brief.references.map((ref) => (
              <li key={ref} className="previs-reference-item">{ref}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Direction */}
      {direction && (
        <div className="previs-brief-section">
          <p className="previs-field-label">Direction</p>
          <div className="previs-direction-grid">
            {[
              ["Lens", direction.lens],
              ["Film Stock", direction.film_stock],
              ["Lighting", direction.lighting],
              ["Camera", direction.camera_movement],
              ["Pacing", direction.pacing],
              ["Sound", direction.sound_register],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="previs-direction-item">
                <span className="previs-direction-key">{k}</span>
                <span className="previs-direction-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Render plan */}
      {render_plan && (
        <div className="previs-brief-section">
          <p className="previs-field-label">Render Plan</p>
          <div className="previs-direction-grid">
            {[
              ["Model", render_plan.model],
              ["Aspect", render_plan.aspect_ratio],
              ["Resolution", render_plan.resolution],
              ["FPS", String(render_plan.fps)],
            ].map(([k, v]) => (
              <div key={k} className="previs-direction-item">
                <span className="previs-direction-key">{k}</span>
                <span className="previs-direction-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {brief.assumptions && brief.assumptions.length > 0 && (
        <div className="previs-brief-section">
          <p className="previs-field-label">Assumptions</p>
          <ul className="previs-assumptions">
            {brief.assumptions.map((a, i) => (
              <li key={i} className="previs-assumption-item">{a}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
