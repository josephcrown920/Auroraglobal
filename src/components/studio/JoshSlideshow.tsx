import { useEffect, useState } from "react";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import josh3 from "@/assets/josh/slideshow/josh-slide-03.jpeg.asset.json";
import josh4 from "@/assets/josh/slideshow/josh-slide-04.jpeg.asset.json";
import josh6 from "@/assets/josh/slideshow/josh-slide-06.png.asset.json";
import josh7 from "@/assets/josh/slideshow/josh-slide-07.png.asset.json";
import josh8 from "@/assets/josh/slideshow/josh-slide-08.png.asset.json";
import josh10 from "@/assets/josh/slideshow/josh-slide-10.png.asset.json";
import joshBlueOrange from "@/assets/josh/josh-blue-orange.jpg.asset.json";

// New hot-pink mic session photos (sent to replace old errored versions)
const PINK_MIC_PORTRAIT = "/josh/josh-pink-mic-portrait.jpg";
// (Mirror session slide removed — that photo now lives exclusively in the
// Get Ready With Me landing section so no image repeats across the page.)
const RAW_SHOTS = [
  { url: joshBlueOrange.url, caption: "Blue × orange studio · color wash" },
  { url: josh3.url, caption: "Blue close-up · live mic portrait" },
  { url: josh4.url, caption: "Electric cobalt crop · signature frames" },
  { url: josh6.url, caption: "Cobalt tech portrait · blue visor" },
  { url: josh7.url, caption: "Crimson portrait · red mirror shield" },
  { url: josh8.url, caption: "Studio red · puffer vest · 4:44" },
  { url: josh10.url, caption: "Leather look · editorial red backdrop" },
  { url: PINK_MIC_PORTRAIT, caption: "Hot-pink side profile · suspended mic" },
];

// Lead the rotation with the last four photos of the set, then the rest.
const SHOTS = [...RAW_SHOTS.slice(-4), ...RAW_SHOTS.slice(0, -4)];

export function JoshSlideshow() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SHOTS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="relative rounded-3xl overflow-hidden aurora-hairline aurora-elevated bg-black/40">
      <div className="relative aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden">
        {SHOTS.map((s, idx) => (
          <ResponsiveImage
            key={s.url}
            src={s.url}
            sizes="100vw"
            alt={s.caption}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0"}`}
            loading={idx === 0 ? "eager" : "lazy"}
            draggable={false}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />
        <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/90 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
          <span className="size-1.5 rounded-full bg-white animate-pulse" /> Image generation · NBA Josh
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-orange-200/80 mb-1">Now showing</p>
          <p className="text-white text-base md:text-xl font-semibold drop-shadow">{SHOTS[i].caption}</p>
          <div className="mt-3 flex gap-1.5">
            {SHOTS.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
