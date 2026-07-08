import { useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Flame, Mic2, Camera, SplitSquareHorizontal, Palette, Film, ImageIcon, Wand2, Smartphone, Monitor, ShoppingBag, Layout, Aperture, Crown, Lock, Store } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/billing.functions";
import { Link } from "@tanstack/react-router";
import { RESHOOT_ANGLES, RESHOOT_MODEL, buildAnglePrompt } from "@/lib/reshoot-angles";
import { listApprovedMarketplaceTemplates } from "@/lib/marketplace.functions";

export type TemplateGraph = { name: string; nodes: Node<any>[]; edges: Edge[] };

function mk(id: string, kind: string, x: number, y: number, extra: Record<string, unknown> = {}): Node<any> {
  return { id, position: { x, y }, type: "aurora", data: { kind, ...extra } };
}
function ed(s: string, t: string): Edge {
  return { id: `${s}-${t}`, source: s, target: t, animated: true };
}

const COLORS_PRESET_PROMPT =
  "Full-body editorial portrait of the subject standing centered on a seamless royal-blue cyclorama. Monochromatic blue ambient light wrapping the body, soft rim light from camera-left, deep cyan shadow falloff, faint smoke. Outfit recolored to complementary cobalt. Preserve exact facial likeness. Shot on 35mm, 4K, fashion campaign quality.";

const LIPSYNC_PRESET_IMG_PROMPT =
  "Portrait of the subject mid-vocal, mouth slightly open, vintage SM7B mic on boom in foreground, soft studio lighting, shallow depth of field, photorealistic, 4K.";

// "One avatar, many shots" — every shot fans out from the SAME reference and is
// locked to that identity, so one face renders into a whole consistent set.
const IDENTITY_LOCK =
  "the exact same person from the uploaded reference photo — preserve their precise face, skin tone, hair and identity with no drift. ";
const SHOT_NEON =
  IDENTITY_LOCK + "Tight vertical 9:16 close-up portrait under glowing magenta and cyan neon studio lighting, looking straight into camera, shallow depth of field, photorealistic.";
const SHOT_STAGE =
  IDENTITY_LOCK + "Performing on a concert stage holding a microphone, dramatic spotlights and atmospheric haze, crowd silhouettes in front, vertical 9:16, photorealistic.";
const SHOT_ROOFTOP =
  IDENTITY_LOCK + "Standing on a city rooftop at sunset, skyline behind, slight wind in the hair, cinematic warm light, vertical 9:16, photorealistic.";
const SHOT_ALLEY =
  IDENTITY_LOCK + "Leaning against a colorful graffiti mural in an urban alley, overcast daylight, street fashion, vertical 9:16, photorealistic.";

type TemplateDef = {
  id: string;
  name: string;
  desc: string;
  icon: typeof Flame;
  tags: string[];
  category: "Music & Lip-sync" | "Portrait & Colors" | "Cinema" | "Product & App";
  /** Premium templates are only available on the Pro plan. */
  premium?: boolean;
  build: () => TemplateGraph;
};

// "Multi-angle photo reshoot" — one reference portrait fans out into the same six
// fixed camera angles as the standalone /reshoot tool. Each angle is its own image
// node pre-loaded with the exact reshoot prompt + model, so running the recipe goes
// through the identical per-image charged generation path (1 Aura each, 6 total).
const RESHOOT_NODE_POSITIONS: Array<[number, number]> = [
  [420, 20],
  [420, 260],
  [420, 500],
  [420, 740],
  [420, 980],
  [420, 1220],
];

const TEMPLATES: TemplateDef[] = [
  {
    id: "multi-angle-reshoot",
    name: "Multi-angle photo reshoot",
    desc: "Drop ONE portrait → fan it out into six identity-locked 9:16 angles: fish-eye, bird's-eye, low angle, Dutch angle, macro close-up, worm's-eye. 1 Aura per shot.",
    icon: Aperture,
    tags: ["Selfie", "Image", "Preset"],
    category: "Portrait & Colors",
    build: () => ({
      name: "Multi-angle photo reshoot",
      nodes: [
        mk("in", "input", 40, 620),
        ...RESHOOT_ANGLES.map((angle, i) =>
          mk(`angle-${angle.id}`, "image", RESHOOT_NODE_POSITIONS[i][0], RESHOOT_NODE_POSITIONS[i][1], {
            label: angle.label,
            prompt: buildAnglePrompt(angle, null),
            model: RESHOOT_MODEL,
          }),
        ),
      ],
      edges: RESHOOT_ANGLES.map((angle) => ed("in", `angle-${angle.id}`)),
    }),
  },
  {
    id: "avatar-many-shots",
    name: "Avatar · One Face, Many Shots",
    desc: "Drop ONE selfie → fan it out into a consistent set: 4 identity-locked shots + 2 animated clips. The 'one avatar, many shots' pipeline.",
    icon: Camera,
    tags: ["Selfie", "Image", "Video", "Preset"],
    category: "Portrait & Colors",
    premium: true,
    build: () => ({
      name: "Avatar · One Face, Many Shots",
      nodes: [
        mk("in", "input", 40, 360),
        mk("neon", "image", 380, 40, { prompt: SHOT_NEON, model: "google/gemini-3-pro-image-preview" }),
        mk("stage", "image", 380, 260, { prompt: SHOT_STAGE, model: "google/gemini-3-pro-image-preview" }),
        mk("roof", "image", 380, 480, { prompt: SHOT_ROOFTOP, model: "google/gemini-3-pro-image-preview" }),
        mk("alley", "image", 380, 700, { prompt: SHOT_ALLEY, model: "google/gemini-3-pro-image-preview" }),
        mk("neonVid", "video", 760, 40, { prompt: "subtle natural head movement and a slow blink, neon lights softly flickering, gentle camera push-in", model: "seedance-2.0-fast", cameraMovement: "push_in" }),
        mk("roofVid", "video", 760, 480, { prompt: "hair drifting in the wind, slow cinematic camera orbit, clouds moving behind", model: "seedance-2.0-fast", cameraMovement: "orbit" }),
      ],
      edges: [
        ed("in", "neon"), ed("in", "stage"), ed("in", "roof"), ed("in", "alley"),
        ed("neon", "neonVid"), ed("roof", "roofVid"),
      ],
    }),
  },
  {
    id: "lipsync-preset",
    name: "Lip-sync · NBA Josh preset",
    desc: "Selfie + audio → concert shot → Sync 1.9 lip-sync. Pre-filled prompts.",
    icon: Mic2,
    tags: ["Selfie", "Audio", "Lip-sync", "Preset"],
    category: "Music & Lip-sync",
    premium: true,
    build: () => ({
      name: "Lip-sync · NBA Josh preset",
      nodes: [
        mk("in", "input", 40, 60),
        mk("aud", "audio", 40, 380),
        mk("img", "image", 380, 60, { prompt: LIPSYNC_PRESET_IMG_PROMPT, model: "google/gemini-3-pro-image-preview" }),
        mk("vid", "video", 720, 60, { prompt: "subject sings into the mic, expressive, subtle head sway, locked camera", model: "seedance-2.0-fast", cameraMovement: "static" }),
        mk("lip", "lipsync", 1060, 220, { model: "fal-ai/sync-lipsync/v2" }),
      ],
      edges: [ed("in", "img"), ed("img", "vid"), ed("vid", "lip"), ed("aud", "lip")],
    }),
  },
  {
    id: "lipsync-blank",
    name: "Lip-sync · Blank",
    desc: "Empty selfie + audio → video → lip-sync scaffold. Bring your own prompt.",
    icon: Mic2,
    tags: ["Selfie", "Audio", "Lip-sync", "Blank"],
    category: "Music & Lip-sync",
    build: () => ({
      name: "Lip-sync · Blank",
      nodes: [
        mk("in", "input", 40, 60),
        mk("aud", "audio", 40, 380),
        mk("img", "image", 380, 60, { prompt: "", model: "google/gemini-2.5-flash-image" }),
        mk("vid", "video", 720, 60, { prompt: "", model: "seedance-2.0-fast", cameraMovement: "static" }),
        mk("lip", "lipsync", 1060, 220, { model: "fal-ai/sync-lipsync/v2" }),
      ],
      edges: [ed("in", "img"), ed("img", "vid"), ed("vid", "lip"), ed("aud", "lip")],
    }),
  },
  {
    id: "colors-preset",
    name: "Colors · Blue Performance preset",
    desc: "Selfie → royal-blue cyclorama editorial portrait. Tried & tested prompt.",
    icon: Palette,
    tags: ["Selfie", "Image", "Preset"],
    category: "Portrait & Colors",
    build: () => ({
      name: "Colors · Blue Performance preset",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, { prompt: COLORS_PRESET_PROMPT, model: "google/gemini-3-pro-image-preview" }),
      ],
      edges: [ed("in", "img")],
    }),
  },
  {
    id: "colors-blank",
    name: "Colors · Blank",
    desc: "Empty colors canvas. Drop a selfie, pick a palette, write the scene.",
    icon: Palette,
    tags: ["Selfie", "Image", "Blank"],
    category: "Portrait & Colors",
    build: () => ({
      name: "Colors · Blank",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, { prompt: "", model: "google/gemini-2.5-flash-image" }),
      ],
      edges: [ed("in", "img")],
    }),
  },
  {
    id: "selfie-concert",
    name: "Selfie → Concert Lip-sync",
    desc: "Selfie + audio → performance shot → lip-sync video",
    icon: Mic2,
    tags: ["Selfie", "Audio", "Lip-sync"],
    category: "Music & Lip-sync",
    build: () => ({
      name: "Selfie → Concert Lip-sync",
      nodes: [mk("in", "input", 40, 60), mk("aud", "audio", 40, 380), mk("img", "image", 380, 60, { prompt: "Subject performing on stage, dramatic spotlights, photorealistic" }), mk("lip", "lipsync", 720, 220)],
      edges: [ed("in", "img"), ed("img", "lip"), ed("aud", "lip")],
    }),
  },
  {
    id: "editorial-cover",
    name: "Editorial Cover Shoot",
    desc: "Selfie → Rembrandt magazine portrait",
    icon: Camera,
    tags: ["Selfie", "Image"],
    category: "Portrait & Colors",
    build: () => ({
      name: "Editorial Cover Shoot",
      nodes: [mk("in", "input", 40, 60), mk("img", "image", 380, 60, { prompt: "Editorial magazine cover, Rembrandt lighting, 85mm" })],
      edges: [ed("in", "img")],
    }),
  },
  {
    id: "split-reality",
    name: "Split Reality",
    desc: "One render, two cinematic grades side-by-side",
    icon: SplitSquareHorizontal,
    tags: ["Selfie", "Split"],
    category: "Cinema",
    build: () => ({
      name: "Split Reality",
      nodes: [mk("in", "input", 40, 60), mk("split", "split", 420, 80, { prompt: "Concert wash vs golden hour" })],
      edges: [ed("in", "split")],
    }),
  },
  {
    id: "my-life-fire",
    name: "My Life · Fire Background",
    desc: "Viral cinematic: drop your selfie → stand composed in front of a dramatic fire/chaos background. The 'My Life / Me' aesthetic — calm artist, burning world.",
    icon: Flame,
    tags: ["Selfie", "Image", "Video", "Preset"],
    category: "Cinema",
    build: () => ({
      name: "My Life · Fire Background",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, {
          prompt:
            "Cinematic wide establishing shot: the EXACT person from the reference photo standing in the foreground, arms crossed or at sides, calm and unbothered expression, looking slightly away from camera. Behind them: a dramatic house fire rages — orange and red flames consuming a suburban home, thick smoke billowing into a dusk sky with deep purple and amber clouds. The subject is perfectly composed and lit from the front by a warm practical source, sharp and detailed against the soft-focus blaze. Shot on Alexa, anamorphic 1.85:1, shallow depth of field, cinematic colour grade. Viral editorial aesthetic — emotionally charged, high contrast.",
          model: "google/gemini-3-pro-image-preview",
        }),
        mk("vid", "video", 760, 60, {
          prompt: "Slow dolly push-in on the subject, fire roaring and flickering behind them, embers drifting past the lens, subject remains completely still — cinematic hero moment",
          model: "seedance-2.0-fast",
          cameraMovement: "push_in",
        }),
      ],
      edges: [ed("in", "img"), ed("img", "vid")],
    }),
  },
  {
    id: "ugc-loop",
    name: "UGC Ad Loop",
    desc: "Talent + product → looping social ad",
    icon: Film,
    tags: ["Selfie", "Video"],
    category: "Product & App",
    build: () => ({
      name: "UGC Ad Loop",
      nodes: [mk("in", "input", 40, 60), mk("img", "image", 380, 60, { prompt: "Product hero shot, UGC style" }), mk("vid", "video", 720, 60, { cameraMovement: "slow push in" })],
      edges: [ed("in", "img"), ed("img", "vid")],
    }),
  },
  {
    id: "tryon-reel",
    name: "Outfit Try-On Reel",
    desc: "Selfie + outfit → video reel",
    icon: ImageIcon,
    tags: ["Selfie", "Video"],
    category: "Portrait & Colors",
    build: () => ({
      name: "Outfit Try-On Reel",
      nodes: [mk("in", "input", 40, 60), mk("img", "image", 380, 60, { prompt: "Full body outfit try-on" }), mk("vid", "video", 720, 60, { cameraMovement: "orbit" })],
      edges: [ed("in", "img"), ed("img", "vid")],
    }),
  },
  {
    id: "music-video-mini",
    name: "Music Video Mini",
    desc: "Selfie + audio → video → lip-sync",
    icon: Wand2,
    tags: ["Selfie", "Audio", "Video", "Lip-sync"],
    category: "Music & Lip-sync",
    premium: true,
    build: () => ({
      name: "Music Video Mini",
      nodes: [mk("in", "input", 40, 60), mk("aud", "audio", 40, 380), mk("img", "image", 360, 60, { prompt: "Cinematic music video still" }), mk("vid", "video", 680, 60, { cameraMovement: "dolly in" }), mk("lip", "lipsync", 1000, 220)],
      edges: [ed("in", "img"), ed("img", "vid"), ed("vid", "lip"), ed("aud", "lip")],
    }),
  },
  // ────────── PRODUCT & APP WORKFLOWS ──────────
  {
    id: "app-hero-mockup",
    name: "App Hero · iPhone mockup",
    desc: "Drop your app screenshot → photorealistic iPhone-in-hand hero shot. Perfect for App Store, landing page, ads.",
    icon: Smartphone,
    tags: ["App screenshot", "Image", "Preset"],
    category: "Product & App",
    build: () => ({
      name: "App Hero · iPhone mockup",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, {
          prompt:
            "Photorealistic hero shot of a person's hand holding a brand-new iPhone 15 Pro in titanium black. The phone screen displays the EXACT uploaded app UI screenshot, pixel-perfect, no distortion. Soft natural window light from camera-left, clean white seamless backdrop with subtle gradient, professional product photography, 50mm f/2.8, ultra sharp screen, gentle hand shadow. The screen content is the uploaded image — preserve it exactly. No text overlays, no logos.",
          model: "google/gemini-3-pro-image-preview",
        }),
      ],
      edges: [ed("in", "img")],
    }),
  },
  {
    id: "saas-dashboard-hero",
    name: "SaaS Dashboard · floating hero",
    desc: "Drop a dashboard screenshot → 3D floating laptop hero with brand glow. Landing page gold.",
    icon: Monitor,
    tags: ["Web screenshot", "Image", "Preset"],
    category: "Product & App",
    build: () => ({
      name: "SaaS Dashboard · floating hero",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, {
          prompt:
            "Cinematic 3D product render of a sleek MacBook Pro floating at a slight tilt against a deep midnight-blue gradient background with soft violet bloom. The laptop screen shows the EXACT uploaded dashboard/web screenshot, pixel-perfect, ultra-sharp, no distortion. Subtle volumetric glow behind the device, soft reflection on a glossy obsidian floor, octane-render quality, hero shot for a SaaS landing page. No text, no logos added.",
          model: "google/gemini-3-pro-image-preview",
        }),
      ],
      edges: [ed("in", "img")],
    }),
  },
  {
    id: "product-lifestyle",
    name: "Product · lifestyle scene",
    desc: "Drop your product photo → cinematic lifestyle shot (cafe, desk, hand-held). Killer for e-commerce + ads.",
    icon: ShoppingBag,
    tags: ["Product", "Image", "Preset"],
    category: "Product & App",
    build: () => ({
      name: "Product · lifestyle scene",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, {
          prompt:
            "Editorial lifestyle product photograph: the EXACT uploaded product placed naturally on a warm walnut cafe table with a soft-focus latte, an open notebook and golden-hour window light streaming from camera-right. Shallow depth of field, 50mm, Kodak Portra 400 grain, magazine-quality colour. Preserve the product's label, shape, colours and proportions exactly — do not redesign it. No people in frame.",
          model: "google/gemini-3-pro-image-preview",
        }),
        mk("vid", "video", 760, 60, {
          prompt: "Slow cinematic push-in on the product, steam rising from the latte, soft particles in the light beam, locked tripod feel.",
          model: "seedance-2.0-fast",
          cameraMovement: "push_in",
        }),
      ],
      edges: [ed("in", "img"), ed("img", "vid")],
    }),
  },
  {
    id: "website-og-banner",
    name: "Website OG · share banner",
    desc: "Drop your homepage screenshot → 1200×630 OG/Twitter share image with brand glow. Drives clicks.",
    icon: Layout,
    tags: ["Web screenshot", "Image", "Preset"],
    category: "Product & App",
    build: () => ({
      name: "Website OG · share banner",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, {
          prompt:
            "1200×630 horizontal social share banner. Center: a tilted browser window mockup showing the EXACT uploaded website screenshot pixel-perfect inside a Safari chrome with three traffic-light dots. Background: deep gradient from oklch dark indigo to violet with subtle dotted grid texture and a soft violet glow behind the browser. Composition leaves clean negative space top-left and bottom-right for headline text. Photorealistic, no added text or logos.",
          model: "google/gemini-3-pro-image-preview",
        }),
      ],
      edges: [ed("in", "img")],
    }),
  },
  {
    id: "app-demo-reel",
    name: "App Demo · scrolling reel",
    desc: "App screenshot → iPhone-in-hand hero → 5s video of the screen content scrolling. TikTok-ready.",
    icon: Smartphone,
    tags: ["App screenshot", "Video", "Preset"],
    category: "Product & App",
    build: () => ({
      name: "App Demo · scrolling reel",
      nodes: [
        mk("in", "input", 40, 60),
        mk("img", "image", 380, 60, {
          prompt:
            "Vertical 9:16 hero shot: a person's hand holding an iPhone 15 Pro in titanium. The screen shows the EXACT uploaded app screenshot, pixel-perfect. Soft studio lighting, gradient violet-to-black backdrop, professional product photography, sharp screen, gentle reflection on the glass.",
          model: "google/gemini-3-pro-image-preview",
        }),
        mk("vid", "video", 760, 60, {
          prompt: "The app content on the iPhone screen scrolls smoothly upward as if the user is browsing. Hand stays steady, subtle natural micro-movement, locked camera, professional product video.",
          model: "seedance-2.0-fast",
          cameraMovement: "static",
        }),
      ],
      edges: [ed("in", "img"), ed("img", "vid")],
    }),
  },
];

export function getTemplateById(id: string): TemplateGraph | null {
  const t = TEMPLATES.find((x) => x.id === id);
  return t ? t.build() : null;
}

export function TrendingTemplatesMenu({ onPick }: { onPick: (g: TemplateGraph) => void }) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { user } = useAuth();
  const profileFn = useServerFn(getMyProfile);
  const marketplaceFn = useServerFn(listApprovedMarketplaceTemplates);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: marketplaceTemplates = [] } = useQuery({
    queryKey: ["marketplace-templates-menu"],
    queryFn: () => marketplaceFn(),
    staleTime: 120_000,
    enabled: open,
  });

  const isPro = profile?.plan === "pro" || profile?.isAdmin === true;

  const categories: TemplateDef["category"][] = [
    "Product & App",
    "Music & Lip-sync",
    "Portrait & Colors",
    "Cinema",
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20">
            <Flame className="size-3.5 mr-1" /> Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Trending workflows</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pick a template → it drops nodes on the canvas with prompts pre-filled. Upload your image/audio into the green input nodes, tweak the prompt if you like, then hit <span className="text-primary font-medium">Run pipeline</span>.
            </p>
          </DialogHeader>
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {categories.map((cat) => {
              const items = TEMPLATES.filter((t) => t.category === cat);
              if (items.length === 0) return null;
              return (
                <section key={cat}>
                  <h3 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2 px-1">
                    {cat}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {items.map((t) => {
                      const Icon = t.icon;
                      const isPreset = t.tags.includes("Preset");
                      const isBlank = t.tags.includes("Blank");
                      const locked = t.premium && !isPro;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            if (locked) { setUpgradeOpen(true); return; }
                            onPick(t.build());
                            setOpen(false);
                          }}
                          className={`relative text-left p-3 rounded-xl border transition-colors ${
                            locked
                              ? "border-primary/20 bg-primary/5 hover:border-primary/40 opacity-80"
                              : isPreset ? "border-emerald-400/40 bg-emerald-500/5 hover:border-emerald-400/70"
                              : isBlank ? "border-sky-400/30 bg-sky-500/5 hover:border-sky-400/60"
                              : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`size-4 ${locked ? "text-muted-foreground" : "text-primary"}`} />
                            <span className="font-medium text-sm">{t.name}</span>
                            {t.premium && (
                              <span className="ml-auto flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                                {locked ? <Lock className="size-2.5" /> : <Crown className="size-2.5" />}
                                Pro
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{t.desc}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {t.tags.map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                          {locked && (
                            <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                              <div className="flex flex-col items-center gap-1">
                                <Lock className="size-4 text-primary" />
                                <span className="text-[10px] font-semibold text-primary">Pro only</span>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* ── Marketplace templates ── */}
            {marketplaceTemplates.length > 0 && (
              <section>
                <h3 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
                  <Store className="size-3" /> Creator Marketplace
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {marketplaceTemplates.map((t) => (
                    <Link
                      key={t.id}
                      to="/marketplace"
                      onClick={() => setOpen(false)}
                      className="text-left p-3 rounded-xl border border-violet-400/30 bg-violet-500/5 hover:border-violet-400/60 transition-colors no-underline block"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Store className="size-4 text-violet-400 shrink-0" />
                        <span className="font-medium text-sm text-foreground">{t.name}</span>
                        <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 shrink-0">
                          {t.run_cost_aura} Aura
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                      <p className="mt-1.5 text-[10px] text-violet-400/70">by {t.creator_display_name ?? "Creator"}</p>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/marketplace"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 no-underline px-1"
                >
                  <Store className="size-3" /> Browse all marketplace templates →
                </Link>
              </section>
            )}

            {marketplaceTemplates.length === 0 && (
              <section>
                <h3 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
                  <Store className="size-3" /> Creator Marketplace
                </h3>
                <Link
                  to="/marketplace"
                  onClick={() => setOpen(false)}
                  className="block p-3 rounded-xl border border-dashed border-violet-400/20 text-center text-xs text-muted-foreground hover:border-violet-400/40 transition-colors no-underline"
                >
                  <Store className="size-4 text-violet-400/50 mx-auto mb-1" />
                  Browse community templates →
                </Link>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade prompt dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="size-5 text-primary" />
              Pro template
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This template is available on the <span className="text-foreground font-medium">Aurora Pro</span> plan. Upgrade to unlock it and get no watermarks, priority queue, and 200 Aura every month.
          </p>
          <div className="flex gap-3 mt-2">
            <Link
              to="/billing"
              onClick={() => { setUpgradeOpen(false); setOpen(false); }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Crown className="size-4" /> Upgrade to Pro
            </Link>
            <button
              type="button"
              onClick={() => setUpgradeOpen(false)}
              className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Not now
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
