// Platform-level Talking Avatar Templates.
//
// Three kinds:
//   "photo"         — still image; generation = HeyGen photo-video (heygen/photo-video)
//   "video"         — full video clip; generation = sync.so lipsync (sync/lipsync-2)
//   "heygen-avatar" — HeyGen hosted avatar ID; HeyGen handles TTS internally via
//                     /v3/videos type:"avatar" — no external TTS step needed.
//
// Assets for photo/video templates live in studio bucket under platform-templates/.
// Thumbnails live in public/videos/thumbs/ and are served as static files.
//
// featured: true  → highlighted as a "best pick" in the studio UI with a special badge.

export type PlatformTemplateKind = "photo" | "video" | "heygen-avatar" | "live";

export type PlatformTemplate = {
  id: string;
  kind: PlatformTemplateKind;
  name: string;
  description: string;
  thumbnailPath: string;
  featured?: boolean;
  featuredLabel?: string;
  // photo / video templates
  storagePath?: string;
  // heygen-avatar templates
  avatarId?: string;
  voiceId?: string;
};

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  // ── FEATURED / Best picks ──────────────────────────────────────────────────
  {
    id: "heygen-loop",
    kind: "video",
    name: "HeyGen Loop",
    description: "Surreal street loop — exported from HeyGen",
    storagePath: "platform-templates/heygen-loop.mp4",
    thumbnailPath: "/videos/thumbs/heygen-loop.jpg",
    featured: true,
    featuredLabel: "🔥 Top Pick",
  },
  {
    id: "man-on-floor",
    kind: "video",
    name: "Man on Floor",
    description: "Floor-level performance clip",
    storagePath: "platform-templates/man-on-floor.mp4",
    thumbnailPath: "/videos/thumbs/man-on-floor.jpg",
    featured: true,
    featuredLabel: "⭐ Best",
  },
  {
    id: "golden-hour",
    kind: "video",
    name: "Golden Hour",
    description: "Rapper in yellow — golden hour chase",
    storagePath: "platform-templates/golden-hour.mp4",
    thumbnailPath: "/videos/thumbs/golden-hour.jpg",
    featured: true,
    featuredLabel: "⭐ Best",
  },

  // ── HeyGen hosted avatars ──────────────────────────────────────────────────
  {
    id: "heygen-avatar-1",
    kind: "heygen-avatar",
    name: "Studio Avatar I",
    description: "HeyGen studio avatar — expressive delivery",
    thumbnailPath: "/videos/thumbs/heygen-avatar-1.jpg",
    avatarId: "57dcf3cadb374112a00671f74c0516f4",
    voiceId: "m3Fp8hA8nS1Gc1Ne9FIf",
  },
  {
    id: "heygen-avatar-2",
    kind: "heygen-avatar",
    name: "Studio Avatar II",
    description: "HeyGen studio avatar — polished look",
    thumbnailPath: "/videos/thumbs/heygen-avatar-2.jpg",
    avatarId: "7b8687d287a34f71a5375b2d54627c29",
    voiceId: "m3Fp8hA8nS1Gc1Ne9FIf",
  },

  // ── Still photo ────────────────────────────────────────────────────────────
  {
    id: "street-floor",
    kind: "photo",
    name: "Street Floor",
    description: "Cinematic street-level still",
    storagePath: "platform-templates/street-floor.png",
    thumbnailPath: "/videos/thumbs/street-floor.jpg",
  },

  // ── Additional video clips ─────────────────────────────────────────────────
  {
    id: "surreal-street",
    kind: "video",
    name: "Surreal Street",
    description: "Surreal street performance",
    storagePath: "platform-templates/surreal-street.mp4",
    thumbnailPath: "/videos/thumbs/surreal-street.jpg",
  },
  {
    id: "avatar-casual",
    kind: "video",
    name: "Casual Avatar",
    description: "Natural, relaxed delivery",
    storagePath: "platform-templates/avatar-casual.mp4",
    thumbnailPath: "/videos/thumbs/avatar-casual.jpg",
  },
  {
    id: "avatar-iv",
    kind: "video",
    name: "Avatar IV",
    description: "Professional presenter style",
    storagePath: "platform-templates/avatar-iv.mp4",
    thumbnailPath: "/videos/thumbs/avatar-iv.jpg",
  },
  {
    id: "avatar-main",
    kind: "video",
    name: "Main Avatar",
    description: "Full-length signature avatar",
    storagePath: "platform-templates/avatar-main.mp4",
    thumbnailPath: "/videos/thumbs/avatar-main.jpg",
  },

  // ── Avatar V ────────────────────────────────────────────────────────────────
  {
    id: "avatar-v",
    kind: "video",
    name: "Avatar V",
    description: "High-energy performance — V series",
    storagePath: "platform-templates/avatar-v.mp4",
    thumbnailPath: "/videos/thumbs/avatar-v.jpg",
  },

  // ── Live Avatar (KlingAI) ────────────────────────────────────────────────────
  {
    id: "live-avatar",
    kind: "live",
    name: "Live Avatar",
    description: "KlingAI generates a cinematic avatar video from your script",
    thumbnailPath: "/videos/thumbs/heygen-avatar-1.jpg",
  },
];

export const FEATURED_TEMPLATES = PLATFORM_TEMPLATES.filter((t) => t.featured);
export const OTHER_TEMPLATES = PLATFORM_TEMPLATES.filter((t) => !t.featured);
