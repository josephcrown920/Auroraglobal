import { useEffect, useRef, useState } from "react";
import { X, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_CLIPS = [
  {
    id: "new-single-reel",
    label: "New Single Announcement Reel",
    src: "/videos/landing-demo-reel.mp4",
    poster: "/videos/landing-demo-reel-poster.w720.webp",
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function LandingDemoModal({ open, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (open) {
      setPlaying(false);
      setTimeout(() => {
        videoRef.current?.play().catch(() => {});
        setPlaying(true);
      }, 150);
    } else {
      videoRef.current?.pause();
      setPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const clip = DEMO_CLIPS[0];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.8)] transition-all duration-300",
          open ? "scale-100 translate-y-0" : "scale-95 translate-y-4",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 size-8 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-colors"
          aria-label="Close demo"
        >
          <X className="size-4" />
        </button>

        <div className="relative aspect-[9/16] bg-black">
          <video
            ref={videoRef}
            src={clip.src}
            poster={clip.poster}
            className="w-full h-full object-cover"
            loop
            muted
            playsInline
            preload="metadata"
          />
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Play className="size-6 text-white fill-white ml-1" />
              </div>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white font-semibold text-sm">{clip.label}</p>
            <p className="text-white/60 text-xs mt-0.5">Generated with Aurora Studio</p>
          </div>
        </div>
      </div>
    </div>
  );
}
