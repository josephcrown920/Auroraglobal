/**
 * CollaboratorsStrip — landing-page logo strip directly above the footer.
 *
 * Shows the six music/creator platforms Aurora plugs into (Spotify, Apple
 * Music, Audiomack, Boomplay, YouTube, TikTok). Every mark links to the
 * Promotion hub (/promotion). Marks are official simple-icons paths
 * (Boomplay drawn from its official app-icon silhouette — it is not in the
 * simple-icons set) rendered as inline SVG: zero network requests.
 *
 * Layout is container-driven (this app has breakpoints disabled): the marks
 * sit in one evenly spaced row while they fit; when the natural width
 * overflows the container they flow as a slow marquee reusing the landing
 * page's `ticker` keyframes (pause on hover/focus, like PhotoStrip). Under
 * prefers-reduced-motion everything is fully static.
 *
 * The eyebrow + subheading are owner-editable via EditableCopy keys; the CTA
 * label is read from site copy directly (a pencil inside a link would
 * navigate) and edited from the Admin landing editor sheet.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EditableCopy } from "@/components/EditableCopy";
import { useSiteCopy } from "@/components/landing/SiteCopyProvider";
import { track } from "@/lib/tracking";

type Mark = {
  id: string;
  name: string;
  /** Official brand colour, applied on hover/focus (rest is quiet monochrome). */
  brand: string;
  path: string;
  fillRule?: "evenodd";
};

const MARKS: Mark[] = [
  {
    id: "spotify",
    name: "Spotify",
    brand: "#1DB954",
    path: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
  },
  {
    id: "apple_music",
    name: "Apple Music",
    brand: "#FA2D48",
    path: "M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z",
  },
  {
    id: "audiomack",
    name: "Audiomack",
    brand: "#FFA200",
    path: "M.331 11.378s.5418-.089.765.1439c.2234.2332.077.7156-.2195.7237-.2965.01-.5705.063-.765-.1439-.1946-.2066-.1424-.6218.2195-.7237m5.881 3.2925c-.0522.01-.1075-.018-.164-.059-.3884-.5413-.5287-2.3923-.707-2.5025-.185-.1144-.8545 1.0255-2.1862.903-.5569-.051-1.1236-.4121-1.4573-.662.031-.4206.0364-1.4027.8659-1.0833.5038.1939 1.3667.7266 2.1245-.23.8378-1.0579 1.2999-.7506 1.577-.5206.2771.23.0925 1.4259.5058 1.0916.4133-.3343 2.082-2.4103 2.082-2.4103s1.292-1.303 1.4898.067c.1979 1.3698 1.0403 2.8877 1.2635 2.8445.2234-.043 2.8223-5.3253 3.1945-5.666.3722-.3409 1.6252-.2961 1.5657.5781-.0596.8742-.1871 6.308-.1871 6.308s-.147 1.5311.0924.7128c.0992-.3392.206-.6453.3392-1.0024.6414-2.0534 1.734-5.5613 2.2784-7.3688.1252-.4325.233-.8037.3166-1.0891l.0001-.0008a3.5925 3.5925 0 0 1 .0973-.3305c.0455-.1532.0763-.2546.0858-.2813.0243-.068.0925-.1192.1884-.157.0962-.061.1995-.064.3165-.067.3021-.027.6907.012 1.0401.1119.1018 0 .2125.037.3172.1118v.0001s.0063 0 .0151.01c.0023 0 .0048 0 .0073.01.0219.015.0573.045.0983.095.0012 0 .0025 0 .004.01.017.021.0341.045.0515.073.1952.2863.315.814.1948 1.7498-.2996 2.3354-.5316 7.1397-.5316 7.1397s-.0461.2298.4353-.782c.0167-.035.0383-.066.058-.098.026-.017.0552-.042.0913-.085.2974-.3546 1.0968-.5629 1.6512-.5586.2336.028.4293.087.5462.1609.2188.333.0897 1.562.0897 1.562-.4612.043-1.3403.2908-1.6519.3366-.3118.046-.7852 2.0699-1.4433 1.8629-.6581-.2069-2.1246-1.1268-2.1246-1.2533 0-.1102.1152-1.4546.1453-1.8016.0022-.024.004-.046.0058-.068a.152.152 0 0 1 .0014-.014l-.0002.0003c.0213-.2733.0023-.3927-.1239-.1199-.1086.2346-.581 1.7359-1.1078 3.3709-.0556.1429-1.0511 3.1558-1.1818 3.5231-.156.4261-.287.7523-.3776.921-.1378.1867-.3234.3036-.5826.2252-.6465-.1954-1.4654-1.0889-1.473-1.3106-.0155-1.2503.0608-7.973-.2423-7.4127-.311.5744-2.73 4.5608-2.73 4.5608-.0405.01-.0705.01-.1062.01-.1712-.019-.4366-.074-.51-.2384-.004-.01-.0094-.018-.0129-.028-.0035-.01-.0075-.022-.0135-.04-.0329-.1097-.0463-.2289-.0753-.3265-.1082-.3652-.2813-.8886-.463-1.421-.2784-.9079-.5654-1.8366-.6127-1.9391-.0923-.2007-.2268-.116-.3475-.0002-.54.458-1.6868 2.4793-2.7225 2.5898",
  },
  {
    id: "boomplay",
    name: "Boomplay",
    brand: "#A3E635",
    // Official app-icon silhouette: lime rounded square with a play cut-out.
    fillRule: "evenodd",
    path: "M8.4 3h7.2a5.4 5.4 0 0 1 5.4 5.4v7.2a5.4 5.4 0 0 1-5.4 5.4H8.4A5.4 5.4 0 0 1 3 15.6V8.4A5.4 5.4 0 0 1 8.4 3zm1.53 4.62v8.76c0 .62.68 1 1.2.65l6.1-4.38a.77.77 0 0 0 0-1.3l-6.1-4.38c-.52-.35-1.2.03-1.2.65z",
  },
  {
    id: "youtube",
    name: "YouTube",
    brand: "#FF0033",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    id: "tiktok",
    name: "TikTok",
    brand: "#FE2C55",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
];

function MarkGlyph({ mark, className = "size-10" }: { mark: Mark; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={mark.path} fillRule={mark.fillRule} clipRule={mark.fillRule} />
    </svg>
  );
}

/** Real, focusable mark link to the Promotion hub. */
function MarkLink({ mark, index, revealed }: { mark: Mark; index: number; revealed: boolean }) {
  return (
    <Link
      to="/promotion"
      aria-label={`${mark.name} — see your stats in Aurora`}
      onClick={() => void track("collaborators_strip_click", { platform: mark.id })}
      style={
        {
          "--brand": mark.brand,
          transitionDelay: revealed ? `${index * 70}ms` : "0ms",
        } as CSSProperties
      }
      className={[
        "inline-flex items-center justify-center rounded-2xl p-3 text-white/35",
        "transition-[color,opacity,transform] duration-500 ease-out",
        "hover:text-[var(--brand)] focus-visible:text-[var(--brand)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]",
        "motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
      ].join(" ")}
    >
      <MarkGlyph mark={mark} />
    </Link>
  );
}

/** Decorative, non-focusable clone used only by the seamless marquee loop. */
function MarkClone({ mark }: { mark: Mark }) {
  return (
    <span className="pointer-events-none inline-flex items-center justify-center p-3 text-white/35">
      <MarkGlyph mark={mark} />
    </span>
  );
}

/** SSR-safe: server assumes reduced motion (fully static markup). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

export function CollaboratorsStrip() {
  const reduced = usePrefersReducedMotion();
  const { copy } = useSiteCopy();
  const cta = copy["landing_collaborators_cta"] ?? "See your stats in one place";

  const sectionRef = useRef<HTMLElement | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Marquee only when the marks' natural width outgrows the container
  // (container-driven — this app has breakpoints disabled).
  useEffect(() => {
    const outer = rowRef.current;
    const measure = measureRef.current;
    if (!outer || !measure) return;
    const update = () => setOverflows(measure.scrollWidth > outer.clientWidth + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  // Staggered reveal as the strip scrolls into view (once).
  useEffect(() => {
    if (reduced) {
      setRevealed(true);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const marquee = overflows && !reduced;
  // Edge fade, applied whenever the row can clip (marquee or overflow scroll).
  const edgeMask: CSSProperties = {
    maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
    WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Platforms Aurora works with"
      className="relative z-10 border-t border-white/5 px-5 pb-14 pt-14"
    >
      <div className="mx-auto max-w-4xl text-center">
        <EditableCopy
          copyKey="landing_collaborators_eyebrow"
          fallback="Collaborators"
          className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]"
        />
        <p className="mt-3 text-sm text-zinc-400">
          <EditableCopy
            copyKey="landing_collaborators_sub"
            fallback="Aurora plugs into the platforms where your music already lives."
          />
        </p>
      </div>

      {/* Marks row — the largest element of the strip. */}
      <div ref={rowRef} className="relative mx-auto mt-9 max-w-4xl">
        {/* Hidden natural-width probe: drives the overflow → marquee decision. */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 flex w-max gap-1 opacity-0"
        >
          {MARKS.map((m) => (
            <MarkClone key={`probe-${m.id}`} mark={m} />
          ))}
        </div>

        {marquee ? (
          <div className="overflow-hidden" style={edgeMask}>
            {/* .collab-marquee (styles.css): reuses the landing `ticker`
                keyframes; pauses on :hover/:focus-within via a stylesheet
                rule — an inline animation shorthand would set play-state at
                inline specificity and defeat any pause class. */}
            <div className="collab-marquee flex w-max gap-1">
              {MARKS.map((m, i) => (
                <MarkLink key={`real-${m.id}`} mark={m} index={i} revealed={revealed} />
              ))}
              {/* Second copy only makes the CSS loop seamless — hidden from
                  screen readers and the tab order, never clickable. */}
              <div aria-hidden="true" className="contents">
                {MARKS.map((m) => (
                  <MarkClone key={`clone-${m.id}`} mark={m} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Always exactly one mark-row tall — including the SSR/first-paint
             frame, when `overflows` is still false — so the post-hydration
             switch to the marquee can never shift layout. `safe center`
             keeps the row centred when it fits and start-aligned + scrollable
             when it doesn't (plain justify-center would clip the left edge
             out of reach in an overflow scroll container). */
          <div
            className="flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar [justify-content:safe_center]"
            style={overflows ? edgeMask : undefined}
          >
            {MARKS.map((m, i) => (
              <MarkLink key={m.id} mark={m} index={i} revealed={revealed} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link
          to="/promotion"
          onClick={() => void track("collaborators_strip_cta_click")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/60 no-underline transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6] rounded-full px-3 py-1.5"
        >
          {cta} <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
