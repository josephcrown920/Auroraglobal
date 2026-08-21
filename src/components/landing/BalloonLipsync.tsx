import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, ArrowRight, Wand2, Upload, Loader2, Mic2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import audioAsset from "@/assets/the-one-hook.mp3.asset.json";
import { transcribeAudio } from "@/lib/hf.functions";
import { AUDIO_ACCEPT } from "@/lib/utils";

const lipsyncDemoVideo = "/videos/face-sings-hero.mp4";

type Cue = { t: number; text: string };

const DEFAULT_LYRICS: Cue[] = [
  { t: 0.0,  text: "Lights up, the stage is calling me tonight" },
  { t: 4.0,  text: "Every note I sing becomes a satellite" },
  { t: 8.0,  text: "Watch the crowd ignite, we're burning bright" },
  { t: 13.0, text: "Turn it up, the whole room feels alive" },
  { t: 17.0, text: "Every face sings when the music arrives" },
  { t: 21.0, text: "Let the rhythm take us higher, higher" },
  { t: 25.0, text: "We were made to shine right through the fire" },
];

export function BalloonLipsync() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const mouthRef = useRef<HTMLDivElement | null>(null);
  const upperLipRef = useRef<HTMLDivElement | null>(null);
  const lowerLipRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);
  const smoothedOpenRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const [lyrics, setLyrics] = useState<Cue[]>(DEFAULT_LYRICS);
  const [audioSrc, setAudioSrc] = useState<string>(audioAsset.url);
  const [transcribing, setTranscribing] = useState(false);
  const transcribeFn = useServerFn(transcribeAudio);

  const applyBars = (values: number[]) => {
    if (!barsRef.current) return;
    const bars = barsRef.current.children;
    for (let i = 0; i < bars.length; i++) {
      const v = values[i % values.length] ?? 0;
      (bars[i] as HTMLElement).style.transform = `scaleY(${0.06 + v * 1})`;
      (bars[i] as HTMLElement).style.opacity = String(0.35 + v * 0.65);
    }
  };

  const loop = () => {
    const audio = audioRef.current;
    const isPlaying = !!(audio && !audio.paused);
    const t = isPlaying
      ? audio!.currentTime
      : (performance.now() - startedAtRef.current) / 1000;
    const breath = (Math.sin(t * 1.3) + 1) / 2;

    let bars: number[];

    const analyser = analyserRef.current;
    const freq = freqDataRef.current;
    const time = timeDataRef.current;
    if (isPlaying && analyser && freq && time) {
      analyser.getByteTimeDomainData(time as Uint8Array<ArrayBuffer>);
      let sumSq = 0;
      for (let i = 0; i < time.length; i++) {
        const v = (time[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / time.length);
      const target = Math.min(1, Math.pow(rms * 3.2, 0.85));
      smoothedOpenRef.current = smoothedOpenRef.current * 0.55 + target * 0.45;

      analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);
      const BAR_COUNT = 56;
      const bucket = Math.floor(freq.length / BAR_COUNT);
      bars = new Array(BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < bucket; j++) sum += freq[i * bucket + j];
        bars[i] = Math.min(1, sum / bucket / 220);
      }
    } else if (isPlaying) {
      const beat = Math.abs(Math.sin(t * 7.2)) * 0.7 + Math.abs(Math.sin(t * 13.1)) * 0.3;
      bars = Array.from({ length: 56 }, (_, i) => {
        const phase = i * 0.35 + t * 6;
        return Math.max(0.05, ((Math.sin(phase) + 1) / 2) * (0.4 + beat * 0.6));
      });
    } else {
      bars = Array.from({ length: 56 }, () => 0.04 + breath * 0.03);
    }

    applyBars(bars);

    if (glowRef.current) {
      const open = smoothedOpenRef.current;
      glowRef.current.style.opacity = String(isPlaying ? 0.5 + open * 0.5 : 0.25);
    }

    if (isPlaying) {
      let idx = 0;
      for (let i = 0; i < lyrics.length; i++) if (t >= lyrics[i].t) idx = i;
      if (idx !== lineIdx) setLineIdx(idx);
    }

    rafRef.current = requestAnimationFrame(loop);
  };

  const ensureAnalyser = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioCtxRef.current && sourceRef.current) return;
    try {
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = src;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      timeDataRef.current = new Uint8Array(analyser.fftSize);
    } catch {
      /* CORS or unsupported — silent fallback */
    }
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        ensureAnalyser();
        if (audioCtxRef.current?.state === "suspended") await audioCtxRef.current.resume();
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
      setLineIdx(0);
    }
  };

  const onUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Audio too large (max 20MB)."); return; }
    const objectUrl = URL.createObjectURL(file);
    setAudioSrc(objectUrl);
    setLineIdx(0);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.load(); }
    setPlaying(false);
    setTranscribing(true);
    try {
      const buf = await file.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < u8.length; i += chunk)
        bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
      const base64 = btoa(bin);
      const res = await transcribeFn({ data: { base64, mime: file.type, timestamps: true } });
      const cues: Cue[] = (res.chunks ?? [])
        .filter((c) => c.text && Number.isFinite(c.start))
        .map((c) => ({ t: Math.max(0, c.start), text: c.text }));
      if (cues.length > 0) {
        setLyrics(cues);
        toast.success(`Transcribed ${cues.length} timed cues`);
      } else if (res.text) {
        const dur = audioRef.current?.duration || 30;
        const lines = res.text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
        const step = dur / Math.max(1, lines.length);
        setLyrics(lines.map((text, i) => ({ t: i * step, text })));
        toast.success("Transcribed — cues auto-spaced");
      } else {
        toast.error("No speech detected");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      toast.error(msg.includes("Unauthorized") ? "Sign in to transcribe your own audio" : msg);
    } finally {
      setTranscribing(false);
    }
  };

  useEffect(() => {
    startedAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Off-screen mouth refs kept alive for audio-reactive loop ── */
  const hiddenRefs = (
    <>
      <div ref={upperLipRef} className="sr-only" aria-hidden />
      <div ref={mouthRef} className="sr-only" aria-hidden />
      <div ref={lowerLipRef} className="sr-only" aria-hidden />
    </>
  );

  return (
    <section className="relative z-10 bg-black overflow-hidden">
      {hiddenRefs}

      {/* ── 1. Full-bleed video stage ─────────────────────────────── */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        {/* Video */}
        <video
          src={lipsyncDemoVideo}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/videos/landing-demo-reel-poster.w720.webp"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Vignette — left + right fade to black */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {/* Top fade */}
        <div className="absolute inset-x-0 top-0 h-20 pointer-events-none bg-gradient-to-b from-black/60 to-transparent" />
        {/* Bottom gradient — blends into the content area */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none bg-gradient-to-t from-black via-black/80 to-transparent" />

        {/* Red ambient glow — reactive to audio */}
        <div
          ref={glowRef}
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none transition-opacity duration-75"
          style={{
            background: "radial-gradient(ellipse at 50% 100%, rgba(139,92,246,0.28) 0%, transparent 70%)",
            opacity: 0.25,
          }}
        />

        {/* Live badge */}
        <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white">
          <span className={`size-1.5 rounded-full bg-[#8b5cf6] ${playing ? "animate-pulse" : ""}`} />
          Live lip-sync · Sync 1.9
        </div>

        {/* Lyrics overlay — bottom third of video */}
        <div className="absolute inset-x-0 bottom-16 px-6 text-center pointer-events-none">
          <p
            key={lineIdx}
            className="mx-auto max-w-lg text-base md:text-xl font-semibold text-white/90 leading-snug animate-fade-in drop-shadow-[0_2px_16px_rgba(0,0,0,1)]"
          >
            {lyrics[lineIdx].text}
          </p>
        </div>

        {/* EQ visualiser — pinned to bottom edge */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-0">
          <div ref={barsRef} className="flex items-end justify-between gap-[2px] h-12">
            {Array.from({ length: 56 }).map((_, i) => (
              <span
                key={i}
                className="block flex-1 rounded-t-sm origin-bottom"
                style={{
                  background: i < 28
                    ? `linear-gradient(to top, #8b5cf6, rgba(139,92,246,0.3))`
                    : `linear-gradient(to top, #8b5cf6, rgba(139,92,246,0.3))`,
                  transform: "scaleY(0.06)",
                  opacity: 0.35,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Content row below video ────────────────────────────── */}
      <div className="relative bg-black border-t border-white/5">
        {/* Subtle red top glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/40 to-transparent" />

        <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 md:py-14 grid md:grid-cols-[1.2fr_1fr] gap-8 md:gap-16 items-start">

          {/* Left — headline + CTA */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#8b5cf6] mb-4">
              Aurora · Lip-sync engine
            </p>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white leading-[0.95] mb-5">
              Every face<br />
              <span className="text-[#8b5cf6]">sings.</span>
            </h2>
            <p className="text-white/55 text-sm md:text-base leading-relaxed max-w-sm mb-8">
              Drop any selfie and any audio — Aurora's Sync 1.9 engine drives
              the mouth, expression, and presence in real time. The demo above
              is a real output. No post, no faking.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                onClick={toggle}
                className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-sm font-bold text-black hover:bg-zinc-100 transition-colors shadow-[0_0_40px_-8px_rgba(255,255,255,0.4)]"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? "Pause hook" : "Play the hook"}
              </button>
              <a
                href="/canvas?template=lipsync-preset"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 hover:border-white/30 transition-colors no-underline"
              >
                <Wand2 className="size-3.5" /> Use template <ArrowRight className="size-3.5 opacity-60" />
              </a>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs text-white/35">
              <Volume2 className="size-3" /> Best with sound on
            </span>
          </div>

          {/* Right — lyrics list + audio upload */}
          <div className="space-y-5">
            {/* Lyrics list */}
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/35 mb-4">
                Lyrics · Aurora demo track
              </p>
              <ol className="space-y-2">
                {lyrics.map((l, i) => (
                  <li
                    key={i}
                    className={`text-sm transition-all duration-150 ${
                      i === lineIdx
                        ? "text-white font-semibold"
                        : "text-white/35"
                    }`}
                  >
                    <span className="text-white/20 tabular-nums mr-2 text-xs">
                      {String(Math.floor(l.t / 60)).padStart(1, "0")}:
                      {String(Math.floor(l.t % 60)).padStart(2, "0")}
                    </span>
                    {l.text}
                  </li>
                ))}
              </ol>
            </div>

            {/* Upload your own track */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Mic2 className="size-3.5 text-[#8b5cf6]" />
                <p className="text-xs font-semibold text-white/60">
                  Try it with your own track
                </p>
              </div>
              <p className="text-[11px] text-white/35 mb-3">
                Upload any MP3 or WAV. Whisper transcribes it and re-times the
                lyric overlay to your song.
              </p>
              <div className="flex flex-wrap gap-2">
                <label
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                    transcribing
                      ? "border-white/8 text-white/25 pointer-events-none"
                      : "border-white/15 text-white/60 hover:border-[#8b5cf6]/50 hover:text-white bg-white/4 hover:bg-[#8b5cf6]/8"
                  }`}
                >
                  {transcribing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {transcribing ? "Transcribing…" : "Upload audio"}
                  <input
                    type="file"
                    accept={AUDIO_ACCEPT}
                    className="hidden"
                    disabled={transcribing}
                    onChange={onUploadAudio}
                  />
                </label>
                {lyrics !== DEFAULT_LYRICS && (
                  <button
                    type="button"
                    onClick={() => {
                      setLyrics(DEFAULT_LYRICS);
                      setAudioSrc(audioAsset.url);
                      setLineIdx(0);
                      if (audioRef.current) audioRef.current.load();
                    }}
                    className="text-xs text-white/30 hover:text-white/70 underline transition-colors"
                  >
                    Reset to demo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioSrc}
        preload="none"
        crossOrigin="anonymous"
        onEnded={() => { setPlaying(false); setLineIdx(0); }}
      />
    </section>
  );
}
