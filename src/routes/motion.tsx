import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { UploadSlot } from "@/components/studio/UploadSlot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowLeft, Loader2, Film, Wand2, Camera, Clapperboard, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import {
  generatePerformanceShot,
  generateVideoFromImage,
  generateMimicMotion,
  generatePerformanceReskin,
  listGenerations,
} from "@/lib/studio.functions";
import { checkWorkerCapability } from "@/lib/workers.functions";
import { VIDEO_MODEL_LIST } from "@/lib/models";
import { computeCost, type Resolution } from "@/lib/pricing";
import { ResolutionPicker } from "@/components/ResolutionPicker";
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

export const Route = createFileRoute("/motion")({
  component: MotionStudio,
  // Deep-link prefill used by Guided Workflows (/guides/$slug): hand off a
  // generated image + context prompt straight into Motion Transfer.
  validateSearch: (
    search: Record<string, unknown>,
  ): { prompt?: string; image?: string } => ({
    prompt:
      typeof search.prompt === "string" && search.prompt.trim()
        ? search.prompt.slice(0, 2000)
        : undefined,
    image:
      typeof search.image === "string" && /^https:\/\//.test(search.image)
        ? search.image
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Perform Anywhere — Aurora" },
      { name: "description", content: "Record yourself performing on your phone. Aurora transfers your motion into your AI-generated scene — no studio, no crew." },
      { property: "og:title", content: "Perform Anywhere — Aurora" },
      { property: "og:description", content: "Generate your AI scene in Colors Studio, film yourself performing, animate with motion transfer." },
    ],
  }),
});

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

type Mode = "pose" | "transfer" | "reskin";

function MotionStudio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("reskin");
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
      if (search.prompt) setMtPrompt(search.prompt);
    }
  }, [search.image, search.prompt]);

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

  // Animate runs generateVideoFromImage at a fixed 5s; cost mirrors the server
  // charge exactly. First pass is a 480p preview; confirmed full render uses
  // the selected resolution (720p → 2160p). Premium models retier live.
  const animateCost = useMemo(
    () => computeCost({ features: ["video"], model: videoModel, durationSeconds: 5, resolution: videoResolution }).total,
    [videoModel, videoResolution],
  );
  const animatePreviewCost = useMemo(
    () => computeCost({ features: ["video"], model: videoModel, durationSeconds: 5, resolution: "480p" }).total,
    [videoModel],
  );

  // Motion Transfer (MimicMotion)
  const [mtImage, setMtImage] = useState<string | null>(null);
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
  // Preview-confirm tickets: first submit renders a discounted capped preview;
  // its generationId unlocks the full render on the next submit.
  const [transferPreviewId, setTransferPreviewId] = useState<string | null>(null);
  const [reskinPreviewId, setReskinPreviewId] = useState<string | null>(null);
  const [animatePreviewId, setAnimatePreviewId] = useState<string | null>(null);
  const [animateHdDialogOpen, setAnimateHdDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const genFn = useServerFn(generatePerformanceShot);
  const videoFn = useServerFn(generateVideoFromImage);
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

  const { data: motionWorker } = useQuery({
    queryKey: ["worker-capability", "motion"],
    queryFn: () => checkWorkerFn({ data: { capability: "motion" } }),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const motionOnline = motionWorker?.available ?? false;

  const { data: history } = useQuery({
    queryKey: ["motion-gens", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 6000,
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
      setStagedImage((out as { imageUrl?: string } | null)?.imageUrl ?? null);
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
      const source = startFrame ?? override ?? stagedImage;
      if (!source) throw new Error("Add a first frame or stage a pose first");
      const out = await videoFn({
        data: {
          imageUrl: source,
          prompt: videoPrompt,
          duration: 5,
          resolution: animatePreviewId ? videoResolution : "480p",
          modelKey: videoModel,
          cameraMovement,
          endFrameUrl: endFrame ?? null,
          confirmPreviewId: animatePreviewId ?? undefined,
        },
      });
      return out;
    },
    onMutate: () => setVideoError(null),
    onSuccess: (out) => {
      markFirstGenComplete();
      const res = out as { id?: string; videoUrl?: string; preview?: boolean } | null;
      setVideoUrl(res?.videoUrl ?? null);
      if (res?.preview) {
        setAnimatePreviewId(res.id ?? null);
        toast.success("Preview ready — happy with it? Render full quality next");
      } else {
        setAnimatePreviewId(null);
        toast.success("Motion ready");
      }
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message.includes("Unsupported preview confirmation")) {
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
    onMutate: () => setMtError(null),
    onSuccess: (out: { generationId?: string; preview?: boolean } | void) => {
      transferSubmittedAtRef.current = Date.now();
      if (out && typeof out === "object" && out.generationId) setTransferGenId(out.generationId);
      if (out && typeof out === "object" && out.preview) {
        setTransferPreviewId(out.generationId ?? null);
        toast.success("Preview queued — review it in Recent, then render the full clip");
      } else {
        setTransferPreviewId(null);
        toast.success("Motion transfer queued — it'll appear in Recent when ready");
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
    onMutate: () => setRsError(null),
    onSuccess: (out: { generationId?: string; preview?: boolean } | void) => {
      reskinSubmittedAtRef.current = Date.now();
      if (out && typeof out === "object" && out.generationId) setReskinGenId(out.generationId);
      if (out && typeof out === "object" && out.preview) {
        setReskinPreviewId(out.generationId ?? null);
        toast.success("Preview queued — review it in Recent, then render the full clip");
      } else {
        setReskinPreviewId(null);
        toast.success("Performance Shot queued — it'll appear in Recent when ready");
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

  const transferProgress = useGenerationProgress({
    isPending: transferMut.isPending,
    isError: transferMut.isError,
    isSuccess: transferMut.isSuccess,
    jobStatus: transferJobStatus,
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

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
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <WelcomeTour show={showTour} onDismiss={() => setShowTour(false)} />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-4 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="size-8 rounded-xl flex items-center justify-center shadow-[var(--shadow-glow-soft)]" style={{ background: "var(--gradient-hero)" }}>
            <Film className="size-4 text-primary-foreground" />
          </span>
          Perform Anywhere
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/colors" className="text-muted-foreground hover:text-foreground">Colors Studio</Link>
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">Full Studio</Link>
          <Link to="/lipsync" className="text-muted-foreground hover:text-foreground">Lip Sync</Link>
        </div>
      </header>
      <ConnectReplicateBanner />

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-10 space-y-6">

        {/* ── Onboarding guide ──────────────────────────────────────── */}
        <PerformAnywhereGuide />

        {/* ── Mode tabs ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {tabBtn("reskin", "Performance Shot", Users)}
          {tabBtn("pose", "Pose → Video", Wand2)}
          {tabBtn("transfer", "Motion Transfer", Clapperboard)}
        </div>

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

                  <p className="text-xs text-muted-foreground">Rendering typically takes 2–3 min · standard quality. You can leave this page — the job updates live in Recent.</p>

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

            {/* aside — preview + recent */}
            <aside className="space-y-4">
              <div className="rounded-3xl overflow-hidden border border-border bg-card/60 backdrop-blur-xl aspect-[4/5] relative">
                {reskinProgress.isActive ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-muted-foreground">
                    <div className="size-14 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                      <Loader2 className="size-6 animate-spin text-primary-foreground" />
                    </div>
                    <GenerationProgress visible progress={reskinProgress.progress} label={reskinProgress.label} />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                    <Film className="size-10 text-primary/40" />
                    <p className="text-sm">Your performance video will appear here when ready.</p>
                    <p className="text-xs">Jobs render on GPU backend — watch the Recent strip below.</p>
                  </div>
                )}
              </div>

              {history && history.items.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Recent</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {history.items.slice(0, 6).map((g) => (
                      <div key={g.id} className="aspect-square rounded-lg overflow-hidden border border-border bg-card/40">
                        {g.result_video_url ? (
                          <AutoplayVideo src={g.result_video_url} className="w-full h-full object-cover" loop playsInline />
                        ) : g.result_image_url ? (
                          <img src={g.result_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">{g.status}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                    animateOverrideRef.current = demoSelfie as string;
                  }
                  animateMut.mutate();
                }}
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
                <p className="text-[11px] text-muted-foreground">Camera move is injected into the prompt — effect strength depends on the video model.</p>
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

              <div className="grid grid-cols-2 gap-2">
                {stepBadge("1. Stage pose (image)", imgState as "idle" | "running" | "ok" | "error", imageError)}
                {stepBadge("2. Animate (video)", vidState as "idle" | "running" | "ok" | "error", videoError)}
              </div>

              <div className="flex gap-2">
                <Button
                  disabled={stageMut.isPending || !selfie}
                  onClick={() => stageMut.mutate()}
                  variant="premium"
                  className="flex-1 h-12"
                >
                  {stageMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Staging…</> : <><Wand2 className="size-4 mr-2" /> {imageError ? "Retry pose" : stagedImage ? "Re-stage" : "Stage pose · 1 Aura"}</>}
                </Button>
                <Button
                  disabled={animateMut.isPending || (!stagedImage && !startFrame)}
                  onClick={() => {
                    const isHd = videoResolution === "1080p" || videoResolution === "2160p";
                    if (animatePreviewId && isHd) {
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
                    <><Film className="size-4 mr-2" /> {videoError ? "Retry animate" : animatePreviewId ? `Render full quality · ${animateCost} Aura` : `Preview animation · ${animatePreviewCost} Aura`}</>
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
                {videoUrl ? (
                  <AutoplayVideo src={videoUrl} className="w-full h-full object-cover" controls playsInline loop />
                ) : stagedImage ? (
                  <BlurredPreview src={stagedImage} alt="Staged pose" aspectRatio="3/4" className="absolute inset-0 w-full h-full rounded-none border-0" transitionMs={700} />
                ) : (stageMut.isPending || animateMut.isPending) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-muted-foreground">
                    <div className="size-14 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                      <Loader2 className="size-6 animate-spin text-primary-foreground" />
                    </div>
                    <div className="w-full space-y-2">
                      <p className="text-sm text-center">{stageMut.isPending ? stageProgress.label : animateProgress.label}</p>
                      <GenerationProgress visible progress={stageMut.isPending ? stageProgress.progress : animateProgress.progress} />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                    <Sparkles className="size-10 text-primary/50" />
                    <p className="text-sm">Your motion clip will appear here.</p>
                  </div>
                )}
              </div>
              {history && history.items.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Recent</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {history.items.slice(0, 6).map((g) => (
                      <div key={g.id} className="aspect-square rounded-lg overflow-hidden border border-border bg-card/40">
                        {g.result_video_url ? (
                          <AutoplayVideo src={g.result_video_url} className="w-full h-full object-cover" loop playsInline />
                        ) : g.result_image_url ? (
                          <img src={g.result_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">{g.status}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ── Motion Transfer ─────────────────────────────────────────── */}
        {mode === "transfer" && (
          <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
            <section className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Motion Transfer</h1>
                <p className="text-muted-foreground text-sm mt-1">Drive a still image with the motion of any video (MimicMotion).</p>
              </div>
              {!motionOnline && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                  <WifiOff className="size-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-300">No motion GPU worker online</p>
                    <p className="text-xs text-amber-300/70 mt-0.5">Motion Transfer runs on a self-hosted GPU (MimicMotion). Register a RunPod or Colab worker with the <strong>motion</strong> capability in the admin panel to enable this.</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Reference + driving video</p>
                <div className="grid grid-cols-2 gap-2">
                  <UploadSlot userId={user.id} label="Subject" hint="Still image" value={mtImage} onChange={setMtImage} />
                  <UploadSlot userId={user.id} kind="video" accept="video/*" label="Driving video" hint="Motion source" value={mtVideo} onChange={setMtVideo} />
                </div>
              </div>
              {motionControls(mtMotion, setMtMotion, mtCamera, setMtCamera)}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Style prompt (optional)</label>
                <Textarea rows={2} value={mtPrompt} onChange={(e) => setMtPrompt(e.target.value)} placeholder="cinematic lighting, 4K…" className="resize-none bg-card/60 text-sm" />
              </div>
              <Button
                disabled={transferMut.isPending || !mtImage || !mtVideo || !motionOnline}
                onClick={() => transferMut.mutate()}
                variant="premium"
                className="w-full h-12"
              >
                {transferMut.isPending ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Queuing…</>
                ) : !motionOnline ? (
                  <><WifiOff className="size-4 mr-2" /> No motion worker online</>
                ) : transferPreviewId ? (
                  <><Clapperboard className="size-4 mr-2" /> Render full clip · {computeCost({ features: ["motion"] }).total} Aura</>
                ) : (
                  <><Clapperboard className="size-4 mr-2" /> Preview motion · {Math.max(1, Math.ceil(computeCost({ features: ["motion"] }).total * 0.5))} Aura</>
                )}
              </Button>
              <GenerationProgress visible={transferProgress.isActive} progress={transferProgress.progress} label={transferProgress.label} />
              <GenerationErrorCard visible={transferMut.isError} error={mtError} onRetry={() => transferMut.mutate()} />
              <p className="text-xs text-muted-foreground">First render is a short discounted preview — review it in Recent, then render the full clip. Runs on a self-hosted GPU backend.</p>
            </section>
            <aside className="space-y-4">
              <div className="rounded-3xl overflow-hidden border border-border bg-card/60 backdrop-blur-xl aspect-[4/5] relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                  <Clapperboard className="size-10 text-primary/40" />
                  <p className="text-sm">Queued jobs render on a GPU backend — watch the Recent strip below.</p>
                </div>
              </div>
              {history && history.items.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Recent</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {history.items.slice(0, 6).map((g) => (
                      <div key={g.id} className="aspect-square rounded-lg overflow-hidden border border-border bg-card/40">
                        {g.result_video_url ? (
                          <AutoplayVideo src={g.result_video_url} className="w-full h-full object-cover" loop playsInline />
                        ) : g.result_image_url ? (
                          <img src={g.result_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">{g.status}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

      </div>
    </main>
  );
}
