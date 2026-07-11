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

export type PlatformTemplateKind = "photo" | "video" | "heygen-avatar";

export type PlatformTemplate = {
  id: string;
  kind: PlatformTemplateKind;
  name: string;
  description: string;
  thumbnailPath: string;
  // photo / video templates
  storagePath?: string;
  // heygen-avatar templates
  avatarId?: string;
  voiceId?: string;
};

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  // ── HeyGen hosted avatars (high-quality, studio-grade) ─────────────────────
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

  // ── Still photo (HeyGen talking photo) ─────────────────────────────────────
  {
    id: "street-floor",
    kind: "photo",
    name: "Street Floor",
    description: "Cinematic street-level still",
    storagePath: "platform-templates/street-floor.png",
    thumbnailPath: "/videos/thumbs/street-floor.jpg",
  },

  // ── Video clips (sync.so lipsync) ──────────────────────────────────────────
  {
    id: "man-on-floor",
    kind: "video",
    name: "Man on Floor",
    description: "Floor-level performance clip",
    storagePath: "platform-templates/man-on-floor.mp4",
    thumbnailPath: "/videos/thumbs/man-on-floor.jpg",
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
];
