import { useState, useRef } from "react";
import {
  Loader2, Download, RefreshCw, Sparkles, ChevronDown, Clock,
  Camera, Sun, FileText, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoShot } from "@/lib/video-agent-skills";

const PURPOSE_COLOR: Record<string, string> = {
  establishing: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  context:      "text-blue-400 bg-blue-400/10 border-blue-400/20",
  character:    "text-violet-400 bg-violet-400/10 border-violet-400/20",
  reaction:     "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",
  detail:       "text-amber-400 bg-amber-400/10 border-amber-400/20",
  insert:       "text-orange-400 bg-orange-400/10 border-orange-400/20",
  payoff:       "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

type PlateState = "idle" | "loading" | "done" | "error";

type ShotCardProps = {
  shot: VideoShot;
  index: number;
  projectId: string;
  sceneId: string;
  frame: string | null;
  frameStatus: string | undefined;
  isSelected: boolean;
  onClick: () => void;
  onGenerateFree: () => Promise<void>;
  onUpgradePremium: () => Promise<void>;
  onFieldChange: (field: string, value: string | number) => void;
  previsPlatesCost: number;
  generatingFree: boolean;
  upgradingPremium: boolean;
};

export function ShotCard({
  shot, index, projectId, frame, frameStatus, isSelected,
  onClick, onGenerateFree, onUpgradePremium,
  onFieldChange, previsPlatesCost,
  generatingFree, upgradingPremium,
}: ShotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [downloadingPlate, setDownloadingPlate] = useState(false);

  const purposeClass = PURPOSE_COLOR[shot.purpose] ?? "text-ink-dim bg-panel-2 border-line";
  const hasPlate = !!frame;
  const isPersisted = projectId.length > 0;
  const plateLoading = frameStatus === "loading" || generatingFree || upgradingPremium;

  async function downloadPlate() {
    if (!frame || downloadingPlate) return;
    setDownloadingPlate(true);
    try {
      const res = await fetch(frame);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const ext = blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `shot-${String(index + 1).padStart(2, "0")}-${shot.purpose}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // If cross-origin download fails, open in new tab
      window.open(frame, "_blank");
    } finally {
      setDownloadingPlate(false);
    }
  }

  return (
    <article
      className={cn(
        "previs-shot-card",
        isSelected && "previs-shot-card--selected",
      )}
      data-testid={`shot-card-${index}`}
      aria-label={`Shot ${index + 1}: ${shot.purpose}`}
    >
      {/* Shot header — always visible */}
      <button
        type="button"
        className="previs-shot-header"
        onClick={onClick}
        aria-expanded={isSelected}
      >
        {/* Shot number badge */}
        <span className="previs-shot-num">{String(index + 1).padStart(2, "0")}</span>

        {/* Meta */}
        <div className="previs-shot-meta">
          <div className="previs-shot-tags">
            <span className={cn("previs-purpose-badge", purposeClass)}>
              {shot.purpose}
            </span>
            <span className="previs-shot-type-badge">{shot.shot_type}</span>
            {shot.duration_s && (
              <span className="previs-duration-badge">
                <Clock className="size-3" />
                {shot.duration_s}s
              </span>
            )}
            {shot.lens_mm && (
              <span className="previs-duration-badge">
                {shot.lens_mm}mm
              </span>
            )}
          </div>
          <p className="previs-shot-action">{shot.action}</p>
        </div>

        {/* Plate thumb */}
        <div className="previs-shot-thumb">
          {plateLoading ? (
            <div className="previs-plate-loading">
              <Loader2 className="size-4 animate-spin text-prime" />
            </div>
          ) : hasPlate ? (
            <img
              src={frame!}
              alt={`Previs plate: ${shot.action}`}
              className="previs-plate-thumb-img"
              loading="lazy"
            />
          ) : (
            <div className="previs-plate-empty-thumb">
              <Camera className="size-4 text-ink-dim/40" />
            </div>
          )}
        </div>

        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-ink-dim/50 transition-transform duration-200",
            isSelected && "rotate-180",
          )}
        />
      </button>

      {/* Expanded detail */}
      {isSelected && (
        <div className="previs-shot-detail">
          {/* ── Visual plate — dominant ── */}
          <div className="previs-plate-section">
            <div className="previs-plate-header">
              <span className="previs-field-label">Visual Plate</span>
              <div className="previs-plate-actions">
                {hasPlate && (
                  <button
                    type="button"
                    onClick={() => void downloadPlate()}
                    disabled={downloadingPlate}
                    className="previs-plate-action-btn"
                    aria-label="Download plate"
                  >
                    <Download className="size-3" />
                    {downloadingPlate ? "Downloading…" : "Download"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onGenerateFree()}
                   disabled={plateLoading || !isPersisted}
                  className="previs-plate-action-btn previs-plate-action-btn--free"
                  aria-label={hasPlate ? "Re-render free plate" : "Generate free previs plate"}
                >
                  {generatingFree ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  {hasPlate ? "Re-render" : "Generate"} · Free
                </button>
                <button
                  type="button"
                  onClick={() => void onUpgradePremium()}
                   disabled={plateLoading || !isPersisted}
                  className="previs-plate-action-btn previs-plate-action-btn--premium"
                  aria-label={`Upgrade to premium plate — ${previsPlatesCost} Aura`}
                >
                  {upgradingPremium ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  Upgrade · {previsPlatesCost}
                  <span className="text-[10px] opacity-70">Aura</span>
                </button>
              </div>
            </div>

            {/* Plate display */}
            {plateLoading && !hasPlate ? (
              <div className="previs-plate-generating">
                <Loader2 className="size-6 animate-spin text-prime" />
                <p className="text-xs text-ink-dim/60 mt-2">
                  {upgradingPremium ? "Rendering premium plate…" : "Generating free preview…"}
                </p>
              </div>
            ) : hasPlate ? (
              <div className="previs-plate-image-wrap">
                <img
                  src={frame!}
                  alt={`Previs plate for shot ${index + 1}: ${shot.action}`}
                  className="previs-plate-image"
                  loading="lazy"
                />
                {plateLoading && (
                  <div className="previs-plate-image-overlay">
                    <Loader2 className="size-6 animate-spin text-white" />
                  </div>
                )}
              </div>
            ) : frameStatus === "error" ? (
              <div className="previs-plate-error">
                <AlertCircle className="size-4 text-rec" />
                <p className="text-xs text-rec">Plate generation failed. Try again.</p>
              </div>
            ) : (
              <div className="previs-plate-empty">
                <Camera className="size-8 text-ink-dim/20" />
                <p className="text-xs text-ink-dim/40 mt-2">
                  No plate yet — generate a free preview or upgrade for a premium render.
                </p>
                <p className="text-[10px] text-ink-dim/30 mt-1">
                   {isPersisted
                     ? "Premium plates are persisted and export with the package."
                     : "Save this shot plan first to generate and persist plates."}
                </p>
              </div>
            )}
          </div>

          {/* ── Editable metadata ── */}
          <div className="previs-shot-fields">
            <div className="previs-field-group">
              <label className="previs-field-label">Action / blocking</label>
              <textarea
                defaultValue={shot.action}
                onBlur={(e) => onFieldChange("script", e.target.value)}
                disabled={!isPersisted}
                className="previs-editable-textarea"
                rows={2}
                aria-label="Shot action and blocking"
              />
            </div>

            {/* Lighting */}
            <div className="previs-field-group">
              <label className="previs-field-label">
                <Sun className="size-3" /> Lighting
              </label>
              <textarea
                defaultValue={shot.lighting ?? ""}
                onBlur={(e) => onFieldChange("lighting", e.target.value)}
                disabled={!isPersisted}
                className="previs-editable-textarea"
                rows={2}
                aria-label="Lighting direction"
              />
            </div>

            {/* Camera */}
            <div className="previs-field-group">
              <label className="previs-field-label">
                <Camera className="size-3" /> Camera / movement
              </label>
              <textarea
                defaultValue={shot.camera ?? ""}
                onBlur={(e) => onFieldChange("camera", e.target.value)}
                disabled={!isPersisted}
                className="previs-editable-textarea"
                rows={2}
                aria-label="Camera and movement"
              />
            </div>

            {/* Model Prompt — editable */}
            <div className="previs-field-group">
              <label className="previs-field-label">
                <FileText className="size-3" /> Model Prompt
              </label>
              <textarea
                defaultValue={shot.prompt}
                onBlur={(e) => onFieldChange("modelPrompt", e.target.value)}
                disabled={!isPersisted}
                className="previs-editable-textarea"
                rows={4}
                placeholder="Engineered model prompt…"
                aria-label="Model prompt"
              />
            </div>

            {/* Negative prompt — editable */}
            <div className="previs-field-group">
              <label className="previs-field-label">Negative Prompt</label>
              <textarea
                defaultValue={shot.negative_prompt}
                onBlur={(e) => onFieldChange("negativePrompt", e.target.value)}
                disabled={!isPersisted}
                className="previs-editable-textarea"
                rows={2}
                placeholder="Negative prompt…"
                aria-label="Negative prompt"
              />
            </div>

            {/* Duration */}
            <div className="previs-field-group previs-field-inline">
              <label className="previs-field-label">Duration (seconds)</label>
              <input
                type="number"
                defaultValue={shot.duration_s}
                min={2}
                max={12}
                step={1}
                onBlur={(e) => onFieldChange("duration", Number(e.target.value))}
                disabled={!isPersisted}
                className="previs-editable-input"
                aria-label="Duration in seconds"
              />
            </div>

            {/* Chain from */}
            <div className="previs-field-group">
              <label className="previs-field-label">Continuity note</label>
              <textarea
                defaultValue={shot.chain_from ?? ""}
                onBlur={(e) => onFieldChange("continuityNote", e.target.value)}
                disabled={!isPersisted}
                className="previs-editable-textarea"
                rows={2}
                placeholder="Eyeline, screen direction, wardrobe or action match…"
                aria-label="Continuity note"
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
