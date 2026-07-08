import a1 from "@/assets/josh/josh-pink-sideprofile.png.asset.json";
import a2 from "@/assets/josh/josh-pink-jersey.png.asset.json";
import a3 from "@/assets/josh/josh-moody-mic.jpg.asset.json";
import a4 from "@/assets/josh/josh-stage-shades.jpg.asset.json";
import a5 from "@/assets/josh/josh-yellow-mic.jpg.asset.json";

// NOTE: josh-jxst-portrait, josh-studio-mic (chair/broadcast) and josh-blue-fullbody removed at user request.
const SHOTS = [
  { src: a1.url, label: "Hot-pink cyc · side profile", color: "Hot magenta + vintage mic" },
  { src: a2.url, label: "Hot-pink cyc · jersey portrait", color: "Hot magenta + chrome mic" },
  { src: "/josh/josh-pink-mic-portrait.jpg", label: "Pink studio · mic portrait", color: "Hot pink + chrome mic" },
  { src: a3.url, label: "Moody blue stage · close-up", color: "Indigo wash + red rim" },
  { src: a4.url, label: "Stage spotlight · red shades", color: "Cool stage + warm rim" },
  { src: "/josh/josh-red-girl-silhouette.jpg", label: "Crimson red · silhouette", color: "Deep crimson + shadow contrast" },
  { src: a5.url, label: "Yellow cyclorama · vintage mic", color: "Cadmium yellow" },
  { src: "/josh/josh-concert-performance.webp", label: "Live concert · stage lights", color: "Performance energy" },
];

export function ColorsShotsGallery() {
  return (
    <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-4 md:p-5 space-y-4">
      <style>{`
        @keyframes colors-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.015); }
        }
        @keyframes colors-shimmer {
          0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
          40% { opacity: 0.45; }
          100% { transform: translateX(220%) skewX(-20deg); opacity: 0; }
        }
        .shot-tile { animation: colors-float 6.5s ease-in-out infinite; will-change: transform; }
        .shot-tile:hover .shot-img { transform: scale(1.08); filter: saturate(1.15); }
        .shot-shimmer { animation: colors-shimmer 4.8s ease-in-out infinite; }
      `}</style>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base md:text-lg font-semibold tracking-tight">Real Colors shoots</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Reference looks generated with Aurora. Tap any to use as a scene/lighting reference.</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{SHOTS.length} looks</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {SHOTS.map((s, i) => (
          <figure
            key={s.src}
            className="shot-tile group relative overflow-hidden rounded-xl border border-border bg-background/40 aspect-[3/4]"
            style={{ animationDelay: `${(i % 6) * 0.45}s` }}
          >
            <img
              src={s.src}
              alt={s.label}
              loading="lazy"
              className="shot-img absolute inset-0 size-full object-cover transition-all duration-700 ease-out"
            />
            {/* Sweeping highlight */}
            <span
              aria-hidden
              className="shot-shimmer absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none mix-blend-overlay"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
              <figcaption className="text-[10px] font-medium text-white">{s.label}</figcaption>
              <div className="text-[9px] text-white/70">{s.color}</div>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
