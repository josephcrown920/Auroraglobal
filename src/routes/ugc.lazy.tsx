import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useRef, useState } from "react";
import { ExampleOutputGrid } from "@/components/studio/ExampleOutputGrid";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePerformanceShotJobFn, useVideoFromImageJobFn } from "@/lib/use-job-polling";
import { generateUGCAd, getGenerationStatus, generateProductDemo } from "@/lib/ugc-generation.functions";
import { handleGenerationError } from "@/lib/error-toasts";
import { supabase } from "@/integrations/supabase/client";
import { COST_UGC_AD } from "@/lib/template-studio";
import { computeCost, COST_PRODUCT_DEMO } from "@/lib/pricing";
import { AUDIO_ACCEPT } from "@/lib/utils";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Smartphone, Camera, ShoppingBag, Coffee, Dumbbell, Sparkles, Check, Loader2, Wand2, Film, AudioLines, Music2, X, Plus, ImagePlus, Presentation, ArrowRight, PackageOpen } from "lucide-react";
import productLipstick from "@/assets/ugc/product-lipstick-car.jpg.asset.json";
import realCarHold from "@/assets/ugc/ugc-car-product-hold.webp.asset.json";
import realStreet from "@/assets/ugc/ugc-street-coffee.jpeg.asset.json";
import realHome from "@/assets/ugc/ugc-home-selfie.webp.asset.json";
import demo1 from "@/assets/demo-1.mov.asset.json";
import demo2 from "@/assets/demo-2.mov.asset.json";
import demo3 from "@/assets/demo-3.mov.asset.json";
import demo4 from "@/assets/demo-4.mov.asset.json";
import demo5 from "@/assets/demo-5.mov.asset.json";
import demo6 from "@/assets/demo-6.mov.asset.json";
import auraBloom from "../assets/ugc/aura-bloom.jpeg";
import auraCafe from "../assets/ugc/aura-cafe.jpeg";
import { EditableCopy } from "@/components/EditableCopy";
import { useSiteCopyValue } from "@/components/landing/SiteCopyProvider";
import { PageHeroBanner } from "@/components/visual/PageHeroBanner";
import { OutputGallery } from "@/components/visual/OutputGallery";
import { DEMO_ASSETS } from "@/lib/demo-assets";
import { UGC_AVATARS } from "@/lib/ugc-avatars";

// Artist-only mode: this feature is hidden from regular users by default.
// Admins always pass; regular users are redirected to /studio unless the
// owner has toggled the feature visible (see feature-visibility registry).
export const Route = createLazyFileRoute("/ugc")({
  component: () => (
    <FeatureGuard feature="ugc">
      <UGCStudio />
    </FeatureGuard>
  ),
});

const AVATARS = UGC_AVATARS;

const PRESETS = [
  { id: "iphone-selfie", name: "iPhone selfie review", icon: Smartphone, hint: "Front camera, slightly tilted, soft window light, casual room.", video: demo1.url, poster: undefined as string | undefined },
  { id: "car-product",   name: "Car-seat product hold", icon: Smartphone, hint: "Sun-flare car selfie, golden hour through windshield, avatar holding the product label-out near the cheek — like the reference shot.", video: demo1.url, poster: realCarHold.url },
  { id: "unboxing", name: "Unboxing hands", icon: ShoppingBag, hint: "Top-down product reveal on desk, natural fingers, kraft paper.", video: demo2.url, poster: undefined as string | undefined },
  { id: "lifestyle-cafe", name: "Cafe lifestyle", icon: Coffee, hint: "Holding product at a cafe table, blurred background, golden hour.", video: undefined as unknown as string, poster: realStreet.url },
  { id: "gym-mirror", name: "Gym mirror", icon: Dumbbell, hint: "Mirror selfie at the gym, post-workout glow, fluorescent overhead.", video: undefined as unknown as string, poster: undefined as string | undefined },
  { id: "get-ready", name: "Get-ready-with-me", icon: Camera, hint: "Bathroom mirror, ring light, candid morning routine.", video: undefined as unknown as string, poster: realHome.url },
  { id: "tiktok-pov", name: "TikTok POV", icon: Sparkles, hint: "POV holding phone, talking-to-camera framing, 9:16 vertical.", video: undefined as unknown as string, poster: undefined as string | undefined },
  { id: "street-walk", name: "Street walk product reveal", icon: Film, hint: "Walking on a city sidewalk, golden hour, avatar reveals product from a bag mid-stride — candid handheld, vertical 9:16.", video: demo3.url, poster: undefined as string | undefined },
  { id: "gym-hold", name: "Gym product hold", icon: Dumbbell, hint: "Post-workout, standing near a squat rack or cable machine, holding the product label-out toward camera — sweat, pump, authentic energy.", video: demo4.url, poster: undefined as string | undefined },
  { id: "desk-review", name: "Desk setup review", icon: Camera, hint: "Sitting at a clean minimal desk, ring light from front, product placed on desk surface and lifted to camera — YouTube/TikTok reviewer energy.", video: demo5.url, poster: undefined as string | undefined },
  { id: "outdoor-athlete", name: "Outdoor athlete shot", icon: Dumbbell, hint: "Outside on a track or court, athlete holding product post-workout with golden-hour rim light — high-energy sports brand vibe.", video: demo6.url, poster: undefined as string | undefined },
  { id: "meme-unbothered", name: "Unbothered product drop", icon: Sparkles, hint: "Sitting or lying back, relaxed and unbothered, casually tossing the product up in the air or inspecting it — deadpan, viral meme energy.", video: undefined as unknown as string, poster: undefined as string | undefined },
];

const AURA_PRODUCT_REFERENCES = [
  {
    id: "bloom",
    name: "Aura Bloom",
    note: "Pink botanical beauty product",
    image: auraBloom,
    prompt: "holding the Aura Bloom pink botanical beauty product label-out near her cheek, smiling naturally at the camera",
  },
  {
    id: "cafe",
    name: "Aura Café",
    note: "Sunlit café packaging",
    image: auraCafe,
    prompt: "revealing the Aura Café yellow package at a sunlit café table, label clearly visible, candid creator energy",
  },
] as const;

function UGCStudio() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [avatarId, setAvatarId] = useState<string>(AVATARS[0].id);
  const avatar = AVATARS.find(a => a.id === avatarId)!;
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [productPrompt, setProductPrompt] = useState<string>("");
  const [productReferenceId, setProductReferenceId] = useState<(typeof AURA_PRODUCT_REFERENCES)[number]["id"] | null>("bloom");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);

  // Product Demo mode (Task #276): a separate feature-list-driven flow that
  // produces a narrated HeyGen avatar walkthrough of a product's features.
  const [showProductDemo, setShowProductDemo] = useState(false);
  const [demoProductName, setDemoProductName] = useState("");
  const [demoAudience, setDemoAudience] = useState("");
  const [demoDuration, setDemoDuration] = useState<"quick" | "walkthrough" | "deep_dive" | "whats_new">("walkthrough");
  const [demoFeatures, setDemoFeatures] = useState<{ name: string; description: string; screenshotUrl: string; uploading: boolean }[]>([
    { name: "", description: "", screenshotUrl: "", uploading: false },
  ]);
  const [demoResultVideo, setDemoResultVideo] = useState<string | null>(null);

  const genShot = usePerformanceShotJobFn();
  const genVid = useVideoFromImageJobFn();
  const genAd = useServerFn(generateUGCAd);
  const genStatus = useServerFn(getGenerationStatus);
  const genDemo = useServerFn(generateProductDemo);

  // The bundled avatar images live at same-origin /__l5e/ asset paths, which the
  // reference-image ownership guard (correctly) refuses — a character reference
  // must be something the caller OWNS, and Aurora's own origin is not a trusted
  // provider host. So each selected avatar is staged into the caller's own studio
  // folder once per session and the studio URL is what every generation call
  // references — the same pattern as the Studio demo selfie (orchestrate re-signs
  // studio refs before handing them to any provider).
  const avatarRefCache = useRef<Record<string, string>>({});
  const resolveAvatarRef = async (): Promise<string> => {
    if (!user) throw new Error("Please sign in first.");
    const cached = avatarRefCache.current[avatar.id];
    if (cached) return cached;
    const ext = (avatar.img.split("?")[0].split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/ugc/avatar-${avatar.id}.${ext}`;
    const publicUrl = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
    // Probe first: a previous session may already have staged this avatar.
    const alreadyStaged = await new Promise<boolean>((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = publicUrl;
    });
    if (!alreadyStaged) {
      const blob = await (await fetch(avatar.img)).blob();
      const { error } = await supabase.storage.from("studio").upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true,
      });
      if (error) throw new Error(`Avatar staging failed: ${error.message}`);
    }
    avatarRefCache.current[avatar.id] = publicUrl;
    return publicUrl;
  };

  const imageMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first.");
      if (!productPrompt.trim()) throw new Error("Describe your product (e.g. holding a glossy red lipstick).");
      const prompt = `Hyper-realistic UGC iPhone-style shot. ${preset.hint} Featuring AI creator "${avatar.name}" (${avatar.vibe}). Product/action: ${productPrompt.trim()}. Native social media aesthetic, photoreal skin, no logos, 9:16 framing.`;
      const avatarRef = await resolveAvatarRef();
      return await genShot({ data: { prompt, imageUrls: [avatarRef], model: "google/gemini-2.5-flash-image" } });
    },
    onSuccess: (r) => { setResultImage(r.resultUrl); setResultVideo(null); toast.success("UGC shot ready — make it move next."); },
    onError: (e) => handleGenerationError(e),
  });

  const videoMut = useMutation({
    mutationFn: async () => {
      if (!resultImage) throw new Error("Generate the shot first.");
      const prompt = `${preset.name}: ${productPrompt.trim()}. Natural micro-movements, subtle handheld, lifelike expression. Avatar: ${avatar.name}.`;
      return await genVid({ data: { imageUrl: resultImage, prompt, duration: 5, resolution: "720p", modelKey: "seedance-2.0-fast" } });
    },
    onSuccess: (r) => { if (r?.videoUrl) setResultVideo(r.videoUrl); toast.success("UGC video rendered."); },
    onError: (e) => handleGenerationError(e),
  });

  // Full talking UGC ad: enqueue the async pipeline, then poll the generation row
  // until the clip is ready (script → voice → still → video → lip-sync server-side).
  const adMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first.");
      if (!productPrompt.trim()) throw new Error("Describe your product (e.g. holding a glossy red lipstick).");
      // Voice lock: when the user supplies their own voice track it drives the
      // final lip-sync — the pipeline never ships a generated voice over it.
      let audioUrl: string | undefined;
      if (voiceFile) {
        const ext = voiceFile.name.split(".").pop() || "mp3";
        const path = `${user.id}/ugc/${Date.now()}-voice.${ext}`;
        const { error } = await supabase.storage.from("studio").upload(path, voiceFile, {
          contentType: voiceFile.type,
          upsert: true,
        });
        if (error) throw new Error(`Voice upload failed: ${error.message}`);
        const { data: signed, error: signErr } = await supabase.storage
          .from("studio")
          .createSignedUrl(path, 60 * 60);
        if (signErr || !signed?.signedUrl) throw new Error(`Voice URL failed: ${signErr?.message ?? "no url"}`);
        audioUrl = signed.signedUrl;
      }
      const avatarRef = await resolveAvatarRef();
      const { generationId } = await genAd({
        data: {
          avatarImageUrl: avatarRef,
          avatarName: avatar.name,
          vibe: avatar.vibe,
          presetHint: preset.hint,
          presetName: preset.name,
          productPrompt: productPrompt.trim(),
          aspect: "9:16",
          duration: 8,
          ...(audioUrl ? { audioUrl } : {}),
        },
      });
      setResultImage(null);
      setResultVideo(null);
      for (let i = 0; i < 75; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await genStatus({ data: { generationId } });
        if (s.status === "succeeded") {
          if (s.imageUrl) setResultImage(s.imageUrl);
          if (s.videoUrl) return { videoUrl: s.videoUrl };
          throw new Error("Ad finished but produced no video.");
        }
        if (s.status === "failed") throw new Error(s.error || "Ad generation failed.");
      }
      throw new Error("Still rendering — check your dashboard in a moment.");
    },
    onSuccess: (r) => { setResultVideo(r.videoUrl); toast.success("Talking UGC ad ready."); },
    onError: (e) => handleGenerationError(e),
  });

  const demoMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first.");
      if (!demoProductName.trim()) throw new Error("Name your product.");
      const features = demoFeatures
        .filter((f) => f.name.trim())
        .map((f) => ({
          name: f.name.trim(),
          description: f.description.trim() || undefined,
          screenshotUrl: f.screenshotUrl || undefined,
        }));
      if (!features.length) throw new Error("Add at least one feature.");

      const { generationId } = await genDemo({
        data: {
          productName: demoProductName.trim(),
          features,
          durationPresetId: demoDuration,
          audience: demoAudience.trim() || undefined,
        },
      });
      setDemoResultVideo(null);
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await genStatus({ data: { generationId } });
        if (s.status === "succeeded") {
          if (s.videoUrl) return { videoUrl: s.videoUrl };
          throw new Error("Demo finished but produced no video.");
        }
        if (s.status === "failed") throw new Error(s.error || "Product demo generation failed.");
      }
      throw new Error("Still rendering — check your dashboard in a moment.");
    },
    onSuccess: (r) => { setDemoResultVideo(r.videoUrl); toast.success("Product demo ready."); },
    onError: (e) => handleGenerationError(e),
  });

  const uploadDemoScreenshot = async (idx: number, file: File) => {
    if (!user) { toast.error("Please sign in first."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Screenshot must be under 10MB"); return; }
    setDemoFeatures((prev) => prev.map((f, i) => (i === idx ? { ...f, uploading: true } : f)));
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/product-demo/${Date.now()}-${idx}.${ext}`;
      const { error } = await supabase.storage.from("studio").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      const { data: signed, error: signErr } = await supabase.storage
        .from("studio")
        .createSignedUrl(path, 60 * 60 * 24);
      if (signErr || !signed?.signedUrl) throw new Error(`Screenshot URL failed: ${signErr?.message ?? "no url"}`);
      setDemoFeatures((prev) =>
        prev.map((f, i) => (i === idx ? { ...f, screenshotUrl: signed.signedUrl, uploading: false } : f)),
      );
    } catch (e) {
      setDemoFeatures((prev) => prev.map((f, i) => (i === idx ? { ...f, uploading: false } : f)));
      toast.error(e instanceof Error ? e.message : "Screenshot upload failed");
    }
  };

  const busy = imageMut.isPending || videoMut.isPending || adMut.isPending;
  const selectedProductReference = AURA_PRODUCT_REFERENCES.find((item) => item.id === productReferenceId) ?? null;
  const selectProductReference = (id: (typeof AURA_PRODUCT_REFERENCES)[number]["id"]) => {
    const item = AURA_PRODUCT_REFERENCES.find((candidate) => candidate.id === id);
    if (!item) return;
    setProductReferenceId(item.id);
    setProductPrompt(item.prompt);
  };
  const ugcGenerateShotCta = useSiteCopyValue("ugc_generate_shot_cta") ?? "Generate UGC shot";
  const ugcAnimateCta = useSiteCopyValue("ugc_animate_cta") ?? "Animate";
  const ugcTalkingAdCta = useSiteCopyValue("ugc_talking_ad_cta") ?? "Generate talking ad";

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 border-b border-border bg-card/40 pl-24 pr-6 py-4 flex items-center justify-between backdrop-blur-xl">
        <Link to="/" className="font-semibold no-underline text-foreground">Aurora</Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/studio" className="text-foreground/70 no-underline">Studio</Link>
          <Link to="/colors" className="text-foreground/70 no-underline">Colors</Link>
          <Link to="/canvas" className="text-foreground/70 no-underline">Canvas</Link>
        </nav>
      </header>

      <PageHeroBanner
        kicker="UGC Factory"
        headline="Turn a product brief into creator-ready proof."
        sub="Pair a product, creator, and scene; Aurora turns the direction into an ad your audience can picture."
        media={DEMO_ASSETS.ugc.hero}
        className="relative z-10 mx-6 mt-7 rounded-3xl border border-white/10"
      />
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
         <EditableCopy
           copyKey="ugc_hero_kicker"
           fallback="UGC Factory"
           className="aurora-kicker mb-2"
         />
         <EditableCopy
           as="h1"
           copyKey="ugc_hero_headline"
           fallback="Pick an avatar. Ship UGC."
           className="text-4xl md:text-5xl font-bold tracking-tight"
         />
         <EditableCopy
           as="p"
           copyKey="ugc_hero_description"
           fallback="Six on-brand AI creators, ready to film. Choose a face, pick a scene, and Aurora generates a native TikTok-style ad with your product in hand."
           className="text-muted-foreground mt-3 max-w-2xl"
         />

        {/* Avatar gallery */}
        <div className="mt-10">
           <EditableCopy
             as="h2"
             copyKey="ugc_avatar_heading"
             fallback="1. Choose your avatar"
             className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4"
           />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {AVATARS.map(a => {
              const active = a.id === avatarId;
              return (
                <button
                  key={a.id}
                  onClick={() => setAvatarId(a.id)}
                  className={`aurora-card-hover relative rounded-xl overflow-hidden border-2 transition group ${active ? "border-primary shadow-[0_0_24px_oklch(0.78_0.18_295/0.4)]" : "border-border hover:border-primary/50"}`}
                >
                  <img src={a.img} alt={a.name} width={512} height={512} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 text-left">
                    <p className="text-white text-sm font-semibold leading-none">{a.name}</p>
                    <p className="text-white/70 text-[10px] mt-0.5 leading-tight">{a.vibe}</p>
                  </div>
                  {active && (
                    <span className="absolute top-2 right-2 size-6 rounded-md bg-primary text-primary-foreground grid place-items-center">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

          <section className="mt-8 rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/[0.12] via-card/70 to-fuchsia-950/20 p-4 sm:p-6 shadow-[0_0_48px_-32px_oklch(0.72_0.2_295)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="aurora-kicker mb-1">Reference-led product shoots</p>
                <h2 className="text-xl font-bold tracking-tight">Character + product + prompt</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Build the brief before you render. Choose a creator, give Aurora a product reference, then describe the moment you want to capture.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                3-part brief <ArrowRight className="size-3" /> UGC shot
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1.35fr] md:items-stretch">
              <ReferenceTile label="Character / avatar" image={avatar.img} title={avatar.name} detail={avatar.vibe} />
              <FlowArrow />
              <div className="rounded-xl border border-primary/30 bg-background/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Product reference</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {AURA_PRODUCT_REFERENCES.map((item) => {
                    const active = item.id === productReferenceId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectProductReference(item.id)}
                        aria-pressed={active}
                        className={`relative aspect-square overflow-hidden rounded-lg border transition ${active ? "border-primary ring-1 ring-primary/70" : "border-border/60 hover:border-primary/60"}`}
                      >
                        <img src={item.image} alt={`Use ${item.name} as product reference`} className="size-full object-cover" />
                        {active && <span className="absolute inset-x-1 bottom-1 rounded bg-primary px-1 py-0.5 text-[8px] font-bold text-primary-foreground">{item.name}</span>}
                      </button>
                    );
                  })}
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 bg-card/40 text-center text-[9px] text-muted-foreground transition hover:border-primary/60 hover:text-primary">
                    <Plus className="size-4" />
                    Add
                    <input className="hidden" type="file" accept="image/*" onChange={() => toast.info("Custom product references are coming next. Use the prompt field to describe your product today.")} />
                  </label>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">{selectedProductReference?.note ?? "Select an Aura product reference."}</p>
              </div>
              <FlowArrow />
              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Prompt / moment</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                  {productPrompt || "Pick a product reference to fill a ready-to-edit UGC prompt."}
                </p>
                <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                  <PackageOpen className="size-4 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Your output appears beside the generator below.</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Product references guide your brief in this release. The current still renderer conditions on the selected avatar, so keep product details and label requirements in your prompt for the most reliable result.
            </p>
          </section>

        {/* ── Sample campaigns inspiration ────────────────────────── */}
        <OutputGallery
          items={DEMO_ASSETS.ugc.gallery}
          kicker="Campaign proof"
          title="See the creator, product, and outcome together."
          subtitle="Every reference is a real Aurora direction—not stock imagery."
          showGalleryLink
        />

        {/* Preset gallery */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">2. Pick a scene</h2>
          <div className="grid grid-cols-3 gap-3">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                aria-pressed={p.id === presetId}
                className={`group relative aspect-[4/3] rounded-2xl overflow-hidden text-left transition-all ${p.id === presetId ? "ring-2 ring-primary shadow-[0_0_28px_oklch(0.78_0.18_295/0.45)]" : "ring-1 ring-white/10 hover:ring-primary/50"}`}
              >
                {/* Background media */}
                {p.poster ? (
                  <img src={p.poster} alt={p.name} loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : p.video ? (
                  <AutoplayVideo
                    src={p.video}
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-background/80 to-background flex items-center justify-center">
                    <p.icon className="h-12 w-12 text-primary/60" />
                  </div>
                )}

                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Selected badge */}
                {p.id === presetId && (
                  <div className="absolute top-2.5 right-2.5 size-6 rounded-md bg-primary flex items-center justify-center z-10">
                    <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                )}

                {/* Text overlay */}
                <div className="absolute bottom-0 inset-x-0 p-4 z-10">
                  <h3 className="font-bold text-white text-sm leading-snug mb-0.5">{p.name}</h3>
                  <p className="text-[11px] text-white/60">
                    {p.id === presetId ? `✓ Selected · ${avatar.name} →` : `${p.hint.split(",")[0]} →`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Inline generator */}
        <div className="mt-12 rounded-2xl border border-primary/40 bg-card p-6 grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <EditableCopy
              as="h2"
              copyKey="ugc_prompt_heading"
              fallback="3. Describe the product / action"
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
            />
            <Textarea
              value={productPrompt}
              onChange={(e) => setProductPrompt(e.target.value)}
              placeholder={`e.g. holding a glossy red lipstick label-out near her cheek, smiling at the camera`}
              className="min-h-[100px]"
            />
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">Quick fills:</span>
              {[
                "holding a sleek matte black skincare bottle, label-out, soft smile",
                "showing off a pastel iPhone case, twisting it in the light",
                "sipping from a branded protein shake, post-workout glow",
                "unboxing fresh white sneakers, hands in frame",
              ].map((s) => (
                <button key={s} type="button" onClick={() => setProductPrompt(s)} className="px-2 py-1 rounded-lg border border-border hover:border-primary text-muted-foreground hover:text-foreground">{s}</button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {!user ? (
                <Button onClick={() => nav({ to: "/auth", search: authNextSearch() })} variant="premium" className="w-full sm:w-auto">Sign in to generate</Button>
              ) : (
                <>
                  <Button onClick={() => imageMut.mutate()} disabled={busy} variant="premium" className="w-full sm:w-auto">
                     {imageMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Shooting…</> : <><Wand2 className="size-4 mr-2" /> {ugcGenerateShotCta} · 10 Aura</>}
                  </Button>
                  <Button onClick={() => videoMut.mutate()} disabled={busy || !resultImage} variant="outline" className="w-full sm:w-auto">
                     {videoMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Animating…</> : <><Film className="size-4 mr-2" /> {ugcAnimateCta} · {computeCost({ features: ["video"], model: "seedance-2.0-fast", resolution: "720p", durationSeconds: 5 }).total} Aura</>}
                  </Button>
                  <Button onClick={() => adMut.mutate()} disabled={busy} variant="secondary" className="w-full sm:w-auto">
                     {adMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Producing ad…</> : <><AudioLines className="size-4 mr-2" /> {ugcTalkingAdCta} · {COST_UGC_AD} Aura</>}
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <EditableCopy copyKey="ugc_generate_shot_cta" fallback="Generate UGC shot" editorOnly />
              <EditableCopy copyKey="ugc_animate_cta" fallback="Animate" editorOnly />
              <EditableCopy copyKey="ugc_talking_ad_cta" fallback="Generate talking ad" editorOnly />
            </div>
            {user && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-primary text-xs text-muted-foreground hover:text-foreground cursor-pointer transition">
                  <Music2 className="size-3.5 text-primary" />
                  {voiceFile ? voiceFile.name : "Add your voice track (optional)"}
                  <input
                    type="file"
                    accept={AUDIO_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f && f.size > 50 * 1024 * 1024) { toast.error("Audio must be under 50MB"); return; }
                      setVoiceFile(f);
                    }}
                  />
                </label>
                {voiceFile && (
                  <button type="button" onClick={() => setVoiceFile(null)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                    <X className="size-3" /> Remove
                  </button>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {voiceFile ? "Your audio drives the final lip-sync — same voice, every render." : "No track? Aurora falls back to auto voice when configured."}
                </span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Avatar <strong className="text-foreground">{avatar.name}</strong> · scene <strong className="text-foreground">{preset.name}</strong>. Generate a still then Animate it, or run <strong className="text-foreground">Generate talking ad</strong> for the full script → voice → video → lip-sync pipeline in one click. Upload your own voice track above to lock the character's voice across renders.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 aspect-[9/16] overflow-hidden grid place-items-center relative">
            {resultVideo ? (
              <AutoplayVideo src={resultVideo} controls muted={false} loop className="w-full h-full object-cover" />
            ) : resultImage ? (
              <img src={resultImage} alt="UGC result" className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-muted-foreground p-4 text-center">
                {busy ? <><Loader2 className="size-5 mx-auto mb-2 animate-spin" /> Working… ~15s</> : <>Your UGC shot will appear here.</>}
              </div>
            )}
          </div>
        </div>

        {/* Product Demo mode (Task #276) */}
        <div className="mt-12 rounded-2xl border border-border bg-card p-6">
          <button
            type="button"
            onClick={() => setShowProductDemo((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <Presentation className="size-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Or: narrated product demo</h2>
                <p className="text-xs text-muted-foreground mt-1">Turn a feature list + screenshots into an avatar walkthrough video · {COST_PRODUCT_DEMO} Aura</p>
              </div>
            </div>
            <span className="text-xs text-primary">{showProductDemo ? "Hide" : "Show"}</span>
          </button>

          {showProductDemo && (
            <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6">
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    value={demoProductName}
                    onChange={(e) => setDemoProductName(e.target.value)}
                    placeholder="Product name (e.g. Aurora Studio)"
                  />
                  <Input
                    value={demoAudience}
                    onChange={(e) => setDemoAudience(e.target.value)}
                    placeholder="Audience (optional, e.g. indie creators)"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {([
                    { id: "quick", label: "Quick (~20s)" },
                    { id: "walkthrough", label: "Walkthrough (~45s)" },
                    { id: "deep_dive", label: "Deep dive (~90s)" },
                    { id: "whats_new", label: "What's new (~30s)" },
                  ] as const).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDemoDuration(d.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs transition ${demoDuration === d.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {demoFeatures.map((f, idx) => (
                    <div key={idx} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={f.name}
                          onChange={(e) =>
                            setDemoFeatures((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                          }
                          placeholder={`Feature ${idx + 1} name`}
                          className="flex-1"
                        />
                        {demoFeatures.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDemoFeatures((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Remove feature"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      <Textarea
                        value={f.description}
                        onChange={(e) =>
                          setDemoFeatures((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                        }
                        placeholder="What does it do? (optional, helps the script)"
                        className="min-h-[60px] text-sm"
                      />
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-primary text-xs text-muted-foreground hover:text-foreground cursor-pointer transition">
                        {f.uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5 text-primary" />}
                        {f.uploading ? "Uploading…" : f.screenshotUrl ? "Screenshot attached" : "Attach screenshot (optional)"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={f.uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadDemoScreenshot(idx, file);
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  {demoFeatures.length < 8 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDemoFeatures((prev) => [...prev, { name: "", description: "", screenshotUrl: "", uploading: false }])
                      }
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Plus className="size-3.5" /> Add feature
                    </button>
                  )}
                </div>

                {!user ? (
                  <Button onClick={() => nav({ to: "/auth", search: authNextSearch() })} variant="premium" className="w-full sm:w-auto">Sign in to generate</Button>
                ) : (
                  <Button onClick={() => demoMut.mutate()} disabled={demoMut.isPending} variant="premium" className="w-full sm:w-auto">
                    {demoMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Producing demo…</> : <><Presentation className="size-4 mr-2" /> Generate product demo · {COST_PRODUCT_DEMO} Aura</>}
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Aurora scripts a Hook → Walkthrough → CTA narration from your feature list and renders it as a HeyGen avatar video, with your screenshots shown alongside.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background/40 aspect-[9/16] overflow-hidden grid place-items-center relative">
                {demoResultVideo ? (
                  <AutoplayVideo src={demoResultVideo} controls muted={false} loop className="w-full h-full object-cover" />
                ) : (
                  <div className="text-xs text-muted-foreground p-4 text-center">
                    {demoMut.isPending ? <><Loader2 className="size-5 mx-auto mb-2 animate-spin" /> Working… this can take a minute</> : <>Your product demo will appear here.</>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      <SiteFooter tone="light" />
    </main>
  );
}

// ── UGC inspiration block ─────────────────────────────────────────────────────
const UGC_EXAMPLES = [
  { src: auraBloom,                                      label: "Aura Bloom",        caption: "Product reference · beauty creator brief" },
  { src: auraCafe,                                       label: "Aura Café",         caption: "Product reference · café lifestyle brief" },
  { src: "/josh/josh-orange-performance.jpg",    label: "Orange energy",     caption: "UGC talking-head • xAI UGC" },
  { src: "/josh/josh-pink-mic-portrait.jpg",     label: "Studio shot",       caption: "Product feature voiceover" },
  { src: "/josh/josh-concert-performance.webp",  label: "Hype moment",       caption: "Campaign hook · viral format" },
  { src: "/josh/josh-pink-leather-mic.jpg",      label: "Leather session",   caption: "Brand collab · story format" },
  { src: "/josh/josh-blue-portrait.webp",        label: "Blue cinematic",    caption: "App-launch announce" },
  { src: "/josh/josh-red-angle1.png",            label: "Red energy",        caption: "Performance campaign" },
];

const UGC_FORMATS = [
  { label: "Product hook",       sec: "7s",  color: "#a78bfa" },
  { label: "Brand story",        sec: "15s", color: "#34d399" },
  { label: "Talking head demo",  sec: "30s", color: "#60a5fa" },
  { label: "Viral lifestyle",    sec: "9s",  color: "#f472b6" },
];

function UGCInspirationBlock() {
  return (
    <div className="py-6 space-y-8">
      <ExampleOutputGrid
        items={UGC_EXAMPLES}
        title="Campaign references — product and creator directions"
        subtitle="Start with a product reference, pair it with an avatar and scene, then turn the brief into a talking-head campaign."
        columns={3}
      />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">UGC formats</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {UGC_FORMATS.map((f) => (
            <div
              key={f.label}
              className="reveal-card rounded-xl border border-border/60 bg-card/40 px-3.5 py-3 space-y-1.5"
            >
              <span
                className="inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{ background: f.color + "28", color: f.color }}
              >
                {f.sec}
              </span>
              <p className="text-xs font-medium leading-tight">{f.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReferenceTile({ label, image, title, detail }: { label: string; image: string; title: string; detail: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
      <div className="relative aspect-[16/10]">
        <img src={image} alt={`${label}: ${title}`} className="size-full object-cover" />
        <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white/85 backdrop-blur">
          {label}
        </span>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center text-primary/80 md:flex">
      <ArrowRight className="size-5" />
    </div>
  );
}
