import { useEffect, useRef, useState } from "react";
import { Play, Pause, Wand2, Loader2, AlertTriangle } from "lucide-react";
const lipsyncVideo = { url: "/videos/lipsync-user-demo.mp4" };

const AUDIO_SRC = "/audio/the-one-hook2.mp3";

/**
 * Landing lip-sync demo. The AI-generated talking-head clip plays in
 * lockstep with the demo audio so users can see + hear what Aurora
 * lip-sync produces.
 */
export function LipSyncDemo() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("ready");
  const [showNativeControls, setShowNativeControls] = useState(false);
  const [bars, setBars] = useState<number[]>(() => Array(28).fill(0.2));

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      const v = videoRef.current;
      if (v) v.pause();
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setBars((prev) => prev.map((_, i) => {
        const base = playing ? 0.35 + Math.random() * 0.65 : 0.15 + Math.random() * 0.1;
        const wave = playing ? Math.abs(Math.sin(Date.now() / 180 + i * 0.6)) : 0.2;
        return Math.min(1, base * 0.6 + wave * 0.4);
      }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const toggle = async () => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a || !v) return;
    if (playing) {
      a.pause();
      v.pause();
      setPlaying(false);
    } else {
      try {
        v.currentTime = 0;
        await Promise.all([v.play(), a.play()]);
        setPlaying(true);
      } catch {
        // Autoplay/gesture policy blocked us — fall back to native controls.
        setShowNativeControls(true);
      }
    }
  };

  return (
    <section className="relative z-10 px-6 md:px-12 pb-16">
      <div className="grid lg:grid-cols-12 gap-6 items-center max-w-6xl mx-auto">
        <div className="lg:col-span-5 space-y-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-200/90 border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 rounded-full">
            <Wand2 className="size-3" /> Sync 1.9 · Lip-sync
          </span>
          <h2 className="text-xl md:text-3xl font-semibold leading-tight">
            Make any portrait
            <span className="block bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
              sing your song.
            </span>
          </h2>
          <p className="text-white/65 text-sm max-w-md">
            Drop a photo and an audio clip. Aurora generates frame-accurate lip-sync in 8+ languages.
          </p>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 shadow-xl shadow-emerald-500/30"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Pause demo" : "Play the demo"}
          </button>
        </div>


        <div className="lg:col-span-7">
          <div className="relative aspect-[4/5] sm:aspect-video max-h-[420px] mx-auto rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-950 via-black to-teal-950">
            <video
              ref={videoRef}
              src={lipsyncVideo.url}
              muted
              playsInline
              loop
              autoPlay
              preload="auto"
              controls={showNativeControls}
              onLoadedData={() => setStatus("ready")}
              onError={() => setStatus("error")}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Song title overlay */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-10">
              <div className="rounded-xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-2 max-w-[80%]">
                <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/90" style={{ fontFamily: "'Unbounded', sans-serif" }}>Now playing</p>
                <p className="text-white text-lg md:text-2xl leading-none mt-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>
                  THE ONE
                </p>
                <p className="text-white/70 text-[11px] mt-1" style={{ fontFamily: "'Unbounded', sans-serif" }}>
                  NBA Josh × R3negad3
                </p>
              </div>
            </div>
            {status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <Loader2 className="size-6 text-emerald-300 animate-spin" />
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center px-6">
                <AlertTriangle className="size-6 text-amber-300" />
                <p className="text-sm text-white/80">Demo video unavailable. <button onClick={() => { setStatus("loading"); videoRef.current?.load(); }} className="underline">Retry</button></p>
              </div>
            )}
            {/* mouth pulse glow */}
            <div
              className="pointer-events-none absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/30 blur-2xl transition-all duration-100"
              style={{ width: `${60 + (bars[10] ?? 0.3) * 120}px`, height: `${30 + (bars[10] ?? 0.3) * 60}px`, opacity: playing ? 0.9 : 0.4 }}
            />
            {/* waveform */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
              <div className="flex items-end justify-center gap-[3px] h-10">
                {bars.map((v, i) => (
                  <span
                    key={i}
                    className="w-[4px] rounded-full bg-gradient-to-t from-emerald-400 to-teal-200"
                    style={{ height: `${10 + v * 100}%`, opacity: playing ? 1 : 0.5 }}
                  />
                ))}
              </div>
              <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
            <audio ref={audioRef} src={AUDIO_SRC} preload="auto" />
          </div>
        </div>
      </div>
    </section>
  );
}


