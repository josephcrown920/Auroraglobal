import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { TriedTestedShowcase } from "@/components/studio/TriedTestedShowcase";
import { BringItToLifePreview } from "@/components/studio/BringItToLifePreview";
import tutorialStudioRefs from "@/assets/tutorial-studio-refs.jpg.asset.json";
import tutorialStudioFinal from "@/assets/tutorial-studio-final.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Wand2, LogOut, Loader2, Download, Camera, Film, Mic2, Coins, Zap, LayoutDashboard, Shield, Workflow, Server } from "lucide-react";
import { toast } from "sonner";
import { generatePerformanceShot, listGenerations, generateVideoFromImage, lipSyncVideo } from "@/lib/studio.functions";
import { getMyProfile, createPaystackCheckout } from "@/lib/billing.functions";
import { PLANS } from "@/lib/billing.plans";
import { detectCurrency } from "@/lib/geo.functions";
import demoSelfie from "@/assets/demo-selfie.jpg";
import { RECIPES } from "@/lib/tutorials";
import { MODEL_LIST, VIDEO_MODEL_LIST, getModelMeta } from "@/lib/models";
import { ModelBadge } from "@/components/ModelBadge";
import { OnboardingModal, shouldShowOnboarding } from "@/components/studio/OnboardingModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HfAudioPanel } from "@/components/studio/HfAudioPanel";
import { publishGeneration } from "@/lib/share.functions";
import { Share2 } from "lucide-react";
import { saveAssetToDisk } from "@/lib/save";
import { ConnectReplicateBanner } from "@/components/ConnectReplicateBanner";
import { JoshSlideshow } from "@/components/studio/JoshSlideshow";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createFileRoute("/studio")({
  component: StudioPage,
  head: () => ({
    meta: [
      { title: "Studio — Aurora" },
      { name: "description", content: "The full Aurora studio: upload references, pick a model, run generations and iterate on cinematic shots." },
      { property: "og:title", content: "Aurora Studio" },
      { property: "og:description", content: "Run image and video generations across every top model from one canvas." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/studio" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/studio" }],
  }),
});

const MODELS = MODEL_LIST;

const colorsWide = (color: string) =>
  `Place the subject into a minimalist studio performance scene. Full-body side profile pose, arms slightly extended forward as if performing. Use an exact suspended vintage studio microphone — photoreal shape, size, material, cable — hanging from ceiling at chest level. Environment is a seamless ${color} cyclorama studio — background and floor are one continuous ${color} color, no visible edges or corners. Soft even glossy lighting with smooth gradient. Subject stands on a circular performance platform matching the ${color} tone, slightly elevated with subtle shadow and faint reflective sheen. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions. Outfit identical to the outfit reference. Cinematic studio lighting, gentle floor shadow, rim light separation, ultra-realistic skin texture, natural pores, sharp clothing detail, high-end music video aesthetic, 4K photoreal quality.`;

const colorsCloseUp = (color: string) =>
  `Place the subject into a studio performance scene. Medium close-up from chest up. Subject turned slightly to side but mostly facing camera — approximately 30-45° angled pose, majority of face visible. Use an exact suspended vintage studio microphone — identical design, metallic finish, hanging cable — positioned in front at mouth level. Environment is a seamless continuous ${color} cyclorama background filling entire frame top to bottom, no visible floor line, corners, or edges. Preserve exact facial likeness, beard, hairstyle, skin tone, proportions. Outfit identical to the outfit reference. Pose natural and expressive as if mid-performance, hands slightly raised or gesturing. Soft even studio lighting, gentle shadows, subtle rim light separation, ultra-realistic skin texture with natural pores, sharp clothing detail, shallow depth of field but subject fully crisp, high-end music video aesthetic, 4K photoreal quality.`;

const musicVideoScene =
  `Create a hyper-realistic composite using the provided reference images. Use the close-up selfie as the primary identity source, preserving exact facial features, skin tone, complexion, beard texture, hairstyle, eye detail, and overall likeness with absolute accuracy. Dress the subject in the exact outfit from the outfit reference — accurate colors, fabric textures, proportions, and fit. Place the subject outdoors in the location reference as the main background environment, and incorporate the prop/vehicle from the prop reference behind the subject — naturally placed, correct scale and angle. Match the pose reference exactly: same body positioning, framing, perspective, and camera angle. Include a vintage hanging microphone suspended directly in front of the subject at mouth level. Apply true cinematic shallow depth of field — subject and microphone razor-sharp, background softly blurred with natural optical bokeh and realistic lens falloff. Visual style of ARRI Alexa cinema camera with high-quality prime lens: filmic color science, natural highlight roll-off, accurate dynamic range, professional golden-hour outdoor lighting. Advanced skin realism — authentic pores, micro-texture, fine lines, natural asymmetry, freckles, vellus hairs, real matte vs oily zones, no smoothing or plastic artifacts. High-fidelity eye detail with crisp iris texture, accurate subsurface light, refined eyelids and lashes. Ultra-photorealistic, seamless blending, accurate proportions, true optical depth, 4K, no text or logos.`;

const PRESETS = [
  { label: "Concert Stage", prompt: "Cinematic concert performance shot of the subject on a massive stage, dramatic purple stage lighting, smoke, crowd silhouettes, professional music photography, 85mm lens, shallow depth of field, ultra detailed" },
  { label: "Editorial Cover", prompt: "High-fashion editorial cover shot of the subject, studio lighting with violet rim light, seamless paper backdrop, confident pose, magazine quality, medium format camera look" },
  { label: "Neon Street", prompt: "Cinematic night street performance, neon purple and pink reflections, rain-soaked pavement, motion blur background, professional cinematic still" },
  { label: "Urban Rooftop", prompt: "Cinematic editorial photograph of the subject on a downtown rooftop at golden hour, skyline of glass towers behind, low sun rim-lighting the subject from the side, warm cinematic color grade, anamorphic 50mm look, sharp focus on the subject, shallow depth of field, 4K. Preserve exact facial likeness and outfit." },
  { label: "Urban Alley", prompt: "Gritty urban alleyway portrait of the subject at night, wet pavement reflecting overhead street lamps, brick walls and graffiti softly out of focus, single hard key light from above, deep shadows, ARRI cinema look, anamorphic flares, 35mm lens, 4K. Preserve exact facial likeness and outfit." },
  { label: "Urban Subway", prompt: "Cinematic underground subway platform shot — subject standing on the platform with a blurred train streaking past behind them creating long motion-blur light streaks, fluorescent overhead lighting mixed with warm tungsten, hyper-real grain, 4K editorial still. Preserve exact facial likeness and outfit." },
  { label: "Urban Crosswalk", prompt: "Aerial-angle street photograph of the subject mid-stride on a busy downtown crosswalk surrounded by motion-blurred pedestrians, taxis with bokeh tail lights, overcast cinematic color grade, ARRI Alexa film look, 4K. Preserve exact facial likeness and outfit." },
  { label: "Colors — Wide (Hot Pink)", prompt: colorsWide("hot pink") },
  { label: "Colors — Close-up (Hot Pink)", prompt: colorsCloseUp("hot pink") },
  { label: "Colors — Wide (Royal Blue)", prompt: colorsWide("royal blue") },
  { label: "Colors — Close-up (Sunset Orange)", prompt: colorsCloseUp("sunset orange") },
  { label: "Music Video Scene", prompt: musicVideoScene },
  { label: "Urban Cut", prompt: "Cinematic luxury fashion showcase of the subject styled like a runway model — but anywhere: a sleek modern interior or a moody downtown street. Full-body editorial pose with confident runway energy, the designer outfit as the hero of the frame. Dramatic directional key light with soft rim separation, polished reflective floor, anamorphic 50mm look, shallow depth of field, high-fashion color grade, ultra-realistic skin texture with natural pores, sharp clothing detail, 4K photoreal quality. Preserve exact facial likeness, beard, hairstyle, skin tone, and the outfit from the reference." },
  { label: "Get Ready With Me", prompt: "Intimate 'get ready with me' scene of the subject in front of a large vanity mirror mid-styling — outfit selection and finishing touches, building to the finished look. Warm soft vanity lighting with natural window fill, cozy bedroom / dressing-room setting, candid handheld editorial feel, shallow depth of field, ultra-realistic skin texture with natural pores, sharp clothing detail, 4K photoreal quality. Preserve exact facial likeness, beard, hairstyle, skin tone, and the outfit from the reference." },
];

const REANGLES = [
  { label: "Side profile", prompt: "super close up, from the side front angle of the subject, keep bokeh depth of field, preserve identity, outfit, and environment exactly" },
  { label: "Wide shot", prompt: "wide shot from behind the subject, showing full environment, keep cinematic depth of field, preserve identity, outfit, and environment exactly" },
  { label: "Low angle", prompt: "low angle looking up at the subject, dramatic perspective, keep bokeh depth of field, preserve identity, outfit, and environment exactly" },
  { label: "Extreme close-up", prompt: "extreme close-up on the face, eyes looking into camera, shallow depth of field, preserve identity and environment exactly" },
  { label: "Over the shoulder", prompt: "over the shoulder shot from behind, looking at the scene ahead, cinematic bokeh, preserve identity, outfit, and environment exactly" },
  { label: "Dutch angle", prompt: "tilted dutch angle, dynamic composition, dramatic cinematic lighting, preserve identity, outfit, and environment exactly" },
];


function StudioPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selfie, setSelfie] = useState<string | null>(null);
  const [outfit, setOutfit] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [prop, setProp] = useState<string | null>(null);
  const [motion, setMotion] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [model, setModel] = useState(MODELS[0].value);
  const [videoModel, setVideoModel] = useState(VIDEO_MODEL_LIST[0].value);
  const [cameraMovement, setCameraMovement] = useState<string>("static");
  const [endFrameUrl, setEndFrameUrl] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("subject performing and singing expressively, natural body movement, camera locked");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lipsyncModel, setLipsyncModel] = useState<"fal-ai/sync-lipsync/v2" | "fal-ai/wav2lip" | "latentsync">("fal-ai/sync-lipsync/v2");

  const [onboardOpen, setOnboardOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && shouldShowOnboarding()) {
      // Defer so the page can mount first
      const t = setTimeout(() => setOnboardOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [user]);

  const genFn = useServerFn(generatePerformanceShot);
  const listFn = useServerFn(listGenerations);
  const videoFn = useServerFn(generateVideoFromImage);
  const lipSyncFn = useServerFn(lipSyncVideo);
  const profileFn = useServerFn(getMyProfile);
  const checkoutFn = useServerFn(createPaystackCheckout);
  const publishFn = useServerFn(publishGeneration);
  const shareMut = useMutation({
    mutationFn: async (id: string) => publishFn({ data: { id } }),
    onSuccess: async (r) => {
      const url = `${window.location.origin}${r.url}`;
      try { await navigator.clipboard.writeText(url); toast.success("Public link copied", { description: url }); }
      catch { toast.success("Published", { description: url }); }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't publish"),
  });
  const detectCurrencyFn = useServerFn(detectCurrency);
  const { data: geo } = useQuery({ queryKey: ["geo-currency"], queryFn: () => detectCurrencyFn(), staleTime: 60 * 60 * 1000 });
  const currency = geo?.currency ?? "USD";

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: history } = useQuery({
    queryKey: ["gens", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const latest = useMemo(() => {
    const items = history?.items ?? [];
    return items.find((i) => i.status === "complete" && i.result_image_url);
  }, [history]);

  const latestVideo = useMemo(() => {
    const items = history?.items ?? [];
    return items.find((i) => i.status === "complete" && i.result_video_url);
  }, [history]);

  const mut = useMutation({
    mutationFn: async () => {
      // Build labeled reference list so Gemini knows which slot each image is.
      // When a pose is provided we strip outfit/lighting cues from the pose ref
      // via the prompt; ordering doesn't matter as long as labels are clear.
      const refs: { url: string; label: string }[] = [];
      if (selfie) refs.push({ url: selfie, label: "Identity (face / skin / hair)" });
      if (outfit) refs.push({ url: outfit, label: "Outfit (wardrobe only)" });
      if (scene) refs.push({ url: scene, label: "Scene / environment" });
      if (prop) refs.push({ url: prop, label: "Prop (mic / vehicle / object)" });
      if (motion) refs.push({ url: motion, label: "POSE reference — copy stance, gesture, camera angle ONLY. Ignore its outfit, face and background." });
      if (refs.length === 0) throw new Error("Add at least one reference image");
      const labelBlock = refs
        .map((r, i) => `Image ${i + 1}: ${r.label}`)
        .join("\n");
      const fullPrompt = `${prompt}\n\nReference images (in order):\n${labelBlock}`;
      return genFn({ data: { prompt: fullPrompt, imageUrls: refs.map((r) => r.url), motionVideoUrl: null, model } });
    },
    onSuccess: () => {
      toast.success("Shot ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });



  const reangleMut = useMutation({
    mutationFn: async (anglePrompt: string) => {
      if (!latest?.result_image_url) throw new Error("Generate a base shot first");
      return genFn({ data: { prompt: anglePrompt, imageUrls: [latest.result_image_url], motionVideoUrl: null, model } });
    },
    onSuccess: () => {
      toast.success("New angle ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const videoMut = useMutation({
    mutationFn: async () => {
      if (!latest?.result_image_url) throw new Error("Generate a base shot first");
      return videoFn({
        data: {
          imageUrl: latest.result_image_url,
          prompt: videoPrompt,
          duration: 5,
          resolution: "720p",
          modelKey: videoModel,
          cameraMovement,
          endFrameUrl: endFrameUrl ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Video ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const lipSyncMut = useMutation({
    mutationFn: async () => {
      if (!audioUrl) throw new Error("Upload your audio first");
      let videoUrl = latestVideo?.result_video_url ?? null;
      if (!videoUrl) {
        const baseImg = latest?.result_image_url;
        if (!baseImg) throw new Error("Generate or upload a base image/video first");
        toast.message("Animating image first…", { description: "Turning your still into a talking-head clip." });
        const v = await videoFn({
          data: {
            imageUrl: baseImg,
            prompt: "subtle talking-head movement, natural micro-expressions, locked camera",
            duration: 5,
            resolution: "720p",
            modelKey: videoModel,
            cameraMovement: "static",
            endFrameUrl: null,
          },
        });
        videoUrl = v.videoUrl;
      }
      return lipSyncFn({ data: { videoUrl, audioUrl, model: lipsyncModel } });
    },
    onSuccess: () => {
      toast.success("Lip-sync ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Resolve a permanent public URL for the bundled demo selfie (uploads it
  // to the studio bucket once per user so the AI model can fetch it).
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const path = `${user.id}/demo/selfie.jpg`;
    const existing = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
    // try a HEAD-style fetch by image load
    const probe = new Image();
    probe.onload = () => setDemoUrl(existing);
    probe.onerror = async () => {
      try {
        const blob = await (await fetch(demoSelfie)).blob();
        await supabase.storage.from("studio").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        setDemoUrl(supabase.storage.from("studio").getPublicUrl(path).data.publicUrl);
      } catch (e) {
        console.error("Demo seed failed", e);
      }
    };
    probe.src = existing;
  }, [user]);

  const demoMut = useMutation({
    mutationFn: async () => {
      if (!demoUrl) throw new Error("Demo selfie not ready yet — try again in a second");
      return genFn({ data: { prompt: PRESETS[3].prompt, imageUrls: [demoUrl], motionVideoUrl: null, model } });
    },
    onSuccess: () => {
      toast.success("Demo shot ready");
      qc.invalidateQueries({ queryKey: ["gens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Pending recipe from landing-page tutorial — pre-fill prompt + selfie and auto-fire.
  const [recipeFired, setRecipeFired] = useState(false);
  useEffect(() => {
    if (recipeFired) return;
    if (typeof window === "undefined") return;
    if (!user || !demoUrl) return;
    const pending = localStorage.getItem("aurora.pendingRecipe");
    if (!pending) return;
    const recipe = RECIPES.find((r) => r.id === pending);
    if (!recipe) {
      localStorage.removeItem("aurora.pendingRecipe");
      return;
    }
    localStorage.removeItem("aurora.pendingRecipe");
    setRecipeFired(true);
    setPrompt(recipe.prompt);
    setSelfie(demoUrl);
    toast.message(`Running "${recipe.title}" with our demo selfie…`);
    genFn({ data: { prompt: recipe.prompt, imageUrls: [demoUrl], motionVideoUrl: null, model } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["gens"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        toast.success("Demo shot ready");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
  }, [user, demoUrl, recipeFired, genFn, model, qc]);

  const checkoutMut = useMutation({
    mutationFn: async (plan: "starter" | "creator" | "studio") => checkoutFn({ data: { plan, currency } }),
    onSuccess: (res) => {
      window.location.href = res.authorizationUrl;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen relative" style={{ background: "var(--gradient-soft)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-stage)" }} />
      <ConnectReplicateBanner />


      {user && (
        <OnboardingModal
          userId={user.id}
          open={onboardOpen}
          onOpenChange={setOnboardOpen}
          onApply={({ selfieUrl, prompt: p }) => {
            setSelfie(selfieUrl);
            setPrompt(p);
          }}
        />
      )}

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 border-b border-border/60 backdrop-blur-xl bg-background/40">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          Aurora Studio
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card/60 text-sm">
            <Coins className="size-3.5 text-primary" />
            <span className="font-medium">{profile?.credits ?? "—"}</span>
            <span className="text-muted-foreground text-xs">Aura</span>
          </div>
          <span className="text-sm text-muted-foreground hidden md:inline">
            Hi, <span className="text-foreground font-medium">{profile?.display_name || user.email?.split("@")[0]}</span> 👋
          </span>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground hidden md:inline-flex items-center gap-1.5">
            <LayoutDashboard className="size-3.5" /> Dashboard
          </Link>
          <Link to="/canvas" className="text-xs sm:text-sm px-2.5 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1.5">
            <Workflow className="size-3.5" /> Canvas
          </Link>
          <Link to="/motion" className="text-xs sm:text-sm px-2.5 py-1.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20 inline-flex items-center gap-1.5">
            <Film className="size-3.5" /> Motion
          </Link>
          <Link to="/colors" className="text-sm text-muted-foreground hover:text-foreground hidden md:inline-flex items-center gap-1.5">Colors</Link>
          <Link to="/gallery" className="text-sm text-muted-foreground hover:text-foreground hidden md:inline-flex items-center gap-1.5">Gallery</Link>
          <Link to="/gifts" className="text-sm text-muted-foreground hover:text-foreground hidden md:inline-flex items-center gap-1.5">Gifts</Link>
          {profile?.isAdmin && (
            <Link to="/admin" className="text-sm hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
              <Shield className="size-3.5 text-amber-500" /> Admin
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-10 grid lg:grid-cols-[1fr_1.1fr] gap-10">
        {/* Control panel */}
        <section className="space-y-5">
          <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-background/40 to-cyan-500/10 px-4 py-3 flex items-center gap-3">
            <span className="inline-flex size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.6)]" />
            <p className="text-xs text-emerald-100/90">
              Studio is ready — you're signed in and pre-authorized. Just upload references and hit generate.
            </p>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {profile?.display_name ? (
                <>Welcome, <span style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{profile.display_name}.</span></>
              ) : (
                <>Direct your <span style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>shoot.</span></>
              )}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">Drop references → write direction → generate. That's it.</p>
          </div>

          {/* Image generation slideshow — moved back up under the heading */}
          <JoshSlideshow />

          {/* Compact 5-slot reference row */}
          <div className="grid grid-cols-5 gap-2">
            <UploadSlot userId={user.id} label="You" hint="Selfie" value={selfie} onChange={setSelfie} />
            <UploadSlot userId={user.id} label="Outfit" hint="Wear" value={outfit} onChange={setOutfit} />
            <UploadSlot userId={user.id} label="Scene" hint="Vibe" value={scene} onChange={setScene} />
            <UploadSlot userId={user.id} label="Prop" hint="Mic / car" value={prop} onChange={setProp} />
            <UploadSlot
              userId={user.id}
              label="Pose"
              hint="Reference photo"
              value={motion}
              onChange={setMotion}
            />

          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Direction</label>
            <Textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the shot you want — e.g. 'cinematic rooftop performance at golden hour, anamorphic 50mm, hanging vintage mic'" className="resize-none bg-card/60 text-base" />
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPrompt(p.prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 hover:bg-accent hover:border-primary/40 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Image model</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="bg-card/60">
                <div className="flex items-center gap-2">
                  <ModelBadge model={model} />
                  <span className="text-sm">{getModelMeta(model).label}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex items-center gap-2 py-0.5">
                      <ModelBadge model={m.value} />
                      <div className="flex flex-col">
                        <span className="text-sm">{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.tagline}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost + runtime estimate */}
          <div className="flex items-center justify-between text-xs text-muted-foreground rounded-xl border border-border bg-card/40 px-3 py-2">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-primary" />
              Cost: <span className="text-foreground font-medium">1 Aura</span>
              <span className="opacity-50">·</span>
              ETA: <span className="text-foreground font-medium">~10–20s</span>
            </span>
            <span className="opacity-70">{getModelMeta(model)?.label ?? model}</span>
          </div>

          <Button
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
            className="w-full h-14 text-base font-medium shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-hero)" }}
          >
            {mut.isPending ? (
              <><Loader2 className="size-5 mr-2 animate-spin" /> Staging the shoot…</>
            ) : (
              <><Wand2 className="size-5 mr-2" /> Generate performance shot · 1 Aura</>
            )}
          </Button>

          <Link
            to="/split-reality"
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-md border border-primary/40 bg-primary/5 hover:bg-primary/10 text-sm font-medium text-foreground no-underline"
          >
            <Sparkles className="size-4 text-primary" /> Split Reality — dedicated studio →
          </Link>

          <Button
            disabled={demoMut.isPending || !demoUrl}
            onClick={() => demoMut.mutate()}
            variant="outline"
            className="w-full"
          >
            {demoMut.isPending ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Running demo…</>
            ) : (
              <><Zap className="size-4 mr-2" /> Try a demo shoot (no upload needed)</>
            )}
          </Button>

          <div className="pt-6 space-y-5 border-t border-border/50">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Inspiration</p>
            <TriedTestedShowcase
              title="See the recipe → see the result"
              subtitle="Real references. Real render. This is what your shoot can look like."
              refsImage={tutorialStudioRefs.url}
              refsCaption="Selfie · Outfit (all black) · Scene (train tracks) · Prop (vintage mic)"
              finalImage={tutorialStudioFinal.url}
              finalCaption="Hyper-real composite · identity preserved · golden-hour grade"
              prompt="Create a hyper-realistic composite using the provided reference images. Use the close-up selfie as the primary identity source, preserving exact facial features, skin tone, dreadlocks. Place the subject in the scene (desert train tracks at golden hour) wearing the outfit (black fuzzy crewneck sweater, black sweatpants). Pose: powerful, hands on hips, slight low angle, leaning into a vintage hanging silver microphone. Cinematic anamorphic 35mm, warm sunset grade, sharp focus on subject, shallow depth of field, 4K editorial."
            />
          </div>

        </section>

        {/* Preview / Gallery */}
        <section className="space-y-4">
          <div className="rounded-3xl overflow-hidden border border-border bg-card/60 backdrop-blur-xl aspect-[4/5] relative shadow-[var(--shadow-soft)]">
            {mut.isPending ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="size-16 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                  <Loader2 className="size-7 animate-spin text-primary-foreground" />
                </div>
                <p className="text-sm">Lighting the stage…</p>
              </div>
            ) : latest?.result_image_url ? (
              <>
                <img src={latest.result_image_url} alt="Latest shot" className="w-full h-full object-cover" />
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => latest?.id && shareMut.mutate(latest.id)}
                    disabled={shareMut.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/90 backdrop-blur text-sm font-medium hover:bg-background disabled:opacity-50"
                  >
                    {shareMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Share
                  </button>
                  <button
                    type="button"
                    onClick={() => latest?.result_image_url && saveAssetToDisk(latest.result_image_url, `aurora-${latest.id.slice(0,8)}.png`)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/90 backdrop-blur text-sm font-medium hover:bg-background"
                  >
                    <Download className="size-4" /> Save
                  </button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                <Sparkles className="size-10 text-primary/50" />
                <p className="text-sm">Your performance shot will appear here.</p>
              </div>
            )}
          </div>

          {/* Per-step pipeline status + retry */}
          {(mut.isPending || mut.isError || videoMut.isPending || videoMut.isError || lipSyncMut.isPending || lipSyncMut.isError || latest || latestVideo) && (
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Pipeline</div>
              {[
                {
                  label: "Image",
                  state: mut.isPending ? "running" : mut.isError ? "error" : latest?.result_image_url ? "ok" : "idle",
                  error: mut.error instanceof Error ? mut.error.message : null,
                  canRetry: mut.isError,
                  onRetry: () => mut.mutate(),
                },
                {
                  label: "Video",
                  state: videoMut.isPending ? "running" : videoMut.isError ? "error" : latestVideo?.result_video_url ? "ok" : "idle",
                  error: videoMut.error instanceof Error ? videoMut.error.message : null,
                  canRetry: videoMut.isError && !!latest?.result_image_url,
                  onRetry: () => videoMut.mutate(),
                },
                {
                  label: "Lip sync",
                  state: lipSyncMut.isPending ? "running" : lipSyncMut.isError ? "error" : "idle",
                  error: lipSyncMut.error instanceof Error ? lipSyncMut.error.message : null,
                  canRetry: lipSyncMut.isError && !!audioUrl,
                  onRetry: () => lipSyncMut.mutate(),
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                    s.state === "ok" ? "border-emerald-500/40 bg-emerald-500/10" :
                    s.state === "running" ? "border-primary/40 bg-primary/10" :
                    s.state === "error" ? "border-destructive/50 bg-destructive/10" :
                    "border-border bg-background/40"
                  }`}
                >
                  <span className={`mt-1 size-2 rounded-full ${
                    s.state === "ok" ? "bg-emerald-400" :
                    s.state === "running" ? "bg-primary animate-pulse" :
                    s.state === "error" ? "bg-destructive" : "bg-muted-foreground/40"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      {s.label}
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {s.state === "running" ? "Running…" : s.state}
                      </span>
                    </div>
                    {s.error && <div className="text-destructive/90 text-[11px] truncate" title={s.error}>{s.error}</div>}
                  </div>
                  {s.canRetry && (
                    <button
                      type="button"
                      onClick={s.onRetry}
                      className="shrink-0 text-[11px] px-2 py-1 rounded-md border border-border bg-background/80 hover:border-primary/40"
                    >
                      Retry this step
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {history && history.items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Recent shoots</h3>
              <div className="grid grid-cols-3 gap-3">
                {history.items.slice(0, 9).map((g) => (
                  <div key={g.id} className="aspect-square rounded-xl overflow-hidden border border-border bg-card/60 relative group">
                    {g.result_image_url ? (
                      <>
                        <img src={g.result_image_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-1.5 left-1.5"><ModelBadge model={g.model} size="xs" /></div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
                        {g.status === "failed" ? "Failed" : g.status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <Link to="/dashboard" className="text-xs text-primary hover:underline">View all in dashboard →</Link>
              </div>
            </div>
          )}

          {latest?.result_image_url && (
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="size-4 text-primary" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Re-angle the last shot</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Generate a new camera angle from your latest result — same scene, same outfit, new shot.</p>
              <div className="flex flex-wrap gap-2">
                {REANGLES.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    disabled={reangleMut.isPending}
                    onClick={() => reangleMut.mutate(a.prompt)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-background/60 hover:bg-accent hover:border-primary/40 transition-colors disabled:opacity-50"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {reangleMut.isPending && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" /> Re-shooting…
                </p>
              )}
            </div>
          )}

          {latest?.result_image_url && (
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Film className="size-4 text-primary" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Bring it to life</h3>
              </div>
              <p className="text-xs text-muted-foreground">Animate your latest shot. Pick a video model and a camera move — Kling supports an optional end-frame for true motion control.</p>

              <BringItToLifePreview active={cameraMovement} onPick={setCameraMovement} />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Video model</label>
                  <Select value={videoModel} onValueChange={setVideoModel}>
                    <SelectTrigger className="bg-background/60 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VIDEO_MODEL_LIST.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-sm">
                          <div className="flex flex-col">
                            <span>{m.label}</span>
                            <span className="text-[10px] text-muted-foreground">{m.tagline}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Camera move</label>
                  <Select value={cameraMovement} onValueChange={setCameraMovement}>
                    <SelectTrigger className="bg-background/60 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Static (locked off)</SelectItem>
                      <SelectItem value="push_in">Push in</SelectItem>
                      <SelectItem value="pull_out">Pull out</SelectItem>
                      <SelectItem value="zoom_in">Slow zoom in</SelectItem>
                      <SelectItem value="zoom_out">Slow zoom out</SelectItem>
                      <SelectItem value="pan_left">Pan left</SelectItem>
                      <SelectItem value="pan_right">Pan right</SelectItem>
                      <SelectItem value="tilt_up">Tilt up</SelectItem>
                      <SelectItem value="tilt_down">Tilt down</SelectItem>
                      <SelectItem value="orbit_cw">Orbit clockwise</SelectItem>
                      <SelectItem value="orbit_ccw">Orbit counter-clockwise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea rows={2} value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} className="resize-none bg-background/60 text-sm" />

              {videoModel.startsWith("kling") && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">End frame (optional, Kling motion control)</label>
                  <div className="w-32">
                    <UploadSlot
                      userId={user.id}
                      label=""
                      hint="Where it ends"
                      value={endFrameUrl}
                      onChange={setEndFrameUrl}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground rounded-xl border border-border bg-background/40 px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="size-3.5 text-primary" />
                  Cost: <span className="text-foreground font-medium">5 Aura</span>
                  <span className="opacity-50">·</span>
                  ETA: <span className="text-foreground font-medium">~60–180s</span>
                </span>
                <span className="opacity-70">{getModelMeta(videoModel).short}</span>
              </div>
              <Button disabled={videoMut.isPending} onClick={() => videoMut.mutate()} variant="secondary" className="w-full">
                {videoMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Rendering video…</> : <><Film className="size-4 mr-2" /> Generate video · 5 Aura</>}
              </Button>

              {latestVideo?.result_video_url && (
                <div className="rounded-xl overflow-hidden border border-border bg-background/40">
                  <video src={latestVideo.result_video_url} className="w-full h-auto" controls playsInline />
                </div>
              )}
            </div>
          )}

          {latestVideo?.result_video_url && (
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mic2 className="size-4 text-primary" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Lip sync to your audio</h3>
              </div>
              <p className="text-xs text-muted-foreground">Upload your song/vocal and we'll sync the lips on your latest video. Sync 1.9 (premium, more natural), Wav2Lip (classic, faster & cheaper), or LatentSync on your own registered GPU worker.</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "fal-ai/sync-lipsync/v2" as const, label: "Sync 1.9", hint: "Premium · natural", icon: Sparkles },
                  { v: "fal-ai/wav2lip" as const, label: "Wav2Lip", hint: "Classic · fast", icon: Zap },
                  { v: "latentsync" as const, label: "Self-hosted", hint: "LatentSync · your GPU", icon: Server },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setLipsyncModel(opt.v)}
                    className={`text-left rounded-xl border p-2.5 transition-colors ${lipsyncModel === opt.v ? "border-primary/60 bg-primary/10" : "border-border bg-background/60 hover:border-primary/30"}`}
                  >
                    <div className="text-sm font-medium flex items-center gap-1.5"><opt.icon className="size-3.5" />{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                  </button>
                ))}
              </div>
              <UploadSlot
                userId={user.id}
                label="Audio"
                hint="Upload mp3 / wav"
                accept="audio/*"
                kind="video"
                value={audioUrl}
                onChange={setAudioUrl}
              />
              <Button disabled={lipSyncMut.isPending || !audioUrl} onClick={() => lipSyncMut.mutate()} variant="secondary" className="w-full">
                {lipSyncMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Syncing lips…</> : <><Mic2 className="size-4 mr-2" /> Lip sync video · 3 Aura</>}
              </Button>
            </div>
          )}

          <HfAudioPanel onAudioReady={(url) => setAudioUrl(url)} />



          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-primary" />
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Buy Aura</h3>
            </div>
            <p className="text-xs text-muted-foreground">1 Aura per image · 5 per video · 3 per lip-sync. Secure checkout via Paystack.</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PLANS) as Array<"starter" | "creator" | "studio">).map((k) => {
                const p = PLANS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={checkoutMut.isPending}
                    onClick={() => checkoutMut.mutate(k)}
                    className="flex flex-col items-start gap-1 rounded-xl border border-border bg-background/60 hover:border-primary/40 hover:bg-accent transition-colors p-3 text-left disabled:opacity-50"
                  >
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
                    <span className="text-lg font-semibold">{p.credits} <span className="text-xs font-normal text-muted-foreground">Aura</span></span>
                    <span className="text-xs text-muted-foreground">{p.prices[currency].display}</span>
                  </button>
                );
              })}
            </div>
            {checkoutMut.isPending && (
              <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> Opening Paystack…</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}