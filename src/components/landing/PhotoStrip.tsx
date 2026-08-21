import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/tracking";

/** One card in the scrolling output strip. */
export type PhotoStripItem = {
  src: string;
  alt: string;
  tag: ReactNode;
  /** Which tool "Create something like this" opens. */
  createTo: "/studio" | "/music-video" | "/colors";
  /** Prefilled idea handed to the Studio composer (?q=) for /studio links. */
  prompt?: string;
};

export type PhotoStripRow = {
  items: PhotoStripItem[];
  direction: "left" | "right";
  duration: number;
  className?: string;
};

const CREATE_LABEL: Record<PhotoStripItem["createTo"], string> = {
  "/studio": "Create something like this in Studio",
  "/music-video": "Create something like this in Music Video",
  "/colors": "Create something like this in Colors",
};

type OpenFn = (item: PhotoStripItem, opener: HTMLElement) => void;

const CARD_CLASS =
  "group relative h-52 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-white/5";

function StripPhotoVisual({ item, decorative }: { item: PhotoStripItem; decorative?: boolean }) {
  return (
    <>
      <img
        src={item.src}
        alt={decorative ? "" : item.alt}
        loading="lazy"
        className="h-full w-auto max-w-none object-cover transition-transform duration-700 group-hover:scale-[1.04]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-3 py-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white">{item.tag}</span>
        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-white/60">
          Tap to view <ArrowUpRight className="size-2.5" />
        </span>
      </div>
    </>
  );
}

function StripPhoto({ item, onOpen }: { item: PhotoStripItem; onOpen: OpenFn }) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(item, e.currentTarget)}
      aria-label={`View full image: ${item.alt}`}
      className={`${CARD_CLASS} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]`}
    >
      <StripPhotoVisual item={item} />
    </button>
  );
}

/**
 * Marquee clone card: exists only so the CSS loop is seamless. It stays
 * pointer-clickable but is a plain div — no focusable control may live
 * inside the aria-hidden clone subtree.
 */
function StripPhotoClone({ item, onOpen }: { item: PhotoStripItem; onOpen: OpenFn }) {
  return (
    <div onClick={(e) => onOpen(item, e.currentTarget)} className={CARD_CLASS}>
      <StripPhotoVisual item={item} decorative />
    </div>
  );
}

function StripRow({ row, onOpen }: { row: PhotoStripRow; onOpen: OpenFn }) {
  const animName = row.direction === "left" ? "gallery-scroll-left" : "gallery-scroll-right";
  const setPlayState = (e: React.SyntheticEvent<HTMLDivElement>, state: "paused" | "running") => {
    e.currentTarget.style.animationPlayState = state;
  };
  return (
    <div
      className={`relative overflow-hidden ${row.className ?? ""}`}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className="flex gap-3"
        style={{ width: "max-content", animation: `${animName} ${row.duration}s linear infinite` }}
        onMouseEnter={(e) => setPlayState(e, "paused")}
        onMouseLeave={(e) => setPlayState(e, "running")}
        // Keyboard users: hold the strip still while any card inside has focus,
        // so the focused card can't drift off-screen mid-interaction.
        onFocus={(e) => setPlayState(e, "paused")}
        onBlur={(e) => setPlayState(e, "running")}
      >
        {row.items.map((item, i) => (
          <StripPhoto key={`real-${i}`} item={item} onOpen={onOpen} />
        ))}
        {/* Second copy exists only to make the CSS marquee loop seamless —
            screen readers and the tab order see each output exactly once. */}
        <div aria-hidden="true" className="contents">
          {row.items.map((item, i) => (
            <StripPhotoClone key={`clone-${i}`} item={item} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The landing "output gallery" strip: two auto-scrolling marquee rows of real
 * generations. Every card is tappable — it opens a lightbox with the full
 * image and a "Create something like this" deep link into the right tool.
 * The lightbox is a Radix dialog (focus trap, Esc-to-close, scroll lock);
 * because it is state-controlled with no Radix trigger, focus restoration to
 * the tapped card is done explicitly via onCloseAutoFocus.
 */
export function PhotoStrip({ rows }: { rows: PhotoStripRow[] }) {
  const [active, setActive] = useState<PhotoStripItem | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const open: OpenFn = (item, opener) => {
    openerRef.current = opener;
    setActive(item);
    void track("landing_photo_lightbox_open", { src: item.src });
  };

  return (
    <>
      {rows.map((row) => (
        <StripRow key={row.direction} row={row} onOpen={open} />
      ))}
      <Dialog open={active !== null} onOpenChange={(o) => { if (!o) setActive(null); }}>
        <DialogContent
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            // No Radix trigger exists (state-controlled dialog), so restore
            // focus to the tapped card ourselves. Clone cards are plain divs;
            // focus() is a harmless no-op there (pointer interaction anyway).
            e.preventDefault();
            openerRef.current?.focus();
          }}
          className="w-[calc(100vw-2rem)] max-w-3xl border-white/10 bg-zinc-950/95 p-4 backdrop-blur-sm sm:rounded-2xl"
        >
          {active && (
            <div className="flex flex-col items-center gap-5">
              <DialogTitle className="sr-only">{active.alt}</DialogTitle>
              <img
                src={active.src}
                alt={active.alt}
                className="max-h-[62vh] w-auto max-w-full rounded-xl object-contain ring-1 ring-white/10"
              />
              <div className="flex w-full flex-col items-center gap-4 pb-1 text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">
                  {active.tag} · Made with Aurora
                </span>
                {active.createTo === "/studio" ? (
                  <Link
                    to="/studio"
                    search={{ q: active.prompt }}
                    onClick={() => void track("landing_photo_lightbox_create", { to: active.createTo })}
                    className="inline-flex items-center gap-2 rounded-full bg-[#8b5cf6] px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    {CREATE_LABEL[active.createTo]} <ArrowUpRight className="size-4" />
                  </Link>
                ) : (
                  <Link
                    to={active.createTo}
                    onClick={() => void track("landing_photo_lightbox_create", { to: active.createTo })}
                    className="inline-flex items-center gap-2 rounded-full bg-[#8b5cf6] px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    {CREATE_LABEL[active.createTo]} <ArrowUpRight className="size-4" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
