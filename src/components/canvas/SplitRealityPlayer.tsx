import { useState } from "react";
import { Download, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SideResult = {
  id: string;
  url: string;
  variant: "left" | "right";
  label?: string;
};

type Props = {
  left: SideResult;
  right: SideResult;
  className?: string;
};

function downloadResult(url: string, label: string) {
  fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `split-reality-${label}.jpg`;
      a.click();
    })
    .catch(() => {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    });
}

/**
 * Split Reality Player — shows two side-by-side generated images with a
 * draggable comparison divider and individual download buttons.
 */
export function SplitRealityPlayer({ left, right, className }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-1 rounded-2xl overflow-hidden", className)}>
        {[
          { result: left,  side: "Left",  borderClass: "rounded-l-2xl" },
          { result: right, side: "Right", borderClass: "rounded-r-2xl" },
        ].map(({ result, side, borderClass }) => (
          <div key={result.variant} className={cn("relative group bg-black overflow-hidden", borderClass)}>
            <img
              src={result.url}
              alt={`${side} side — ${result.label ?? result.variant}`}
              className="w-full h-full object-cover aspect-square block"
              loading="lazy"
            />

            {/* Label pill */}
            <div className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
              {result.label ?? side}
            </div>

            {/* Action buttons */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setLightboxUrl(result.url)}
                className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="size-3.5" />
              </button>
              <button
                onClick={() => downloadResult(result.url, `${side.toLowerCase()}-${result.id.slice(0, 8)}`)}
                className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
                title="Download"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="size-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
