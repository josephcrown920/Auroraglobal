// Server-safe defaults shared by the client provider and the admin
// server functions. No React imports so it can be imported from either side.

export type SiteImageKey =
  | "hero_1" | "hero_2" | "hero_3" | "hero_4" | "hero_5" | "hero_6"
  | "creator_1" | "creator_2" | "creator_3" | "creator_4" | "creator_5" | "creator_6";

export type SiteImageDefault = { url: string; label: string; section: string };

export const SITE_IMAGE_DEFAULTS: Record<SiteImageKey, SiteImageDefault> = {
  hero_1:    { url: "/gallery/josh-pink-mic.png",          label: "Concert Wash",       section: "hero" },
  hero_2:    { url: "/josh/josh-concert-performance.webp", label: "Editorial",           section: "hero" },
  hero_3:    { url: "/josh/josh-orange-performance.jpg",   label: "Golden Hour",         section: "hero" },
  hero_4:    { url: "/gallery/josh-neon-tech.png",         label: "Neon Dreams",         section: "hero" },
  hero_5:    { url: "/gallery/josh-blue-portrait.png",     label: "Rembrandt",           section: "hero" },
  hero_6:    { url: "/gallery/violet-haze.webp",           label: "Violet Haze",         section: "hero" },
  creator_1: { url: "/gallery/glitter-bath.jpg",           label: "Boudoir Editorial",   section: "creator" },
  creator_2: { url: "/gallery/violet-haze.webp",           label: "Velvet Fantasy",      section: "creator" },
  creator_3: { url: "/gallery/blonde-selfie.png",          label: "Golden Seduction",    section: "creator" },
  creator_4: { url: "/gallery/josh-pink-mic.png",          label: "Neon Temptation",     section: "creator" },
  creator_5: { url: "/gallery/ski-selfie.jpg",             label: "Luxury Suite",        section: "creator" },
  creator_6: { url: "/gallery/ichroma-cover.webp",         label: "Private Collection",  section: "creator" },
};

export const SITE_IMAGE_KEYS = Object.keys(SITE_IMAGE_DEFAULTS) as SiteImageKey[];
