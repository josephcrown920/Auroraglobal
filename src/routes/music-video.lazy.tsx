import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2,
  Wand2,
  ArrowLeft,
  Music2,
  Upload,
  Film,
  Zap,
  Download,
  RefreshCw,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listGenerations } from "@/lib/studio.functions";
import { deleteGeneration } from "@/lib/gallery.functions";
import { usePerformanceShotJobFn, useVideoFromImageJobFn } from "@/lib/use-job-polling";
import { generateLyricVideoFromSong } from "@/lib/captions.functions";
import { handleGenerationError } from "@/lib/error-toasts";
import { markFirstGenComplete } from "@/lib/first-run";
import { computeCost } from "@/lib/pricing";
import { VIDEO_MODEL_LIST } from "@/lib/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadSlot } from "@/components/studio/UploadSlot";
import {
  MUSIC_VIDEO_STYLES,
  MUSIC_VIDEO_MODES,
  buildMusicVideoPrompt,
  buildEvenLyricSegments,
  LOCATION_SUGGESTIONS,
  SUBJECT_SUGGESTIONS,
  type MusicVideoMode,
  type MusicVideoStyle,
} from "@/lib/music-video-prompts";
import { useBeatDetect } from "@/hooks/use-beat-detect";
import { cn, AUDIO_ACCEPT } from "@/lib/utils";
import { EditableCopy } from "@/components/EditableCopy";
import { useSiteCopyValue } from "@/components/landing/SiteCopyProvider";

export const Route = createLazyFileRoute("/music-video")({ component: MusicVideoPage });

const IMAGE_COST = 1;

function MusicVideoPage() {
  const { user, loading } = useAuth();
  const musicVideoHeaderTitle = useSiteCopyValue("music_video_header_title") ?? "Music Video Studio";
  const musicVideoGenerateCta = useSiteCopyValue("music_video_generate_cta") ?? "Generate";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [style, setStyle] = useState<MusicVideoStyle>("trap");
  const [mode, setMode] = useState<MusicVideoMode>("text-to-video");
  const [location, setLocation] = useState(LOCATION_SUGGESTIONS[0]);
  const [subject, setSubject] = useState(SUBJECT_SUGGESTIONS[0]);
  const [prompt, setPrompt] = useState(() =>
    buildMusicVideoPrompt("text-to-video", "trap", LOCATION_SUGGESTIONS[0], SUBJECT_SUGGESTIONS[0]),
  );
  const [image, setImage] = useState<string | null>(null);
  const [videoModel, setVideoModel] = useState(VIDEO_MODEL_LIST[0].value);

  const beatFileRef = useRef<HTMLInputElement>(null);
  const [beatFileName, setBeatFileName] = useState<string | null>(null);
  const { state: beatState, analyze: analyzeBeat, reset: resetBeat } = useBeatDetect();

  // Lyric Video mode — song upload + pasted lyrics, timed by an even split
  // across the song's duration (no ASR alignment; see buildEvenLyricSegments).
  const [lyricAudioUrl, setLyricAudioUrl] = useState<string | null>(null);
  const [lyricAudioDuration, setLyricAudioDuration] = useState<number | null>(null);
  const [lyricsText, setLyricsText] = useState("");

  const currentMode = MUSIC_VIDEO_MODES.find((m) => m.key === mode)!;
  const isLyricVideo = mode === "lyric-style";

  const videoCost = useMemo(
    () =>
      computeCost({ features: ["video"], model: videoModel, durationSeconds: 5, resolution: "720p" })
        .total,
    [videoModel],
  );

  const lyricVideoCost = useMemo(() => computeCost({ features: ["lyric_video"] }).total, []);

  const displayCost = isLyricVideo ? lyricVideoCost : currentMode.needsImage ? videoCost : IMAGE_COST;

  const lyricLines = useMemo(
    () => lyricsText.split("\n").map((l) => l.trim()).filter(Boolean),
    [lyricsText],
  );
  const lyricSegments = useMemo(
    () => (lyricAudioDuration ? buildEvenLyricSegments(lyricAudioDuration, lyricLines) : []),
    [lyricAudioDuration, lyricLines],
  );

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  useEffect(() => {
    setPrompt(buildMusicVideoPrompt(mode, style, location, subject));
  }, [mode, style, location, subject]);

  // Read the uploaded song's duration client-side once its signed URL is set.
  useEffect(() => {
    if (!lyricAudioUrl) {
      setLyricAudioDuration(null);
      return;
    }
    const audio = new Audio();
    audio.preload = "metadata";
    const onLoaded = () => setLyricAudioDuration(audio.duration || null);
    const onError = () => {
      setLyricAudioDuration(null);
      toast.error("Couldn't read that audio file's duration — try a different file.");
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = lyricAudioUrl;
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
    };
  }, [lyricAudioUrl]);

  const genFn = usePerformanceShotJobFn();
  const videoFn = useVideoFromImageJobFn();
  const lyricVideoFn = useServerFn(generateLyricVideoFromSong);
  const listFn = useServerFn(listGenerations);

  const { data: history } = useQuery({
    queryKey: ["mv-gens", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 8000,
  });

  const genMut = useMutation({
    mutationFn: async () => {
      if (currentMode.needsImage) {
        if (!image) throw new Error("Upload a reference image first");
        return videoFn({
          data: {
            imageUrl: image,
            prompt,
            duration: 5,
            resolution: "720p",
            modelKey: videoModel,
            cameraMovement: "static",
            endFrameUrl: null,
          },
        });
      }
      return genFn({ data: { prompt, imageUrls: [], motionVideoUrl: null, model: "replit/gemini-2.5-flash-image" } });
    },
    onSuccess: () => {
      markFirstGenComplete();
      toast.success("Queued — view your result in Gallery");
      qc.invalidateQueries({ queryKey: ["mv-gens"] });
    },
    onError: (e) => handleGenerationError(e),
  });

  const lyricGenMut = useMutation({
    mutationFn: async () => {
      if (!lyricAudioUrl) throw new Error("Upload a song first");
      if (lyricSegments.length === 0) throw new Error("Paste at least one lyric line");
      const res = await lyricVideoFn({ data: { audioUrl: lyricAudioUrl, lines: lyricSegments } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      markFirstGenComplete();
      toast.success("Queued — view your result in Gallery");
      qc.invalidateQueries({ queryKey: ["mv-gens"] });
    },
    onError: (e) => handleGenerationError(e),
  });

  const delFn = useServerFn(deleteGeneration);
  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["mv-gens"] });
      qc.invalidateQueries({ queryKey: ["gallery"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const recentResults = (history?.items ?? [])
    .filter((i) => i.status === "complete" && (i.result_video_url ?? i.result_image_url))
    .slice(0, 6);
  const styleEntries = Object.entries(MUSIC_VIDEO_STYLES) as [
    MusicVideoStyle,
    (typeof MUSIC_VIDEO_STYLES)[MusicVideoStyle],
  ][];

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 py-4 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span
            className="size-8 rounded-xl flex items-center justify-center shadow-[var(--shadow-glow-soft)]"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Music2 className="size-4 text-primary-foreground" />
          </span>
          <span>{musicVideoHeaderTitle}</span>
        </Link>
        <EditableCopy
          copyKey="music_video_header_title"
          fallback="Music Video Studio"
          editorOnly
        />
        <div className="flex items-center gap-4 text-sm">
          <Link to="/motion" className="text-muted-foreground hover:text-foreground no-underline">
            Motion
          </Link>
          <Link to="/lipsync" className="text-muted-foreground hover:text-foreground no-underline">
            Lip Sync
          </Link>
          <Link to="/tiktok" className="text-muted-foreground hover:text-foreground no-underline">
            TikTok
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-5 py-8 space-y-8">
        {/* Genre / Style */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Genre / Style
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {styleEntries.map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStyle(key)}
                className={cn(
                  "relative rounded-2xl border p-4 text-left transition-all",
                  `bg-gradient-to-br ${meta.colorClass}`,
                  style === key
                    ? "ring-2 ring-primary border-primary/60"
                    : "border-white/10 hover:border-white/20",
                )}
              >
                <div className="text-2xl mb-1">{meta.emoji}</div>
                <div className="font-semibold text-sm">{meta.label}</div>
                <div className="text-xs text-white/60 mt-0.5">{meta.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Mode tabs */}
        <section className="space-y-3">
          <EditableCopy
            as="h2"
            copyKey="music_video_mode_heading"
            fallback="What to create"
            className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          />
          <div className="grid grid-cols-3 gap-2">
            {MUSIC_VIDEO_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-xs font-medium text-left transition-colors",
                  mode === m.key
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                <div className="font-semibold">{m.label}</div>
                <div className="mt-0.5 text-[10px] opacity-70">{m.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Lyric Video: song + lyrics (distinct from the caption-burn tool — this
            synthesizes a brand-new video from an uploaded song and generates its
            own timed captions, no source video required) */}
        {isLyricVideo && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Song
            </h2>
            <UploadSlot
              userId={user.id}
              label="Upload"
              hint="MP3 / WAV / M4A — the track your lyrics will be timed to"
              accept={AUDIO_ACCEPT}
              kind="video"
              value={lyricAudioUrl}
              onChange={setLyricAudioUrl}
            />
            {lyricAudioUrl && lyricAudioDuration == null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" /> Reading duration…
              </p>
            )}
            {lyricAudioDuration != null && (
              <p className="text-xs text-muted-foreground">
                Duration: {Math.round(lyricAudioDuration)}s
              </p>
            )}

            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-2">
              Lyrics
              <span className="ml-2 text-[10px] font-normal normal-case opacity-60">
                one line per lyric — evenly timed across the song
              </span>
            </h2>
            <Textarea
              rows={8}
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              className="resize-none bg-card/60 text-sm"
              placeholder={"Paste your lyrics here, one line at a time…\n\nLine one\nLine two\nLine three"}
            />
            {lyricLines.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {lyricLines.length} line{lyricLines.length === 1 ? "" : "s"}
                {lyricAudioDuration != null && lyricSegments.length > 0
                  ? ` · ~${(lyricAudioDuration / lyricLines.length).toFixed(1)}s per line`
                  : ""}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl border border-border bg-card/40 px-3 py-2">
              <Zap className="size-3.5 text-primary" />
              Cost: <span className="text-foreground font-medium">{displayCost} Aura</span>
              <span className="opacity-50">·</span>
              ETA: <span className="text-foreground font-medium">~20–40s</span>
            </div>

            <Button
              disabled={lyricGenMut.isPending || !lyricAudioUrl || lyricSegments.length === 0}
              onClick={() => lyricGenMut.mutate()}
              className="w-full h-14 text-base font-medium shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-hero)" }}
            >
              {lyricGenMut.isPending ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Wand2 className="size-5 mr-2" /> Generate · {displayCost} Aura
                </>
              )}
            </Button>
            {(!lyricAudioUrl || lyricSegments.length === 0) && (
              <p className="text-center text-xs text-muted-foreground">
                {!lyricAudioUrl ? "↑ Upload a song to continue" : "↑ Paste at least one lyric line"}
              </p>
            )}
          </section>
        )}

        {/* Reference image (for modes that need it) */}
        {!isLyricVideo && currentMode.needsImage && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Reference image
            </h2>
            <UploadSlot
              userId={user.id}
              label="Upload"
              hint="Cover art, still, or a frame from existing footage"
              value={image}
              onChange={setImage}
            />
          </section>
        )}

        {/* Beat detection (beat-sync mode only) */}
        {mode === "beat-sync" && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Beat analysis
              <span className="ml-2 text-[10px] font-normal normal-case opacity-60">
                optional · runs in your browser
              </span>
            </h2>
            <div className="rounded-2xl aurora-glass border border-white/10 p-4 space-y-3">
              <p className="text-xs text-white/60">
                Upload a track to detect BPM and beat timestamps — use the cut count to plan your
                scene count.
              </p>
              <input
                ref={beatFileRef}
                type="file"
                accept={AUDIO_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBeatFileName(f.name);
                  void analyzeBeat(f);
                }}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => beatFileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full aurora-glass border border-white/10 px-4 py-2 text-xs font-medium text-white/80 hover:text-white hover:border-white/20 transition-colors"
                >
                  <Upload className="size-3.5" />
                  {beatFileName ?? "Upload track"}
                </button>
                {beatState.status !== "idle" && (
                  <button
                    type="button"
                    onClick={() => {
                      resetBeat();
                      setBeatFileName(null);
                    }}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                    title="Reset"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                )}
              </div>

              {beatState.status === "analyzing" && (
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Loader2 className="size-3.5 animate-spin" /> Analyzing beats…
                </div>
              )}

              {beatState.status === "done" && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                    <div className="text-xl font-bold text-primary">
                      {beatState.result.bpm}
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">BPM</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                    <div className="text-xl font-bold text-amber-400">
                      {beatState.result.suggestedCuts}
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">Cuts</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                    <div className="text-xl font-bold">
                      {beatState.result.durationSeconds}s
                    </div>
                    <div className="text-[10px] text-white/50 mt-0.5">Duration</div>
                  </div>
                </div>
              )}

              {beatState.status === "error" && (
                <p className="text-xs text-destructive">{beatState.message}</p>
              )}
            </div>
          </section>
        )}

        {/* Scene details (text/performance modes only) */}
        {(mode === "text-to-video" || mode === "ai-performance" || mode === "beat-sync") && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Scene details
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Location</label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="bg-card/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_SUGGESTIONS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Subject</label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="bg-card/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_SUGGESTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        )}

        {/* Prompt preview (always shown, always editable) */}
        {!isLyricVideo && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Direction{" "}
              <span className="font-normal normal-case opacity-60 text-[10px]">auto-built · editable</span>
            </h2>
            <Textarea
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="resize-none bg-card/60 text-sm"
              placeholder="Your prompt will appear here…"
            />
          </section>
        )}

        {/* Model + cost */}
        {!isLyricVideo && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {currentMode.needsImage ? "Video model" : "Image model"}
            </h2>
            {currentMode.needsImage && (
              <Select value={videoModel} onValueChange={setVideoModel}>
                <SelectTrigger className="bg-card/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODEL_LIST.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.tagline}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl border border-border bg-card/40 px-3 py-2">
              <Zap className="size-3.5 text-primary" />
              Cost:{" "}
              <span className="text-foreground font-medium">{displayCost} Aura</span>
              <span className="opacity-50">·</span>
              ETA:{" "}
              <span className="text-foreground font-medium">
                {currentMode.needsImage ? "~20–40s" : "~10–20s"}
              </span>
            </div>
          </section>
        )}

        {/* Generate */}
        {!isLyricVideo && (
          <Button
            disabled={genMut.isPending || (currentMode.needsImage && !image)}
            onClick={() => genMut.mutate()}
            className="w-full h-14 text-base font-medium shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-hero)" }}
          >
            {genMut.isPending ? (
              <>
                <Loader2 className="size-5 mr-2 animate-spin" /> Generating…
              </>
            ) : (
              <><Wand2 className="size-5 mr-2" /> {musicVideoGenerateCta} · {displayCost} Aura</>
            )}
          </Button>
        )}

        {!isLyricVideo && currentMode.needsImage && !image && (
          <p className="text-center text-xs text-muted-foreground -mt-4">
            ↑ Upload a reference image to enable video generation
          </p>
        )}
        <EditableCopy
          copyKey="music_video_generate_cta"
          fallback="Generate"
          editorOnly
        />

        {/* Gallery redirect */}
        <Link
          to="/gallery"
          className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium no-underline hover:border-primary/40 hover:bg-card/80 transition-colors"
        >
          <Check className="size-4 text-emerald-400" />
          <span>View your generations in Gallery</span>
          <span className="ml-auto text-muted-foreground text-xs">→</span>
        </Link>

        {/* Nav links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/motion"
            className="inline-flex items-center gap-2 rounded-full aurora-glass px-4 py-2 text-sm no-underline hover:brightness-110"
          >
            <Film className="size-3.5" /> Motion Studio
          </Link>
          <Link
            to="/lipsync"
            className="inline-flex items-center gap-2 rounded-full aurora-glass px-4 py-2 text-sm no-underline hover:brightness-110"
          >
            <Music2 className="size-3.5" /> Lip Sync
          </Link>
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-full aurora-glass px-4 py-2 text-sm no-underline hover:brightness-110"
          >
            Full Studio →
          </Link>
        </div>
      </div>
    </main>
  );
}
