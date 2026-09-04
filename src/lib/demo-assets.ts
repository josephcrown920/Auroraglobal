export type DemoMediaAsset = {
  id: string;
  src: string;
  type: "image" | "video";
  alt: string;
  poster?: string;
  label?: string;
};

const video = (
  id: string,
  src: string,
  alt: string,
  poster?: string,
  label?: string,
): DemoMediaAsset => ({ id, src, type: "video", alt, poster, label });

const image = (
  id: string,
  src: string,
  alt: string,
  label?: string,
): DemoMediaAsset => ({ id, src, type: "image", alt, label });

export const DEMO_ASSETS = {
  landing: {
    ambient: video(
      "landing-reel",
      "/videos/landing-demo-reel.mp4",
      "Aurora-generated performer in a cinematic neon scene",
      "/videos/landing-demo-reel-poster.jpg",
      "Aurora Motion reel",
    ),
    walkthrough: video(
      "studio-workflow",
      "/videos/aurora-workflow-overview.mp4",
      "Sixty-second Aurora workflow reel: Studio direction, Spin campaign, then UGC delivery",
      "/videos/aurora-workflow-overview-poster.jpg",
      "60-second workflow overview",
    ),
    studio: [
      image("studio-live", "/nav-previews/live-studio.jpg", "Aurora Studio's live creative workspace", "Studio"),
      image("studio-josh", "/josh/looping-officers-hero.png", "Cinematic artist key art made in Aurora Studio", "Artist visual"),
      image("studio-editorial", "/landing-client-2.png", "Editorial music artist portrait generated in Aurora", "Campaign still"),
    ],
    spin: [
      image("spin-templates", "/screenshots/tiktok30-templates.png", "TikTok30 template selection shown inside Aurora", "TikTok30"),
      image("spin-promo", "/landing-client-4.png", "Short-form campaign-ready artist visual", "Campaign output"),
      video("spin-preview", "/viral-presets/preview-1.mp4", "Vertical social video created from an Aurora viral preset", "/videos/landing-demo-reel-poster.jpg", "Viral preset"),
    ],
    ugc: [
      video("ugc-lipsync", "/videos/face-sings-hero.mp4", "Photo transformed into a talking creator performance", "/videos/landing-demo-reel-poster.jpg", "Creator video"),
      image("ugc-product", "/sample-photos/green-car.png", "Product-focused creator content visual", "Product visual"),
      image("ugc-campaign", "/landing-client-5.png", "Styled campaign image for a creator brief", "Campaign still"),
    ],
    colors: [
      image("colors-grade", "/colors/colors-6.png", "Cinematic color grade variations in Aurora Colors Studio", "Color grade"),
      image("colors-scene", "/landing-photo-6.png", "Artist portrait with a rich violet color treatment", "Palette output"),
      image("colors-editorial", "/landing-client-7.png", "Editorial image with an Aurora color finish", "Finished still"),
    ],
    canvas: [
      image("canvas-storyboard", "/josh/looping-officers-sunset.png", "Cinematic reference frame for an Aurora canvas workflow", "Canvas reference"),
      image("canvas-scene", "/josh-scene-still.jpeg", "A scene planning frame for a music video", "Scene plan"),
      video("canvas-motion", "/videos/landing-demo-reel.mp4", "Finished moving image from an Aurora visual plan", "/videos/landing-demo-reel-poster.jpg", "Motion output"),
    ],
  },
  studio: {
    hero: video("studio-hero", "/videos/landing-demo-reel.mp4", "Aurora Studio cinematic output reel", "/videos/landing-demo-reel-poster.jpg"),
    gallery: [
      image("studio-live", "/nav-previews/live-studio.jpg", "Aurora Studio creative workspace", "Live workspace"),
      image("studio-josh", "/josh/looping-officers-hero.png", "Artist promo still created in Studio", "Artist promo"),
      image("studio-editorial", "/landing-client-2.png", "Editorial campaign still created in Studio", "Campaign"),
    ],
  },
  spin: {
    hero: video("spin-hero", "/viral-presets/preview-2.mp4", "Vertical campaign video rendered by Aurora Spin", "/videos/landing-demo-reel-poster.jpg"),
    gallery: [
      image("spin-templates", "/screenshots/tiktok30-templates.png", "TikTok30 campaign templates in Aurora Spin", "Campaign templates"),
      image("spin-promo", "/landing-client-4.png", "Short-form campaign visual", "Post one"),
      video("spin-preview", "/viral-presets/preview-1.mp4", "Viral preset video output", "/videos/landing-demo-reel-poster.jpg", "Vertical output"),
    ],
  },
  ugc: {
    hero: video("ugc-hero", "/videos/face-sings-hero.mp4", "Creator portrait animated into a UGC clip", "/videos/landing-demo-reel-poster.jpg"),
    gallery: [
      video("ugc-lipsync", "/videos/photo2-lipsync-sample.mp4", "Creator-style product performance video", "/videos/landing-demo-reel-poster.jpg", "Creator result"),
      image("ugc-product", "/sample-photos/green-car.png", "Product-led creator visual", "Product focus"),
      image("ugc-campaign", "/landing-client-5.png", "Campaign visual made for a UGC brief", "Campaign"),
    ],
  },
  ugcLine: {
    hero: image("ugc-line-hero", "/landing-client-3.png", "Creator campaign output for a content brief"),
    gallery: [
      image("ugc-line-hook", "/landing-client-3.png", "Creator hook visual for a batch brief", "Hook"),
      image("ugc-line-unboxing", "/sample-photos/dj-party.png", "Lifestyle angle for an unboxing-style brief", "Lifestyle"),
      image("ugc-line-proof", "/landing-client-7.png", "Polished campaign proof visual", "Proof"),
    ],
  },
  colors: {
    hero: video("colors-hero", "/videos/landing-demo-reel.mp4", "Color-treated Aurora cinematic output", "/videos/landing-demo-reel-poster.jpg"),
    gallery: [
      image("colors-grade", "/colors/colors-6.png", "Aurora Colors Studio grade variations", "Color grade"),
      image("colors-scene", "/landing-photo-6.png", "Artist portrait with a tuned color palette", "Palette"),
      image("colors-editorial", "/landing-client-7.png", "Editorial portrait with a finished Aurora grade", "Finished still"),
    ],
  },
  lipsync: {
    hero: video("lipsync-hero", "/videos/balloon-lipsync-demo.mp4", "A portrait lip syncing a performance", "/videos/landing-demo-reel-poster.jpg"),
    gallery: [
      video("lipsync-balloon", "/videos/balloon-lipsync-demo.mp4", "Lip synced balloon performance", "/videos/landing-demo-reel-poster.jpg", "Photo to performance"),
      video("lipsync-photo", "/videos/photo2-lipsync-sample.mp4", "Portrait lip sync output", "/videos/landing-demo-reel-poster.jpg", "Portrait performance"),
      image("lipsync-reference", "/josh/identity-reference.jpeg", "Reference portrait used to direct a performance", "Reference"),
    ],
  },
  canvas: {
    gallery: [
      image("canvas-storyboard", "/josh/looping-officers-sunset.png", "Cinematic reference frame used in an Aurora canvas", "Reference"),
      image("canvas-scene", "/josh-scene-still.jpeg", "Scene card for a music video sequence", "Scene card"),
      video("canvas-motion", "/videos/landing-demo-reel.mp4", "Finished motion output from a visual plan", "/videos/landing-demo-reel-poster.jpg", "Finished output"),
    ],
  },
} as const;

export const UGC_ANGLE_THUMBNAILS: Record<string, DemoMediaAsset> = {
  testimonial: image("testimonial", "/landing-client-2.png", "Testimonial-style creator performance"),
  "before/after": image("before-after", "/colors/colors-6.png", "Before and after visual comparison"),
  "myth-bust": image("myth-bust", "/landing-client-7.png", "Myth-busting creator reaction visual"),
  unboxing: image("unboxing", "/sample-photos/green-car.png", "Creator unboxing visual"),
  day_in_life: image("day-in-life", "/sample-photos/dj-party.png", "Day in the life creator visual"),
  pov: image("pov", "/josh/looping-officers-sunset.png", "POV cinematic creator frame"),
  comparison: image("comparison", "/colors/colors-6.png", "Side-by-side comparison concept"),
  reaction: image("reaction", "/landing-client-3.png", "Creator reaction visual"),
  tutorial: image("tutorial", "/nav-previews/live-studio.jpg", "Creator tutorial setup"),
};