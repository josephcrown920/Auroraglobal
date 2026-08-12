import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Mic, Play, Pause, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { generateSpeech, SPEECH_VOICE_OPTIONS } from "@/lib/speech.functions";
import { ExampleChips } from "@/components/onboarding/ExampleChips";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { SPEECH_EXAMPLE_PRESETS } from "@/lib/example-presets";
import {
  hasCompletedFirstGen,
  hasDismissedTour,
  isFirstPageVisit,
  markFirstGenComplete,
  markPageVisited,
} from "@/lib/first-run";
import { handleGenerationError, friendlyGenerationMessage } from "@/lib/error-toasts";
import { saveAssetToDisk } from "@/lib/save";
import { useGenerationProgress } from "@/hooks/use-generation-progress";
import { GenerationProgress } from "@/components/ui/GenerationProgress";
import { GenerationErrorCard } from "@/components/ui/GenerationErrorCard";

export const Route = createLazyFileRoute("/speech")({ component: SpeechPage });

function SpeechPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState<string>(SPEECH_VOICE_OPTIONS[0].id);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeExampleId, setActiveExampleId] = useState<string | undefined>(undefined);
  const [showTour, setShowTour] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const genFn = useServerFn(generateSpeech);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    if (hasCompletedFirstGen()) return;
    if (!hasDismissedTour()) setShowTour(true);
    if (isFirstPageVisit("speech")) {
      markPageVisited("speech");
      const first = SPEECH_EXAMPLE_PRESETS[0];
      if (first?.prompt) setScript(first.prompt);
      setActiveExampleId(first?.id ?? null);
    }
  }, [user]);

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { text: script.trim(), voiceId } }),
    onSuccess: (out) => {
      markFirstGenComplete();
      setResultUrl(out.url);
      setPlaying(false);
      toast.success("Voiceover ready");
    },
    onError: (e) => handleGenerationError(e),
  });

  const progress = useGenerationProgress({
    isPending: genMut.isPending,
    isError: genMut.isError,
    isSuccess: genMut.isSuccess,
    estimatedMs: 20_000,
    persistKey: "aurora.progress.speech",
    labels: {
      queued: "Warming up the voice model…",
      processing: "Synthesising speech…",
      finalizing: "Almost ready…",
      done: "Voiceover ready",
    },
  });

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  if (loading || !user) return null;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <WelcomeTour show={showTour} onDismiss={() => setShowTour(false)} />

      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pr-10 py-4 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span
            className="size-8 rounded-xl flex items-center justify-center shadow-[var(--shadow-glow-soft)]"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Mic className="size-4 text-primary-foreground" />
          </span>
          Speech Studio
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/lipsync" className="text-muted-foreground hover:text-foreground">Lip Sync</Link>
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">Full Studio</Link>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto p-5 md:p-10 space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Voice your <span className="aurora-gradient-text">vision</span>.
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Type a script and Aurora generates a studio-quality voiceover in seconds.
          </p>
        </div>

        <section className="aurora-glass rounded-2xl p-5 space-y-4">
          <ExampleChips
            presets={SPEECH_EXAMPLE_PRESETS}
            activeId={activeExampleId}
            onSelect={(preset) => {
              if (preset.prompt) setScript(preset.prompt);
              setActiveExampleId(preset.id);
            }}
            onGenerate={() => {
              if (!script.trim()) return toast.info("Add a script first");
              genMut.mutate();
            }}
            label="Quick start:"
          />

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Script
            </label>
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Write your voiceover script here…"
              rows={5}
              className="resize-none bg-background/60"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">{script.length}/2000</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Voice
            </label>
            <div className="flex flex-wrap gap-2">
              {SPEECH_VOICE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoiceId(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    voiceId === v.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                  title={v.description}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending || !script.trim()}
            className="w-full aurora-btn-primary"
          >
            {genMut.isPending
              ? <><Loader2 className="size-4 mr-2 animate-spin" /> Generating…</>
              : <><Mic className="size-4 mr-2" /> Generate voiceover · 20 Aura</>}
          </Button>

          <GenerationProgress
            visible={progress.isActive}
            progress={progress.progress}
            label={progress.label}
          />

          <GenerationErrorCard
            visible={genMut.isError}
            error={friendlyGenerationMessage(genMut.error)}
            onRetry={() => genMut.mutate()}
            retryLabel="Try again"
          />
        </section>

        {resultUrl && (
          <section className="aurora-glass rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Result</h2>
            <audio
              ref={audioRef}
              src={resultUrl}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                onClick={togglePlay}
                className="size-12 rounded-full border-primary/40"
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              </Button>
              <div className="flex-1">
                <p className="text-sm font-medium">Voiceover ready</p>
                <p className="text-xs text-muted-foreground truncate">{script.slice(0, 60)}{script.length > 60 ? "…" : ""}</p>
              </div>
              <button
                onClick={() => saveAssetToDisk(resultUrl, "aurora-voiceover.mp3")}
                className="text-muted-foreground hover:text-foreground"
                title="Download"
                type="button"
              >
                <Download className="size-4" />
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
