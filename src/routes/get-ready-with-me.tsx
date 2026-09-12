import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ImagePlus, Loader2, MapPin, Play, Sparkles, Upload, Video } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/get-ready-with-me")({ component: GetReadyWithMe });
type Uploaded = { name: string; subfolder?: string; type?: string };

async function uploadFile(file: File, accept: string): Promise<Uploaded> {
  const form = new FormData(); form.append("file", file);
  const response = await fetch(`/api/files/upload?accept=${encodeURIComponent(accept)}`, { method: "POST", body: form, credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Upload failed (${response.status})`);
  return payload as Uploaded;
}

function GetReadyWithMe() {
  const [performance, setPerformance] = useState<Uploaded | null>(null);
  const [outfit, setOutfit] = useState<Uploaded | null>(null);
  const [location, setLocation] = useState<Uploaded | null>(null);
  const [images, setImages] = useState<Uploaded[]>([]);
  const [videos, setVideos] = useState<Uploaded[]>([]);
  const [sceneReferences, setSceneReferences] = useState<Uploaded[]>([]);
  const [scenePrompt, setScenePrompt] = useState("cinematic luxury getting-ready sequence, premium editorial lighting, realistic skin and fabric detail");
  const [motionContext, setMotionContext] = useState("preserve the original getting-ready actions, gestures, pacing, and natural camera movement");
  const [ratio, setRatio] = useState("9:16");
  const [duration, setDuration] = useState("8");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const ready = Boolean(performance && outfit);
  const busy = ["uploading", "queued", "running"].includes(status);
  const statusLabel = useMemo(() => ({ idle: "Generate GRWM", uploading: "Uploading…", queued: "Queued…", running: "Generating…", succeeded: "Generation complete", failed: "Try again" }[status] || "Generate GRWM"), [status]);

  async function uploadMany(files: FileList | null, kind: "images" | "videos" | "scenes") {
    if (!files?.length) return; setError(""); setStatus("uploading");
    try {
      const max = kind === "images" ? 8 : kind === "videos" ? 4 : 4;
      const uploaded = await Promise.all(Array.from(files).slice(0, max).map((file) => uploadFile(file, kind === "videos" ? "video/*" : "image/*")));
      if (kind === "images") setImages((v) => [...v, ...uploaded].slice(0, max));
      else if (kind === "videos") setVideos((v) => [...v, ...uploaded].slice(0, max));
      else setSceneReferences((v) => [...v, ...uploaded].slice(0, max));
      setStatus("idle");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Upload failed"); }
  }
  async function uploadSingle(file: File | undefined, kind: "performance" | "outfit" | "location") {
    if (!file) return; setError(""); setStatus("uploading");
    try {
      const uploaded = await uploadFile(file, kind === "performance" ? "video/*" : "image/*");
      if (kind === "performance") setPerformance(uploaded);
      else if (kind === "outfit") setOutfit(uploaded);
      else setLocation(uploaded);
      setStatus("idle");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Upload failed"); }
  }
  async function generate() {
    if (!performance || !outfit) return; setError(""); setVideoUrl(""); setStatus("queued");
    try {
      const response = await fetch("/api/grwm", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ performance_video: performance.name, outfit_reference: outfit.name, location_reference: location?.name || null, reference_images: images.map((x) => x.name), reference_videos: videos.map((x) => x.name), scene_reference_images: sceneReferences.map((x) => x.name), scene_prompt: scenePrompt, motion_context: motionContext, ratio, duration: Number(duration), resolution: "720p" }) });
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Could not start generation (${response.status})`); const taskId = String(payload.taskId || ""); if (!taskId) throw new Error("ModelArk did not return a task ID."); setStatus("running");
      for (let attempt = 0; attempt < 120; attempt++) { await new Promise((resolve) => setTimeout(resolve, 5000)); const poll = await fetch(`/api/grwm/status/${encodeURIComponent(taskId)}`, { credentials: "include" }); const result = await poll.json().catch(() => ({})); if (!poll.ok) throw new Error(result.error || "Could not read generation status."); const s = String(result.status || "").toLowerCase(); if (["succeeded", "completed", "success"].includes(s)) { const url = String(result.content?.video_url || ""); if (!url) throw new Error("Generation succeeded but no video URL was returned."); setVideoUrl(url); setStatus("succeeded"); return; } if (["failed", "cancelled", "canceled"].includes(s)) throw new Error(result.error?.message || "ModelArk generation failed."); }
      throw new Error("Generation is still running. Check the Jobs page for the task.");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Generation failed"); }
  }

  return <main className="min-h-screen bg-[#0b0a17] px-5 py-10 text-white sm:px-8"><div className="mx-auto max-w-6xl"><Link to="/perform-anywhere" className="inline-flex items-center gap-2 text-sm font-semibold text-white/55 no-underline hover:text-white"><ArrowLeft size={15} /> Perform Anywhere</Link><div className="mt-8 rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 p-7 sm:p-10"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-fuchsia-300">Perform Anywhere · New workflow</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Get Ready With Me</h1><p className="mt-5 max-w-3xl text-base leading-relaxed text-white/55 sm:text-lg">Film yourself getting ready once. Add a new outfit, optional location, scene references, styling references, and motion references. Aurora transfers your performance into a cinematic GRWM while keeping your identity, movement, gestures, and timing recognizable.</p></div><div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]"><section className="space-y-5"><UploadCard icon={<Video />} title="1. Your GRWM performance" body="Primary motion and timing source. A clean 3–30 second phone clip works best." accept="video/*" value={performance} onFiles={(files) => uploadSingle(files?.[0], "performance")} /><div className="grid gap-5 sm:grid-cols-2"><UploadCard icon={<ImagePlus />} title="2. Reference photos" body="Identity, hair, makeup, styling, products, and continuity. Up to 8." accept="image/*" multiple count={images.length} onFiles={(files) => uploadMany(files, "images")} /><UploadCard icon={<Video />} title="3. Reference videos" body="Movement, framing, transitions, lighting, and treatment references. Up to 4." accept="video/*" multiple count={videos.length} onFiles={(files) => uploadMany(files, "videos")} /></div><div className="grid gap-5 sm:grid-cols-2"><UploadCard icon={<MapPin />} title="4. New location" body="Optional. Upload a location, room, street, hotel, car interior, studio, or other environment you want to replace the original setting." accept="image/*" value={location} onFiles={(files) => uploadSingle(files?.[0], "location")} /><UploadCard icon={<ImagePlus />} title="5. Scene references" body="Optional scene/production references for architecture, composition, lighting, set design, or atmosphere. Up to 4." accept="image/*" multiple count={sceneReferences.length} onFiles={(files) => uploadMany(files, "scenes")} /></div><UploadCard icon={<Sparkles />} title="6. New outfit" body="The wardrobe reference Aurora should apply consistently while preserving your original performance." accept="image/*" value={outfit} onFiles={(files) => uploadSingle(files?.[0], "outfit")} /><div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"><h2 className="text-lg font-bold">7. Direct the result</h2><div className="mt-4 space-y-4"><label className="block text-sm font-semibold text-white/75">Scene / look direction<textarea value={scenePrompt} onChange={(e) => setScenePrompt(e.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white outline-none focus:border-fuchsia-400/50" /></label><label className="block text-sm font-semibold text-white/75">Motion context<textarea value={motionContext} onChange={(e) => setMotionContext(e.target.value)} className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white outline-none focus:border-fuchsia-400/50" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-white/70">Frame<select value={ratio} onChange={(e) => setRatio(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm"><option>9:16</option><option>16:9</option><option>1:1</option></select></label><label className="text-sm font-semibold text-white/70">Duration<select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm"><option value="5">5 sec</option><option value="8">8 sec</option><option value="10">10 sec</option><option value="15">15 sec</option></select></label></div></div></div></section><aside className="lg:sticky lg:top-20 lg:h-fit"><div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"><p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">Generation</p><h2 className="mt-2 text-2xl font-black">Your cinematic GRWM</h2><div className="mt-5 space-y-3">{[["Performance", Boolean(performance)], ["New outfit", Boolean(outfit)], ["New location", Boolean(location)], ["Reference photos", images.length > 0], ["Reference videos", videos.length > 0], ["Scene references", sceneReferences.length > 0]].map(([label, done]) => <div key={String(label)} className="flex items-center gap-3 text-sm text-white/65"><span className={`flex size-6 items-center justify-center rounded-full border ${done ? "border-fuchsia-300 bg-fuchsia-300 text-black" : "border-white/15"}`}>{done ? <Check size={13} /> : null}</span>{String(label)}</div>)}</div><button disabled={!ready || busy} onClick={generate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{statusLabel}</button>{error && <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-xs leading-relaxed text-red-200">{error}</div>}{videoUrl && <div className="mt-5 overflow-hidden rounded-2xl border border-fuchsia-400/30"><video src={videoUrl} controls playsInline className="w-full" /><div className="flex items-center gap-2 p-3 text-xs font-bold text-fuchsia-200"><Play size={13} /> Generated GRWM</div></div>}<p className="mt-4 text-[11px] leading-relaxed text-white/35">The original performance is the motion anchor. Optional location and scene references can replace the original environment. Other reference media supplies identity, styling, and transition constraints. The new outfit is the wardrobe source.</p></div></aside></div></div></main>;
}

function UploadCard({ icon, title, body, accept, multiple = false, value, count, onFiles }: { icon: React.ReactNode; title: string; body: string; accept: string; multiple?: boolean; value?: Uploaded | null; count?: number; onFiles: (files: FileList | null) => void | Promise<void> }) {
  return <label className="block cursor-pointer rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-fuchsia-400/40"><div className="flex items-start justify-between gap-4"><div><div className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-400/10 text-fuchsia-300">{icon}</div><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">{body}</p></div>{count !== undefined && <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-3 py-1 text-[10px] font-bold text-fuchsia-200">{count} uploaded</span>}</div><div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-8 text-sm text-white/45"><Upload size={16} />{value ? value.name : `Choose file${multiple ? "s" : ""}`}<input type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => onFiles(e.target.files)} /></div></label>;
}
