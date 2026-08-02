/**
 * Curated cinematic media assets for Aurora UI cards.
 * All from Unsplash free CDN — no auth required.
 * Used as image backgrounds for inspiration cards, tool tiles, and nav previews.
 *
 * Organised by preset ID (matches home SIDES presets) and tool slug.
 */
export const MEDIA_ASSETS: Record<string, string> = {
  // ── Artist presets ────────────────────────────────────────────────────────
  performance:   "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80",
  "music-video": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
  colors:        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  cover:         "https://images.unsplash.com/photo-1571974599782-87624638275c?w=800&q=80",
  editorial:     "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80",

  // ── Creator presets ───────────────────────────────────────────────────────
  ugc:           "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
  avatar:        "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80",
  hook:          "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=80",
  grwm:          "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80",
  product:       "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",

  // ── Shared / tool slots ───────────────────────────────────────────────────
  custom:        "https://images.unsplash.com/photo-1536240478700-b869ad10525b?w=800&q=80",
  studio:        "https://images.unsplash.com/photo-1536240478700-b869ad10525b?w=800&q=80",
  motion:        "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80",
  lipsync:       "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=80",
  tiktok:        "https://images.unsplash.com/photo-1611162617213-1ceb7a893a58?w=800&q=80",
  content:       "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80",
  storyboard:    "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80",
  scene:         "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80",
  lyrics:        "https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=800&q=80",
  photo:         "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800&q=80",
};

/** Inspiration card images keyed by inspiration ID (a1–a6, c1–c6). */
export const INSPIRATION_IMAGES: Record<string, string> = {
  a1: MEDIA_ASSETS.performance,
  a2: MEDIA_ASSETS["music-video"],
  a3: MEDIA_ASSETS.colors,
  a4: MEDIA_ASSETS.cover,
  a5: MEDIA_ASSETS.editorial,
  a6: MEDIA_ASSETS.custom,
  c1: MEDIA_ASSETS.ugc,
  c2: MEDIA_ASSETS.avatar,
  c3: MEDIA_ASSETS.hook,
  c4: MEDIA_ASSETS.grwm,
  c5: MEDIA_ASSETS.product,
  c6: MEDIA_ASSETS.custom,
};
