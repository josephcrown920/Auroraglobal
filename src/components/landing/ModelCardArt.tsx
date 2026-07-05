import { Film, ImageIcon, Mic2, Clock } from "lucide-react";
import type { ShowcaseKind } from "@/lib/models";

/** Animated motif rendered inside each model card on the landing page. */
export function ModelCardArt({ kind }: { kind: ShowcaseKind }) {
  if (kind === "video") {
    // Animated waveform bars + film icon
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Film className="size-14 text-white/15" strokeWidth={1.25} />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-center gap-1 h-10">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-white/40"
              style={{
                height: `${30 + ((i * 37) % 60)}%`,
                animation: `mc-bar 1.2s ease-in-out ${i * 0.07}s infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (kind === "image") {
    // Pulsing rings + image icon + scanning line
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <span className="absolute size-24 rounded-full border border-white/15 animate-ping" />
        <span className="absolute size-16 rounded-full border border-white/20" />
        <ImageIcon className="size-12 text-white/30" strokeWidth={1.25} />
        <span
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
          style={{ animation: "mc-scan 2.4s linear infinite" }}
        />
      </div>
    );
  }
  if (kind === "lipsync") {
    // Mouth-like pulsing ellipse + mic icon + waveform
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Mic2 className="size-12 text-white/20" strokeWidth={1.25} />
        <span
          className="absolute size-20 rounded-full bg-emerald-400/10 border border-emerald-300/30"
          style={{ animation: "mc-pulse 1.4s ease-in-out infinite" }}
        />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full bg-emerald-200/70"
              style={{
                height: `${4 + ((i * 53) % 18)}px`,
                animation: `mc-bar 0.9s ease-in-out ${i * 0.05}s infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  // soon
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <Clock className="size-12 text-white/15" strokeWidth={1.25} />
    </div>
  );
}
