import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, ImagePlus, X, Download, Check, RefreshCw, Music2, Camera } from "lucide-react";
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
  tab: "live" | "artist";
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

function LiveStudioPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState<"live" | "artist">("live");
  const [sceneId, setSceneId] = useState("kexp-purple");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tabScenes = SCENES.filter(s => s.tab === tab);
  const scene = SCENES.find(s => s.id === sceneId) ?? tabScenes[0];
  const isColorsLink = scene.id === "colored-backdrop";

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

  function switchTab(t: "live" | "artist") {
    setTab(t);
    const first = SCENES.find(s => s.tab === t);
    if (first) setSceneId(first.id);
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
    if (!refFile) { toast.error("Upload your reference photo first"); return; }
    if (isColorsLink) return;
    setGenerating(true);
    try {
      const imageUrl = await uploadRef(refFile);
      const res = await fetch("/api/public/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ kind: "image", prompt: scene.prompt, imageUrls: [imageUrl], model: MODEL }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Generation failed");
      toast.success("Scene queued! Rendering now…");
      await fetchGallery();
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
          <Link to="/auth"><Button className="aurora-button-primary">Sign in</Button></Link>
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
        <div className="flex gap-1 mb-8 p-1 bg-card border border-border rounded-xl w-fit">
          <button
            onClick={() => switchTab("live")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "live" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Music2 size={15} /> Live Session
          </button>
          <button
            onClick={() => switchTab("artist")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "artist" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Camera size={15} /> Artist Shoot
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
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

            {/* Gallery */}
            {generations.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-base">Your shots</h2>
                  <button onClick={() => void fetchGallery()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {generations.map(g => (
                    <div key={g.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      {g.status === "completed" && g.result_image_url ? (
                        <>
                          <img src={g.result_image_url} alt="Generated" className="w-full aspect-square object-cover" />
                          <div className="flex items-center justify-between px-2.5 py-2">
                            <span className="text-[11px] font-semibold text-emerald-400">Done</span>
                            <button onClick={() => dlImage(g.result_image_url!, `live-studio-${g.id}.jpg`)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <Download size={13} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="aspect-square flex flex-col items-center justify-center gap-2">
                          {(g.status === "pending" || g.status === "processing") && (
                            <Loader2 size={18} className="animate-spin text-primary" />
                          )}
                          <span className={cn("text-[11px] font-semibold", g.status === "failed" ? "text-destructive" : "text-amber-400")}>
                            {g.status === "pending" ? "Queued" : g.status === "processing" ? "Rendering…" : "Failed"}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                      : <><Sparkles size={16} /> Generate · 1 Aura</>}
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
