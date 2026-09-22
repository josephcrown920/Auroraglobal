import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { runAuroraAgent, type AgentPlan } from "@/lib/agent.functions";
import { generatePerformanceShot, generateVideoFromImage } from "@/lib/studio.functions";
import { VIDEO_MODEL_LIST } from "@/lib/models";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clapperboard,
  Copy,
  Film,
  ImagePlus,
  Lightbulb,
  Loader2,
  LockKeyhole,
  MoveRight,
  Palette,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/director")({
  component: DirectorPage,
  head: () => ({
    meta: [
      { title: "Director's Room — Aurora Studio" },
      {
        name: "description",
        content: "Turn one creative brief into a shootable sequence, staged still and Seedance motion clip.",
      },
      { property: "og:title", content: "Director's Room — Aurora Studio" },
    ],
  }),
});

const EXAMPLES = [
  {
    title: "Rain on the rooftop",
    text: "A moody R&B performance in a rainy Tokyo rooftop garden. One singer in a silver coat, sodium-vapor street light, wet concrete and a slow emotional build from isolation to release.",
  },
  {
    title: "Desert transmission",
    text: "A short film about a woman receiving a radio transmission in the middle of the Mojave. Bleached daylight, red dust, a chrome portable radio, and an eerie feeling that the horizon is listening.",
  },
  {
    title: "After the last show",
    text: "A musician walks alone through an empty theatre after the final show of a tour. Velvet seats, work lights, confetti on the stage, intimate handheld frames, and a quiet sense of coming home.",
  },
];

const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const VIDEO_MODEL = VIDEO_MODEL_LIST.find((model) => model.value === "seedance-2.5")?.value ?? "seedance-2.5";

type StepState = "idle" | "working" | "complete" | "error";

function DirectorPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [brief, setBrief] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [cameraMovement, setCameraMovement] = useState("push_in");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const runAgent = useServerFn(runAuroraAgent);
  const stageImage = useServerFn(generatePerformanceShot);
  const animateImage = useServerFn(generateVideoFromImage);

  const planMut = useMutation({
    mutationFn: () =>
      runAgent({
        data: {
          brief: brief.trim(),
          ...(referenceImage ? { referenceImages: [referenceImage] } : {}),
        },
      }),
    onMutate: () => {
      setPlanError(null);
      setPlan(null);
      setSelectedShotId(null);
      setStagedImage(null);
      setVideoUrl(null);
      setStageError(null);
      setVideoError(null);
    },
    onSuccess: (nextPlan) => {
      setPlan(nextPlan);
      if (nextPlan.shots[0]) {
        setSelectedShotId(nextPlan.shots[0].id);
        setVideoPrompt(nextPlan.shots[0].prompt);
      }
      toast.success("Direction locked. Your sequence is ready.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Aurora could not build the plan.";
      setPlanError(message);
      toast.error(message);
    },
  });

  const selectedShot = plan?.shots.find((shot) => shot.id === selectedShotId) ?? null;

  const stageMut = useMutation({
    mutationFn: async () => {
      if (!referenceImage) throw new Error("Add a reference image before staging a shot.");
      if (!selectedShot) throw new Error("Choose a shot from the sequence first.");
      return stageImage({
        data: {
          prompt: selectedShot.prompt,
          imageUrls: [referenceImage],
          motionVideoUrl: null,
          model: IMAGE_MODEL,
        },
      });
    },
    onMutate: () => {
      setStageError(null);
      setStagedImage(null);
      setVideoUrl(null);
      setVideoError(null);
    },
    onSuccess: (result) => {
      setStagedImage(result.resultUrl);
      toast.success("Still staged. Ready for motion.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "The still could not be staged.";
      setStageError(message);
      toast.error(message);
    },
  });

  const animateMut = useMutation({
    mutationFn: async () => {
      if (!stagedImage) throw new Error("Stage the selected shot before animating it.");
      if (!selectedShot) throw new Error("Choose a shot from the sequence first.");
      return animateImage({
        data: {
          imageUrl: stagedImage,
          prompt: videoPrompt.trim() || selectedShot.prompt,
          duration: 5,
          resolution: "720p",
          modelKey: VIDEO_MODEL,
          cameraMovement,
          motionType: "expressive",
          endFrameUrl: null,
        },
      });
    },
    onMutate: () => {
      setVideoError(null);
      setVideoUrl(null);
    },
    onSuccess: (result) => {
      setVideoUrl(result.videoUrl);
      toast.success("Seedance clip is ready.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "The clip could not be rendered.";
      setVideoError(message);
      toast.error(message);
    },
  });

  if (loading) return <DirectorLoading />;
  if (!user) return null;

  const reset = () => {
    setPlan(null);
    setSelectedShotId(null);
    setStagedImage(null);
    setVideoUrl(null);
    setPlanError(null);
    setStageError(null);
    setVideoError(null);
    setBrief("");
    setReferenceImage(null);
    setVideoPrompt("");
    toast.success("Director's room reset.");
  };

  const chooseShot = (shotId: string) => {
    const shot = plan?.shots.find((item) => item.id === shotId);
    setSelectedShotId(shotId);
    setStagedImage(null);
    setVideoUrl(null);
    setStageError(null);
    setVideoError(null);
    setVideoPrompt(shot?.prompt ?? "");
  };

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Shot prompt copied.");
    } catch {
      toast.error("Could not copy the prompt.");
    }
  };

  const planState: StepState = planMut.isPending ? "working" : planError ? "error" : plan ? "complete" : "idle";
  const stageState: StepState = stageMut.isPending ? "working" : stageError ? "error" : stagedImage ? "complete" : "idle";
  const animateState: StepState = animateMut.isPending ? "working" : videoError ? "error" : videoUrl ? "complete" : "idle";

  return (
    <main className="min-h-[100dvh] bg-[#0b0814] text-white selection:bg-fuchsia-400/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-48 top-[-18rem] size-[38rem] rounded-full bg-violet-700/10 blur-3xl" />
        <div className="absolute right-[-16rem] top-[25rem] size-[32rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0b0814]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3.5 md:px-8">
          <div className="flex items-center gap-4">
            <Link to="/studio" className="inline-flex items-center gap-2 text-xs text-white/45 transition-colors hover:text-white" data-testid="link-back-studio">
              <ArrowLeft className="size-3.5" /> Studio
            </Link>
            <span className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-lg shadow-fuchsia-500/20">
                <Clapperboard className="size-4 text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">Director&apos;s Room</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Aurora sequence design</p>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1.5">
            <Link to="/motion" className="rounded-lg px-3 py-2 text-xs text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white" data-testid="link-motion-studio">Motion Studio</Link>
            <Link to="/canvas" className="rounded-lg px-3 py-2 text-xs text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white" data-testid="link-canvas">Canvas</Link>
            <Button variant="ghost" size="sm" onClick={reset} className="ml-1 text-white/55 hover:bg-white/[0.06] hover:text-white" data-testid="button-reset-director">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          </nav>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-8 md:px-8 md:pt-12">
        <section className="mb-10 max-w-3xl">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-fuchsia-300/75">
            <span className="size-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_12px_rgba(244,114,182,.8)]" />
            One brief. One visual language. A sequence you can shoot.
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-white md:text-6xl">
            Put the whole idea<br /><span className="text-white/35">on the call sheet.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
            Write the feeling, not a spec. Aurora will turn it into direction, a considered palette, and a shot list with prompts ready to stage.
          </p>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.72fr)_minmax(0,1.28fr)]">
          <section className="space-y-5" aria-label="Creative brief">
            <Card className="overflow-hidden border-white/[0.1] bg-white/[0.045] shadow-2xl shadow-black/20">
              <CardHeader className="border-b border-white/[0.07] px-5 pb-4 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base text-white"><span className="grid size-6 place-items-center rounded-md bg-fuchsia-400/15 text-fuchsia-200">01</span> Write the brief</CardTitle>
                    <CardDescription className="mt-2 text-xs text-white/40">What are we making, and what should it feel like?</CardDescription>
                  </div>
                  <LockKeyhole className="size-4 text-white/25" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5 pt-5">
                <Textarea
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="A night-drive performance film for a song about leaving home…"
                  rows={8}
                  className="resize-none border-white/10 bg-[#100c1c] text-sm leading-6 text-white placeholder:text-white/25 focus-visible:ring-fuchsia-400/60"
                  data-testid="input-creative-brief"
                />
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/30">
                  <span>{brief.length}/4000</span>
                  <span className="inline-flex items-center gap-1"><Sparkles className="size-3 text-fuchsia-300" /> Aurora Agent</span>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/35">Try a starting point</p>
                  <div className="space-y-1.5">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example.title}
                        type="button"
                        onClick={() => setBrief(example.text)}
                        className="group flex w-full items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-left text-xs text-white/55 transition-colors hover:border-fuchsia-300/30 hover:bg-fuchsia-400/[0.06] hover:text-white"
                        data-testid={`button-example-${example.title.toLowerCase().replaceAll(" ", "-")}`}
                      >
                        <span>{example.title}</span><ArrowRight className="size-3 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-fuchsia-300" />
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => planMut.mutate()}
                  disabled={planMut.isPending || brief.trim().length < 4}
                  className="h-11 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-white shadow-xl shadow-fuchsia-500/15 hover:from-violet-400 hover:to-fuchsia-400"
                  data-testid="button-direct-plan"
                >
                  {planMut.isPending ? <><Loader2 className="animate-spin" /> Building the sequence…</> : <><Send /> Direct this brief <span className="ml-auto text-[10px] font-normal text-white/65">No generation yet</span></>}
                </Button>
                {planError && <InlineError message={planError} onRetry={() => planMut.mutate()} testId="error-plan" />}
              </CardContent>
            </Card>

            <Card className="border-white/[0.1] bg-white/[0.035] shadow-xl shadow-black/10">
              <CardHeader className="px-5 pb-3 pt-5">
                <CardTitle className="flex items-center gap-2 text-sm text-white"><ImagePlus className="size-4 text-fuchsia-300" /> Reference image <span className="text-[10px] font-normal uppercase tracking-wider text-white/30">optional</span></CardTitle>
                <CardDescription className="mt-1.5 text-xs leading-5 text-white/40">Use a face, wardrobe, location, or texture anchor. You&apos;ll need one to stage a still.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <UploadSlot userId={user.id} label="Visual anchor" hint="Upload a JPG or PNG" value={referenceImage} onChange={(value) => { setReferenceImage(value); setStagedImage(null); setVideoUrl(null); }} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2">
              <ProgressTile number="01" label="Brief" state={planState} />
              <ProgressTile number="02" label="Stage still" state={stageState} />
              <ProgressTile number="03" label="Animate" state={animateState} />
            </div>
          </section>

          <section className="min-w-0" aria-label="Production plan">
            {!plan && !planMut.isPending ? (
              <EmptyPlan />
            ) : planMut.isPending ? (
              <PlanLoading />
            ) : plan ? (
              <PlanView
                plan={plan}
                selectedShotId={selectedShotId}
                onSelectShot={chooseShot}
                onCopyPrompt={copyPrompt}
                referenceImage={referenceImage}
                selectedShot={selectedShot}
                stagedImage={stagedImage}
                videoUrl={videoUrl}
                videoPrompt={videoPrompt}
                setVideoPrompt={setVideoPrompt}
                cameraMovement={cameraMovement}
                setCameraMovement={setCameraMovement}
                stageError={stageError}
                videoError={videoError}
                stagePending={stageMut.isPending}
                animatePending={animateMut.isPending}
                onStage={() => stageMut.mutate()}
                onAnimate={() => animateMut.mutate()}
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function ProgressTile({ number, label, state }: { number: string; label: string; state: StepState }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${state === "complete" ? "border-emerald-400/25 bg-emerald-400/[0.07]" : state === "error" ? "border-rose-400/30 bg-rose-400/[0.07]" : state === "working" ? "border-fuchsia-300/30 bg-fuchsia-400/[0.06]" : "border-white/[0.08] bg-white/[0.025]"}`} data-testid={`status-step-${number}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-white/35">{number}</span>
        {state === "working" ? <Loader2 className="size-3 animate-spin text-fuchsia-300" /> : state === "complete" ? <CheckCircle2 className="size-3 text-emerald-300" /> : state === "error" ? <XCircle className="size-3 text-rose-300" /> : <span className="size-1.5 rounded-full bg-white/20" />}
      </div>
      <p className="text-[11px] font-medium text-white/70">{label}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">{state === "working" ? "Working" : state === "complete" ? "Ready" : state === "error" ? "Needs retry" : "Waiting"}</p>
    </div>
  );
}

function EmptyPlan() {
  return (
    <Card className="flex min-h-[620px] flex-col items-center justify-center border-dashed border-white/[0.1] bg-white/[0.02] p-8 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-3xl bg-fuchsia-500/15 blur-2xl" />
        <div className="relative grid size-20 place-items-center rounded-3xl border border-fuchsia-300/20 bg-[#171027] text-fuchsia-200 shadow-2xl shadow-fuchsia-900/20">
          <Clapperboard className="size-8" strokeWidth={1.4} />
        </div>
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/65">The room is quiet</p>
      <h2 className="text-2xl font-semibold tracking-tight text-white">Your sequence starts with a feeling.</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-white/40">Give Aurora one paragraph. The plan will land here with a logline, visual rules, palette, and shots you can actually stage.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-wider text-white/30">
        <span className="rounded-full border border-white/10 px-3 py-1.5">Direction</span>
        <MoveRight className="mt-1 size-3" />
        <span className="rounded-full border border-white/10 px-3 py-1.5">Shot list</span>
        <MoveRight className="mt-1 size-3" />
        <span className="rounded-full border border-white/10 px-3 py-1.5">Motion</span>
      </div>
    </Card>
  );
}

function PlanLoading() {
  return (
    <Card className="min-h-[620px] border-white/[0.1] bg-white/[0.035] p-6">
      <div className="flex items-center gap-3 border-b border-white/[0.07] pb-5">
        <div className="size-10 animate-pulse rounded-xl bg-fuchsia-400/15" />
        <div className="space-y-2"><div className="h-3 w-36 animate-pulse rounded bg-white/10" /><div className="h-2 w-56 animate-pulse rounded bg-white/5" /></div>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-3"><div className="h-8 w-3/4 animate-pulse rounded bg-white/10" /><div className="h-3 w-full animate-pulse rounded bg-white/5" /><div className="h-3 w-5/6 animate-pulse rounded bg-white/5" /><div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" /></div>
        <div className="h-44 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
      <div className="mt-8 space-y-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      <div className="mt-8 flex items-center gap-3 text-xs text-white/40"><Loader2 className="size-4 animate-spin text-fuchsia-300" /> Aurora is finding the visual spine…</div>
    </Card>
  );
}

type PlanViewProps = {
  plan: AgentPlan;
  selectedShotId: string | null;
  onSelectShot: (id: string) => void;
  onCopyPrompt: (prompt: string) => void;
  referenceImage: string | null;
  selectedShot: AgentPlan["shots"][number] | null;
  stagedImage: string | null;
  videoUrl: string | null;
  videoPrompt: string;
  setVideoPrompt: (value: string) => void;
  cameraMovement: string;
  setCameraMovement: (value: string) => void;
  stageError: string | null;
  videoError: string | null;
  stagePending: boolean;
  animatePending: boolean;
  onStage: () => void;
  onAnimate: () => void;
};

function PlanView(props: PlanViewProps) {
  const { plan, selectedShotId, onSelectShot, onCopyPrompt, referenceImage, selectedShot, stagedImage, videoUrl, videoPrompt, setVideoPrompt, cameraMovement, setCameraMovement, stageError, videoError, stagePending, animatePending, onStage, onAnimate } = props;
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-white/[0.1] bg-white/[0.045] shadow-2xl shadow-black/20">
        <CardHeader className="border-b border-white/[0.07] px-5 pb-5 pt-5 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300/75">Production plan / ready</p>
              <CardTitle className="text-2xl leading-tight tracking-[-0.03em] text-white md:text-3xl" data-testid="text-plan-title">{plan.title}</CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm italic leading-6 text-white/50" data-testid="text-plan-logline">“{plan.logline}”</CardDescription>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200"><Check className="size-3" /> Direction locked</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_0.65fr]">
            <div className="rounded-xl border border-white/[0.07] bg-[#100c1c]/70 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35"><Lightbulb className="size-3 text-fuchsia-300" /> Creative direction</p>
              <p className="text-xs leading-5 text-white/70" data-testid="text-plan-direction">{plan.direction}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-[#100c1c]/70 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35"><Palette className="size-3 text-fuchsia-300" /> Color story</p>
              <div className="flex gap-1.5">
                {plan.palette.map((color, index) => <div key={`${color}-${index}`} className="min-w-0 flex-1" title={color}><div className="aspect-square rounded-lg border border-white/10" style={{ backgroundColor: color }} /><p className="mt-1 truncate text-center font-mono text-[9px] text-white/35">{color}</p></div>)}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-5 md:px-6">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Sequence / {plan.shots.length} shots</p><p className="mt-1 text-xs text-white/30">Select a shot to move it into the staging bay.</p></div>
            <Film className="size-4 text-fuchsia-300/60" />
          </div>
          <div className="space-y-2">
            {plan.shots.map((shot, index) => <ShotRow key={shot.id} shot={shot} index={index} selected={shot.id === selectedShotId} onSelect={() => onSelectShot(shot.id)} onCopy={() => onCopyPrompt(shot.prompt)} />)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/[0.08] via-white/[0.035] to-violet-500/[0.07] shadow-2xl shadow-fuchsia-950/20">
        <CardHeader className="px-5 pb-4 pt-5 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200/70">Staging bay</p>
              <CardTitle className="flex items-center gap-2 text-lg text-white"><Wand2 className="size-4 text-fuchsia-200" /> {selectedShot ? `${selectedShot.id} · ${selectedShot.title}` : "Choose a shot"}</CardTitle>
              <CardDescription className="mt-1 text-xs text-white/40">Stage the still first. Then send that frame into Seedance 2.5.</CardDescription>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-mono text-white/45">IMAGE → MOTION</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 px-5 pb-5 md:grid-cols-[0.78fr_1.22fr] md:px-6">
          <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d0918]">
            {videoUrl ? <video src={videoUrl} className="aspect-video h-full w-full object-cover" controls autoPlay loop playsInline data-testid="video-director-result" /> : stagedImage ? <img src={stagedImage} alt={`Staged ${selectedShot?.title ?? "shot"}`} className="aspect-video h-full w-full object-cover" data-testid="img-staged-result" /> : <div className="p-8 text-center"><div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/30">{referenceImage ? <Wand2 className="size-5" /> : <ImagePlus className="size-5" />}</div><p className="text-xs font-medium text-white/55">{referenceImage ? "The staged frame will land here." : "Add a reference image to unlock staging."}</p><p className="mt-1 text-[10px] leading-4 text-white/30">{referenceImage ? "Aurora will follow the selected shot's visual direction." : "Nothing is generated until you choose to stage."}</p></div>}
            {videoUrl && <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#06110d]"><Play className="size-2.5 fill-current" /> Final motion</span>}
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-[#100c1c]/75 p-3.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Shot prompt</p>
              <p className="max-h-24 overflow-y-auto text-xs leading-5 text-white/65">{selectedShot?.prompt ?? "Select a shot above to load its production prompt."}</p>
              {selectedShot && <button type="button" onClick={() => onCopyPrompt(selectedShot.prompt)} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200 transition-colors hover:text-white" data-testid="button-copy-selected-prompt"><Copy className="size-3" /> Copy prompt</button>}
            </div>
            {stagedImage && !videoUrl && (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35" htmlFor="director-motion-prompt">Motion note</label>
                <Textarea id="director-motion-prompt" rows={3} value={videoPrompt} onChange={(event) => setVideoPrompt(event.target.value)} className="resize-none border-white/10 bg-[#100c1c] text-xs leading-5 text-white placeholder:text-white/25" data-testid="input-motion-prompt" />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Select value={cameraMovement} onValueChange={setCameraMovement}>
                    <SelectTrigger className="h-9 border-white/10 bg-[#100c1c] text-xs text-white" data-testid="select-camera-movement"><SelectValue /></SelectTrigger>
                    <SelectContent>{["push_in", "static", "pull_out", "orbit_cw", "pan_left", "pan_right"].map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="inline-flex h-9 items-center rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-[10px] text-white/40">5s · 720p</span>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {!referenceImage ? <div className="flex flex-1 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2.5 text-[10px] leading-4 text-amber-100/70"><ImagePlus className="size-3.5 shrink-0 text-amber-200" /> Add a reference image on the left to stage this shot.</div> : !stagedImage ? <Button onClick={onStage} disabled={stagePending || !selectedShot} className="h-11 flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/15" data-testid="button-stage-shot">{stagePending ? <><Loader2 className="animate-spin" /> Staging still…</> : <><Wand2 /> Stage still · 1 Aurora</>}</Button> : <Button onClick={onAnimate} disabled={animatePending} className="h-11 flex-1 bg-gradient-to-r from-fuchsia-500 to-rose-400 text-white shadow-lg shadow-fuchsia-500/15" data-testid="button-animate-shot">{animatePending ? <><Loader2 className="animate-spin" /> Seedance is rendering…</> : <><Film /> Animate with Seedance · 5 Aurora</>}</Button>}
              {stagedImage && !animatePending && <Button variant="outline" onClick={onStage} disabled={stagePending} className="h-11 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" data-testid="button-restage-shot"><RotateCcw className="size-3.5" /> Re-stage</Button>}
            </div>
            {stageError && <InlineError message={stageError} onRetry={onStage} testId="error-stage" />}
            {videoError && <InlineError message={videoError} onRetry={onAnimate} testId="error-animate" />}
            {videoUrl && <div className="flex items-center justify-between rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07] px-3 py-2 text-[10px] text-emerald-100/75"><span className="inline-flex items-center gap-2"><CheckCircle2 className="size-3.5 text-emerald-300" /> Clip complete and ready to review.</span><a href={videoUrl} download="aurora-director-shot.mp4" className="font-semibold text-emerald-200 hover:text-white" data-testid="link-download-director-video">Download</a></div>}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
        <p className="flex items-center gap-2 text-[10px] leading-5 text-white/40"><Clipboard className="size-3.5 shrink-0 text-fuchsia-300/70" /><span><strong className="font-medium text-white/60">Next moves:</strong> {plan.suggestions.join(" · ")}</span></p>
      </div>
    </div>
  );
}

function ShotRow({ shot, index, selected, onSelect, onCopy }: { shot: AgentPlan["shots"][number]; index: number; selected: boolean; onSelect: () => void; onCopy: () => void }) {
  return (
    <details open={selected} className={`group overflow-hidden rounded-xl border transition-colors ${selected ? "border-fuchsia-300/30 bg-fuchsia-400/[0.065]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"}`} data-testid={`card-shot-${shot.id}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg font-mono text-[10px] ${selected ? "bg-fuchsia-400/20 text-fuchsia-100" : "bg-white/[0.06] text-white/35"}`}>{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white/85">{shot.title}</p><p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-white/35">{shot.shotType} · {shot.camera}</p></div>
        {selected && <button type="button" onClick={(event) => { event.preventDefault(); onSelect(); }} className="rounded-md border border-fuchsia-300/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-300/10" data-testid={`button-select-shot-${shot.id}`}>Selected</button>}
        {!selected && <button type="button" onClick={(event) => { event.preventDefault(); onSelect(); }} className="rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-white/35 opacity-0 transition-opacity hover:text-fuchsia-200 group-hover:opacity-100" data-testid={`button-select-shot-${shot.id}`}>Stage</button>}
        <ChevronDown className="size-4 shrink-0 text-white/25 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/[0.06] px-3.5 pb-3.5 pt-3">
        <p className="mb-3 text-xs leading-5 text-white/60">{shot.action}</p>
        <div className="flex items-start gap-2 rounded-lg bg-black/20 p-3"><p className="flex-1 text-[11px] leading-5 text-white/55">{shot.prompt}</p><button type="button" onClick={onCopy} className="shrink-0 rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/[0.08] hover:text-fuchsia-200" title="Copy prompt" data-testid={`button-copy-prompt-${shot.id}`}><Copy className="size-3.5" /></button></div>
      </div>
    </details>
  );
}

function InlineError({ message, onRetry, testId }: { message: string; onRetry: () => void; testId: string }) {
  return <div className="flex items-start gap-2 rounded-lg border border-rose-300/20 bg-rose-400/[0.07] px-3 py-2.5 text-[10px] leading-4 text-rose-100/75" data-testid={testId}><XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-300" /><span className="flex-1">{message}</span><button type="button" onClick={onRetry} className="shrink-0 font-semibold text-rose-200 hover:text-white" data-testid={`${testId}-retry`}>Retry</button></div>;
}

function DirectorLoading() {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#0b0814]"><div className="w-72 space-y-3"><div className="h-2 w-24 animate-pulse rounded bg-fuchsia-300/20" /><div className="h-7 w-full animate-pulse rounded bg-white/10" /><div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" /><div className="mt-6 h-24 animate-pulse rounded-2xl bg-white/[0.04]" /><p className="pt-2 text-center text-[10px] uppercase tracking-[0.2em] text-white/25">Opening director&apos;s room</p></div></main>;
}