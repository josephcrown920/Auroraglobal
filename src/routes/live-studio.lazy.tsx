import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, ImagePlus, X, Download, Check, RefreshCw, Music2, Camera, Upload, Headphones, Tv2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/live-studio")({
  component: LiveStudioPage,
});

// ── Data ─────────────────────────────────────────────────────────────────────

const REALISM = "Hyper-realistic photography, ultra-HD 8K, cinema glass — lifelike micro-texture in skin, fabric and surfaces, physically accurate light falloff, no CGI or AI look.";
const IDENTITY = "IDENTITY LOCK: composite the REAL person from the uploaded reference photo into this scene. Preserve their EXACT face, skin tone, hairstyle, and body proportions. Do NOT alter their likeness.";

type Scene = {
  id: string;
  tab: "live" | "artist" | "tiktok-live";
  name: string;
  tagline: string;
  thumb: string;
  accentColor: string;
  prompt: string;
};

const SCENES: Scene[] = [
  {
    id: "kexp-purple",
    tab: "live",
    name: "Live on KEXP",
    tagline: "Concrete warehouse · violet wash",
    thumb: "/studio-refs/kexp-purple-studio.jpg",
    accentColor: "#8b5cf6",
    prompt: [
      "You are an AI performance compositor: place the REAL person from the reference photo into this live music session environment.",
      IDENTITY,
      "SCENE: raw brutalist concrete warehouse performance space — high ceilings with exposed industrial trusses, smooth grey concrete walls and floor, large colorful vinyl mural banner panel on the left wall, 'LIVE ON KEXP' lit monitor screen background right, drum kit at rear right, guitar amplifiers left, electric guitar player and trumpet player in background, vintage upright microphone stand front-center, purple/violet gel flood wash bathing the entire room from above.",
      "CAMERA: wide 3/4 angle, anamorphic 35mm, slight low angle, subject at vintage microphone front-center, band visible in background.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "kexp-blue",
    tab: "live",
    name: "Blue Cyclorama Session",
    tagline: "Bright blue sweep · full band",
    thumb: "/studio-refs/kexp-blue-studio.jpg",
    accentColor: "#3b82f6",
    prompt: [
      "You are an AI performance compositor: place the REAL person from the reference photo into this live session studio.",
      IDENTITY,
      "SCENE: bright cobalt blue seamless cyclorama sweep — wall and floor continuous, large white softboxes camera-left and camera-right at 45°, vintage silver standing microphone front-center on hardwood floor section, drum kit with cymbals at rear right, guitar with amp rear left, trumpet player far left. Clean professional live performance photography.",
      "CAMERA: wide full-body shot, eye level, 50mm, subject at vintage mic center frame.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "kexp-on-air",
    tab: "live",
    name: "ON AIR Lounge",
    tagline: "Glowing halos · cozy session",
    thumb: "/studio-refs/kexp-on-air-studio.png",
    accentColor: "#f97316",
    prompt: [
      "You are an AI performance compositor: place the REAL person from the reference photo into this intimate on-air session lounge.",
      IDENTITY,
      "SCENE: concrete industrial session room — smooth grey walls, glowing circular halo lights on stands (cobalt blue, magenta pink, warm orange tones), backlit red ON AIR neon sign upper right, drum kit at rear left, keyboard synthesizer player rear center, Persian rug on concrete floor, round bar stools, handheld vintage mic.",
      "CAMERA: medium wide, 35mm, subject front-center holding mic, band and glowing lights visible in background.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "black-box",
    tab: "live",
    name: "Black Box Theater",
    tagline: "Raw stage · single spotlight",
    thumb: "/studio-refs/kexp-purple-studio.jpg",
    accentColor: "#6b7280",
    prompt: [
      "You are an AI performance compositor: place the REAL person into this dramatic black box theater performance.",
      IDENTITY,
      "SCENE: black box theater — matte black walls and ceiling, single hard theatrical Fresnel spotlight from directly above illuminating subject only, surrounding darkness, atmospheric haze, boom-arm microphone from above, raw exposed rigging visible in shadows.",
      "CAMERA: locked-off center frame, 35mm, dramatic top-down pool of light, deep noir shadows.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "production-set",
    tab: "artist",
    name: "Music Video Set",
    tagline: "Warehouse · smoke · camera crew",
    thumb: "/studio-refs/artist-shoot-production-set.png",
    accentColor: "#ec4899",
    prompt: [
      "You are an AI performance compositor: place the REAL person from the reference photo into this high-production music video set.",
      IDENTITY,
      "SCENE: large industrial warehouse studio — exposed brick walls, polished concrete floor, matte orange sports car as centerpiece background prop, red and blue smoke bomb plumes billowing upward behind subject, professional Canon cameras on gimbal rigs operated by camera crew visible at frame edges, tall professional softbox lights both sides, overhead production lighting rig, subject holding vintage silver handheld microphone.",
      "CAMERA: medium wide, 35mm, subject front-center holding mic, car and production crew slightly out of focus behind.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "blue-cyc-portrait",
    tab: "artist",
    name: "Blue Cyclorama Portrait",
    tagline: "Royal blue sweep · close-up",
    thumb: "/studio-refs/kexp-blue-studio.jpg",
    accentColor: "#1e40af",
    prompt: [
      "You are an AI performance compositor: place the REAL person into this close-up blue cyclorama portrait session.",
      IDENTITY,
      "SCENE: seamless royal blue cyclorama — close-up 3/4 portrait crop chest and above, vintage ribbon microphone on stand at subject's chin level, heavy silver chain jewelry, dramatic single key light from camera-left at 45° with hard shadows, royal blue fill from behind, rich blue floor reflection, editorial fashion energy.",
      "CAMERA: tight 3/4 portrait, 85mm, f/1.8, dramatic shallow DOF, cinematic.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "arena-stage",
    tab: "artist",
    name: "Arena Stage",
    tagline: "Massive lights · crowd · haze",
    thumb: "/studio-refs/artist-shoot-production-set.png",
    accentColor: "#ef4444",
    prompt: [
      "You are an AI performance compositor: place the REAL person onto this sold-out arena concert stage.",
      IDENTITY,
      "SCENE: massive arena concert stage — enormous red and blue moving-head spotlights beaming from above, thick atmospheric haze, sold-out crowd of thousands blurred in darkness behind, subject standing center stage holding a handheld dynamic microphone, confetti in the air, massive LED screen wall behind.",
      "CAMERA: wide dramatic hero shot, anamorphic 35mm, low angle looking slightly up, crowd energy palpable.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "colored-backdrop",
    tab: "artist",
    name: "Colored Backdrop",
    tagline: "Full Colors Studio · 13 scenes",
    thumb: "/studio-refs/kexp-blue-studio.jpg",
    accentColor: "#8b5cf6",
    prompt: "See Colors Studio for the full cyclorama + color experience →",
  },
  // ── TikTok LIVE virtual backgrounds (16:9 landscape) ──────────────────────
  {
    id: "tl-neon-stage",
    tab: "tiktok-live",
    name: "Neon Arena Stage",
    tagline: "Massive LED rig · crowd energy",
    thumb: "/studio-refs/artist-shoot-production-set.png",
    accentColor: "#ec4899",
    prompt: [
      "Cinematic wide-angle 16:9 landscape photograph of a massive sold-out arena concert stage — point of view from center stage looking out at the crowd.",
      "Enormous custom LED video wall covering the entire back wall, animated with abstract violet and electric-pink light forms.",
      "Overhead rig packed with moving-head beam lights, all firing upward in a radial burst pattern, thick atmospheric haze filling the air.",
      "Sold-out crowd of thousands stretching to the horizon, rendered as a blur of raised phones and colored wristbands, warm amber and cool blue tones.",
      "Foreground: polished black stage floor, no human figures. The composition leaves the center and foreground clear for a live virtual background.",
      "Hyper-realistic photography, ultra-wide anamorphic lens, cinematic color grade, concert-grade production quality. NO TEXT, NO LOGOS.",
    ].join(" "),
  },
  {
    id: "tl-recording-studio",
    tab: "tiktok-live",
    name: "Recording Studio",
    tagline: "Pro booth · warm low light",
    thumb: "/studio-refs/kexp-purple-studio.jpg",
    accentColor: "#a78bfa",
    prompt: [
      "Cinematic 16:9 landscape photograph of a world-class professional recording studio control room.",
      "Massive SSL mixing console stretching across a floating island desk, hundreds of faders and knobs glowing amber.",
      "Large studio monitor speakers on either side, towering rack of outboard gear lit by tiny LEDs, acoustic foam panels on the walls in dark charcoal.",
      "Warm tungsten light from recessed ceiling coves, a soft accent light behind the console creating a gentle violet halo.",
      "Through the thick glass window, a dimly lit live room is visible — drum kit, microphone stands, a vintage upright piano.",
      "Foreground: clean wood floor, no human figures. Clear center space for a TikTok LIVE virtual background host.",
      "Hyper-realistic photography, 35mm, f/2.0, shallow depth of field on the window glass. NO TEXT, NO LOGOS.",
    ].join(" "),
  },
  {
    id: "tl-rooftop-skyline",
    tab: "tiktok-live",
    name: "Rooftop Golden Hour",
    tagline: "City skyline · sunset glow",
    thumb: "/studio-refs/kexp-on-air-studio.png",
    accentColor: "#f59e0b",
    prompt: [
      "Cinematic 16:9 landscape photograph of a luxury rooftop terrace in a major city at golden hour.",
      "Low sun at 10-degree elevation casting long warm amber shadows, entire scene bathed in rich orange-gold light.",
      "Background: dense city skyline of glass skyscrapers glowing with reflected sunset, a few buildings' windows lit individually.",
      "Terrace foreground: smooth concrete deck, potted palm trees with backlighting, a low glass balustrade railing.",
      "No people. Clean open center suitable for a TikTok LIVE virtual background with the host standing in front.",
      "Hyper-realistic aerial photography, ultra-wide 16mm lens, cinematic golden-hour color grade. NO TEXT, NO LOGOS.",
    ].join(" "),
  },
  {
    id: "tl-penthouse",
    tab: "tiktok-live",
    name: "Luxury Penthouse",
    tagline: "Floor-to-ceiling glass · night",
    thumb: "/studio-refs/kexp-blue-studio.jpg",
    accentColor: "#06b6d4",
    prompt: [
      "Cinematic 16:9 landscape photograph of an ultra-luxury penthouse interior at night.",
      "Floor-to-ceiling glass walls spanning the entire back, revealing a city skyline with millions of lights 60 floors below.",
      "Interior: floating marble island, bespoke furniture in ivory and champagne gold, candelabra with flickering warm light.",
      "Ceiling: backlit coffered plaster ceiling in soft warm white. Side walls: book-matched Italian marble panels.",
      "City lights outside provide a cool blue-teal ambient fill that contrasts the warm interior candle glow.",
      "No people. Clear center space for a TikTok LIVE virtual background. Ultra-realistic architectural photography, tilt-shift lens. NO TEXT, NO LOGOS.",
    ].join(" "),
  },
  {
    id: "tl-underground-club",
    tab: "tiktok-live",
    name: "Underground Club",
    tagline: "Dark concrete · neon haze",
    thumb: "/studio-refs/kexp-purple-studio.jpg",
    accentColor: "#7c3aed",
    prompt: [
      "Cinematic 16:9 landscape photograph of an underground nightclub at peak night.",
      "Raw exposed concrete walls, low ceiling with exposed conduit, industrial pipe lighting.",
      "DJ booth at the back: CDJs on a custom-lit plinth, a mesh of laser beams cutting through thick fog in cyan and violet.",
      "Neon tube signs on the concrete walls in red and blue reading abstract shapes (no legible text).",
      "Circular mirror ball overhead scattering white specks across the walls. Dark wood bar on the left with backlit shelves of bottles.",
      "No people. Clear center floor area for a TikTok LIVE virtual background host. Hyper-realistic club photography. NO TEXT, NO LOGOS.",
    ].join(" "),
  },
  {
    id: "tl-tour-bus",
    tab: "tiktok-live",
    name: "Tour Bus Interior",
    tagline: "Moving lights · road life",
    thumb: "/studio-refs/artist-shoot-production-set.png",
    accentColor: "#10b981",
    prompt: [
      "Cinematic 16:9 landscape photograph of the interior of a luxury artist tour bus in motion at night.",
      "Long narrow lounge area: low leather bench seating in forest green, ambient strip LEDs along the ceiling in warm amber, flat-screen monitors on the walls.",
      "Gold and chrome accents on the cabinet handles. Curtained bunk doors visible at the back.",
      "Side windows show blurred freeway lights streaming past at highway speed, conveying motion.",
      "A small studio section at front: keyboard on a fold-out surface, a notebook with scrawled lyrics, a half-drunk bottle of water.",
      "No people. Clear center space for a TikTok LIVE virtual background host. Hyper-realistic interior photography, 24mm wide. NO TEXT, NO LOGOS.",
    ].join(" "),
  },
];

type JobStatus = "pending" | "processing" | "completed" | "failed";
interface Generation {
  id: string;
  status: JobStatus;
  result_image_url: string | null;
  created_at: string;
  error: string | null;
}

const MODEL = "google/gemini-3.1-flash-image-preview";

function dlImage(url: string, name: string) {
  fetch(url).then(r => r.blob()).then(b => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
  }).catch(() => window.open(url, "_blank"));
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── Mastering panel (inline, lives inside the Mastering tab) ─────────────────

type MasterLoudness = "low" | "medium" | "high";
type MasterStyle = "balanced" | "warm" | "open" | "punchy" | "clean";
type MasterFormat = "mp3" | "wav" | "flac";
type MasterPhase = "idle" | "uploading" | "submitting" | "polling" | "done" | "error";

const LOUDNESS_OPTS: { value: MasterLoudness; label: string; sub: string }[] = [
  { value: "low",    label: "Low",    sub: "Streaming-optimised, true to source" },
  { value: "medium", label: "Medium", sub: "Balanced, works everywhere" },
  { value: "high",   label: "High",   sub: "Loud and punchy, club-ready" },
];
const STYLE_OPTS: { value: MasterStyle; label: string; sub: string }[] = [
  { value: "balanced", label: "Balanced", sub: "Clean, works across genres" },
  { value: "warm",     label: "Warm",     sub: "Analogue richness, softer highs" },
  { value: "open",     label: "Open",     sub: "Wide, airy, detailed top end" },
  { value: "punchy",   label: "Punchy",   sub: "Forward mids, tight low end" },
  { value: "clean",    label: "Clean",    sub: "Transparent, high clarity" },
];
const FORMAT_OPTS: MasterFormat[] = ["mp3", "wav", "flac"];

function MasteringPanel() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loudness, setLoudness] = useState<MasterLoudness>("medium");
  const [style, setStyle] = useState<MasterStyle>("balanced");
  const [format, setFormat] = useState<MasterFormat>("mp3");
  const [phase, setPhase] = useState<MasterPhase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function submit() {
    if (!audioFile) { toast.error("Upload a mix first"); return; }
    setPhase("uploading");
    setErrorMsg(null);
    try {
      // 1. Upload
      const fd = new FormData();
      fd.append("file", audioFile);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in to upload audio");
      const up = await fetch("/api/audio/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const { url, error: upErr } = await up.json() as { url?: string; error?: string };
      if (!up.ok || !url) throw new Error(upErr ?? "Upload failed");

      // 2. Submit to LANDR
      setPhase("submitting");
      const res = await fetch("/api/audio/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: url, loudness, style, format }),
      });
      const { id, error: mErr } = await res.json() as { id?: string; error?: string };
      if (!res.ok || !id) throw new Error(mErr ?? "Mastering request failed");
      setJobId(id);

      // 3. Poll
      setPhase("polling");
      pollRef.current = setInterval(async () => {
        const st = await fetch(`/api/audio/master/${id}/status`);
        const { status, downloadUrl: dl, error: stErr } = await st.json() as { status?: string; downloadUrl?: string; error?: string };
        if (status === "completed" && dl) {
          if (pollRef.current) clearInterval(pollRef.current);
          setDownloadUrl(dl);
          setPhase("done");
        } else if (status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          throw new Error(stErr ?? "Mastering failed");
        }
      }, 4000);
    } catch (e) {
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  function reset() {
    setAudioFile(null); setJobId(null); setDownloadUrl(null);
    setErrorMsg(null); setPhase("idle");
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        {/* Upload */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Your Mix</p>
          <input ref={fileRef} type="file" accept=".mp3,.wav,.aif,.aiff,.flac" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setAudioFile(f); e.target.value = ""; }} />
          <button onClick={() => audioFile ? reset() : fileRef.current?.click()}
            className={cn("w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all",
              audioFile ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/60")}>
            {audioFile ? (
              <><Headphones size={22} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">{audioFile.name}</span>
                <span className="text-[11px] text-muted-foreground">tap to remove</span></>
            ) : (
              <><Upload size={22} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">MP3, WAV, AIFF, FLAC · up to 200MB</span></>
            )}
          </button>
        </div>

        {/* Loudness */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Loudness</p>
          <div className="grid grid-cols-3 gap-2">
            {LOUDNESS_OPTS.map(o => (
              <button key={o.value} onClick={() => setLoudness(o.value)}
                className={cn("rounded-xl p-3 text-left border transition-all",
                  loudness === o.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-border/60")}>
                <div className="text-sm font-bold">{o.label}</div>
                <div className="text-[10px] leading-snug mt-0.5">{o.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Master Style</p>
          <div className="grid grid-cols-2 gap-2">
            {STYLE_OPTS.map(o => (
              <button key={o.value} onClick={() => setStyle(o.value)}
                className={cn("rounded-xl p-3 text-left border transition-all",
                  style === o.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-border/60")}>
                <div className="text-sm font-bold">{o.label}</div>
                <div className="text-[10px] leading-snug mt-0.5">{o.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Output Format</p>
          <div className="flex gap-2">
            {FORMAT_OPTS.map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={cn("rounded-lg px-4 py-2 text-sm font-bold border transition-all uppercase",
                  format === f ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Status / action */}
        {phase === "done" && downloadUrl ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-emerald-400">✓ Mastered and ready</p>
            <a href={downloadUrl} target="_blank" rel="noreferrer">
              <Button className="w-full aurora-button-primary gap-2 h-11">
                <Download size={15} /> Download Master
              </Button>
            </a>
            <Button variant="outline" onClick={reset} className="w-full h-9 text-sm">Master another track</Button>
          </div>
        ) : phase === "error" ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{errorMsg ?? "An error occurred"}</p>
            <Button variant="outline" onClick={reset} className="w-full h-9 text-sm">Try again</Button>
          </div>
        ) : (
          <Button onClick={() => void submit()} disabled={!audioFile || phase !== "idle"}
            className="w-full aurora-button-primary gap-2 h-12 text-base font-bold">
            {phase === "idle" ? <><Sparkles size={16} /> Master this track</>
              : <><Loader2 size={16} className="animate-spin" />
                {phase === "uploading" ? "Uploading…" : phase === "submitting" ? "Sending to LANDR…" : "Mastering…"}</>}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function LiveStudioPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState<"live" | "artist" | "tiktok-live" | "mastering">("live");
  const [sceneId, setSceneId] = useState("kexp-purple");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tabScenes = SCENES.filter(s => s.tab === (tab === "mastering" ? "live" : tab));
  const scene = SCENES.find(s => s.id === sceneId) ?? tabScenes[0];
  const isColorsLink = scene.id === "colored-backdrop";
  const isTikTokLive = tab === "tiktok-live";

  const fetchGallery = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("generations")
      .select("id,status,result_image_url,created_at,error")
      .eq("kind", "image")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setGenerations(data as Generation[]);
  }, [session]);

  useEffect(() => { void fetchGallery(); }, [fetchGallery]);

  useEffect(() => {
    const hasActive = generations.some(g => g.status === "pending" || g.status === "processing");
    if (hasActive) {
      if (!pollRef.current) pollRef.current = setInterval(() => void fetchGallery(), 3500);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [generations, fetchGallery]);

  function switchTab(t: "live" | "artist" | "tiktok-live" | "mastering") {
    setTab(t);
    if (t !== "mastering") {
      const first = SCENES.find(s => s.tab === t);
      if (first) setSceneId(first.id);
    }
  }

  async function uploadRef(file: File): Promise<string> {
    if (!session) throw new Error("Not signed in");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${session.user.id}/live-refs/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data: signed, error: se } = await supabase.storage.from("studio").createSignedUrl(path, 3600);
    if (se || !signed) throw new Error("Could not sign reference image");
    return signed.signedUrl;
  }

  async function generate() {
    if (!session) { toast.error("Sign in to generate"); return; }
    if (!isTikTokLive && !refFile) { toast.error("Upload your reference photo first"); return; }
    if (isColorsLink) return;
    setGenerating(true);
    try {
      let uploadedUrl: string | undefined;
      if (!isTikTokLive && refFile) uploadedUrl = await uploadRef(refFile);
      const body: Record<string, unknown> = {
        kind: "image",
        prompt: scene.prompt,
        model: MODEL,
        ...(isTikTokLive
          ? { params: { aspect_ratio: "16:9" } }
          : { imageUrls: [uploadedUrl!] }),
      };
      const res = await fetch("/api/public/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Generation failed");
      toast.success("Scene queued! Rendering now…");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setGenerating(false);
    }
  }

  if (!session) {
    return (
      <div className="aurora-page-shell flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-4xl">🎙</div>
          <h1 className="text-2xl font-bold">Live Performance Studios</h1>
          <p className="text-muted-foreground">Sign in to start generating performance photos</p>
          <Link to="/auth" search={authNextSearch()}><Button className="aurora-button-primary">Sign in</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="aurora-page-shell min-h-screen relative">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ background: `radial-gradient(circle, ${scene.accentColor}, transparent)` }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-8" style={{ background: `radial-gradient(circle, ${scene.accentColor}, transparent)` }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-1">Live Performance Studios</h1>
          <p className="text-muted-foreground text-sm">Place yourself into a real performance space — upload your photo and generate</p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-1 mb-8 p-1 bg-card border border-border rounded-xl w-fit">
          <button
            onClick={() => switchTab("live")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "live" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Music2 size={15} /> Live Session
          </button>
          <button
            onClick={() => switchTab("artist")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "artist" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Camera size={15} /> Artist Shoot
          </button>
          <button
            onClick={() => switchTab("tiktok-live")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "tiktok-live" ? "bg-[#fe2c55] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Tv2 size={15} /> TikTok LIVE
          </button>
          <button
            onClick={() => switchTab("mastering")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "mastering" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Headphones size={15} /> AI Mastering
          </button>
        </div>

        {tab === "mastering" && <MasteringPanel />}

        <div className={cn("grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8", tab === "mastering" && "hidden")}>
          {/* Left: scene grid */}
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
              {tabScenes.map(sc => (
                <button
                  key={sc.id}
                  onClick={() => setSceneId(sc.id)}
                  className={cn(
                    "relative aspect-video rounded-xl overflow-hidden border-2 text-left transition-all",
                    sceneId === sc.id ? "shadow-lg scale-[1.02]" : "border-border hover:border-border/80",
                  )}
                  style={{ borderColor: sceneId === sc.id ? sc.accentColor : undefined, boxShadow: sceneId === sc.id ? `0 0 0 3px ${sc.accentColor}33` : undefined }}
                >
                  <img src={sc.thumb} alt={sc.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                  {sceneId === sc.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: sc.accentColor }}>
                      <Check size={11} color="#fff" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 p-2.5">
                    <div className="text-xs font-bold text-white leading-tight">{sc.name}</div>
                    <div className="text-[10px] text-white/60 mt-0.5 leading-tight">{sc.tagline}</div>
                  </div>
                </button>
              ))}
            </div>

          </div>

          {/* Right: upload + generate panel */}
          <div className="lg:sticky lg:top-20 self-start">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
              {/* Scene info */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: scene.accentColor }} />
                  <span className="font-bold text-sm">{scene.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{scene.tagline}</p>
              </div>

              {isColorsLink ? (
                /* Colored backdrop → redirect to colors studio */
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">The full 13-scene cyclorama experience lives in Colors Studio.</p>
                  <Link to="/colors">
                    <Button className="w-full aurora-button-primary gap-2">
                      <Sparkles size={15} /> Open Colors Studio
                    </Button>
                  </Link>
                </div>
              ) : isTikTokLive ? (
                /* TikTok LIVE — no photo needed, just generate a 16:9 background */
                <>
                  <div className="rounded-xl border border-[#fe2c55]/30 bg-[#fe2c55]/5 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Tv2 size={14} className="text-[#fe2c55]" />
                      <span className="text-xs font-bold text-[#fe2c55] uppercase tracking-wide">16:9 Virtual Background</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Generates a landscape background you can load directly into TikTok LIVE Studio as a virtual background scene.
                    </p>
                  </div>

                  <Button
                    onClick={() => void generate()}
                    disabled={generating}
                    className="w-full gap-2 h-12 text-base font-bold bg-[#fe2c55] hover:bg-[#e0253c] text-white border-0"
                  >
                    {generating
                      ? <><Loader2 size={16} className="animate-spin" /> Rendering…</>
                      : <><Sparkles size={16} /> Generate Background · 10 Aura</>}
                  </Button>

                  {/* How to use */}
                  <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Info size={12} /> How to use in TikTok LIVE
                    </div>
                    {[
                      "Download the generated background",
                      "Open TikTok LIVE Studio on desktop",
                      "Click + Add source → Image",
                      "Select your downloaded background",
                      "Drag it below your camera layer",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#fe2c55]/15 text-[9px] font-black text-[#fe2c55]">{i + 1}</span>
                        <span className="text-[11px] text-muted-foreground leading-snug">{step}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Photo upload */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">YOUR PHOTO</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setRefFile(f); setRefPreview(URL.createObjectURL(f)); }
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => refFile ? (setRefFile(null), setRefPreview(null)) : fileRef.current?.click()}
                      className={cn(
                        "w-full aspect-square rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all",
                        refFile ? "border-primary/60" : "border-border hover:border-border/60"
                      )}
                    >
                      {refPreview ? (
                        <div className="relative w-full h-full">
                          <img src={refPreview} alt="Ref" className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center">
                            <X size={12} color="#fff" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImagePlus size={26} />
                          <span className="text-xs font-medium">Upload your photo</span>
                          <span className="text-[11px]">Front-facing, clear lighting</span>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Generate */}
                  <Button
                    onClick={() => void generate()}
                    disabled={!refFile || generating}
                    className="w-full aurora-button-primary gap-2 h-12 text-base font-bold"
                  >
                    {generating
                      ? <><Loader2 size={16} className="animate-spin" /> Rendering…</>
                      : <><Sparkles size={16} /> Generate · 10 Aura</>}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
