import { useRef } from "react";
import { useRevealOnScroll } from "@/hooks/use-reveal-on-scroll";

export type ExampleItem = {
  src: string;
  type?: "image" | "video";
  label?: string;
  caption?: string;
  aspect?: "portrait" | "landscape" | "square" | "vertical";
};

type Props = {
  items: ExampleItem[];
  title?: string;
  subtitle?: string;
  columns?: 2 | 3 | 4;
  className?: string;
};

/**
 * Shared "inspiration" block used on every tool page.
 * Images get Ken Burns (scale-in) animation. Videos autoplay silently.
 * All cards have scroll-triggered fade-up entrance + violet glow on hover.
 */
export function ExampleOutputGrid({
  items,
  title,
  subtitle,
  columns = 3,
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useRevealOnScroll(ref);

  const colClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <div ref={ref} className={`space-y-4 ${className}`}>
      <style>{`
        @keyframes ken-burns {
          0% { transform: scale(1.0); }
          100% { transform: scale(1.06); }
        }
        .eg-img { animation: ken-burns 5s ease-in-out infinite alternate; will-change: transform; }
        .eg-card { transition: transform 300ms ease, box-shadow 300ms ease; }
        .eg-card:hover { transform: translateY(-4px); box-shadow: 0 0 0 1.5px oklch(0.66 0.26 295/0.65), 0 16px 40px oklch(0.70 0.22 295/0.30); }
        /* reveal-card: starts hidden, animates in when data-revealed is set */
        .reveal-card { opacity: 0; transform: translateY(20px); transition: opacity 400ms ease-out, transform 400ms ease-out; }
        .reveal-card[data-revealed="true"] { opacity: 1; transform: translateY(0); }
      `}</style>

      {(title || subtitle) && (
        <div className="reveal-card">
          {title && <h2 className="text-base md:text-lg font-semibold tracking-tight">{title}</h2>}
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}

      <div className={`grid ${colClass} gap-2.5`}>
        {items.map((item, i) => {
          const aspectClass =
            item.aspect === "landscape"
              ? "aspect-video"
              : item.aspect === "square"
                ? "aspect-square"
                : item.aspect === "vertical"
                  ? "aspect-[9/16]"
                  : "aspect-[3/4]";
          return (
            <figure
              key={item.src + i}
              className={`reveal-card eg-card group relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 ${aspectClass}`}
              style={{ transitionDelay: `${(i % 6) * 55}ms` }}
            >
              {item.type === "video" ? (
                <video
                  src={item.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <img
                  src={item.src}
                  alt={item.label ?? "Example output"}
                  loading="lazy"
                  className="eg-img absolute inset-0 size-full object-cover"
                />
              )}
              {(item.label || item.caption) && (
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {item.label && (
                    <p className="text-[11px] font-medium text-white leading-tight">{item.label}</p>
                  )}
                  {item.caption && (
                    <p className="text-[10px] text-white/65 mt-0.5">{item.caption}</p>
                  )}
                </div>
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
