import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ImagePlus, Sparkles, Upload, Video } from "lucide-react";

export const Route = createFileRoute("/get-ready-with-me")({
  component: GetReadyWithMe,
});

function GetReadyWithMe() {
  return (
    <main className="min-h-screen bg-[#0b0a17] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/perform-anywhere" className="inline-flex items-center gap-2 text-sm font-semibold text-white/55 no-underline hover:text-white"><ArrowLeft size={15} /> Perform Anywhere</Link>
        <div className="mt-10 rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 p-7 sm:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-300">Perform Anywhere · New workflow</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Get Ready With Me</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/55 sm:text-lg">Upload your real getting-ready video, reference photos, reference videos, and the new outfit you want. Aurora uses your original movement, timing, gestures, and identity as the performance source while rebuilding the look and scene.</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <UploadCard icon={<Video />} title="Your GRWM performance" body="Upload the video of yourself getting ready. This is the motion and timing source." accept="video/*" />
          <UploadCard icon={<ImagePlus />} title="Reference photos" body="Add identity, outfit, environment, styling, or product references." accept="image/*" multiple />
          <UploadCard icon={<Video />} title="Reference videos" body="Add clips that describe the movement, framing, transitions, or visual treatment you want." accept="video/*" multiple />
          <UploadCard icon={<Sparkles />} title="New outfit" body="Upload the outfit reference that should replace the original wardrobe while keeping your performance." accept="image/*" multiple={false} />
        </div>
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold">Generation contract</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{[
            "Preserve the user's identity",
            "Preserve the original actions and gestures",
            "Preserve timing and performance beats",
            "Apply the supplied new outfit consistently",
            "Use reference photos for visual identity and continuity",
            "Use reference videos for motion, framing, and transition cues",
          ].map((item) => <div key={item} className="flex items-center gap-2.5 text-sm text-white/70"><Check size={15} className="text-fuchsia-300" />{item}</div>)}</div>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-white/35">The generation handoff is wired as a multimodal reference workflow: the source performance remains the motion anchor, while reference media supplies identity, wardrobe, scene, and treatment constraints.</p>
      </div>
    </main>
  );
}

function UploadCard({ icon, title, body, accept, multiple = false }: { icon: React.ReactNode; title: string; body: string; accept: string; multiple?: boolean }) {
  return <label className="cursor-pointer rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-fuchsia-400/40"><div className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-400/10 text-fuchsia-300">{icon}</div><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-white/45">{body}</p><div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-8 text-sm text-white/45"><Upload size={16} /> Choose file{multiple ? "s" : ""}<input type="file" accept={accept} multiple={multiple} className="sr-only" /></div></label>;
}
