import { createFileRoute, Link } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LipSyncDemo } from "@/components/landing/LipSyncDemo";
import { Mic2, ArrowRight, Upload, Music2, Wand2, Download, Loader2, Play, Pause, CheckCircle2, X, Zap, Sparkles, Server } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { startLipsync } from "@/lib/lipsync.functions";
import { friendlyGenerationMessage, handleGenerationError } from "@/lib/error-toasts";
import { ExampleChips } from "@/components/onboarding/ExampleChips";
import { LIPSYNC_EXAMPLE_PRESETS } from "@/lib/example-presets";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { hasCompletedFirstGen, hasDismissedTour, isFirstPageVisit, markFirstGenComplete, markPageVisited } from "@/lib/first-run";

export const Route = createFileRoute("/lipsync")({
  component: LipSyncStudioPage,
  head: () => ({
    meta: [
      { title: "Lip Sync Studio — Aurora" },
      { name: "description", content: "Drop a clip and a vocal — Aurora's lip-sync studio matches mouth shapes to the audio frame-perfect." },
      { property: "og:title", content: "Lip Sync Studio — Aurora" },
      { property: "og:description", content: "Frame-perfect AI lip-sync. Bring a clip, a vocal, get a music video." },
    ],
  }),
});

type JobStatus = "idle" | "uploading" | "syncing" | "rendering" | "done" | "error";
type Engine = "sync-v2" | "wav2lip" | "latentsync";

function LipSyncStudioPage() {
  return (
    <div className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <section className="relative z-10 px-6 md:px-12 pt-24 pb-8 animate-fade-in">
        <div className="max-w-5xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary border border-primary/30 bg-primary/10 px-3 py-1 rounded-full">
            <Mic2 className="size-3" /> Lip Sync Studio
          </span>
          <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">
            Make any face <span className="aurora-gradient-text">sing your hook</span>.
          </h1>
          <p className="mt-4 text-white/70 max-w-2xl">
            Drop a performance clip + a vocal. Pick Studio (Sync 1.9) for film-grade
            mouth shapes, or Fast (Wav2Lip) for quick turnarounds. Stage-ready in under a minute.
          </p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Upload, t: "1. Upload clip", d: "Any talking head, 5-30s" },
              { icon: Music2, t: "2. Add vocal", d: "MP3 / WAV stem" },
              { icon: Wand2, t: "3. Run sync", d: "3 Aura · ~45s" },
            ].map((s, i) => (
              <div
                key={s.t}
                className="aurora-glass rounded-2xl p-4 animate-fade-in"
                style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
              >
                <s.icon className="size-4 text-primary" />
                <p className="mt-2 font-semibold text-sm">{s.t}</p>
                <p className="text-xs text-white/60">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LipSyncForm />

      <section className="relative z-10 px-6 md:px-12 pb-12">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-3">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)] px-5 py-2.5 text-sm font-semibold hover-scale"
          >
            Open full studio <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/clips"
            className="inline-flex items-center gap-2 rounded-full aurora-glass px-5 py-2.5 text-sm hover-scale"
          >
            See clip gallery
          </Link>
        </div>
      </section>

      <div className="relative z-10 animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
        <LipSyncDemo />
      </div>
    </div>
  );
}

function LipSyncForm() {
  const { user } = useAuth();
  const runLipsync = useServerFn(startLipsync);

  const [video, setVideo] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>("sync-v2");
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeExampleId, setActiveExampleId] = useState("studio-quality");
  const [showTour, setShowTour] = useState(false);
  const [likelyConsent, setLikelyConsent] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [videoUrl, audioUrl]);

  useEffect(() => {
    if (!hasCompletedFirstGen() && isFirstPageVisit("lipsync")) {
      markPageVisited("lipsync");
      const p = LIPSYNC_EXAMPLE_PRESETS[0];
      if (p.extra?.engine) setEngine(p.extra.engine as Engine);
      setActiveExampleId(p.id);
    }
    if (!hasDismissedTour()) {
      const t = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const onVideo = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/") && !f.type.startsWith("image/")) {
      return toast.error("Please upload a video or image file");
    }
    if (f.size > 100 * 1024 * 1024) return toast.error("Video must be under 100MB");
    setVideo(f);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(f));
    setStatus("idle");
    setResultUrl(null);
  };

  const onAudio = (f: File | null) => {
    if (!f) return;
    // Accept any audio file — browsers report blank MIME for some formats
    // (flac, opus, aiff, m4a on certain platforms). Trust the extension/picker.
    if (f.size > 50 * 1024 * 1024) return toast.error("Audio must be under 50MB");
    setAudio(f);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
    setStatus("idle");
    setResultUrl(null);
  };

  const uploadOne = async (file: File, kind: "video" | "audio"): Promise<string> => {
    const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "mp3");
    const path = `${user!.id}/lipsync/${Date.now()}-${kind}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(`${kind} upload failed: ${error.message}`);
    const { data: signed, error: signErr } = await supabase.storage
      .from("studio")
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) throw new Error(`${kind} URL failed: ${signErr?.message ?? "no url"}`);
    return signed.signedUrl;
  };

  const run = async (opts?: { videoFile: File; audioFile: File }) => {
    const vid = opts?.videoFile ?? video;
    const aud = opts?.audioFile ?? audio;
    if (!vid || !aud) return toast.error("Upload both a clip and a vocal first");
    if (!user) return toast.error("Sign in to run lip sync");

    setStatus("uploading");
    setProgress(5);
    setResultUrl(null);

    // Coarse progress animator so the bar feels alive while the server runs.
    let p = 5;
    const ticker = setInterval(() => {
      p = Math.min(95, p + Math.random() * 4 + 1);
      setProgress(p);
      setStatus(p < 30 ? "uploading" : p < 70 ? "syncing" : "rendering");
    }, 600);

    try {
      const [vUrl, aUrl] = await Promise.all([
        uploadOne(vid, "video"),
        uploadOne(aud, "audio"),
      ]);
      setStatus("syncing");
      const res = await runLipsync({ data: { videoUrl: vUrl, audioUrl: aUrl, engine } });
      clearInterval(ticker);
      if (res.status === "done" && res.resultUrl) {
        setProgress(100);
        setStatus("done");
        setResultUrl(res.resultUrl);
        markFirstGenComplete();
        toast.success("Lip-sync rendered.");
      } else {
        setStatus("error");
        const reason = res.status === "error" ? (res as { error?: string }).error ?? "Render failed" : "Render failed";
        toast.error(friendlyGenerationMessage(reason));
      }
    } catch (e) {
      clearInterval(ticker);
      setStatus("error");
      handleGenerationError(e);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setVideo(null); setAudio(null);
    setVideoUrl(null); setAudioUrl(null);
    setStatus("idle"); setProgress(0); setPlaying(false); setResultUrl(null);
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `synced-${(video?.name ?? "clip").replace(/\.[^.]+$/, "")}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const stageLabel: Record<JobStatus, string> = {
    idle: "Ready",
    uploading: "Uploading assets…",
    syncing: "Aligning phonemes to mouth shapes…",
    rendering: "Rendering final clip…",
    done: "Sync complete",
    error: "Something went wrong",
  };

  const busy = status === "uploading" || status === "syncing" || status === "rendering";

  return (
    <section className="relative z-10 px-6 md:px-12 pb-12">
      <div className="max-w-5xl mx-auto rounded-3xl aurora-glass p-6 md:p-8 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="aurora-kicker">New job</p>
            <h2 className="text-xl md:text-2xl font-semibold mt-1">Run a lip sync</h2>
          </div>
          {(video || audio) && (
            <button onClick={reset} className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1">
              <X className="size-3" /> Reset
            </button>
          )}
        </div>

        {!user && (
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            You need to <Link to="/auth" className="underline font-semibold">sign in</Link> to upload clips and run a render.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DropSlot label="Performance source" hint="MP4 / MOV / JPG / PNG · up to 100MB" icon={Upload} accept="video/*,image/*" file={video} onFile={onVideo} previewUrl={videoUrl} kind="video" />
          <DropSlot label="Vocal track" hint="Any audio · up to 50MB" icon={Music2} accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.aiff" file={audio} onFile={onAudio} previewUrl={audioUrl} kind="audio" />
        </div>

        <WelcomeTour show={showTour} onDismiss={() => setShowTour(false)} />
        <ExampleChips
          presets={LIPSYNC_EXAMPLE_PRESETS}
          activeId={activeExampleId}
          onSelect={(preset) => {
            if (preset.extra?.engine) setEngine(preset.extra.engine as Engine);
            setActiveExampleId(preset.id);
          }}
          onGenerate={() => {
            if (video && audio) {
              void run();
              return;
            }
            const preset = LIPSYNC_EXAMPLE_PRESETS.find((p) => p.id === activeExampleId);
            const demoVideo = typeof preset?.extra?.sampleVideoUrl === "string" ? preset.extra.sampleVideoUrl : null;
            const demoAudio = typeof preset?.extra?.sampleAudioUrl === "string" ? preset.extra.sampleAudioUrl : null;
            if (demoVideo && demoAudio) {
              toast.loading("Loading demo media…", { id: "lipsync-demo" });
              Promise.all([fetch(demoVideo), fetch(demoAudio)])
                .then(([vr, ar]) => Promise.all([vr.blob(), ar.blob()]))
                .then(([vb, ab]) => {
                  toast.dismiss("lipsync-demo");
                  void run({
                    videoFile: new File([vb], "demo-video.mp4", { type: "video/mp4" }),
                    audioFile: new File([ab], "demo-audio.mp3", { type: "audio/mpeg" }),
                  });
                })
                .catch(() => {
                  toast.dismiss("lipsync-demo");
                  toast.error("Failed to fetch demo media");
                });
            } else {
              void run();
            }
          }}
          label="Pick a mode:"
          className="mt-5"
        />

        {/* Engine toggle */}
        <div className="mt-4">
          <p className="aurora-kicker mb-2">Engine</p>
          <div className="grid grid-cols-3 gap-2 rounded-full aurora-glass p-1">
            {([
              { id: "sync-v2", label: "Studio", sub: "Sync 1.9 · film-grade", icon: Sparkles },
              { id: "wav2lip", label: "Fast", sub: "Wav2Lip · cheaper", icon: Zap },
              { id: "latentsync", label: "Self-hosted", sub: "LatentSync · your GPU", icon: Server },
            ] as const).map(o => (
              <button
                key={o.id}
                onClick={() => setEngine(o.id)}
                disabled={busy}
                className={`flex items-center gap-2 justify-center rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  engine === o.id ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]" : "text-white/70 hover:text-white"
                }`}
              >
                <o.icon className="size-3.5" />
                <span>{o.label}</span>
                <span className="hidden sm:inline text-[10px] opacity-70">· {o.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Voice & likeness consent — required before generating */}
        <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={likelyConsent}
            onChange={(e) => setLikelyConsent(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-primary)] flex-shrink-0"
          />
          <span className="text-xs text-white/70 leading-relaxed">
            I confirm I have the legal right to use this voice and likeness for AI generation.{" "}
            <Link
              to="/legal/$slug"
              params={{ slug: "ai-policy" }}
              className="underline text-white/60 hover:text-white"
              target="_blank"
            >
              AI &amp; Content Policy
            </Link>
          </span>
        </label>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={run}
            disabled={!video || !audio || busy || !user || !likelyConsent}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)] px-6 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover-scale"
          >
            {busy ? (
              <><Loader2 className="size-4 animate-spin" /> {stageLabel[status]}</>
            ) : status === "done" ? (
              <><CheckCircle2 className="size-4" /> Run again</>
            ) : (
              <><Wand2 className="size-4" /> Run lip sync</>
            )}
          </button>
          <p className="text-xs text-white/50">
            {engine === "sync-v2" ? "3 Aura · ~45s" : engine === "wav2lip" ? "2 Aura · ~25s" : "Runs on your GPU worker"}
          </p>
        </div>

        {status !== "idle" && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-white/60 mb-1.5">
              <span>{stageLabel[status]}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[image:var(--gradient-hero)] transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === "done" && resultUrl && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-300" />
                <p className="text-sm font-semibold text-emerald-100">Synced render</p>
              </div>
              <button onClick={download} className="inline-flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover-scale">
                <Download className="size-3.5" /> Download
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
              <video
                ref={videoRef}
                src={resultUrl}
                playsInline
                loop
                className="w-full max-h-[60vh] object-contain"
                onEnded={() => setPlaying(false)}
              />
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group"
                aria-label={playing ? "Pause" : "Play"}
              >
                <span className="size-14 rounded-full bg-white/90 text-black flex items-center justify-center opacity-90 group-hover:scale-110 transition-transform">
                  {playing ? <Pause className="size-6" /> : <Play className="size-6 ml-0.5" />}
                </span>
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/50">Rendered with {engine === "sync-v2" ? "Sync 1.9 (Studio)" : engine === "wav2lip" ? "Wav2Lip (Fast)" : "LatentSync (self-hosted)"}.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function DropSlot({
  label, hint, icon: Icon, accept, file, onFile, previewUrl, kind,
}: {
  label: string;
  hint: string;
  icon: typeof Upload;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  previewUrl: string | null;
  kind: "video" | "audio";
}) {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`relative block rounded-2xl border-2 border-dashed p-4 cursor-pointer transition-colors ${
        drag ? "border-primary bg-primary/10" : file ? "border-emerald-400/40 bg-emerald-500/5" : "border-white/15 bg-white/5 hover:bg-white/10"
      }`}
    >
      <input type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="text-[11px] text-white/50 mt-0.5">{hint}</p>

      {file && previewUrl ? (
        <div className="mt-3 rounded-lg overflow-hidden bg-black/40">
          {kind === "video" ? (
            <AutoplayVideo src={previewUrl} className="w-full max-h-48 object-contain" controls autoPlay={false} />
          ) : (
            <audio src={previewUrl} className="w-full" controls />
          )}
          <p className="text-[11px] text-white/60 px-2 py-1.5 truncate">{file.name}</p>
        </div>
      ) : (
        <div className="mt-3 h-32 rounded-lg border border-white/10 bg-black/20 flex flex-col items-center justify-center text-white/40">
          <Upload className="size-5 mb-1" />
          <p className="text-[11px]">Click or drop file</p>
        </div>
      )}
    </label>
  );
}
