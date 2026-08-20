import { useEffect, useRef, useState } from "react";

type Layer = { label: string; src: string };

/**
 * Interactive decomposition demo: the frame peels into stacked planes on
 * hover / when scrolled into view, and each plane can be picked.
 */
export function LayerPeel({ layers, className = "" }: { layers: Layer[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(layers.length - 1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setOpen(es.some((e) => e.isIntersecting)), {
      threshold: 0.4,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className="relative aspect-4/3 w-full [perspective:1400px]"
        onPointerEnter={() => setOpen(true)}
      >
        {layers.map((layer, i) => {
          const depth = layers.length - 1 - i;
          const isActive = i === active;
          return (
            <button
              key={layer.label}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Isolate ${layer.label} layer`}
              className="absolute inset-0 origin-center transition-all duration-700 ease-out"
              style={{
                transform: open
                  ? `translate3d(${depth * -5}%, ${depth * 5}%, 0) rotateY(-16deg) rotateX(4deg) scale(${1 - depth * 0.04})`
                  : "none",
                zIndex: i + 1,
                opacity: open ? (isActive ? 1 : 0.55) : 1,
                filter: open && !isActive ? "saturate(0.5)" : "none",
              }}
            >
              <span className="glow-frame block h-full w-full bg-card">
                <img
                  src={layer.src}
                  alt={`${layer.label} layer`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </span>
              <span
                className="label-chip absolute -bottom-2 left-3 z-10 transition-opacity duration-500"
                style={{ opacity: open ? 1 : 0 }}
              >
                {layer.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {layers.map((layer, i) => (
          <button
            key={layer.label}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-full px-4 py-2 font-[family-name:var(--font-mono-ui)] text-[0.62rem] tracking-[0.2em] uppercase transition-colors ${
              i === active
                ? "btn-aurora"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>
    </div>
  );
}
