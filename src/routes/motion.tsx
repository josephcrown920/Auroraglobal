import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowLeft, Loader2, Film, Wand2, Camera, Clapperboard, Users } from "lucide-react";
import { toast } from "sonner";
import {
  generatePerformanceShot,
  generateVideoFromImage,
  generateMimicMotion,
  generatePerformanceReskin,
  listGenerations,
} from "@/lib/studio.functions";
import { VIDEO_MODEL_LIST } from "@/lib/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BringItToLifePreview } from "@/components/studio/BringItToLifePreview";
import { ConnectReplicateBanner } from "@/components/ConnectReplicateBanner";

export const Route = createFileRoute("/motion")({
  component: MotionStudio,
  head: () => ({
    meta: [
      { title: "Motion Studio — Aurora" },
      { name: "description", content: "Pose-driven cinematic motion: drop a selfie, a pose reference and a camera move, get a clip." },
      { property: "og:title", content: "Motion Studio — Aurora" },
      { property: "og:description", content: "Pose presets + camera moves. Image → video in one screen." },
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

  const [mode, setMode] = useState<Mode>("pose");

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
  const [rsMotion, setRsMotion] = useState("faithful");
  const [rsCamera, setRsCamera] = useState("static");
  const [rsError, setRsError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const genFn = useServerFn(generatePerformanceShot);
  const videoFn = useServerFn(generateVideoFromImage);
  const motionFn = useServerFn(generateMimicMotion);
  const reskinFn = useServerFn(generatePerformanceReskin);
  const listFn = useServerFn(listGenerations);

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
      const msg = e instanceof Error ? e.message : "Pose failed";
      setImageError(msg);
      toast.error(msg);
    },
  });

  // Step 2 — animate it
  const animateMut = useMutation({
    mutationFn: async () => {
      const source = startFrame ?? stagedImage;
      if (!source) throw new Error("Add a first frame or stage a pose first");
      const out = await videoFn({
        data: {
          imageUrl: source,
          prompt: videoPrompt,
          duration: 5,
          resolution: "720p",
          modelKey: videoModel,
          cameraMovement,
          endFrameUrl: endFrame ?? null,
        },
      });
      return out;
    },
    onMutate: () => setVideoError(null),
    onSuccess: (out) => {
      setVideoUrl((out as { videoUrl?: string } | null)?.videoUrl ?? null);
      toast.success("Motion ready");
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Animate failed";
      setVideoError(msg);
      toast.error(msg);
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
        },
      });
    },
    onMutate: () => setMtError(null),
    onSuccess: () => {
      toast.success("Motion transfer queued — it'll appear in Recent when ready");
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Motion transfer failed";
      setMtError(msg);
      toast.error(msg);
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
        },
      });
    },
    onMutate: () => setRsError(null),
    onSuccess: () => {
      toast.success("Performance Shot queued — it'll appear in Recent when ready");
      qc.invalidateQueries({ queryKey: ["motion-gens"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Performance Shot failed";
      setRsError(msg);
      toast.error(msg);
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

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-4 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="size-8 rounded-xl flex items-center justify-center shadow-[var(--shadow-glow-soft)]" style={{ background: "var(--gradient-hero)" }}>
            <Film className="size-4 text-primary-foreground" />
          </span>
          Motion Studio
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/colors" className="text-muted-foreground hover:text-foreground">Colors</Link>
          <Link to="/studio" className="text-muted-foreground hover:text-foreground">Full Studio</Link>
          <Link to="/lipsync" className="text-muted-foreground hover:text-foreground">Lip Sync</Link>
        </div>
      </header>
      <ConnectReplicateBanner />

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-10 grid lg:grid-cols-[1fr_1fr] gap-8">
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Direct the <span className="aurora-gradient-text">motion</span>.
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "pose" && "Pose + camera move = a clip. Two steps, two retry buttons."}
              {mode === "transfer" && "Drive a still image with the motion of any video (MimicMotion)."}
              {mode === "reskin" && "Reskin a real performance video onto your avatar — outfit, location, optional lip-sync."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {tabBtn("pose", "Pose → Video", Wand2)}
            {tabBtn("transfer", "Motion Transfer", Clapperboard)}
            {tabBtn("reskin", "Performance Shot", Users)}
          </div>

          {/* ── Pose → Video ─────────────────────────────────────────── */}
          {mode === "pose" && (
            <>
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
                <BringItToLifePreview active={cameraMovement} onPick={setCameraMovement} />
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
                  onClick={() => animateMut.mutate()}
                  variant="secondary"
                  className="flex-1 h-12"
                >
                  {animateMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Rendering…</> : <><Film className="size-4 mr-2" /> {videoError ? "Retry animate" : "Animate · 5 Aura"}</>}
                </Button>
              </div>
            </>
          )}

          {/* ── Motion Transfer (MimicMotion) ─────────────────────────── */}
          {mode === "transfer" && (
            <>
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

              {mtError && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-foreground">{mtError}</div>
              )}

              <Button
                disabled={transferMut.isPending || !mtImage || !mtVideo}
                onClick={() => transferMut.mutate()}
                variant="premium"
                className="w-full h-12"
              >
                {transferMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Queuing…</> : <><Clapperboard className="size-4 mr-2" /> Transfer motion · 5 Aura</>}
              </Button>
              <p className="text-xs text-muted-foreground">Runs on a GPU backend and appears in Recent when ready.</p>
            </>
          )}

          {/* ── Performance Shot (reskin) ─────────────────────────────── */}
          {mode === "reskin" && (
            <>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Performance + avatar</p>
                <div className="grid grid-cols-3 gap-2">
                  <UploadSlot userId={user.id} kind="video" accept="video/*" label="Performance" hint="Source video" value={rsVideo} onChange={setRsVideo} />
                  <UploadSlot userId={user.id} label="Avatar" hint="Persona image" value={rsAvatar} onChange={setRsAvatar} />
                  <UploadSlot userId={user.id} kind="video" accept="audio/*,video/*" label="Audio" hint="Optional lip-sync" value={rsAudio} onChange={setRsAudio} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outfit (optional)</label>
                  <input
                    value={rsOutfit}
                    onChange={(e) => setRsOutfit(e.target.value)}
                    placeholder="black leather jacket"
                    className="w-full h-10 rounded-md border border-border bg-card/60 px-3 text-sm outline-none focus:border-primary/60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Location (optional)</label>
                  <input
                    value={rsLocation}
                    onChange={(e) => setRsLocation(e.target.value)}
                    placeholder="neon-lit rooftop at night"
                    className="w-full h-10 rounded-md border border-border bg-card/60 px-3 text-sm outline-none focus:border-primary/60"
                  />
                </div>
              </div>

              {motionControls(rsMotion, setRsMotion, rsCamera, setRsCamera)}

              {rsError && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-foreground">{rsError}</div>
              )}

              <Button
                disabled={reskinMut.isPending || !rsVideo || !rsAvatar}
                onClick={() => reskinMut.mutate()}
                variant="premium"
                className="w-full h-12"
              >
                {reskinMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Queuing…</> : <><Users className="size-4 mr-2" /> Create Performance Shot · 8 Aura</>}
              </Button>
              <p className="text-xs text-muted-foreground">Runs on a GPU backend and appears in Recent when ready.</p>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl overflow-hidden border border-border bg-card/60 backdrop-blur-xl aspect-[4/5] relative">
            {mode === "pose" && videoUrl ? (
              <AutoplayVideo src={videoUrl} className="w-full h-full object-cover" controls playsInline loop />
            ) : mode === "pose" && stagedImage ? (
              <img src={stagedImage} alt="Staged pose" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                <Sparkles className="size-10 text-primary/50" />
                <p className="text-sm">
                  {mode === "pose" ? "Your motion clip will appear here." : "Queued jobs render on a GPU backend — watch the Recent strip below."}
                </p>
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
    </main>
  );
}
