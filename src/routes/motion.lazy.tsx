import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExampleOutputGrid } from "@/components/studio/ExampleOutputGrid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowLeft, Loader2, Film, Wand2, Camera, Clapperboard, Users, WifiOff, Music2, Download, Zap, ChevronRight, BookOpen } from "lucide-react";
import { saveAssetToDisk } from "@/lib/save";
import { PageSpinner } from "@/components/PageSpinner";
import { AuthRedirect } from "@/components/AuthRedirect";
import { toast } from "sonner";
import {
  generateMimicMotion,
  generatePerformanceReskin,
  listGenerations,
} from "@/lib/studio.functions";
import { usePerformanceShotJobFn, useVideoFromImageJobFn } from "@/lib/use-job-polling";
import { getJobStatus } from "@/lib/jobs.functions";
import { checkWorkerCapability } from "@/lib/workers.functions";
import { VIDEO_MODEL_LIST } from "@/lib/models";
import { computeCost, type Resolution } from "@/lib/pricing";
import { ResolutionPicker } from "@/components/ResolutionPicker";
import { PlanLimitNotice } from "@/components/PlanLimitNotice";
import { evaluatePlanLimits } from "@/lib/billing.plans";
import { getMyProfile } from "@/lib/billing.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import demoSelfie from "@/assets/demo-selfie.jpg";
import { ExampleChips } from "@/components/onboarding/ExampleChips";
import { MOTION_EXAMPLE_PRESETS } from "@/lib/example-presets";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { hasCompletedFirstGen, hasDismissedTour, isFirstPageVisit, markFirstGenComplete, markPageVisited } from "@/lib/first-run";
import { ConnectReplicateBanner } from "@/components/ConnectReplicateBanner";
import { friendlyGenerationMessage, handleGenerationError } from "@/lib/error-toasts";
import { useGenerationProgress, type BackendJobStatus } from "@/hooks/use-generation-progress";
import { GenerationProgress } from "@/components/ui/GenerationProgress";
import { GenerationErrorCard } from "@/components/ui/GenerationErrorCard";
import { BlurredPreview } from "@/components/ui/BlurredPreview";
import { PerformAnywhereGuide } from "@/components/onboarding/PerformAnywhereGuide";
import { Check, ArrowRight } from "lucide-react";
import {
  generateAvatarShot,
  SHOT_IMAGE_COST,
  SHOT_KLING_COST,
} from "@/lib/platform-template.functions";
import { generateLyricVideoFromSong } from "@/lib/captions.functions";
import {
  MUSIC_VIDEO_STYLES,
  MUSIC_VIDEO_MODES,
  buildMusicVideoPrompt,
  buildLyricVideoSegments,
  LOCATION_SUGGESTIONS,
  SUBJECT_SUGGESTIONS,
  type MusicVideoMode,
  type MusicVideoStyle,
} from "@/lib/music-video-prompts";
import { useBeatDetect } from "@/hooks/use-beat-detect";
import { useLyricBeatAnalysis } from "@/hooks/use-lyric-beat-analysis";
import { cn, AUDIO_ACCEPT } from "@/lib/utils";
import { HiggsHero, HiggsDivider, FanPhotos } from "@/components/studio/HiggsLayout";

export const Route = createLazyFileRoute("/motion")({ component: MotionStudio });

const POSE_PRESETS = [
  { id: "perform", label: "Performing", prompt: "powerful performance stance, one hand raised, leaning into a vintage mic" },
  { id: "walk", label: "Walking towards camera", prompt: "confident walk towards camera, mid-stride, arms relaxed" },
  { id: "lean", label: "Leaning side profile", prompt: "side profile lean against a wall, arms crossed, head tilted" },
  { id: "seated", label: "Seated, looking up", prompt: "seated low on a stool, looking up into the lens" },
  { id: "low-angle", label: "Hero low-angle", prompt: "low-angle hero pose, chin raised, looking off-camera, dramatic" },
  { id: "dance", label: "Mid-dance freeze", prompt: "mid-dance freeze, body in motion, dynamic limbs" },
];

const CAMERA_MOVES = [
  { v: "static", label: "Static (locked off)" },
  { v: "push_in", label: "Push in" },
  { v: "pull_out", label: "Pull out" },
  { v: "orbit_cw", label: "Orbit clockwise" },
  { v: "orbit_ccw", label: "Orbit counter-clockwise" },
  { v: "pan_left", label: "Pan left" },
  { v: "pan_right", label: "Pan right" },
  { v: "tilt_up", label: "Tilt up" },
  { v: "tilt_down", label: "Tilt down" },
];

// Structured motion vocabularies — mirror motion-workflows.server.ts (kept local so
// this client route never imports a .server module). The server re-validates them.
const MOTION_TYPES_UI = [
  { v: "faithful", label: "Faithful" },
  { v: "expressive", label: "Expressive" },
  { v: "subtle", label: "Subtle" },
  { v: "exaggerated", label: "Exaggerated" },
];
const MOTION_CAMERA = [
  { v: "static", label: "Static" },
  { v: "orbit", label: "Orbit" },
  { v: "push-in", label: "Push in" },
  { v: "pull-out", label: "Pull out" },
  { v: "pan-left", label: "Pan left" },
  { v: "pan-right", label: "Pan right" },
  { v: "tilt-up", label: "Tilt up" },
  { v: "tilt-down", label: "Tilt down" },
  { v: "handheld", label: "Handheld" },
];

type Mode = "pose" | "transfer" | "reskin" | "avatar-shots" | "live-avatar" | "music-video";
type ShotEngine = "seedream" | "gemini" | "kling";
type ShotResult = { url: string; engine: ShotEngine; kind: "image" | "video"; fallbackFrom?: ShotEngine };

const ANIMATE_DURATION_SECONDS = 5;

type AnimatePreviewKeyInput = {
  sourceUrl: string | null;
  endFrameUrl: string | null;
  prompt: string;
  cameraMovement: string;
  modelKey: string;
  resolution: Resolution;
  durationSeconds: number;
};

/** Stable identity for the inputs bound to an animation preview ticket. */
function buildAnimatePreviewKey(input: AnimatePreviewKeyInput): string {
  return JSON.stringify(input);
}

const SHOT_ENGINE_LABEL: Record<ShotEngine, string> = { seedream: "SeedDream", gemini: "Gemini Omni", kling: "KlingAI" };

const KLING_FALLBACK_TOAST = "KlingAI unavailable — generated a SeedDream portrait instead";

function shotResultLabel(r: ShotResult): string {
  return r.fallbackFrom ? `${SHOT_ENGINE_LABEL[r.engine]} (fallback)` : SHOT_ENGINE_LABEL[r.engine];
}

/**
 * Result cards for Avatar Shots / Live Avatar. Branches on the media kind the
 * server ACTUALLY served — a KlingAI request that fell back to SeedDream is a
 * still image, so it must never be poured into a <video> element.
 */
function ShotResultsSection({ results }: { results: ShotResult[] }) {
  if (results.length === 0) return null;
  return (
    <section className="space-y-3" aria-label="Generated avatar shots">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Results</p>
        <Link to="/gallery" className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors">
          <Check className="size-3.5" /> Saved to Gallery
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {results.map((r, i) => (
          <div key={`${r.url}-${i}`} className="rounded-2xl border border-border bg-card/60 overflow-hidden" data-testid={`shot-result-${r.kind}`}>
            {r.kind === "video" ? (
              <video src={r.url} controls playsInline preload="metadata" className="w-full aspect-video object-cover bg-black" />
            ) : (
              <img src={r.url} alt={`${shotResultLabel(r)} avatar shot ${i + 1}`} className="w-full aspect-square object-cover" loading="lazy" />
            )}
            <div className="p-2 flex items-center justify-between gap-2">
              <span
                className={cn("text-[10px] font-medium", r.fallbackFrom ? "text-amber-400" : "text-muted-foreground")}
                title={r.fallbackFrom ? `${SHOT_ENGINE_LABEL[r.fallbackFrom]} was unavailable, so ${SHOT_ENGINE_LABEL[r.engine]} served this shot` : undefined}
              >
                {shotResultLabel(r)}
              </span>
              <button
                type="button"
                onClick={() => void saveAssetToDisk(r.url, `shot-${Date.now()}.${r.kind === "video" ? "mp4" : "jpg"}`)}
                className="text-xs text-primary flex items-center gap-1"
              >
                <Download className="size-3" /> Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MotionStudio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("transfer");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Pose → Video (existing two-step flow)
  const [selfie, setSelfie] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<string | null>(null);
  const [poseRef, setPoseRef] = useState<string | null>(null);
  const [startFrame, setStartFrame] = useState<string | null>(null);
  const [endFrame, setEndFrame] = useState<string | null>(null);
  const [pose, setPose] = useState(POSE_PRESETS[0]);
  const [cameraMovement, setCameraMovement] = useState("push_in");
  const [videoModel, setVideoModel] = useState(VIDEO_MODEL_LIST[0].value);
  const [videoPrompt, setVideoPrompt] = useState("natural body movement, expressive performance, cinematic");
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [activeExampleId, setActiveExampleId] = useState<string | undefined>(undefined);
  const [showTour, setShowTour] = useState(false);
  const [videoResolution, setVideoResolution] = useState<Resolution>("720p");

  // Guided Workflows deep-link handoff: ?image=…&prompt=… lands the user in
  // Motion Transfer with the source image + context prompt pre-staged.
  const search = Route.useSearch();
  useEffect(() => {
    if (search.image || search.prompt) {
      setMode("transfer");
      if (search.image) setMtImage(search.image);
      if (search.image2) setMtImage2(search.image2);
      if (search.prompt) setMtPrompt(search.prompt);
    }
  }, [search.image, search.image2, search.prompt]);

  useEffect(() => {
    if (!hasCompletedFirstGen() && isFirstPageVisit("motion")) {
      markPageVisited("motion");
      const p = MOTION_EXAMPLE_PRESETS[0];
      if (p.prompt) setVideoPrompt(p.prompt);
      if (p.extra?.pose) {
        const found = POSE_PRESETS.find((pr) => pr.id === p.extra!.pose);
        if (found) setPose(found);
      }
      if (p.extra?.cameraMovement) setCameraMovement(String(p.extra.cameraMovement));
      setActiveExampleId(p.id);
    }
    if (!hasDismissedTour()) {
      const t = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Motion Transfer (MimicMotion)
  const [mtImage, setMtImage] = useState<string | null>(null);
  const [mtImage2, setMtImage2] = useState<string | null>(null);
  const [mtVideo, setMtVideo] = useState<string | null>(null);
  const [mtMotion, setMtMotion] = useState("faithful");
  const [mtCamera, setMtCamera] = useState("static");
  const [mtPrompt, setMtPrompt] = useState("");
  const [mtError, setMtError] = useState<string | null>(null);

  // Performance Shot (video-driven avatar reskin)
  const [rsVideo, setRsVideo] = useState<string | null>(null);
  const [rsAvatar, setRsAvatar] = useState<string | null>(null);
  const [rsAudio, setRsAudio] = useState<string | null>(null);
  const [rsOutfit, setRsOutfit] = useState("");
  const [rsLocation, setRsLocation] = useState("");
  const [rsOutfitImg, setRsOutfitImg] = useState<string | null>(null);
  const [rsSceneImg, setRsSceneImg] = useState<string | null>(null);
  const [rsTitle, setRsTitle] = useState("Untitled performance");
  const [rsMotion, setRsMotion] = useState("faithful");
  const [rsCamera, setRsCamera] = useState("static");
  const [rsError, setRsError] = useState<string | null>(null);

  // Timestamps + generation IDs set on mutation success — used to find in-flight jobs in history
  const transferSubmittedAtRef = useRef<number | null>(null);
  const reskinSubmittedAtRef = useRef<number | null>(null);
  const [transferGenId, setTransferGenId] = useState<string | null>(null);
  const [reskinGenId, setReskinGenId] = useState<string | null>(null);
  // Jobs-row ids for the in-flight transfer/reskin — real progress
  // (progress_pct/progress_stage) lives on the jobs row, not the generation.
  const [transferJobId, setTransferJobId] = useState<string | null>(null);
  const [reskinJobId, setReskinJobId] = useState<string | null>(null);

  // Refs for aside DOM elements (scroll-into-view on completion)
  const transferAsideRef = useRef<HTMLElement>(null);
  const reskinAsideRef = useRef<HTMLElement>(null);
  // Track previous status so we detect the exact frame it flips to "complete"
  const prevTransferStatusRef = useRef<BackendJobStatus>(null);
  const prevReskinStatusRef = useRef<BackendJobStatus>(null);
  // Preview-confirm tickets: first submit renders a discounted capped preview;
  // its generationId unlocks the full render on the next submit.
  const [transferPreviewId, setTransferPreviewId] = useState<string | null>(null);
  const [reskinPreviewId, setReskinPreviewId] = useState<string | null>(null);
  const [animatePreviewId, setAnimatePreviewId] = useState<string | null>(null);
  const [animateHdDialogOpen, setAnimateHdDialogOpen] = useState(false);

  // The quick-start sample is bundled with the app, not owned by the caller.
  // Stage it into the caller's studio folder before using it as a character
  // reference so generateVideoFromImage can enforce the same ownership guard as
  // a user-uploaded frame.
  type DemoStageStatus = "idle" | "loading" | "ready" | "error";
  const [demoRef, setDemoRef] = useState<{ userId: string; url: string } | null>(null);
  const [demoStageStatus, setDemoStageStatus] = useState<DemoStageStatus>("idle");
  const [demoStageError, setDemoStageError] = useState<string | null>(null);
  const [demoStageAttempt, setDemoStageAttempt] = useState(0);
  const demoOwnerId = user?.id ?? null;
  useEffect(() => {
    if (!demoOwnerId) {
      setDemoRef(null);
      setDemoStageStatus("idle");
      setDemoStageError(null);
      return;
    }

    let cancelled = false;
    const ownerId = demoOwnerId;
    const path = `${ownerId}/demo/selfie.jpg`;
    setDemoRef(null);
    setDemoStageStatus("loading");
    setDemoStageError(null);

    const stageDemo = async () => {
      try {
        // The studio bucket may be private, so probing its public URL with an
        // <img> is not a reliable existence check. A signed URL uses the
        // caller's authenticated session and also gives the guarded enqueue
        // path a fetchable reference.
        const existing = await supabase.storage.from("studio").createSignedUrl(path, 60 * 60);
        let signedUrl = existing.data?.signedUrl ?? null;

        if (!signedUrl) {
          const response = await fetch(demoSelfie);
          if (!response.ok) throw new Error(`Demo selfie fetch failed: HTTP ${response.status}`);
          const blob = await response.blob();
          const { error } = await supabase.storage.from("studio").upload(path, blob, {
            contentType: blob.type || "image/jpeg",
            upsert: true,
          });
          if (error) throw new Error(`Demo selfie staging failed: ${error.message}`);

          const staged = await supabase.storage.from("studio").createSignedUrl(path, 60 * 60);
          if (staged.error || !staged.data?.signedUrl) {
            throw new Error(`Demo selfie URL failed: ${staged.error?.message ?? "no signed URL"}`);
          }
          signedUrl = staged.data.signedUrl;
        }

        if (!cancelled) {
          setDemoRef({ userId: ownerId, url: signedUrl });
          setDemoStageStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setDemoStageStatus("error");
          setDemoStageError(error instanceof Error ? error.message : "Could not prepare the demo selfie");
        }
      }
    };

    void stageDemo();

    return () => {
      cancelled = true;
    };
  }, [demoOwnerId, demoStageAttempt]);
  const usableDemoUrl = demoRef?.userId === demoOwnerId ? demoRef.url : null;

  // A preview confirmation ticket is only valid for the exact inputs that
  // produced it. Keep this identity separate from output/mutation state so a
  // completed video or a refetch cannot invalidate a fresh preview.
  const animatePreviewBindingRef = useRef<string | null>(null);
  const animateRequestKeyRef = useRef<string | null>(null);
  const animateSource = startFrame ?? stagedImage ?? usableDemoUrl;
  const animateInputKey = buildAnimatePreviewKey({
    sourceUrl: animateSource,
    endFrameUrl: endFrame,
    prompt: videoPrompt,
    cameraMovement,
    modelKey: videoModel,
    resolution: videoResolution,
    durationSeconds: ANIMATE_DURATION_SECONDS,
  });
  const currentAnimateInputKeyRef = useRef(animateInputKey);
  currentAnimateInputKeyRef.current = animateInputKey;
  const activeAnimatePreviewId =
    animatePreviewId && animatePreviewBindingRef.current === animateInputKey ? animatePreviewId : null;

  useEffect(() => {
    if (!animatePreviewId || animatePreviewBindingRef.current === animateInputKey) return;
    animatePreviewBindingRef.current = null;
    setAnimatePreviewId(null);
    setAnimateHdDialogOpen(false);
  }, [animateInputKey, animatePreviewId]);

  // Animate runs generateVideoFromImage at a fixed 5s; cost mirrors the server
  // charge exactly. First pass is a 480p preview; confirmed full render uses
  // the selected resolution (720p → 2160p). Premium models retier live.
  const animateCost = useMemo(
    () => computeCost({ features: ["video"], model: videoModel, durationSeconds: ANIMATE_DURATION_SECONDS, resolution: videoResolution }).total,
    [videoModel, videoResolution],
  );
  const animatePreviewCost = useMemo(
    () => computeCost({ features: ["video"], model: videoModel, durationSeconds: ANIMATE_DURATION_SECONDS, resolution: "480p" }).total,
    [videoModel],
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  // ── Avatar Shots state ────────────────────────────────────────────────────
  const [shotEngine, setShotEngine] = useState<ShotEngine>("seedream");
  const [shotPrompt, setShotPrompt] = useState("");
  const [shotResults, setShotResults] = useState<ShotResult[]>([]);
  const [shotLoading, setShotLoading] = useState(false);

  // ── Music Video (embedded) state ──────────────────────────────────────────
  const [mvStyle, setMvStyle] = useState<MusicVideoStyle>("trap");
  const [mvMode, setMvMode] = useState<MusicVideoMode>("text-to-video");
  const [mvLocation, setMvLocation] = useState(LOCATION_SUGGESTIONS[0]);
  const [mvSubject, setMvSubject] = useState(SUBJECT_SUGGESTIONS[0]);
  const [mvPrompt, setMvPrompt] = useState(() =>
    buildMusicVideoPrompt("text-to-video", "trap", LOCATION_SUGGESTIONS[0], SUBJECT_SUGGESTIONS[0]),
  );
  const [mvImage, setMvImage] = useState<string | null>(null);
  const [mvVideoModel, setMvVideoModel] = useState(VIDEO_MODEL_LIST[0].value);
  const [lyricAudioUrl, setLyricAudioUrl] = useState<string | null>(null);
  const [lyricAudioDuration, setLyricAudioDuration] = useState<number | null>(null);
  const [lyricsText, setLyricsText] = useState("");

  const beatFileRef = useRef<HTMLInputElement>(null);
  const [beatFileName, setBeatFileName] = useState<string | null>(null);
  const { state: beatState, analyze: analyzeBeat, reset: resetBeat } = useBeatDetect();

  const isMvLyric = mvMode === "lyric-style";
  const lyricBeatAnalysis = useLyricBeatAnalysis(lyricAudioUrl, isMvLyric);
  const mvCurrentMode = MUSIC_VIDEO_MODES.find((m) => m.key === mvMode)!;
  const mvVideoCost = computeCost({ features: ["video"], model: mvVideoModel, durationSeconds: 5, resolution: "720p" }).total;
  const mvLyricCost = computeCost({ features: ["lyric_video"] }).total;
  const mvDisplayCost = isMvLyric ? mvLyricCost : mvCurrentMode?.needsImage ? mvVideoCost : 1;

  const lyricLines = lyricsText.split("\n").map((l) => l.trim()).filter(Boolean);
  const lyricBeatTimestamps = lyricBeatAnalysis.beatTimestamps;
  const lyricGenerationGate = lyricBeatAnalysis.gate;
  const lyricSegments = buildLyricVideoSegments(
    lyricAudioDuration,
    lyricLines,
    lyricBeatTimestamps,
  );

  useEffect(() => {
    setMvPrompt(buildMusicVideoPrompt(mvMode, mvStyle, mvLocation, mvSubject));
  }, [mvMode, mvStyle, mvLocation, mvSubject]);

  useEffect(() => {
    if (!lyricAudioUrl) { setLyricAudioDuration(null); return; }
    const audio = new Audio();
    audio.preload = "metadata";
    const onLoaded = () => setLyricAudioDuration(audio.duration || null);
    const onError = () => { setLyricAudioDuration(null); toast.error("Couldn't read that audio file's duration"); };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = lyricAudioUrl;
    return () => { audio.removeEventListener("loadedmetadata", onLoaded); audio.removeEventListener("error", onError); };
  }, [lyricAudioUrl]);

  // Real server-side progress (task #284) for the wrapped enqueue+poll flows.
  const [poseJobProg, setPoseJobProg] = useState<{ pct: number | null; stage: string | null } | null>(null);
  const [animateJobProg, setAnimateJobProg] = useState<{ pct: number | null; stage: string | null } | null>(null);
  const genFn = usePerformanceShotJobFn({ onProgress: (u) => setPoseJobProg({ pct: u.pct, stage: u.stage }) });
  const videoFn = useVideoFromImageJobFn({ onProgress: (u) => setAnimateJobProg({ pct: u.pct, stage: u.stage }) });
  const shotFn = useServerFn(generateAvatarShot);
  const lyricVideoFn = useServerFn(generateLyricVideoFromSong);
  const motionFn = useServerFn(generateMimicMotion);
  const reskinFn = useServerFn(generatePerformanceReskin);
  const listFn = useServerFn(listGenerations);
  const profileFn = useServerFn(getMyProfile);
  const checkWorkerFn = useServerFn(checkWorkerCapability);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const isPro = !!(profile?.is_pro || profile?.isAdmin);

  // Pre-click plan-limit warnings for the Animate flow (HD/4K on Free) —
  // same shared helpers the server guard throws with, so the warning matches
  // the rejection a full-quality render would otherwise hit after the user
  // already paid for a preview. The preview pass itself runs at 480p (exempt).
  const animatePlanWarnings = evaluatePlanLimits({
    tier: isPro ? "pro" : "free",
    kind: "video",
    durationSeconds: ANIMATE_DURATION_SECONDS,
    resolution: videoResolution,
    nextRenderIsPreview: !activeAnimatePreviewId,
  });
  const animatePlanBlocked = animatePlanWarnings.some((w) => w.blocksNextRender);

  const { data: motionWorker } = useQuery({
    queryKey: ["worker-capability", "motion"],
    queryFn: () => checkWorkerFn({ data: { capability: "motion" } }),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 60_000,
  });
  const motionOnline = motionWorker?.available ?? false;

  const { data: history } = useQuery({
    queryKey: ["motion-gens", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 6000,
    staleTime: 0,
  });

  // Step 1 — stage the still with pose reference
  const stageMut = useMutation({
    mutationFn: async () => {
      if (!selfie) throw new Error("Add a selfie first");
      const refs: { url: string; label: string }[] = [
        { url: selfie, label: "Identity (face / skin / hair)" },
      ];
      if (outfit) refs.push({ url: outfit, label: "Outfit (wardrobe only)" });
      if (poseRef) refs.push({ url: poseRef, label: "POSE reference — copy stance, gesture, framing ONLY. Ignore its outfit/face/background." });
      const labelBlock = refs.map((r, i) => `Image ${i + 1}: ${r.label}`).join("\n");
      const prompt = `Cinematic portrait of the subject. Pose: ${pose.prompt}. Preserve exact facial likeness, hair, skin tone. Outfit identical to the outfit reference if provided. Soft cinematic lighting, shallow depth of field, ARRI look, 4K.\n\nReference images (in order):\n${labelBlock}`;
      const out = await genFn({
        data: {
          prompt,
          imageUrls: refs.map((r) => r.url),
          motionVideoUrl: null,
          model: "google/gemini-3.1-flash-image-preview",
        },
      });
      return out;
    },
    onMutate: () => setImageError(null),
    onSuccess: (out) => {
      setStagedImage(out?.resultUrl ?? null);
      setVideoUrl(null);
      setVideoError(null);
      toast.success("Pose staged");
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      setImageError(friendlyGenerationMessage(e));
      handleGenerationError(e);
    },
  });

  // Step 2 — animate it
  // Ref used by onGenerate to pass a demo override without hitting React batching.
  const animateOverrideRef = useRef<string | null>(null);

  const animateMut = useMutation({
    mutationFn: async () => {
      const override = animateOverrideRef.current;
      animateOverrideRef.current = null;
      const source = startFrame ?? override ?? stagedImage ?? usableDemoUrl;
      if (!source) throw new Error("Add a first frame or stage a pose first");
      const previewId = activeAnimatePreviewId;
      animateRequestKeyRef.current = buildAnimatePreviewKey({
        sourceUrl: source,
        endFrameUrl: endFrame,
        prompt: videoPrompt,
        cameraMovement,
        modelKey: videoModel,
        resolution: videoResolution,
        durationSeconds: ANIMATE_DURATION_SECONDS,
      });
      const out = await videoFn({
        data: {
          imageUrl: source,
          prompt: videoPrompt,
          duration: ANIMATE_DURATION_SECONDS,
          resolution: previewId ? videoResolution : "480p",
          modelKey: videoModel,
          cameraMovement,
          endFrameUrl: endFrame ?? null,
          confirmPreviewId: previewId ?? undefined,
        },
      });
      return out;
    },
    onMutate: () => setVideoError(null),
    onSuccess: (out) => {
      markFirstGenComplete();
      const res = out;
      setVideoUrl(res?.videoUrl ?? null);
      if (res?.preview) {
        const requestKey = animateRequestKeyRef.current;
        if (res.id && requestKey && requestKey === currentAnimateInputKeyRef.current) {
          animatePreviewBindingRef.current = requestKey;
          setAnimatePreviewId(res.id);
        } else {
          animatePreviewBindingRef.current = null;
          setAnimatePreviewId(null);
        }
        toast.success("Preview ready — happy with it? Render full quality next");
      } else {
        animatePreviewBindingRef.current = null;
        setAnimatePreviewId(null);
        toast.success("Motion ready");
      }
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message.includes("Unsupported preview confirmation")) {
        animatePreviewBindingRef.current = null;
        setAnimatePreviewId(null);
      }
      setVideoError(friendlyGenerationMessage(e));
      handleGenerationError(e);
    },
  });

  // Motion Transfer — async via GPU job queue
  const transferMut = useMutation({
    mutationFn: async () => {
      if (!mtImage) throw new Error("Add a reference image");
      if (!mtVideo) throw new Error("Add a driving video");
      return await motionFn({
        data: {
          imageUrl: mtImage,
          drivingVideoUrl: mtVideo,
          prompt: mtPrompt || undefined,
          params: { motionType: mtMotion, cameraMovement: mtCamera },
          confirmPreviewId: transferPreviewId ?? undefined,
        },
      });
    },
    onMutate: () => { setMtError(null); setTransferJobId(null); },
    onSuccess: (out: { generationId?: string; jobId?: string; preview?: boolean } | void) => {
      transferSubmittedAtRef.current = Date.now();
      if (out && typeof out === "object" && out.generationId) setTransferGenId(out.generationId);
      if (out && typeof out === "object" && out.jobId) setTransferJobId(out.jobId);
      if (out && typeof out === "object" && out.preview) {
        setTransferPreviewId(out.generationId ?? null);
        toast.success("Preview queued — review it in Gallery, then render the full clip");
      } else {
        setTransferPreviewId(null);
        toast.success("Motion transfer queued — view in Gallery when ready");
      }
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message.includes("Unsupported preview confirmation")) {
        setTransferPreviewId(null);
      }
      setMtError(friendlyGenerationMessage(e));
      handleGenerationError(e);
    },
  });

  // Performance Shot — async via GPU job queue
  const reskinMut = useMutation({
    mutationFn: async () => {
      if (!rsVideo) throw new Error("Add a performance video");
      if (!rsAvatar) throw new Error("Add an avatar image");
      return await reskinFn({
        data: {
          performanceVideoUrl: rsVideo,
          avatarImageUrl: rsAvatar,
          outfit: rsOutfit || undefined,
          location: rsLocation || undefined,
          audioUrl: rsAudio || undefined,
          params: { motionType: rsMotion, cameraMovement: rsCamera },
          confirmPreviewId: reskinPreviewId ?? undefined,
        },
      });
    },
    onMutate: () => { setRsError(null); setReskinJobId(null); },
    onSuccess: (out: { generationId?: string; jobId?: string; preview?: boolean } | void) => {
      reskinSubmittedAtRef.current = Date.now();
      if (out && typeof out === "object" && out.generationId) setReskinGenId(out.generationId);
      if (out && typeof out === "object" && out.jobId) setReskinJobId(out.jobId);
      if (out && typeof out === "object" && out.preview) {
        setReskinPreviewId(out.generationId ?? null);
        toast.success("Preview queued — review it in Gallery, then render the full clip");
      } else {
        setReskinPreviewId(null);
        toast.success("Performance Shot queued — view in Gallery when ready");
      }
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message.includes("Unsupported preview confirmation")) {
        setReskinPreviewId(null);
      }
      setRsError(friendlyGenerationMessage(e));
      handleGenerationError(e);
    },
  });

  const stageProgress = useGenerationProgress({
    realProgress: poseJobProg ?? undefined,
    isPending: stageMut.isPending,
    isError: stageMut.isError,
    isSuccess: stageMut.isSuccess,
    estimatedMs: 18_000,
    persistKey: "aurora.progress.motion.stage",
    labels: {
      queued: "Queued…",
      processing: "Posing your subject…",
      finalizing: "Finishing the pose…",
      done: "Pose staged",
    },
  });

  const animateProgress = useGenerationProgress({
    realProgress: animateJobProg ?? undefined,
    isPending: animateMut.isPending,
    isError: animateMut.isError,
    isSuccess: animateMut.isSuccess,
    estimatedMs: 50_000,
    persistKey: "aurora.progress.motion.animate",
    labels: {
      queued: "Queued…",
      processing: "Animating your clip…",
      finalizing: "Rendering final frames…",
      done: "Motion ready",
    },
  });

  // Derive real job status for async GPU jobs from the history query.
  // After submission, history (polled every 6s) will contain the in-flight job.
  // We find the first item that has no video result yet — that's the most recent
  // async job, which is exactly the one we just submitted.
  const transferJobStatus = useMemo((): BackendJobStatus => {
    if (transferMut.isError) return "failed";
    if (!transferSubmittedAtRef.current || !history?.items) return null;
    // Find by specific generationId if we captured it — avoids mixing up concurrent jobs
    const item = transferGenId
      ? history.items.find((g) => g.id === transferGenId)
      : history.items.find((g) => !g.result_video_url && g.status !== "failed");
    if (!item) return transferGenId ? "complete" : null; // ID known but not in-flight → done
    const s = item.status;
    if (s === "complete" || s === "succeeded" || s === "done") return "complete";
    if (s === "processing") return "processing";
    if (s === "finalizing") return "finalizing";
    if (s === "failed") return "failed";
    return "queued";
  }, [history, transferMut.isError, transferGenId]);

  const reskinJobStatus = useMemo((): BackendJobStatus => {
    if (reskinMut.isError) return "failed";
    if (!reskinSubmittedAtRef.current || !history?.items) return null;
    const item = reskinGenId
      ? history.items.find((g) => g.id === reskinGenId)
      : history.items.find((g) => !g.result_video_url && g.status !== "failed");
    if (!item) return reskinGenId ? "complete" : null;
    const s = item.status;
    if (s === "complete" || s === "succeeded" || s === "done") return "complete";
    if (s === "processing") return "processing";
    if (s === "finalizing") return "finalizing";
    if (s === "failed") return "failed";
    return "queued";
  }, [history, reskinMut.isError, reskinGenId]);

  // Real server-side progress (task #284): while a transfer/reskin job is in
  // flight, poll its jobs row directly — progress_pct/progress_stage are
  // written by the queue runner and by self-hosted workers via the progress
  // callback route. History rows (generations) don't carry these fields.
  const jobStatusFn = useServerFn(getJobStatus);
  const transferActive =
    transferJobStatus === "queued" || transferJobStatus === "processing" || transferJobStatus === "finalizing";
  const { data: transferJobRow } = useQuery({
    queryKey: ["job-progress", transferJobId],
    queryFn: () => jobStatusFn({ data: { jobId: transferJobId! } }),
    enabled: !!transferJobId && transferActive,
    refetchInterval: 3_500,
    staleTime: 0,
  });
  const reskinActive =
    reskinJobStatus === "queued" || reskinJobStatus === "processing" || reskinJobStatus === "finalizing";
  const { data: reskinJobRow } = useQuery({
    queryKey: ["job-progress", reskinJobId],
    queryFn: () => jobStatusFn({ data: { jobId: reskinJobId! } }),
    enabled: !!reskinJobId && reskinActive,
    refetchInterval: 3_500,
    staleTime: 0,
  });

  // Fire a toast + scroll the result panel into view the moment a job completes.
  useEffect(() => {
    const prev = prevTransferStatusRef.current;
    prevTransferStatusRef.current = transferJobStatus;
    if (prev !== null && prev !== "complete" && transferJobStatus === "complete") {
      toast.success("Motion transfer complete!", {
        action: {
          label: "View result",
          onClick: () => transferAsideRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        },
      });
    }
  }, [transferJobStatus]);

  useEffect(() => {
    const prev = prevReskinStatusRef.current;
    prevReskinStatusRef.current = reskinJobStatus;
    if (prev !== null && prev !== "complete" && reskinJobStatus === "complete") {
      toast.success("Performance Shot complete!", {
        action: {
          label: "View result",
          onClick: () => reskinAsideRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        },
      });
    }
  }, [reskinJobStatus]);

  const transferProgress = useGenerationProgress({
    isPending: transferMut.isPending,
    isError: transferMut.isError,
    isSuccess: transferMut.isSuccess,
    jobStatus: transferJobStatus,
    realProgress: transferJobRow?.job
      ? { pct: transferJobRow.job.progress_pct, stage: transferJobRow.job.progress_stage }
      : undefined,
    estimatedMs: 60_000,
    persistKey: "aurora.progress.motion.transfer",
    asyncEnqueue: true,
    labels: {
      queued: "Queued on GPU backend…",
      processing: "Transferring motion…",
      finalizing: "Almost there…",
      done: "Transfer complete",
    },
  });

  const reskinProgress = useGenerationProgress({
    isPending: reskinMut.isPending,
    isError: reskinMut.isError,
    isSuccess: reskinMut.isSuccess,
    jobStatus: reskinJobStatus,
    realProgress: reskinJobRow?.job
      ? { pct: reskinJobRow.job.progress_pct, stage: reskinJobRow.job.progress_stage }
      : undefined,
    estimatedMs: 60_000,
    persistKey: "aurora.progress.motion.reskin",
    asyncEnqueue: true,
    labels: {
      queued: "Queued on GPU backend…",
      processing: "Reskinning performance…",
      finalizing: "Almost there…",
      done: "Shot complete",
    },
  });

  if (loading) return <PageSpinner />;
  if (!user) return <AuthRedirect />;

  const stepBadge = (label: string, state: "idle" | "running" | "ok" | "error", error?: string | null) => (
    <div className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${
      state === "ok" ? "border-emerald-500/40 bg-emerald-500/10" :
      state === "running" ? "border-primary/40 bg-primary/10" :
      state === "error" ? "border-destructive/50 bg-destructive/10" :
      "border-border bg-card/40"
    }`}>
      <span className={`mt-0.5 size-2 rounded-full ${
        state === "ok" ? "bg-emerald-400" :
        state === "running" ? "bg-primary animate-pulse" :
        state === "error" ? "bg-destructive" : "bg-muted-foreground/40"
      }`} />
      <div className="flex-1">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-muted-foreground">
          {state === "idle" && "Waiting"}
          {state === "running" && "Running…"}
          {state === "ok" && "Done"}
          {state === "error" && (error ?? "Failed")}
        </div>
      </div>
    </div>
  );

  const imgState = stageMut.isPending ? "running" : imageError ? "error" : stagedImage ? "ok" : "idle";
  const vidState = animateMut.isPending ? "running" : videoError ? "error" : videoUrl ? "ok" : "idle";

  const motionControls = (
    motionVal: string,
    onMotion: (v: string) => void,
    cameraVal: string,
    onCamera: (v: string) => void,
  ) => (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Motion</label>
        <Select value={motionVal} onValueChange={onMotion}>
          <SelectTrigger className="bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTION_TYPES_UI.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><Camera className="size-3.5" /> Camera</label>
        <Select value={cameraVal} onValueChange={onCamera}>
          <SelectTrigger className="bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTION_CAMERA.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const tabBtn = (m: Mode, label: string, Icon: typeof Film) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex items-center justify-center gap-2 text-xs md:text-sm font-medium px-3 py-2.5 rounded-xl border transition-colors ${
        mode === m ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
      }`}
    >
      <Icon className="size-4" /> {label}
    </button>
  );

  const WIZARD_STEPS = [
    { n: 1, label: "Assets" },
    { n: 2, label: "Direction" },
    { n: 3, label: "Review" },
  ];

  const WizardUploadCard = ({
    n, label, hint, required: req, value, onChange, kind = "image",
  }: {
    n: string; label: string; hint: string; required?: boolean;
    value: string | null; onChange: (v: string | null) => void; kind?: "image" | "video";
  }) => (
    <div className={`relative rounded-2xl border overflow-hidden transition-colors ${value ? "border-primary/50 bg-primary/5" : "border-border bg-card/30"}`}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {n}
          </span>
          <span className="text-sm font-semibold text-foreground">{label}{req && <span className="text-destructive ml-0.5">*</span>}</span>
        </div>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive transition-colors">
            <span className="text-xs">✕</span>
          </button>
        )}
      </div>
      <p className="px-4 pb-2 text-[11px] text-muted-foreground">{hint}</p>
      <div className="mx-3 mb-3 rounded-xl overflow-hidden border border-border bg-background/40" style={{ minHeight: 140 }}>
        {value ? (
          kind === "video" ? (
            <AutoplayVideo src={value} className="w-full h-40 object-cover" loop playsInline />
          ) : (
            <img src={value} alt={label} className="w-full h-40 object-cover" />
          )
        ) : (
          <UploadSlot
            userId={user.id}
            label=""
            hint={`Click to upload`}
            value={value}
            onChange={onChange}
            kind={kind}
            accept={kind === "video" ? "video/*" : "image/*"}
          />
        )}
      </div>
    </div>
  );

  return (
    <main className="aurora-page-shell text-foreground lg:flex lg:flex-row lg:h-[100dvh] lg:overflow-hidden">
      <span aria-hidden className="aurora-ambient" />
      <WelcomeTour show={showTour} onDismiss={() => setShowTour(false)} />
      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[300px] lg:shrink-0 lg:h-full lg:overflow-y-auto lg:border-r lg:border-white/8 scrollbar-none">

        {/* ── Feature card ──────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden m-3 mb-0 rounded-2xl flex-shrink-0"
          style={{ minHeight: 144, background: "#111" }}
        >
          <img
            src="/josh/josh-concert-performance.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.55 }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.25) 65%, transparent 100%)" }}
          />
          <div className="relative flex flex-col p-3.5" style={{ minHeight: 144 }}>
            <div className="flex items-center justify-between">
              <Link
                to="/studio"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-white/60 no-underline hover:text-white/90 transition-colors"
                style={{ background: "rgba(0,0,0,0.5)" }}
              >
                <ArrowLeft className="size-3" /> Studio
              </Link>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-white/60 hover:text-white/90 transition-colors"
                style={{ background: "rgba(0,0,0,0.5)" }}
              >
                <BookOpen className="size-3" /> How it works
              </button>
            </div>
            <div className="mt-auto pt-8">
              <div className="font-black text-xl uppercase tracking-tight leading-tight" style={{ color: "#CCFF00" }}>
                PERFORM ANYWHERE
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                Place yourself inside any scene — no studio, no crew
              </div>
            </div>
          </div>
        </div>

        <ConnectReplicateBanner />

        {/* ── Mode strip ────────────────────────────────────────────── */}
        <div className="px-3 pt-2 pb-0 flex-shrink-0">
          <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {([
              { m: "reskin"       as Mode, label: "Performance Shot", Icon: Users        },
              { m: "pose"         as Mode, label: "Pose → Video",     Icon: Wand2        },
              { m: "transfer"     as Mode, label: "Motion Transfer",  Icon: Clapperboard },
              { m: "avatar-shots" as Mode, label: "Avatar Shots",     Icon: Sparkles     },
              { m: "live-avatar"  as Mode, label: "Live Avatar",      Icon: Film         },
              { m: "music-video"  as Mode, label: "Music Video",      Icon: Music2       },
            ]).map(({ m, label, Icon }) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1 shrink-0 text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                  mode === m
                    ? "bg-primary/15 text-white border border-primary/40"
                    : "bg-transparent text-zinc-500 border border-transparent hover:text-zinc-300",
                )}
              >
                <Icon className="size-3" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mobile: inspiration ───────────────────────────────────── */}
        <div className="lg:hidden p-4 space-y-6">
          <MotionInspirationBlock />
          <PerformAnywhereGuide />
        </div>

        {/* ── Mode panels ───────────────────────────────────────────── */}
        <div className="p-3 space-y-4 flex-1 overflow-y-auto scrollbar-none">

        {/* ── Performance Shot (wizard) ──────────────────────────────── */}
        {mode === "reskin" && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-8">
            <section className="space-y-6">
              {/* offline banner */}
              {!motionOnline && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <WifiOff className="size-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-300">No motion worker online</p>
                    <p className="text-xs text-amber-300/70 mt-0.5">Performance Shot runs on a self-hosted GPU (MimicMotion). Finish the Vast.ai worker setup to enable this. Cloud image generation above works now.</p>
                  </div>
                </div>
              )}

              {/* wizard step indicator */}
              <div className="flex items-center gap-1">
                {WIZARD_STEPS.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (s.n < wizardStep || (s.n === 2 && rsVideo && rsAvatar) || (s.n === 3 && rsVideo && rsAvatar)) {
                          setWizardStep(s.n as 1 | 2 | 3);
                        }
                      }}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        wizardStep === s.n
                          ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)]"
                          : wizardStep > s.n
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-card/40 text-muted-foreground border border-border"
                      }`}
                    >
                      {wizardStep > s.n ? <Check className="size-3" /> : <span>{s.n}</span>}
                      {s.label}
                    </button>
                    {i < WIZARD_STEPS.length - 1 && (
                      <ArrowRight className="size-3 text-muted-foreground/40 shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {/* ── Step 1: Assets ─────────────────────────────────── */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">New Project</p>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Compose a performance</h1>
                    <p className="text-muted-foreground text-sm mt-1.5 max-w-lg">
                      Four inputs — Aurora routes them to the best motion model and renders a new take that preserves your timing.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">Project title</label>
                    <input
                      value={rsTitle}
                      onChange={(e) => setRsTitle(e.target.value)}
                      placeholder="Untitled performance"
                      className="w-full h-11 rounded-xl border border-border bg-card/60 px-4 text-sm outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <WizardUploadCard n="01" label="Performance video" hint="≤ 30s · MP4, MOV, WebM" required value={rsVideo} onChange={setRsVideo} kind="video" />
                    <WizardUploadCard n="02" label="Identity photo" hint="Clear face · JPG, PNG" required value={rsAvatar} onChange={setRsAvatar} />
                    <WizardUploadCard n="03" label="Outfit reference" hint="Optional · clothing" value={rsOutfitImg} onChange={setRsOutfitImg} />
                    <WizardUploadCard n="04" label="Scene reference" hint="Optional · environment" value={rsSceneImg} onChange={setRsSceneImg} />
                  </div>

                  <p className="text-xs text-muted-foreground">Performance video and identity photo are required to continue.</p>

                  <Button
                    disabled={!rsVideo || !rsAvatar}
                    onClick={() => setWizardStep(2)}
                    variant="premium"
                    className="w-full h-12"
                  >
                    Continue to Direction <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* ── Step 2: Direction ──────────────────────────────── */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Step 2 of 3</p>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Direction</h1>
                    <p className="text-muted-foreground text-sm mt-1.5">Describe the style, outfit, and scene. Keep the context prompt short and specific.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outfit notes <span className="normal-case text-muted-foreground/60">(optional)</span></label>
                      <input
                        value={rsOutfit}
                        onChange={(e) => setRsOutfit(e.target.value)}
                        placeholder="black leather jacket, white kicks"
                        className="w-full h-10 rounded-xl border border-border bg-card/60 px-3 text-sm outline-none focus:border-primary/60 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scene / location <span className="normal-case text-muted-foreground/60">(optional)</span></label>
                      <input
                        value={rsLocation}
                        onChange={(e) => setRsLocation(e.target.value)}
                        placeholder="golden hour, LA suburb street"
                        className="w-full h-10 rounded-xl border border-border bg-card/60 px-3 text-sm outline-none focus:border-primary/60 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Context prompt <span className="normal-case text-muted-foreground/60">— tells AI what's happening, prevents artifacts</span></label>
                    <Textarea
                      rows={2}
                      value={rsMotion === "faithful" ? "a man rapping in a studio" : rsMotion}
                      onChange={() => {}}
                      placeholder="a man rapping inside a studio"
                      className="resize-none bg-card/60 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Keep it simple: "a man rapping inside a car", "a woman dancing on a rooftop". This constrains the AI to the correct environment.</p>
                  </div>

                  {motionControls(rsMotion, setRsMotion, rsCamera, setRsCamera)}

                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setWizardStep(1)} className="flex-1 h-11">
                      ← Back
                    </Button>
                    <Button variant="premium" onClick={() => setWizardStep(3)} className="flex-[2] h-11">
                      Review & Generate <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Review ─────────────────────────────────── */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Step 3 of 3</p>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Review</h1>
                    <p className="text-muted-foreground text-sm mt-1.5">Double-check your inputs before rendering.</p>
                  </div>

                  <div className="rounded-2xl border border-border overflow-hidden">
                    {[
                      { label: "TITLE", value: rsTitle || "Untitled performance" },
                      { label: "PERFORMANCE", value: rsVideo ? "Video uploaded ✓" : "—" },
                      { label: "IDENTITY", value: rsAvatar ? "Photo uploaded ✓" : "—" },
                      { label: "OUTFIT REF", value: rsOutfitImg ? "Image uploaded ✓" : rsOutfit || "—" },
                      { label: "SCENE REF", value: rsSceneImg ? "Image uploaded ✓" : rsLocation || "—" },
                      { label: "MOTION STYLE", value: rsMotion },
                      { label: "CAMERA", value: rsCamera },
                    ].map((row, i) => (
                      <div key={i} className={`flex gap-4 px-5 py-3 text-sm ${i % 2 === 0 ? "bg-card/20" : "bg-card/40"}`}>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-28 shrink-0 mt-0.5">{row.label}</span>
                        <span className="text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">Rendering typically takes 2–3 min · standard quality. You can leave this page — check your Gallery for results.</p>

                  <GenerationProgress
                    visible={reskinProgress.isActive}
                    progress={reskinProgress.progress}
                    label={reskinProgress.label}
                  />

                  <GenerationErrorCard
                    visible={reskinMut.isError}
                    error={rsError}
                    onRetry={() => reskinMut.mutate()}
                  />

                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setWizardStep(2)} className="flex-1 h-12">
                      ← Back
                    </Button>
                    <Button
                      disabled={reskinMut.isPending || !rsVideo || !rsAvatar || !motionOnline}
                      onClick={() => reskinMut.mutate()}
                      variant="premium"
                      className="flex-[2] h-12"
                    >
                      {reskinMut.isPending ? (
                        <><Loader2 className="size-4 mr-2 animate-spin" /> Submitting…</>
                      ) : !motionOnline ? (
                        <><WifiOff className="size-4 mr-2" /> No motion worker online</>
                      ) : reskinPreviewId ? (
                        <><Users className="size-4 mr-2" /> Render full Performance Shot · {computeCost({ features: ["video", "motion"] }).total} Aura</>
                      ) : (
                        <><Sparkles className="size-4 mr-2" /> Preview Performance Shot · {Math.max(1, Math.ceil(computeCost({ features: ["video", "motion"] }).total * 0.5))} Aura</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* aside — progress only */}
            <aside ref={reskinAsideRef} className="space-y-4">
              <div className={cn(
                "rounded-3xl overflow-hidden border bg-card/60 backdrop-blur-xl aspect-[4/5] relative transition-colors duration-500",
                reskinProgress.isActive ? "border-primary/50" : "border-border",
              )}>
                {reskinProgress.isActive ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-muted-foreground">
                    <div className="size-14 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                      <Loader2 className="size-6 animate-spin text-primary-foreground" />
                    </div>
                    <GenerationProgress visible progress={reskinProgress.progress} label={reskinProgress.label} />
                  </div>
                ) : reskinMut.isSuccess ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <Link to="/gallery" className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors">
                      <Check className="size-4" /> Queued — View in Gallery
                    </Link>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                    <Film className="size-10 text-primary/40" />
                    <p className="text-sm">Your performance video will appear here when ready.</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ── Pose → Video ─────────────────────────────────────────────── */}
        {mode === "pose" && (
          <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
            <section className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Pose → Video</h1>
                <p className="text-muted-foreground text-sm mt-1">Stage a selfie into a cinematic pose, then animate it. Two steps, two retry buttons.</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Stage a pose</p>
                <div className="grid grid-cols-3 gap-2">
                  <UploadSlot userId={user.id} label="You" hint="Selfie" value={selfie} onChange={setSelfie} />
                  <UploadSlot userId={user.id} label="Outfit" hint="Wear" value={outfit} onChange={setOutfit} />
                  <UploadSlot userId={user.id} label="Pose ref" hint="Reference photo" value={poseRef} onChange={setPoseRef} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Or skip staging — interpolate between two frames
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <UploadSlot userId={user.id} label="First frame" hint="Start image" value={startFrame} onChange={setStartFrame} />
                  <UploadSlot userId={user.id} label="Last frame" hint="End image (Kling)" value={endFrame} onChange={setEndFrame} />
                </div>
              </div>

              {!stagedImage && !startFrame && demoStageStatus === "loading" && (
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                  Preparing the quick-start demo…
                </p>
              )}
              {!stagedImage && !startFrame && demoStageStatus === "error" && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs" role="alert">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-destructive">Quick-start demo unavailable</p>
                    <p className="mt-0.5 text-destructive/80">{demoStageError ?? "Could not prepare the sample image."}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDemoStageAttempt((attempt) => attempt + 1)}
                    className="shrink-0 rounded-lg border border-destructive/40 px-2.5 py-1.5 font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Retry
                  </button>
                </div>
              )}

              <ExampleChips
                presets={MOTION_EXAMPLE_PRESETS}
                activeId={activeExampleId}
                onSelect={(preset) => {
                  if (preset.prompt) setVideoPrompt(preset.prompt);
                  if (preset.extra?.pose) {
                    const found = POSE_PRESETS.find((p) => p.id === preset.extra!.pose);
                    if (found) setPose(found);
                  }
                  if (preset.extra?.cameraMovement) setCameraMovement(String(preset.extra.cameraMovement));
                  setActiveExampleId(preset.id);
                }}
                onGenerate={() => {
                  if (!stagedImage && !startFrame) {
                    if (!usableDemoUrl) {
                      if (demoStageStatus === "error") {
                        setDemoStageAttempt((attempt) => attempt + 1);
                        return;
                      }
                      toast.error("Demo selfie is still loading — try again in a second");
                      return;
                    }
                    animateOverrideRef.current = usableDemoUrl;
                  }
                  animateMut.mutate();
                }}
                generateDisabled={animateMut.isPending || (!stagedImage && !startFrame && demoStageStatus === "loading")}
                label="Quick start:"
                className="mb-1"
              />

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pose preset</label>
                <div className="flex flex-wrap gap-2">
                  {POSE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPose(p)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${pose.id === p.id ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card/60 hover:border-primary/40"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><Camera className="size-3.5" /> Camera move</label>
                <Select value={cameraMovement} onValueChange={setCameraMovement}>
                  <SelectTrigger className="bg-card/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMERA_MOVES.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Camera move is injected into the prompt — included at no extra Aura; effect strength depends on the video model.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Video model</label>
                <Select value={videoModel} onValueChange={setVideoModel}>
                  <SelectTrigger className="bg-card/60"><SelectValue /></SelectTrigger>
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
              </div>

              <Textarea rows={2} value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} className="resize-none bg-card/60 text-sm" />

              <ResolutionPicker
                resolution={videoResolution}
                onChange={setVideoResolution}
                isPro={isPro}
                features={["video"]}
                durationSeconds={5}
                model={videoModel}
              />

              <PlanLimitNotice warnings={animatePlanWarnings} />

              <div className="grid grid-cols-2 gap-2">
                {stepBadge("1. Stage pose (image)", imgState as "idle" | "running" | "ok" | "error", imageError)}
                {stepBadge("2. Animate (video)", vidState as "idle" | "running" | "ok" | "error", videoError)}
              </div>

              {/* Exact next-click charge — mirrors the server's computeCost call so the
                  shown price can never drift from what Animate actually deducts. */}
              <div className="rounded-xl border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Animate will charge</span>
                  <span className="font-semibold text-foreground">
                    {activeAnimatePreviewId ? animateCost : animatePreviewCost} Aura
                  </span>
                </div>
                <p className="mt-0.5">
                  {activeAnimatePreviewId
                    ? `Full-quality ${videoResolution === "2160p" ? "4K" : videoResolution} render · 5s video`
                    : "480p preview · 5s video"}
                  {" "}· pose preset & camera move included free
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={stageMut.isPending || !selfie}
                  onClick={() => stageMut.mutate()}
                  variant="premium"
                  className="flex-1 h-12"
                >
                  {stageMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Staging…</> : <><Wand2 className="size-4 mr-2" /> {imageError ? "Retry pose" : stagedImage ? "Re-stage" : "Stage pose · 10 Aura"}</>}
                </Button>
                <Button
                  disabled={animateMut.isPending || animatePlanBlocked || (!stagedImage && !startFrame)}
                  onClick={() => {
                    const isHd = videoResolution === "1080p" || videoResolution === "2160p";
                    if (activeAnimatePreviewId && isHd) {
                      setAnimateHdDialogOpen(true);
                    } else {
                      animateMut.mutate();
                    }
                  }}
                  variant="secondary"
                  className="flex-1 h-12"
                >
                  {animateMut.isPending ? (
                    <><Loader2 className="size-4 mr-2 animate-spin" /> Rendering…</>
                  ) : (
                    <><Film className="size-4 mr-2" /> {videoError ? "Retry animate" : activeAnimatePreviewId ? `Render full quality · ${animateCost} Aura` : `Preview animation · ${animatePreviewCost} Aura`}</>
                  )}
                </Button>
                <AlertDialog open={animateHdDialogOpen} onOpenChange={setAnimateHdDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Render at {videoResolution === "2160p" ? "4K (2160p)" : "HD (1080p)"}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will charge <strong>{animateCost} Aura</strong> from your balance to produce a full-quality {videoResolution === "2160p" ? "4K" : "HD"} video render.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => animateMut.mutate()}>
                        Confirm &amp; Render
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {(stageProgress.isActive || animateProgress.isActive) && (
                <div className="space-y-2">
                  {stageProgress.isActive && (
                    <GenerationProgress
                      visible
                      progress={stageProgress.progress}
                      label={stageProgress.label}
                    />
                  )}
                  {animateProgress.isActive && (
                    <GenerationProgress
                      visible
                      progress={animateProgress.progress}
                      label={animateProgress.label}
                    />
                  )}
                </div>
              )}

              <GenerationErrorCard
                visible={stageMut.isError}
                error={imageError}
                onRetry={() => stageMut.mutate()}
                retryLabel="Retry pose"
              />
              <GenerationErrorCard
                visible={animateMut.isError && !stageMut.isError}
                error={videoError}
                onRetry={() => animateMut.mutate()}
                retryLabel="Retry animate"
              />
            </section>
            <aside className="space-y-4">
              <div className="rounded-3xl overflow-hidden border border-border bg-card/60 backdrop-blur-xl aspect-[4/5] relative">
                {(stageMut.isPending || animateMut.isPending) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-muted-foreground">
                    <div className="size-14 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                      <Loader2 className="size-6 animate-spin text-primary-foreground" />
                    </div>
                    <div className="w-full space-y-2">
                      <p className="text-sm text-center">{stageMut.isPending ? stageProgress.label : animateProgress.label}</p>
                      <GenerationProgress visible progress={stageMut.isPending ? stageProgress.progress : animateProgress.progress} />
                    </div>
                  </div>
                ) : animateMut.isSuccess ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <Link to="/gallery" className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors">
                      <Check className="size-4" /> Queued — View in Gallery
                    </Link>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                    <Sparkles className="size-10 text-primary/50" />
                    <p className="text-sm">Your motion clip will appear here.</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ── Motion Transfer — primary Higgsfield-style panel ──────── */}
        {mode === "transfer" && (
          <div className="space-y-2.5">

            {/* Offline banner */}
            {!motionOnline && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm">
                <WifiOff className="size-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-300">No motion worker online</p>
                  <p className="text-[11px] text-amber-300/70 mt-0.5">Register a GPU worker with the <strong>motion</strong> capability in the admin panel to enable this.</p>
                </div>
              </div>
            )}

            {/* ── Upload card 1: motion reference video ──────────────── */}
            <div
              className={cn(
                "relative rounded-2xl overflow-hidden border transition-all",
                mtVideo ? "border-primary/40 bg-zinc-900/80" : "border-white/10 bg-zinc-900/50",
              )}
            >
              {mtVideo ? (
                <>
                  <AutoplayVideo src={mtVideo} className="w-full h-28 object-cover" loop playsInline muted />
                  <button
                    type="button"
                    onClick={() => setMtVideo(null)}
                    className="absolute top-2 right-2 size-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white/70 hover:text-white transition-colors"
                    style={{ background: "rgba(0,0,0,0.65)" }}
                    aria-label="Remove video"
                  >
                    ✕
                  </button>
                  <div className="px-3.5 py-2.5 border-t border-white/5">
                    <div className="text-xs font-semibold text-white/80">Motion video added ✓</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Video duration: 3–30 seconds</div>
                  </div>
                </>
              ) : (
                <UploadSlot
                  userId={user.id}
                  label="Add motion to copy"
                  hint="Video duration: 3–30 seconds"
                  value={mtVideo}
                  onChange={setMtVideo}
                  kind="video"
                  accept="video/*"
                />
              )}
            </div>

            {/* ── Upload card 2: character image ─────────────────────── */}
            <div
              className={cn(
                "relative rounded-2xl overflow-hidden border transition-all",
                mtImage ? "border-primary/40 bg-zinc-900/80" : "border-white/10 bg-zinc-900/50",
              )}
            >
              {mtImage ? (
                <>
                  <img src={mtImage} alt="Character" className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => setMtImage(null)}
                    className="absolute top-2 right-2 size-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white/70 hover:text-white transition-colors"
                    style={{ background: "rgba(0,0,0,0.65)" }}
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                  <div className="px-3.5 py-2.5 border-t border-white/5">
                    <div className="text-xs font-semibold text-white/80">Character added ✓</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Image with visible face and body</div>
                  </div>
                </>
              ) : (
                <UploadSlot
                  userId={user.id}
                  label="Add your character"
                  hint="Image with visible face and body"
                  value={mtImage}
                  onChange={setMtImage}
                  kind="image"
                  accept="image/*"
                />
              )}
            </div>

            {/* ── Second image swap (deep-link handoff) ──────────────── */}
            {mtImage2 && mtImage2 !== mtImage && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <img src={mtImage2} alt="Second shot" className="w-10 h-14 object-cover rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70">Second shot available</p>
                  <p className="text-[11px] text-white/40 mt-0.5">Swap to animate this one instead</p>
                </div>
                <button
                  type="button"
                  onClick={() => { const tmp = mtImage2; setMtImage2(mtImage ?? null); setMtImage(tmp); }}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                >
                  Swap
                </button>
              </div>
            )}

            {/* ── Model + Quality rows ───────────────────────────────── */}
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 overflow-hidden divide-y divide-white/5">
              {/* Model */}
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="text-xs text-zinc-500 font-medium">Model</span>
                <Select value={videoModel} onValueChange={setVideoModel}>
                  <SelectTrigger className="h-auto border-none bg-transparent shadow-none px-0 py-0 text-sm text-white/80 font-normal w-auto gap-1.5 focus:ring-0 [&>svg]:hidden">
                    <SelectValue />
                    <ChevronRight className="size-3.5 text-zinc-500 shrink-0" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_MODEL_LIST.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex flex-col">
                          <span>{m.label}</span>
                          {m.tagline && <span className="text-[10px] text-muted-foreground">{m.tagline}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Quality */}
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="text-xs text-zinc-500 font-medium">Quality</span>
                <button
                  type="button"
                  onClick={() => {
                    // HD is Pro-gated (same lock as the ResolutionPicker): don't
                    // cycle a Free user into a resolution their plan can't render.
                    // A stale 1080p selection also recovers here: indexOf → -1 → 480p.
                    const opts = (isPro ? ["480p", "720p", "1080p"] : ["480p", "720p"]) as Resolution[];
                    const idx = opts.indexOf(videoResolution);
                    setVideoResolution(opts[(idx + 1) % opts.length]);
                  }}
                  className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
                >
                  {videoResolution} <ChevronRight className="size-3.5 text-zinc-500" />
                </button>
              </div>
            </div>

            {/* ── Advanced options (collapsed) ───────────────────────── */}
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors list-none py-1 select-none">
                <ChevronRight className="size-3 transition-transform duration-200 group-open:rotate-90" />
                Advanced options
              </summary>
              <div className="mt-2.5 space-y-3 pt-2.5 border-t border-white/5">
                {motionControls(mtMotion, setMtMotion, mtCamera, setMtCamera)}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Style prompt <span className="normal-case font-normal opacity-60">(optional)</span></label>
                  <Textarea rows={2} value={mtPrompt} onChange={(e) => setMtPrompt(e.target.value)} placeholder="cinematic lighting, 4K…" className="resize-none bg-card/60 text-sm" />
                </div>
              </div>
            </details>

            {/* ── Progress + errors ──────────────────────────────────── */}
            <GenerationProgress visible={transferProgress.isActive} progress={transferProgress.progress} label={transferProgress.label} />
            <GenerationErrorCard visible={transferMut.isError} error={mtError} onRetry={() => transferMut.mutate()} />

            {/* ── Generate button (lime) ─────────────────────────────── */}
            <button
              type="button"
              disabled={transferMut.isPending || !mtImage || !mtVideo || !motionOnline}
              onClick={() => transferMut.mutate()}
              className="w-full h-14 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2.5 transition-opacity disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #CCFF00 0%, #AAFF00 100%)", color: "#0A0A0A" }}
            >
              {transferMut.isPending ? (
                <><Loader2 className="size-5 animate-spin" style={{ color: "#0A0A0A" }} /> Queuing…</>
              ) : !motionOnline ? (
                <><WifiOff className="size-5" /> No motion worker</>
              ) : (
                <><Sparkles className="size-5" style={{ color: "#0A0A0A" }} /> Generate · {transferPreviewId ? computeCost({ features: ["motion"] }).total : Math.max(1, Math.ceil(computeCost({ features: ["motion"] }).total * 0.5))} Aura</>
              )}
            </button>

            {transferMut.isSuccess && (
              <Link
                to="/gallery"
                className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-400 no-underline hover:bg-emerald-500/20 transition-colors"
              >
                <Check className="size-4" /> Queued — View in Gallery
              </Link>
            )}

            <p className="text-[11px] text-zinc-600 pb-1">First render is a short discounted preview — review in Gallery, then render the full clip. Runs on a self-hosted GPU backend.</p>
          </div>
        )}

        {/* ── Avatar Shots ──────────────────────────────────────────── */}
        {mode === "avatar-shots" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Avatar Shots</h1>
              <p className="text-muted-foreground text-sm mt-1">Generate AI portraits and live videos with SeedDream, Gemini Omni, or KlingAI.</p>
            </div>

            {/* Engine picker */}
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI Engine</p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { id: "seedream" as ShotEngine, label: "SeedDream", sub: "Portrait", cost: SHOT_IMAGE_COST, icon: "🌱", kind: "image" as const },
                    { id: "gemini" as ShotEngine, label: "Gemini Omni", sub: "Enhanced", cost: SHOT_IMAGE_COST, icon: "✨", kind: "image" as const },
                    { id: "kling" as ShotEngine, label: "KlingAI", sub: "Live Video", cost: SHOT_KLING_COST, icon: "🎬", kind: "video" as const },
                  ]
                ).map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => setShotEngine(eng.id)}
                    className={`flex flex-col items-center gap-1 px-3 py-4 rounded-2xl border text-center transition-all ${
                      shotEngine === eng.id
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xl">{eng.icon}</span>
                    <span className="text-sm font-semibold">{eng.label}</span>
                    <span className="text-[10px] opacity-60">{eng.sub}</span>
                    <span className="text-xs font-medium text-primary mt-1">{eng.cost} Aura</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Prompt */}
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Prompt</p>
              <Textarea
                rows={4}
                value={shotPrompt}
                onChange={(e) => setShotPrompt(e.target.value)}
                placeholder={
                  shotEngine === "kling"
                    ? "Describe the scene: 'Rapper in neon-lit studio, confident energy, cinematic camera move…'"
                    : "Describe your avatar shot: 'Professional rapper portrait, studio lighting, dark background…'"
                }
                className="resize-none bg-card/60 text-sm"
              />
              <Button
                disabled={shotLoading || !shotPrompt.trim()}
                onClick={async () => {
                  const trimmed = shotPrompt.trim();
                  if (!trimmed) return toast.error("Enter a prompt first");
                  setShotLoading(true);
                  try {
                    const res = await shotFn({ data: { prompt: trimmed, engine: shotEngine } });
                    if (!res.ok) {
                      toast.error(res.error ?? "Generation failed");
                    } else {
                      // Trust the server's report of what ACTUALLY served the shot — when the
                      // KlingAI→SeedDream fallback fires the result is a still, not a video.
                      setShotResults((prev) => [
                        { url: res.url, engine: res.engine, kind: res.mediaKind, fallbackFrom: res.fallbackFrom },
                        ...prev,
                      ]);
                      if (res.fallbackFrom === "kling") toast.info(KLING_FALLBACK_TOAST);
                      else toast.success("Shot ready!");
                    }
                  } catch {
                    toast.error("Generation failed");
                  } finally {
                    setShotLoading(false);
                  }
                }}
                variant="premium"
                className="w-full h-12"
              >
                {shotLoading ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="size-4 mr-2" /> Generate · {shotEngine === "kling" ? SHOT_KLING_COST : SHOT_IMAGE_COST} Aura</>
                )}
              </Button>
            </section>

            {!shotLoading && <ShotResultsSection results={shotResults} />}

            {shotResults.length === 0 && !shotLoading && (
              <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-primary/20 bg-card/50 text-center">
                <img
                  src={shotEngine === "kling" ? "/gallery/josh-neon-tech.png" : "/gallery/josh-blue-portrait.png"}
                  alt={shotEngine === "kling" ? "Neon-lit avatar video inspiration" : "Portrait generation inspiration"}
                  loading="lazy"
                  className="h-44 w-full object-cover"
                />
                <div className="px-4 py-4 text-muted-foreground/70">
                <p className="text-sm">
                  {shotEngine === "kling"
                    ? "Describe a scene and KlingAI will create a live avatar video"
                    : "Describe your avatar and get an AI-generated portrait"}
                </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Live Avatar ───────────────────────────────────────────────── */}
        {mode === "live-avatar" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <figure className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card">
              <img src="/gallery/josh-neon-tech.png" alt="Neon-lit creator portrait demonstrating a live avatar scene" loading="lazy" className="h-48 w-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10 text-xs text-white/80">
                Turn a scene direction into a talking-head performance.
              </figcaption>
            </figure>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Live Avatar</h1>
              <p className="text-muted-foreground text-sm mt-1">Describe a scene and KlingAI animates your avatar as a live talking-head video.</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex items-start gap-2">
              <Zap className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Powered by KlingAI</p>
                <p className="text-xs text-muted-foreground mt-0.5">Generates a 5-second animated avatar video. No source video required.</p>
              </div>
            </div>
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scene prompt</p>
              <Textarea
                rows={5}
                value={shotPrompt}
                onChange={(e) => setShotPrompt(e.target.value)}
                placeholder="A confident artist in a neon-lit recording studio, gesturing expressively, cinematic slow zoom…"
                className="resize-none bg-card/60 text-sm"
              />
              <Button
                disabled={shotLoading || !shotPrompt.trim()}
                onClick={async () => {
                  const trimmed = shotPrompt.trim();
                  if (!trimmed) return toast.error("Enter a prompt first");
                  setShotLoading(true);
                  try {
                    const res = await shotFn({ data: { prompt: trimmed, engine: "kling" } });
                    if (!res.ok) {
                      toast.error(res.error ?? "Generation failed");
                    } else {
                      setShotResults((prev) => [
                        { url: res.url, engine: res.engine, kind: res.mediaKind, fallbackFrom: res.fallbackFrom },
                        ...prev,
                      ]);
                      if (res.fallbackFrom === "kling") toast.info(KLING_FALLBACK_TOAST);
                      else toast.success("Live avatar ready!");
                    }
                  } catch {
                    toast.error("Generation failed");
                  } finally {
                    setShotLoading(false);
                  }
                }}
                variant="premium"
                className="w-full h-12"
              >
                {shotLoading ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Generating live avatar…</>
                ) : (
                  <><Film className="size-4 mr-2" /> Generate Live Avatar · {SHOT_KLING_COST} Aura</>
                )}
              </Button>
            </section>

            {!shotLoading && <ShotResultsSection results={shotResults.filter((r) => r.engine === "kling" || r.fallbackFrom === "kling")} />}
          </div>
        )}

        {/* ── Music Video ───────────────────────────────────────────────── */}
        {mode === "music-video" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Music Video Maker</h1>
              <p className="text-muted-foreground text-sm mt-1">Build cinematic music videos with AI — beat-sync, lyric video, or AI performance.</p>
            </div>
            <figure className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card">
              <img src="/gallery/josh-pink-mic.png" alt="Performance portrait demonstrating an AI music video direction" loading="lazy" className="h-52 w-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-12">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Performance direction</span>
                <span className="block text-sm font-semibold text-white">Start with a look. Build the cut around the song.</span>
              </figcaption>
            </figure>

            {/* Genre / Style */}
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Genre / Style</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(MUSIC_VIDEO_STYLES) as [MusicVideoStyle, (typeof MUSIC_VIDEO_STYLES)[MusicVideoStyle]][]).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMvStyle(key)}
                    className={cn(
                      "relative rounded-2xl border p-3 text-left transition-all",
                      `bg-gradient-to-br ${meta.colorClass}`,
                      mvStyle === key ? "ring-2 ring-primary border-primary/60" : "border-white/10 hover:border-white/20",
                    )}
                  >
                    <div className="text-xl mb-0.5">{meta.emoji}</div>
                    <div className="font-semibold text-sm">{meta.label}</div>
                    <div className="text-[10px] text-white/60 mt-0.5">{meta.description}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Mode tabs */}
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What to create</p>
              <div className="grid grid-cols-3 gap-2">
                {MUSIC_VIDEO_MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMvMode(m.key)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-xs font-medium text-left transition-colors",
                      mvMode === m.key
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

            {/* Lyric Video: song + lyrics */}
            {isMvLyric && (
              <section className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Song</p>
                <UploadSlot
                  userId={user.id}
                  label="Upload"
                  hint="MP3 / WAV / M4A — your track"
                  accept={AUDIO_ACCEPT}
                  kind="video"
                  value={lyricAudioUrl}
                  onChange={setLyricAudioUrl}
                />
                {lyricAudioUrl && lyricAudioDuration == null && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Reading duration…</p>
                )}
                {lyricAudioDuration != null && (
                  <p className="text-xs text-muted-foreground">Duration: {Math.round(lyricAudioDuration)}s</p>
                )}
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground pt-1">
                  Lyrics{" "}
                  <span className="ml-1 font-normal normal-case opacity-60">
                    {lyricBeatTimestamps
                      ? "one line per lyric — snapped to the detected beat grid"
                      : lyricGenerationGate === "pending"
                        ? "one line per lyric — detecting beats…"
                        : "one line per lyric — beat detection unavailable, evenly timed"}
                  </span>
                </p>
                <Textarea
                  rows={7}
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  className="resize-none bg-card/60 text-sm"
                  placeholder={"Paste your lyrics here, one line at a time…\n\nLine one\nLine two\nLine three"}
                />
                {lyricLines.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {lyricLines.length} line{lyricLines.length === 1 ? "" : "s"}
                    {lyricAudioDuration != null && lyricSegments.length > 0
                      ? lyricBeatTimestamps
                        ? ` · beat-aligned (${lyricBeatTimestamps.length} beats detected)`
                        : ` · ~${(lyricAudioDuration / lyricLines.length).toFixed(1)}s per line`
                      : ""}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl border border-border bg-card/40 px-3 py-2">
                  <Zap className="size-3.5 text-primary" />
                  Cost: <span className="text-foreground font-medium">{mvDisplayCost} Aura</span>
                  <span className="opacity-50">·</span>
                  ETA: <span className="text-foreground font-medium">~20–40s</span>
                </div>
                <Button
                  disabled={lyricGenerationGate !== "ready" || lyricSegments.length === 0}
                  onClick={async () => {
                    if (!lyricAudioUrl) return toast.error("Upload a song first");
                    if (lyricGenerationGate === "pending") {
                      return toast.error("Beat analysis is still running — wait a moment before generating.");
                    }
                    if (lyricSegments.length === 0) return toast.error("Paste at least one lyric line");
                    const res = await lyricVideoFn({ data: { audioUrl: lyricAudioUrl, lines: lyricSegments } });
                    if (!res.ok) { toast.error(res.error); return; }
                    markFirstGenComplete();
                    toast.success("Lyric video queued — check your Gallery");
                    qc.invalidateQueries({ queryKey: ["motion-gens"] });
                  }}
                  variant="premium"
                  className="w-full h-12"
                >
                  <Wand2 className="size-4 mr-2" /> Generate Lyric Video · {mvDisplayCost} Aura
                </Button>
                {lyricGenerationGate === "pending" ? (
                  <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" /> Detecting the beat grid before timing your lyrics…
                  </p>
                ) : (!lyricAudioUrl || lyricSegments.length === 0) && (
                  <p className="text-center text-xs text-muted-foreground">
                    {!lyricAudioUrl ? "↑ Upload a song to continue" : "↑ Paste at least one lyric line"}
                  </p>
                )}
              </section>
            )}

            {/* Reference image (for modes that need it) */}
            {!isMvLyric && mvCurrentMode?.needsImage && (
              <section className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference image</p>
                <UploadSlot userId={user.id} label="Upload" hint="Cover art, still, or footage frame" value={mvImage} onChange={setMvImage} />
              </section>
            )}

            {/* Scene details */}
            {!isMvLyric && (mvMode === "text-to-video" || mvMode === "ai-performance" || mvMode === "beat-sync") && (
              <section className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scene details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Location</label>
                    <Select value={mvLocation} onValueChange={setMvLocation}>
                      <SelectTrigger className="bg-card/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LOCATION_SUGGESTIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Subject</label>
                    <Select value={mvSubject} onValueChange={setMvSubject}>
                      <SelectTrigger className="bg-card/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBJECT_SUGGESTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            )}

            {/* Direction prompt + generate */}
            {!isMvLyric && (
              <section className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Direction <span className="ml-1 font-normal normal-case opacity-60">auto-built · editable</span>
                </p>
                <Textarea rows={5} value={mvPrompt} onChange={(e) => setMvPrompt(e.target.value)} className="resize-none bg-card/60 text-sm" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-xl border border-border bg-card/40 px-3 py-2">
                  <Zap className="size-3.5 text-primary" />
                  Cost: <span className="text-foreground font-medium">{mvDisplayCost} Aura</span>
                </div>
                <Button
                  disabled={!mvPrompt.trim() || (mvCurrentMode?.needsImage && !mvImage)}
                  onClick={async () => {
                    if (!mvPrompt.trim()) return toast.error("Enter a prompt first");
                    try {
                      if (mvCurrentMode?.needsImage && mvImage) {
                        await videoFn({ data: { imageUrl: mvImage, prompt: mvPrompt, duration: 5, resolution: "720p", modelKey: mvVideoModel, cameraMovement: "static", endFrameUrl: null } });
                      } else {
                        await genFn({ data: { prompt: mvPrompt, imageUrls: [], motionVideoUrl: null, model: "replit/gemini-2.5-flash-image" } });
                      }
                      markFirstGenComplete();
                      toast.success("Queued — check your Gallery for results");
                      qc.invalidateQueries({ queryKey: ["motion-gens"] });
                    } catch (e) {
                      handleGenerationError(e as Error);
                    }
                  }}
                  variant="premium"
                  className="w-full h-12"
                >
                  <Music2 className="size-4 mr-2" /> Generate · {mvDisplayCost} Aura
                </Button>
              </section>
            )}

            <Link to="/gallery" className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium no-underline hover:border-primary/40 hover:bg-card/80 transition-colors">
              <Sparkles className="size-4 text-primary" />
              <span>View your generations in Gallery</span>
              <span className="ml-auto text-muted-foreground text-xs">→</span>
            </Link>
          </div>
        )}

        </div>{/* ← end mode panels */}
      </div>{/* ← end left sidebar */}

      {/* ── Right panel: hero + inspiration — desktop only ─────────── */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:h-full lg:overflow-y-auto bg-zinc-900/40 scrollbar-none">
        <HiggsHero
          kicker="Motion Control"
          lines={["RECREATE ANY", "MOTION", "WITH YOUR IMAGE"]}
          bracketWord="MOTION"
          description="Copy the exact movement from any video and place your character into the same performance."
        />
        <FanPhotos
          photos={[
            { src: "/josh/josh-concert-performance.webp", alt: "Live performance" },
            { src: "/josh/josh-pink-mic-portrait.jpg",    alt: "Stage energy" },
            { src: "/josh/josh-blue-portrait.webp",       alt: "Cinematic shot" },
          ]}
        />
        <HiggsDivider label="MOTION LIBRARY" />
        <div className="px-4 pb-8">
          <MotionInspirationBlock />
        </div>
      </div>
    </main>
  );
}

// ── Motion inspiration block ──────────────────────────────────────────────────
const MOTION_BEFORE_AFTER = [
  {
    before: { src: "/josh/josh-orange-performance.jpg",    label: "Reference image" },
    after:  { src: "/josh/josh-concert-performance.webp",  label: "Animated result" },
    caption: "Performance Shot — motion transferred to your avatar",
  },
  {
    before: { src: "/josh/josh-red-angle1.png",            label: "Reference image" },
    after:  { src: "/josh/josh-red-angle3.png",            label: "New angle" },
    caption: "Pose → Video — pose staged then animated",
  },
  {
    before: { src: "/josh/josh-pink-mic-portrait.jpg",     label: "Identity ref" },
    after:  { src: "/josh/josh-pink-leather-mic.jpg",      label: "Motion output" },
    caption: "Motion Transfer — driving video applied to still",
  },
];

const MOTION_EXAMPLES = [
  { src: "/josh/josh-concert-performance.webp",  label: "Live performance",  caption: "Motion Transfer" },
  { src: "/josh/josh-orange-performance.jpg",    label: "Stage energy",      caption: "Performance Shot" },
  { src: "/josh/josh-red-angle2.png",            label: "Low angle hero",    caption: "Pose → Video" },
  { src: "/josh/josh-red-angle4.png",            label: "Profile shot",      caption: "Avatar Shots" },
  { src: "/josh/josh-pink-mic-fullbody.jpg",     label: "Full body",         caption: "Music Video" },
  { src: "/josh/josh-blue-portrait.webp",        label: "Blue cinematic",    caption: "Performance Shot" },
];

function MotionInspirationBlock() {
  return (
    <div className="space-y-8">
      <style>{`
        @keyframes divider-pulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.85); }
          50% { opacity: 1; transform: scaleY(1); }
        }
        .divider-anim { animation: divider-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Before → After comparison row */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Before → After</p>
          <p className="text-[10px] text-muted-foreground">3 example transformations</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MOTION_BEFORE_AFTER.map((item) => (
            <div key={item.caption} className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr]">
                <div className="aspect-[3/4] relative overflow-hidden">
                  <img src={item.before.src} alt={item.before.label} loading="lazy" className="absolute inset-0 size-full object-cover" />
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-widest bg-black/60 text-white/80 px-1.5 py-0.5 rounded">Before</span>
                </div>
                <div className="flex items-center justify-center px-1.5">
                  <div className="divider-anim w-px bg-gradient-to-b from-transparent via-primary to-transparent h-12 rounded-full" />
                </div>
                <div className="aspect-[3/4] relative overflow-hidden">
                  <img src={item.after.src} alt={item.after.label} loading="lazy" className="absolute inset-0 size-full object-cover" />
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-widest bg-primary/80 text-white px-1.5 py-0.5 rounded">After</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground px-2.5 py-2 leading-snug">{item.caption}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Output grid */}
      <ExampleOutputGrid
        items={MOTION_EXAMPLES}
        title="Motion outputs — what you can create"
        subtitle="Performance Shot, Motion Transfer, Pose → Video, Avatar Shots, Music Video."
        columns={3}
      />
    </div>
  );
}
