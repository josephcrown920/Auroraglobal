import { useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Flame, Mic2, Camera, SplitSquareHorizontal, Palette, Film, ImageIcon, Wand2, Smartphone, Monitor, ShoppingBag, Layout } from "lucide-react";

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
  "Cinematic concert performance shot of the subject mid-vocal, mouth slightly open, vintage SM7B mic on boom in foreground, deep magenta + violet stage haze, anamorphic flares, shallow depth of field, sweat-glow on skin, 35mm.";

type TemplateDef = {
  id: string;
  name: string;
  desc: string;
  icon: typeof Flame;
  tags: string[];
  category: "Music & Lip-sync" | "Portrait & Colors" | "Cinema" | "Product & App";
  build: () => TemplateGraph;
};

const TEMPLATES: TemplateDef[] = [
  {
    id: "lipsync-preset",
    name: "Lip-sync · NBA Josh preset",
    desc: "Selfie + audio → concert shot → Sync 1.9 lip-sync. Pre-filled prompts.",
    icon: Mic2,
    tags: ["Selfie", "Audio", "Lip-sync", "Preset"],
    category: "Music & Lip-sync",
    build: () => ({
      name: "Lip-sync · NBA Josh preset",
      nodes: [
        mk("in", "input", 40, 60),
        mk("aud", "audio", 40, 380),
        mk("img", "image", 380, 60, { prompt: LIPSYNC_PRESET_IMG_PROMPT, model: "google/gemini-3-pro-image-preview" }),
        mk("vid", "video", 720, 60, { prompt: "subject sings into the mic, expressive, subtle head sway, locked camera", model: "seedance-2.0", cameraMovement: "static" }),
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
        mk("vid", "video", 720, 60, { prompt: "", model: "seedance-2.0", cameraMovement: "static" }),
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
      nodes: [mk("in", "input", 40, 60), mk("aud", "audio", 40, 380), mk("img", "image", 380, 60, { prompt: "Cinematic concert performance, stage lights" }), mk("lip", "lipsync", 720, 220)],
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
          model: "seedance-2.0",
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
          model: "seedance-2.0",
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
  const categories: TemplateDef["category"][] = [
    "Product & App",
    "Music & Lip-sync",
    "Portrait & Colors",
    "Cinema",
  ];
  return (
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
                    return (
                      <button
                        key={t.id}
                        onClick={() => { onPick(t.build()); setOpen(false); }}
                        className={`text-left p-3 rounded-xl border transition-colors ${
                          isPreset ? "border-emerald-400/40 bg-emerald-500/5 hover:border-emerald-400/70"
                          : isBlank ? "border-sky-400/30 bg-sky-500/5 hover:border-sky-400/60"
                          : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="size-4 text-primary" />
                          <span className="font-medium text-sm">{t.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
