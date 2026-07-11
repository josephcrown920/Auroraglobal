// Platform-level Talking Avatar Templates.
//
// These are pre-seeded video clips stored in the studio bucket under
// platform-templates/. Users pick one, type a script, Aurora generates
// TTS audio, then runs sync.so lipsync to make the person say the new words.
//
// Storage paths are signed at generation time (1-hour TTL) so the lipsync
// provider can fetch them. Thumbnails live in public/videos/thumbs/ and are
// served statically.

export type PlatformTemplate = {
  id: string;
  name: string;
  description: string;
  storagePath: string;
  thumbnailPath: string;
};

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    id: "man-on-floor",
    name: "Man on Floor",
    description: "Cinematic floor-level shot",
    storagePath: "platform-templates/man-on-floor.mp4",
    thumbnailPath: "/videos/thumbs/man-on-floor.jpg",
  },
  {
    id: "avatar-casual",
    name: "Casual Avatar",
    description: "Natural, relaxed delivery",
    storagePath: "platform-templates/avatar-casual.mp4",
    thumbnailPath: "/videos/thumbs/avatar-casual.jpg",
  },
  {
    id: "avatar-iv",
    name: "Avatar IV",
    description: "Professional presenter style",
    storagePath: "platform-templates/avatar-iv.mp4",
    thumbnailPath: "/videos/thumbs/avatar-iv.jpg",
  },
  {
    id: "avatar-main",
    name: "Main Avatar",
    description: "Full-length signature avatar",
    storagePath: "platform-templates/avatar-main.mp4",
    thumbnailPath: "/videos/thumbs/avatar-main.jpg",
  },
];
