import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { generatePerformanceShot, generateVideoFromImage } from "@/lib/studio.functions";
import { generateUGCAd, getGenerationStatus } from "@/lib/ugc-generation.functions";
import { handleGenerationError } from "@/lib/error-toasts";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Smartphone, Camera, ShoppingBag, Coffee, Dumbbell, Sparkles, Check, Loader2, Wand2, Film, AudioLines } from "lucide-react";
import avatarMaya from "@/assets/ugc/maya.jpg.asset.json";
import avatarLuna from "@/assets/ugc/luna.jpg.asset.json";
import avatarAva from "@/assets/ugc/ava.jpg.asset.json";
import avatarRio from "@/assets/ugc/rio.jpg.asset.json";
import avatarScarlet from "@/assets/ugc/scarlet.jpg.asset.json";
import avatarNova from "@/assets/ugc/nova.jpg.asset.json";
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

export const Route = createFileRoute("/ugc")({
  component: UGCStudio,
  head: () => ({
    meta: [
      { title: "UGC Factory — Aurora" },
      { name: "description", content: "Pick an AI avatar and generate scroll-stopping UGC ads in seconds. iPhone realism, product in hand, native social vibe." },
      { property: "og:title", content: "UGC Factory — Aurora" },
      { property: "og:description", content: "Pick an avatar, drop your product, ship UGC ads. iPhone-real, native, scroll-stopping." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/ugc" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/ugc" }],
  }),
});

const AVATARS = [
  { id: "maya",    name: "Maya",    vibe: "Soft-glam beauty reviewer", img: avatarMaya.url },
  { id: "luna",    name: "Luna",    vibe: "Clean-girl skincare lead",  img: avatarLuna.url },
  { id: "ava",     name: "Ava",     vibe: "Bold lip, red-dress energy", img: avatarAva.url },
  { id: "rio",     name: "Rio",     vibe: "Cool-tone editorial",       img: avatarRio.url },
  { id: "scarlet", name: "Scarlet", vibe: "Red-hair freckled it-girl", img: avatarScarlet.url },
  { id: "nova",    name: "Nova",    vibe: "Glossy fitness creator",    img: avatarNova.url },
  { id: "emma",    name: "Emma",    vibe: "Car-selfie product reviewer", img: realCarHold.url },
  { id: "sasha",   name: "Sasha",   vibe: "Street-style coffee run",     img: realStreet.url },
];

const PRESETS = [
  { id: "iphone-selfie", name: "iPhone selfie review", icon: Smartphone, hint: "Front camera, slightly tilted, soft window light, casual room.", video: demo1.url, poster: undefined as string | undefined },
  { id: "car-product",   name: "Car-seat product hold", icon: Smartphone, hint: "Sun-flare car selfie, golden hour through windshield, avatar holding the product label-out near the cheek — like the reference shot.", video: demo1.url, poster: realCarHold.url },
  { id: "unboxing", name: "Unboxing hands", icon: ShoppingBag, hint: "Top-down product reveal on desk, natural fingers, kraft paper.", video: demo2.url, poster: undefined as string | undefined },
  { id: "lifestyle-cafe", name: "Cafe lifestyle", icon: Coffee, hint: "Holding product at a cafe table, blurred background, golden hour.", video: undefined as unknown as string, poster: realStreet.url },
  { id: "gym-mirror", name: "Gym mirror", icon: Dumbbell, hint: "Mirror selfie at the gym, post-workout glow, fluorescent overhead.", video: undefined as unknown as string, poster: undefined as string | undefined },
  { id: "get-ready", name: "Get-ready-with-me", icon: Camera, hint: "Bathroom mirror, ring light, candid morning routine.", video: undefined as unknown as string, poster: realHome.url },
  { id: "tiktok-pov", name: "TikTok POV", icon: Sparkles, hint: "POV holding phone, talking-to-camera framing, 9:16 vertical.", video: undefined as unknown as string, poster: undefined as string | undefined },
];

function UGCStudio() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [avatarId, setAvatarId] = useState<string>(AVATARS[0].id);
  const avatar = AVATARS.find(a => a.id === avatarId)!;
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [productPrompt, setProductPrompt] = useState<string>("");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);

  const genShot = useServerFn(generatePerformanceShot);
  const genVid = useServerFn(generateVideoFromImage);
  const genAd = useServerFn(generateUGCAd);
  const genStatus = useServerFn(getGenerationStatus);

  // Avatar images are bundled as relative asset paths; the async pipeline needs
  // an absolute, fetchable URL for both validation and the provider fetch.
  const toAbsolute = (u: string) =>
    /^https?:\/\//.test(u) ? u : new URL(u, window.location.origin).href;

  const imageMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first.");
      if (!productPrompt.trim()) throw new Error("Describe your product (e.g. holding a glossy red lipstick).");
      const prompt = `Hyper-realistic UGC iPhone-style shot. ${preset.hint} Featuring AI creator "${avatar.name}" (${avatar.vibe}). Product/action: ${productPrompt.trim()}. Native social media aesthetic, photoreal skin, no logos, 9:16 framing.`;
      return await genShot({ data: { prompt, imageUrls: [toAbsolute(avatar.img)], model: "google/gemini-2.5-flash-image" } });
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
      const { generationId } = await genAd({
        data: {
          avatarImageUrl: toAbsolute(avatar.img),
          avatarName: avatar.name,
          vibe: avatar.vibe,
          presetHint: preset.hint,
          presetName: preset.name,
          productPrompt: productPrompt.trim(),
          aspect: "9:16",
          duration: 8,
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

  const busy = imageMut.isPending || videoMut.isPending || adMut.isPending;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 border-b border-border bg-card/40 px-6 py-4 flex items-center justify-between backdrop-blur-xl">
        <Link to="/" className="font-semibold no-underline text-foreground">Aurora</Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/studio" className="text-foreground/70 no-underline">Studio</Link>
          <Link to="/colors" className="text-foreground/70 no-underline">Colors</Link>
          <Link to="/canvas" className="text-foreground/70 no-underline">Canvas</Link>
        </nav>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <p className="aurora-kicker mb-2">UGC Factory</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Pick an avatar. Ship UGC.</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Six on-brand AI creators, ready to film. Choose a face, pick a scene, and Aurora generates a native TikTok-style ad with your product in hand.
        </p>

        {/* Avatar gallery */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">1. Choose your avatar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {AVATARS.map(a => {
              const active = a.id === avatarId;
              return (
                <button
                  key={a.id}
                  onClick={() => setAvatarId(a.id)}
                  className={`aurora-card-hover relative rounded-xl overflow-hidden border-2 transition group ${active ? "border-primary shadow-[0_0_24px_oklch(0.78_0.18_305/0.4)]" : "border-border hover:border-primary/50"}`}
                >
                  <img src={a.img} alt={a.name} width={512} height={512} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 text-left">
                    <p className="text-white text-sm font-semibold leading-none">{a.name}</p>
                    <p className="text-white/70 text-[10px] mt-0.5 leading-tight">{a.vibe}</p>
                  </div>
                  {active && (
                    <span className="absolute top-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preset gallery */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">2. Pick a scene</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                aria-pressed={p.id === presetId}
                className={`aurora-card-hover text-left rounded-xl border bg-card hover:border-primary transition group overflow-hidden ${p.id === presetId ? "border-primary shadow-[0_0_24px_oklch(0.78_0.18_305/0.35)]" : "border-border"}`}
              >
                <div className="aspect-video bg-black/40 overflow-hidden">
                  {p.poster ? (
                    <img src={p.poster} alt={p.name} loading="lazy" className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition" />
                  ) : p.video ? (
                  <AutoplayVideo
                    src={p.video}
                    loop
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
                  />
                  ) : (
                    <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/30 via-background to-background">
                      <p.icon className="h-10 w-10 text-primary/80" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p.icon className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-semibold group-hover:text-primary">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{p.hint}</p>
                  <p className="text-[11px] text-primary/80 mt-3">{p.id === presetId ? `✓ Selected · paired with ${avatar.name}` : `Tap to pair with ${avatar.name}`}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Inline generator */}
        <div className="mt-12 rounded-2xl border border-primary/40 bg-card p-6 grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">3. Describe the product / action</h2>
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
                <button key={s} type="button" onClick={() => setProductPrompt(s)} className="px-2 py-1 rounded-full border border-border hover:border-primary text-muted-foreground hover:text-foreground">{s}</button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {!user ? (
                <Button onClick={() => nav({ to: "/auth" })} variant="premium" className="w-full sm:w-auto">Sign in to generate</Button>
              ) : (
                <>
                  <Button onClick={() => imageMut.mutate()} disabled={busy} variant="premium" className="w-full sm:w-auto">
                    {imageMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Shooting…</> : <><Wand2 className="size-4 mr-2" /> Generate UGC shot · 1 Aura</>}
                  </Button>
                  <Button onClick={() => videoMut.mutate()} disabled={busy || !resultImage} variant="outline" className="w-full sm:w-auto">
                    {videoMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Animating…</> : <><Film className="size-4 mr-2" /> Animate · 5 Aura</>}
                  </Button>
                  <Button onClick={() => adMut.mutate()} disabled={busy} variant="secondary" className="w-full sm:w-auto">
                    {adMut.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Producing ad…</> : <><AudioLines className="size-4 mr-2" /> Generate talking ad · 8 Aura</>}
                  </Button>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Avatar <strong className="text-foreground">{avatar.name}</strong> · scene <strong className="text-foreground">{preset.name}</strong>. Generate a still then Animate it, or run <strong className="text-foreground">Generate talking ad</strong> for the full script → voice → video → lip-sync pipeline in one click (voice &amp; lip-sync apply when configured, otherwise a silent clip).
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
      </section>
      <SiteFooter tone="light" />
    </main>
  );
}
