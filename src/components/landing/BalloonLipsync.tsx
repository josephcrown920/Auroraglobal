import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Sparkles, ArrowRight, Wand2, Upload, Loader2, Mic2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import audioAsset from "@/assets/the-one-hook.mp3.asset.json";
import { transcribeAudio } from "@/lib/hf.functions";
import { AUDIO_ACCEPT } from "@/lib/utils";

// Balloon-head lip-sync demo video (local public path — reliable across environments)
const lipsyncDemoVideo = "/videos/balloon-lipsync-demo.mp4";

/**
 * Every Face Sings — drives a clear lip-sync mouth, upper/lower lips and
 * an EQ visualizer entirely from a synthetic syllable rhythm tied to the
 * audio.currentTime. Optional: upload your own audio and Whisper will
 * generate timed lyric cues that sync to playback.
 */

type Cue = { t: number; text: string };

const DEFAULT_LYRICS: Cue[] = [
  { t: 0.0,  text: "To the feds, I just duck and roll, or slide and jump, like the C.O.D." },
  { t: 4.0,  text: "They've got loaded guns, and I ain't on the run, but the feds, they gon' see you," },
  { t: 8.0,  text: "act like they lost their memory or somethin', talkin' 'bout, ain't you the one?" },
  { t: 13.0, text: "Ay, ay, and I'm still the one, I'm finna rule my gun, ay," },
  { t: 17.0, text: "I never fuck no thot, thot, thot, thot, thot." },
  { t: 21.0, text: "Let's have some fun." },
  { t: 22.0, text: "No, Diddy, come chill with me, get litty." },
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

  // Real audio analyser — drives the mouth from actual song amplitude.
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

  const applyMouth = (open: number) => {
    if (mouthRef.current) {
      mouthRef.current.style.transform = `translate(-50%, -50%) scaleY(${0.22 + open * 1.4}) scaleX(${0.9 + open * 0.35})`;
      mouthRef.current.style.opacity = String(0.85 + open * 0.15);
    }
    if (upperLipRef.current) {
      upperLipRef.current.style.transform = `translate(-50%, ${-open * 9}px)`;
    }
    if (lowerLipRef.current) {
      lowerLipRef.current.style.transform = `translate(-50%, ${open * 9}px)`;
    }
    if (glowRef.current) {
      glowRef.current.style.opacity = String(0.35 + open * 0.55);
      glowRef.current.style.filter = `blur(${22 + open * 30}px)`;
    }
  };

  const applyBars = (values: number[]) => {
    if (!barsRef.current) return;
    const bars = barsRef.current.children;
    for (let i = 0; i < bars.length; i++) {
      const v = values[i % values.length] ?? 0;
      (bars[i] as HTMLElement).style.transform = `scaleY(${0.08 + v * 1})`;
      (bars[i] as HTMLElement).style.opacity = String(0.4 + v * 0.6);
    }
  };

  const loop = () => {
    const audio = audioRef.current;
    const isPlaying = !!(audio && !audio.paused);
    const t = isPlaying
      ? audio!.currentTime
      : (performance.now() - startedAtRef.current) / 1000;
    const breath = (Math.sin(t * 1.3) + 1) / 2;

    let open = 0.08 + breath * 0.06;
    let bars: number[];

    const analyser = analyserRef.current;
    const freq = freqDataRef.current;
    const time = timeDataRef.current;
    if (isPlaying && analyser && freq && time) {
      // Real song amplitude → mouth open.
      analyser.getByteTimeDomainData(time as Uint8Array<ArrayBuffer>);
      let sumSq = 0;
      for (let i = 0; i < time.length; i++) {
        const v = (time[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / time.length);
      const target = Math.min(1, Math.pow(rms * 3.2, 0.85));
      smoothedOpenRef.current = smoothedOpenRef.current * 0.55 + target * 0.45;
      open = smoothedOpenRef.current;

      analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);
      const BAR_COUNT = 48;
      const bucket = Math.floor(freq.length / BAR_COUNT);
      bars = new Array(BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < bucket; j++) sum += freq[i * bucket + j];
        bars[i] = Math.min(1, sum / bucket / 220);
      }
    } else if (isPlaying) {
      const beat = Math.abs(Math.sin(t * 7.2)) * 0.7 + Math.abs(Math.sin(t * 13.1)) * 0.3;
      open = Math.min(1, beat * (0.55 + breath * 0.45));
      bars = Array.from({ length: 48 }, (_, i) => {
        const phase = i * 0.35 + t * 6;
        return Math.max(0.05, ((Math.sin(phase) + 1) / 2) * (0.4 + breath * 0.6));
      });
    } else {
      bars = Array.from({ length: 48 }, () => 0.06 + breath * 0.04);
    }

    applyMouth(open);
    applyBars(bars);

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
      // CORS-tainted audio or unsupported — silent fallback to synth rhythm.
    }
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        ensureAnalyser();
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
        await audio.play();
        setPlaying(true);
      } catch {
        // Autoplay blocked — still animate so users see the lip-sync.
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
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Audio is too large (max 20MB).");
      return;
    }

    // Swap in the user's audio immediately so they can play it.
    const objectUrl = URL.createObjectURL(file);
    setAudioSrc(objectUrl);
    setLineIdx(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
    setPlaying(false);

    setTranscribing(true);
    try {
      const buf = await file.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < u8.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
      }
      const base64 = btoa(bin);
      const res = await transcribeFn({ data: { base64, mime: file.type, timestamps: true } });
      const cues: Cue[] = (res.chunks ?? [])
        .filter((c) => c.text && Number.isFinite(c.start))
        .map((c) => ({ t: Math.max(0, c.start), text: c.text }));
      if (cues.length > 0) {
        setLyrics(cues);
        toast.success(`Transcribed ${cues.length} timed cues`);
      } else if (res.text) {
        // Fallback: split the transcript evenly across the audio duration.
        const dur = audioRef.current?.duration || 30;
        const lines = res.text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
        const step = dur / Math.max(1, lines.length);
        setLyrics(lines.map((text, i) => ({ t: i * step, text })));
        toast.success("Transcribed — cues auto-spaced");
      } else {
        toast.error("No speech detected in audio");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      toast.error(msg.includes("Unauthorized") ? "Sign in to transcribe your own audio" : msg);
    } finally {
      setTranscribing(false);
    }
  };

  // Always-on animation loop so idle breathing + bars are alive on mount.
  useEffect(() => {
    startedAtRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: RAF animation loop must start once and run until unmount; re-running on dep changes would restart the animation
  }, []);

  return (
    <section
      className="relative z-10 mx-4 md:mx-12 my-12 rounded-[32px] overflow-hidden border border-border animate-fade-in"
      style={{ background: "radial-gradient(circle at 30% 0%, #1a0d3a 0%, #0a0717 60%, #050410 100%)" }}
    >
      <div className="relative grid md:grid-cols-[1.1fr_1fr] gap-0">
        {/* Visual stage */}
        <div className="relative aspect-[4/5] md:aspect-auto md:min-h-[560px] overflow-hidden">
          <video
            src={lipsyncDemoVideo}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
          />
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              background:
                "radial-gradient(circle at 40% 45%, rgba(42,15,77,0.35) 0%, rgba(22,10,48,0.55) 45%, rgba(7,4,26,0.75) 100%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70 pointer-events-none" />

          {/* Ambient edge glow — subtle, doesn't cover the real video */}
          <div
            ref={glowRef}
            className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(236,72,153,0.35), transparent)",
              opacity: 0.35,
            }}
          />
          {/* Off-screen refs kept mounted so the audio-reactive loop has stable
              targets without rendering the old CSS mouth/lips over the real video. */}
          <div ref={upperLipRef} className="sr-only" aria-hidden />
          <div ref={mouthRef} className="sr-only" aria-hidden />
          <div ref={lowerLipRef} className="sr-only" aria-hidden />

          {/* Lyrics overlay */}
          <div className="absolute inset-x-0 bottom-20 px-6 text-center pointer-events-none">
            <p className="text-[10px] uppercase tracking-[0.3em] text-pink-200/80 mb-2">
              Now playing · lyrics
            </p>
            <p
              key={lineIdx}
              className="mx-auto max-w-md text-lg md:text-2xl font-bold text-white leading-snug animate-fade-in drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
            >
              {lyrics[lineIdx].text}
            </p>
          </div>

          {/* EQ bars */}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
            <div ref={barsRef} className="flex items-end justify-between gap-[3px] h-14">
              {Array.from({ length: 48 }).map((_, i) => (
                <span
                  key={i}
                  className="block flex-1 rounded-sm origin-bottom"
                  style={{
                    background: "linear-gradient(to top, #ec4899, #a855f7, #22d3ee)",
                    transform: "scaleY(0.08)",
                    opacity: 0.4,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Live tag */}
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/90 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
            <span className="size-1.5 rounded-full bg-white animate-pulse" /> Live lip-sync
          </div>
        </div>

        {/* Side panel */}
        <div className="relative p-6 md:p-10 flex flex-col justify-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pink-300/40 bg-pink-500/10 text-pink-200 text-[11px] uppercase tracking-widest w-fit">
            <Sparkles className="size-3" /> Sync 1.9 · Audio reactive
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight text-white leading-[1.05]">
            Every face{" "}
            <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
              sings
            </span>
            .
          </h2>
          <p className="mt-3 text-white/65 text-base md:text-lg">
            Press play — the mouth, lips and EQ bars sing the hook of an unreleased NBA Josh
            track. Same engine as Aurora's Sync 1.9 lip-sync model — drop any selfie, get a
            singing performance back.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={toggle}
              className="inline-flex items-center gap-2 rounded-full bg-pink-400 px-5 py-3 text-sm font-bold text-pink-950 hover:opacity-95 shadow-[0_0_30px_-5px_rgba(236,72,153,0.7)]"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {playing ? "Pause hook" : "Play the hook"}
            </button>
            <a
              href="/canvas?template=lipsync-preset"
              className="inline-flex items-center gap-2 rounded-full border border-pink-300/40 bg-white/5 px-4 py-2.5 text-sm font-medium text-pink-100 hover:bg-white/10 no-underline"
            >
              <Wand2 className="size-3.5" /> Use this template <ArrowRight className="size-3.5" />
            </a>
            <a
              href="/canvas?template=lipsync-blank"
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white no-underline"
            >
              or start blank
            </a>
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/55">
            <Volume2 className="size-3.5" /> Best with sound on
          </span>

          {/* Upload your own audio → Whisper timed cues */}
          <div className="mt-6 rounded-2xl border border-pink-300/20 bg-pink-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className="size-4 text-pink-300" />
              <p className="text-xs uppercase tracking-[0.2em] text-pink-200/80">
                Your audio → Whisper timed cues
              </p>
            </div>
            <p className="text-xs text-white/55 mb-3">
              Drop an MP3/WAV. We transcribe it with Whisper and re-time the lyric overlay to your track.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium cursor-pointer border ${transcribing ? "border-white/10 bg-white/5 text-white/40" : "border-pink-300/40 bg-white/5 text-pink-100 hover:bg-white/10"}`}>
                {transcribing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
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
                  className="text-xs text-white/55 hover:text-white underline"
                >
                  Reset to demo hook
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-black/40 backdrop-blur p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-3">Lyrics</p>
            <ol className="space-y-2">
              {lyrics.map((l, i) => (
                <li
                  key={i}
                  className={`text-sm md:text-base transition-colors ${
                    i === lineIdx ? "text-white font-semibold" : "text-white/45"
                  }`}
                >
                  <span className="text-white/30 tabular-nums mr-2">
                    {String(Math.floor(l.t / 60)).padStart(1, "0")}:
                    {String(Math.floor(l.t % 60)).padStart(2, "0")}
                  </span>
                  {l.text}
                </li>
              ))}
            </ol>
          </div>

          <audio
            ref={audioRef}
            src={audioSrc}
            preload="none"
            crossOrigin="anonymous"
            onEnded={() => {
              setPlaying(false);
              setLineIdx(0);
            }}
          />
        </div>
      </div>
    </section>
  );
}
