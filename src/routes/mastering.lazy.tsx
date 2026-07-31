import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Music2, Upload, Loader2, CheckCircle2, Download,
  AlertCircle, Sliders, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createLazyFileRoute("/mastering")({
  component: MasteringPage,
});

type MasterStatus = "idle" | "uploading" | "submitted" | "processing" | "completed" | "failed";

type MasterJob = {
  id: string;
  filename: string;
  status: MasterStatus;
  downloadUrl?: string;
  error?: string;
  submittedAt: number;
};

const LOUDNESS_OPTIONS = [
  { value: "low",    label: "Low",    desc: "Streaming-optimised, true to source" },
  { value: "medium", label: "Medium", desc: "Balanced, works everywhere" },
  { value: "high",   label: "High",   desc: "Loud and punchy, club-ready" },
] as const;

const STYLE_OPTIONS = [
  { value: "balanced", label: "Balanced", desc: "Clean, works across genres" },
  { value: "warm",     label: "Warm",     desc: "Analogue richness, softer highs" },
  { value: "open",     label: "Open",     desc: "Wide, airy, detailed top end" },
  { value: "punchy",   label: "Punchy",   desc: "Forward mids, tight low end" },
  { value: "clean",    label: "Clean",    desc: "Transparent, high clarity" },
] as const;

type Loudness = typeof LOUDNESS_OPTIONS[number]["value"];
type Style = typeof STYLE_OPTIONS[number]["value"];
type Format = "mp3" | "wav" | "flac";

function MasteringPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loudness, setLoudness] = useState<Loudness>("medium");
  const [style, setStyle] = useState<Style>("balanced");
  const [format, setFormat] = useState<Format>("mp3");
  const [status, setStatus] = useState<MasterStatus>("idle");
  const [job, setJob] = useState<MasterJob | null>(null);
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const allowed = ["audio/mpeg", "audio/wav", "audio/aiff", "audio/x-aiff", "audio/flac", "audio/ogg"];
    if (!allowed.includes(picked.type) && !picked.name.match(/\.(mp3|wav|aiff|flac|ogg)$/i)) {
      toast.error("Please upload an audio file (MP3, WAV, AIFF, FLAC)");
      return;
    }
    if (picked.size > 200 * 1024 * 1024) {
      toast.error("File must be under 200MB");
      return;
    }
    setFile(picked);
  }

  async function handleSubmit() {
    if (!file) return toast.error("Choose an audio file first");
    setStatus("uploading");

    try {
      // Upload to Aurora object storage first, get a public URL
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "mastering");

      const uploadRes = await fetch("/api/audio/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Upload failed: ${err}`);
      }

      const { url: inputUri } = (await uploadRes.json()) as { url: string };

      // Submit to LANDR
      setStatus("submitted");
      const masterRes = await fetch("/api/audio/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputUri, loudness, style, format }),
      });

      if (!masterRes.ok) {
        const err = await masterRes.text();
        throw new Error(`Mastering failed: ${err}`);
      }

      const masterData = (await masterRes.json()) as { id: string };

      const newJob: MasterJob = {
        id: masterData.id,
        filename: file.name,
        status: "processing",
        submittedAt: Date.now(),
      };
      setJob(newJob);
      setStatus("processing");
      toast.success("Submitted to LANDR AI Mastering — this takes 1-3 minutes");

      // Poll for status every 8 seconds
      const timer = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/audio/master/${masterData.id}/status`);
          if (!statusRes.ok) return;
          const statusData = (await statusRes.json()) as {
            status: string;
            downloadUrl?: string;
            errorMessage?: string;
          };

          if (statusData.status === "completed") {
            clearInterval(timer);
            setPollTimer(null);
            setJob((j) => j ? { ...j, status: "completed", downloadUrl: statusData.downloadUrl } : j);
            setStatus("completed");
            toast.success("✓ Mastering complete! Your file is ready to download.");
          } else if (statusData.status === "failed" || statusData.status === "expired") {
            clearInterval(timer);
            setPollTimer(null);
            setJob((j) => j ? { ...j, status: "failed", error: statusData.errorMessage } : j);
            setStatus("failed");
            toast.error(`Mastering failed: ${statusData.errorMessage ?? "Unknown error"}`);
          }
        } catch {
          // Polling errors are transient — keep trying
        }
      }, 8000);

      setPollTimer(timer);

    } catch (err) {
      setStatus("failed");
      setJob((j) => j ? { ...j, status: "failed", error: (err as Error).message } : j);
      toast.error((err as Error).message);
    }
  }

  function reset() {
    if (pollTimer) clearInterval(pollTimer);
    setPollTimer(null);
    setFile(null);
    setStatus("idle");
    setJob(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isBusy = status === "uploading" || status === "submitted" || status === "processing";

  return (
    <div className="aurora-page-shell">
      <div className="relative z-10 mx-auto max-w-2xl px-5 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
          <Music2 className="h-3 w-3 text-primary" /> AI Mastering · Powered by LANDR
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Master your <span className="aurora-gradient-text">track</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a mix. LANDR's AI masters it in minutes — broadcast-ready, streaming-optimised.
        </p>

        {/* Upload zone */}
        <div
          onClick={() => !isBusy && fileInputRef.current?.click()}
          className={`mt-7 glass rounded-xl p-8 text-center transition-all cursor-pointer border-2 border-dashed ${
            file ? "border-primary/60 bg-primary/5" : "border-border/40 hover:border-border/80"
          } ${isBusy ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.aiff,.flac"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <Music2 className="h-8 w-8 text-primary" />
              <div className="text-sm font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="text-[11px] text-muted-foreground hover:text-foreground mt-1"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <div className="text-sm font-medium">Drop your mix here</div>
                <div className="text-xs text-muted-foreground mt-1">MP3, WAV, AIFF, FLAC · up to 200MB</div>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="mt-6 grid gap-5">
          {/* Loudness */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Loudness</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {LOUDNESS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLoudness(opt.value)}
                  disabled={isBusy}
                  className={`glass rounded-lg p-3 text-left transition-all border ${
                    loudness === opt.value
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/40 hover:border-border/80"
                  }`}
                >
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Music2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Master style</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStyle(opt.value)}
                  disabled={isBusy}
                  className={`glass rounded-lg p-2.5 text-left transition-all border ${
                    style === opt.value
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/40 hover:border-border/80"
                  }`}
                >
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              Output format
            </div>
            <div className="flex gap-2">
              {(["mp3", "wav", "flac"] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  disabled={isBusy}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border uppercase transition-colors ${
                    format === f
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Button
            size="lg"
            className="w-full h-12 text-sm font-semibold gap-2"
            onClick={handleSubmit}
            disabled={!file || isBusy}
          >
            {isBusy ? (
              <><Loader2 className="h-4 w-4 animate-spin" />
                {status === "uploading" ? "Uploading…" : status === "submitted" ? "Submitting to LANDR…" : "Mastering…"}
              </>
            ) : (
              <><Zap className="h-4 w-4" /> Master with LANDR AI</>
            )}
          </Button>
        </div>

        {/* Job status */}
        {job && (
          <div className={`mt-6 glass rounded-xl p-5 border ${
            job.status === "completed" ? "border-green-500/30" :
            job.status === "failed" ? "border-destructive/30" :
            "border-primary/20"
          }`}>
            <div className="flex items-center gap-3">
              {job.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
              ) : job.status === "failed" ? (
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              ) : (
                <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{job.filename}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {job.status === "completed" ? "Mastering complete" :
                   job.status === "failed" ? (job.error ?? "Mastering failed") :
                   "Mastering in progress — this takes 1-3 minutes…"}
                </div>
              </div>
              {job.status === "completed" && job.downloadUrl && (
                <a
                  href={job.downloadUrl}
                  download
                  className="flex-shrink-0"
                >
                  <Button size="sm" className="gap-1.5 h-8">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </a>
              )}
            </div>
            {job.status === "failed" && (
              <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={reset}>
                Try again
              </Button>
            )}
          </div>
        )}

        {/* Info note */}
        <p className="mt-6 text-center text-[10px] text-muted-foreground/60">
          Mastering powered by LANDR AI. Files are processed securely and never shared.
        </p>
      </div>
    </div>
  );
}
