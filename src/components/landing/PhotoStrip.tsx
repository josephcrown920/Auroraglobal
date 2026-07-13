/**
 * PhotoStrip — infinite CSS-animated dual-row photo scroll.
 * Row 1 scrolls left; Row 2 scrolls right (reversed).
 * Pure CSS — no JavaScript, no IntersectionObserver.
 * Uses the attached gallery images + existing Josh generated2 assets.
 */

const ROW1 = [
  { src: "/gallery/violet-haze.webp",                    alt: "Violet Haze – NBA Josh magazine cover" },
  { src: "/josh/generated2/viral-03-cover-reveal.webp",  alt: "Cover reveal" },
  { src: "/gallery/josh-blue-portrait.png",              alt: "NBA Josh – blue light portrait" },
  { src: "/josh/generated2/viral-09-vertical-poster.webp",alt: "Vertical poster" },
  { src: "/gallery/glitter-bath.jpg",                    alt: "Glitter bath editorial" },
  { src: "/gallery/ichroma-cover.webp",                  alt: "ICHROMA magazine cover" },
  { src: "/josh/generated2/viral-10-performance.webp",   alt: "Performance" },
  { src: "/gallery/josh-pink-mic.png",                   alt: "NBA Josh – pink mic portrait" },
  { src: "/josh/generated2/colors-royal-blue.webp",      alt: "Royal blue Colors Studio" },
  { src: "/gallery/josh-balloon.jpg",                    alt: "Josh balloon art" },
  { src: "/josh/generated2/viral-07-lipsync-clip.webp",  alt: "Lip-sync clip" },
  { src: "/gallery/josh-neon-tech.png",                  alt: "Josh neon tech" },
];

const ROW2 = [
  { src: "/gallery/josh-meme-fire.png",                  alt: "My Life – viral meme" },
  { src: "/gallery/coca-cola-kling.jpg",                 alt: "Coca-Cola Kling AI product video" },
  { src: "/josh/generated2/viral-05-color-grade.webp",   alt: "Color grade" },
  { src: "/gallery/rapper-grid.jpg",                     alt: "Rapper editorial grid" },
  { src: "/josh/generated2/viral-12-single-cover.webp",  alt: "Single cover" },
  { src: "/gallery/ski-selfie.jpg",                      alt: "Ski selfie lifestyle" },
  { src: "/josh/generated2/viral-08-album-teaser.webp",  alt: "Album teaser" },
  { src: "/gallery/blonde-selfie.png",                   alt: "Makeup selfie" },
  { src: "/josh/generated2/colors-sunset-orange.webp",   alt: "Sunset orange Colors Studio" },
  { src: "/josh/generated2/viral-01-lyric-hook.webp",    alt: "Lyric hook" },
  { src: "/josh/generated2/viral-11-captioned-hook.webp",alt: "Captioned hook" },
  { src: "/josh/generated2/colors-neon-green.webp",      alt: "Neon green Colors Studio" },
];

interface StripRowProps {
  items: typeof ROW1;
  reverse?: boolean;
  speed?: string;
  cardH?: string;
}

function StripRow({ items, reverse = false, speed = "40s", cardH = "h-52" }: StripRowProps) {
  const doubled = [...items, ...items];
  const anim = reverse ? "photo-strip-rtl" : "photo-strip-ltr";
  return (
    <div className="relative flex overflow-hidden">
      <div
        className={`flex gap-3 shrink-0`}
        style={{
          animation: `${anim} ${speed} linear infinite`,
          willChange: "transform",
        }}
      >
        {doubled.map((img, i) => (
          <div
            key={i}
            className={`relative shrink-0 w-36 ${cardH} rounded-xl overflow-hidden border border-white/10 bg-black/40`}
            style={{ animationDelay: `${i * 0.03}s` }}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes photo-strip-ltr {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes photo-strip-rtl {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export function PhotoStrip() {
  return (
    <section className="relative z-10 py-6 overflow-hidden">
      {/* Edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 z-10"
        style={{ background: "linear-gradient(to right, #070612, transparent)" }} />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 z-10"
        style={{ background: "linear-gradient(to left, #070612, transparent)" }} />

      <div className="flex flex-col gap-3">
        <StripRow items={ROW1} reverse={false} speed="52s" cardH="h-52" />
        <StripRow items={ROW2} reverse={true}  speed="44s" cardH="h-44" />
      </div>
    </section>
  );
}
