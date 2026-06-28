import { forwardRef, useEffect, useRef, type VideoHTMLAttributes } from "react";

type AutoplayVideoProps = VideoHTMLAttributes<HTMLVideoElement>;

/**
 * SSR-safe autoplaying / muted / looping video.
 *
 * React's handling of the `muted` (and `autoPlay`) attribute on <video>
 * differs between server-rendered HTML and the hydrated client tree, which
 * produces the "a tree hydrated but some attributes ... didn't match" console
 * warning and a possible first-load flicker. To avoid it we never emit
 * `muted` / `autoPlay` as JSX attributes — server and client render identical
 * markup without them — and instead set them imperatively on the element once
 * it mounts, then start playback. Behaviour is unchanged (muted autoplay loop)
 * but the hydration tree matches exactly.
 *
 * Both flags default to `true`. Pass `muted={false}` or `autoPlay={false}` for
 * videos that should not be muted / should not autoplay.
 *
 * All other <video> props (src, poster, loop, playsInline, preload, controls,
 * className, style, onLoadedData, onMouseEnter, ...) are forwarded untouched,
 * and the underlying element ref is forwarded so callers can drive playback
 * manually.
 */
export const AutoplayVideo = forwardRef<HTMLVideoElement, AutoplayVideoProps>(
  function AutoplayVideo({ autoPlay = true, muted = true, ...rest }, forwardedRef) {
    const innerRef = useRef<HTMLVideoElement | null>(null);

    const setRef = (node: HTMLVideoElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      if (muted) {
        el.defaultMuted = true;
        el.muted = true;
      }
      if (autoPlay) {
        el.autoplay = true;
        // play() may reject (autoplay policy / interrupted load) — that's fine,
        // the element keeps its muted+autoplay properties and resumes itself.
        void el.play?.()?.catch?.(() => {});
      }
    }, [autoPlay, muted, rest.src]);

    return <video ref={setRef} suppressHydrationWarning {...rest} />;
  },
);
