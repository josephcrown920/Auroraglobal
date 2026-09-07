import { useState } from "react";
import { Loader2, Clapperboard, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FORMAT_OPTIONS = ["16:9", "9:16", "2.39:1", "1:1"] as const;
type Format = (typeof FORMAT_OPTIONS)[number];

const STARTERS = [
  { label: "Fashion campaign", idea: "A high-fashion editorial short for a luxury streetwear brand. Muted palette, golden hour, close faces, minimal movement. References: Wong Kar-wai, Luca Guadagnino." },
  { label: "Brand launch", idea: "A 60-second product launch film for a premium AI hardware device. Clinical whites, precision macro shots, reveal arc from detail to hero. Deakins light treatment." },
  { label: "Music visual", idea: "A music video for a moody electronic artist. Neon rain, wet asphalt, long lenses, shallow depth. Moving camera, solitary subject. Denis Villeneuve meets Gaspar Noe." },
  { label: "Short doc", idea: "A documentary short following a master ceramicist in their workshop. Warm practical light, medium lenses, patient timing. Cinematic Minimal motion language." },
];

type BriefFormProps = {
  onAnalyze: (idea: string, format: string) => void;
  loading: boolean;
};

export function BriefForm({ onAnalyze, loading }: BriefFormProps) {
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<Format>("16:9");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = idea.trim();
    if (!trimmed || trimmed.length < 10) return;
    onAnalyze(trimmed, format);
  }

  function applyStarter(text: string) {
    setIdea(text);
  }

  return (
    <div className="previs-brief-form">
      {/* Eyebrow */}
      <div className="previs-brief-eyebrow">
        <span className="previs-badge">Previs Workspace</span>
        <p className="previs-brief-sub">
          Describe your concept — Aurora will build a directed shot plan with free visual plates for each frame.
        </p>
      </div>

      {/* Starter chips */}
      <div className="previs-starters" role="list" aria-label="Quick-start concepts">
        {STARTERS.map((s) => (
          <button
            key={s.label}
            type="button"
            role="listitem"
            onClick={() => applyStarter(s.idea)}
            className={cn(
              "previs-starter-chip",
              idea === s.idea && "previs-starter-chip--active",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="previs-composer">
        <div className="previs-composer-field">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your concept — subject, setting, mood, references, platform…"
            className="previs-composer-textarea"
            disabled={loading}
            maxLength={3000}
            rows={5}
            aria-label="Creative brief"
          />
        </div>

        <div className="previs-composer-controls">
          {/* Format selector */}
          <label className="previs-format-select" aria-label="Aspect ratio">
            <span className="previs-format-label">Format</span>
            <div className="previs-format-control">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
                disabled={loading}
                className="previs-native-select"
                aria-label="Select format"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <ChevronDown className="size-3 pointer-events-none" />
            </div>
          </label>

          <span className="previs-char-count">{idea.length}/3000</span>

          <button
            type="submit"
            disabled={loading || idea.trim().length < 10}
            className="previs-analyze-btn"
            data-testid="button-analyze"
          >
            {loading ? (
              <><Loader2 className="size-4 animate-spin" /> Analyzing…</>
            ) : (
              <><Clapperboard className="size-4" /> Build Shot Plan</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
