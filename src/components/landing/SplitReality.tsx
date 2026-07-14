import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { AutoplayVideo } from "@/components/landing/AutoplayVideo";
// URL from public/videos/split-reality-demo.mp4.asset.json
const splitVideo = "/__l5e/assets-v1/82946f74-8322-4f16-ab37-164aec7fecfb/split-reality-demo.mp4";

/**
 * Split-screen "two lives" demo. The same AI-generated clip plays under
 * both sides — the slider reveals two graded looks of the same render
 * (ultra-real concert vs cinematic golden hour). Auto-sweeps until the
 * user interacts.
 */
export function SplitReality() {
  const ref = useRef<HTMLDivElement | null>(null);
  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const rightVideoRef = useRef<HTMLVideoElement | null>(null);
  const [pos, setPos] = useState(50);
  const [auto, setAuto] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Keep both videos in lockstep so the split looks like one continuous take.
  useEffect(() => {
    const sync = () => {
      const a = leftVideoRef.current;
      const b = rightVideoRef.current;
      if (!a || !b) return;
      if (Math.abs(a.currentTime - b.currentTime) > 0.08) b.currentTime = a.currentTime;
    };
    const id = setInterval(sync, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    let t = 0;
    const loop = () => {
      t += 0.012;
      setPos(50 + Math.sin(t) * 38);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(2, Math.min(98, p)));
  };

  return (
    <section className="relative z-10 px-6 md:px-12 pb-24 animate-fade-in">
      <div className="flex items-end justify-between mb-5 animate-fade-in" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
        <div>
          <p className="aurora-kicker mb-2">Split reality · Football × Basketball</p>
          <h2 className="text-2xl md:text-3xl font-semibold">One athlete. Two sports. Same shot.</h2>
          <p className="text-muted-foreground text-sm mt-1">Drag the slider — hyper-real footballer on one side, NBA hooper on the other. Same render, same man.</p>
        </div>
        <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-primary border border-primary/30 bg-primary/10 px-3 py-1 rounded-full">
          <Sparkles className="size-3" /> Live AI render
        </span>
      </div>

      <div
        ref={ref}
        className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden border border-border select-none cursor-ew-resize group bg-black animate-scale-in"
        style={{ animationDelay: "160ms", animationFillMode: "both" }}
        onMouseMove={(e) => { setAuto(false); move(e.clientX); }}
        onTouchMove={(e) => { setAuto(false); move(e.touches[0].clientX); }}
        onMouseLeave={() => setAuto(true)}
      >


        {/* Right side — Cinematic Golden Hour grade */}
        <AutoplayVideo
          ref={rightVideoRef}
          src={splitVideo}
          loop
          playsInline
          preload="auto"
          onLoadedData={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "saturate(1.05) contrast(1.05) sepia(0.18) hue-rotate(-8deg) brightness(1.02)" }}
        />
        <span className="absolute bottom-3 right-3 text-[13px] uppercase tracking-wider px-2 py-1 rounded bg-black/60 text-amber-300 border border-amber-400/30 z-20">
          Cinematic · Golden Hour
        </span>

        {/* Left side — Ultra-real Concert Wash grade, clipped by pos */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <AutoplayVideo
            ref={leftVideoRef}
            src={splitVideo}
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "saturate(1.35) contrast(1.15) hue-rotate(15deg) brightness(0.95)" }}
          />
          <span className="absolute bottom-3 left-3 text-[13px] uppercase tracking-wider px-2 py-1 rounded bg-black/60 text-emerald-300 border border-emerald-400/30">
            Ultra-real · Concert Wash
          </span>
        </div>

        {/* Divider */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/80 shadow-[0_0_24px_rgba(255,255,255,0.6)] z-10 pointer-events-none"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-9 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold shadow-xl">
            ⇆
          </div>
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30">
            <Loader2 className="size-6 text-primary animate-spin" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-center px-6 z-30">
            <AlertTriangle className="size-6 text-amber-300" />
            <p className="text-sm text-foreground/80">Couldn't load the split-reality clip. <button onClick={() => { setStatus("loading"); leftVideoRef.current?.load(); rightVideoRef.current?.load(); }} className="underline">Retry</button></p>
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

