import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Film, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { Button } from "@/components/ui/button";
import { generateSeedanceMotion } from "@/lib/seedance-motion-control.server";

export const Route = createFileRoute("/seedance-motion")({
  component: SeedanceMotionPage,
  head: () => ({
    meta: [
      { title: "Seedance Motion Control — Aurora" },
      { name: "description", content: "ModelArk Seedance reference-video motion control." },
    ],
  }),
});

const MODELS = [
  ["seedance-2.0-fast", "Seedance 2.0 Fast"],
  ["seedance-2.0", "Seedance 2.0"],
  ["seedance-2.5", "Seedance 2.5"],
] as const;

const CAMERAS = [
  ["static", "Static"],
  ["push_in", "Push in"],
  ["pull_out", "Pull out"],
  ["orbit_cw", "Orbit clockwise"],
  ["orbit_ccw", "Orbit counter-clockwise"],
  ["pan_left", "Pan left"],
  ["pan_right", "Pan right"],
  ["tilt_up", "Tilt up"],
  ["tilt_down", "Tilt down"],
  ["zoom_in", "Zoom in"],
  ["zoom_out", "Zoom out"],
  ["handheld", "Handheld"],
] as const;

const MOTIONS = [
  ["faithful", "Faithful"],
  ["expressive", "Expressive"],
  ["subtle", "Subtle"],
  ["exaggerated", "Exaggerated"],
] as const;

function SeedanceMotionPage() {
  const { user, loading } = useAuth();
  const generate = useServerFn(generateSeedanceMotion);
  const [subjectImageUrl, setSubjectImageUrl] = useState<string | null>(null);
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Transfer the motion and timing from the reference video to the subject. Preserve the subject's identity and clothing.");
  const [modelKey, setModelKey] = useState<(typeof MODELS)[number][0]>("seedance-2.0-fast");
  const [cameraMovement, setCameraMovement] = useState<(typeof CAMERAS)[number][0]>("static");
  const [motionType, setMotionType] = useState<(typeof MOTIONS)[number][0]>("faithful");
  const [resolution, setResolution] = useState<"480p" | "720p">("720p");
  const [duration, setDuration] = useState(5);
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }

  async function run() {
    if (!subjectImageUrl || !motionVideoUrl) {
      toast.error("Upload both a subject image and a motion-reference video");
      return;
    }
    setBusy(true);
    setVideoUrl(null);
    setMeta(null);
    try {
      const result = await generate({
        data: {
          subjectImageUrl,
          motionVideoUrl,
          prompt,
          modelKey,
          duration,
          resolution,
          cameraMovement,
          motionType,
        },
      });
      setVideoUrl(result.videoUrl);
      setMeta(`${result.provider} · ${result.endpoint} · ${Math.round(result.latencyMs / 1000)}s`);
      toast.success("Seedance motion render complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Seedance motion render failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link to="/motion" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Motion Studio
        </Link>
        <div className="flex items-center gap-2 font-semibold"><Film className="size-4" /> Seedance Motion Control</div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-5 rounded-2xl border border-border bg-card/50 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4" /> ModelArk-native motion</div>
            <p className="mt-1 text-sm text-muted-foreground">The motion video is sent to Seedance as a reference video. No GPU, ComfyUI, MimicMotion, or Replicate path is used.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <UploadSlot userId={user.id} label="Subject image" hint="Upload the person/image to animate" value={subjectImageUrl} onChange={setSubjectImageUrl} />
            <UploadSlot userId={user.id} label="Motion reference video" hint="Upload the movement/performance to copy" accept="video/*" kind="video" value={motionVideoUrl} onChange={setMotionVideoUrl} />
          </div>

          <label className="block space-y-2 text-sm">
            <span className="font-medium">Motion prompt</span>
            <textarea className="min-h-28 w-full rounded-xl border border-border bg-background p-3 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Model</span><select className="w-full rounded-xl border border-border bg-background p-2.5" value={modelKey} onChange={(e) => setModelKey(e.target.value as typeof modelKey)}>{MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span>Camera</span><select className="w-full rounded-xl border border-border bg-background p-2.5" value={cameraMovement} onChange={(e) => setCameraMovement(e.target.value as typeof cameraMovement)}>{CAMERAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span>Motion intensity</span><select className="w-full rounded-xl border border-border bg-background p-2.5" value={motionType} onChange={(e) => setMotionType(e.target.value as typeof motionType)}>{MOTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span>Resolution</span><select className="w-full rounded-xl border border-border bg-background p-2.5" value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)}><option value="480p">480p</option><option value="720p">720p</option></select></label>
          </div>

          <label className="block space-y-2 text-sm"><span>Duration: {duration}s</span><input className="w-full" type="range" min={4} max={modelKey === "seedance-2.5" ? 30 : 15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
          <Button className="w-full" disabled={busy || !subjectImageUrl || !motionVideoUrl} onClick={() => void run()}>{busy ? <><Loader2 className="mr-2 size-4 animate-spin" />Rendering with Seedance…</> : "Generate motion-controlled video"}</Button>
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <h2 className="font-semibold">Output</h2>
          {videoUrl ? <video className="mt-4 w-full rounded-xl" src={videoUrl} controls playsInline /> : <div className="mt-4 flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">Your Seedance render will appear here.</div>}
          {meta && <p className="mt-3 text-xs text-muted-foreground">{meta}</p>}
        </div>
      </section>
    </main>
  );
}
