import { useEffect, useRef, useState } from "react";
import type { DemoMediaAsset } from "@/lib/demo-assets";
import { cn } from "@/lib/utils";

type DemoMediaProps = {
  asset: DemoMediaAsset;
  className?: string;
  imageClassName?: string;
  autoPlay?: boolean;
  controls?: boolean;
  priority?: boolean;
};

export function DemoMedia({
  asset,
  className,
  imageClassName,
  autoPlay = true,
  controls = false,
  priority = false,
}: DemoMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) return;

    video.muted = autoPlay;
    video.defaultMuted = autoPlay;
    video.loop = autoPlay;
    video.playsInline = true;
    if (!autoPlay) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay, failed]);

  const fallback = (
    <div
      className={cn(
        "grid size-full place-items-end overflow-hidden bg-[radial-gradient(circle_at_20%_12%,rgba(155,92,255,0.5),transparent_42%),linear-gradient(135deg,#121325,#050509)] p-4",
        className,
      )}
      role="img"
      aria-label={`${asset.alt}. Aurora media preview unavailable.`}
    >
      <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur">
        Aurora preview
      </span>
    </div>
  );

  if (failed) {
    if (asset.poster && !posterFailed) {
      return (
        <img
          src={asset.poster}
          alt={asset.alt}
          loading={priority ? "eager" : "lazy"}
          onError={() => setPosterFailed(true)}
          className={cn("size-full object-cover", className, imageClassName)}
        />
      );
    }
    return fallback;
  }

  if (asset.type === "image") {
    return (
      <img
        src={asset.src}
        alt={asset.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className, imageClassName)}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={asset.src}
      poster={asset.poster}
      controls={controls}
      preload={priority ? "metadata" : "none"}
      onError={() => setFailed(true)}
      className={cn("size-full object-cover", className)}
      aria-label={asset.alt}
    />
  );
}