// Platform-level Talking Avatar Templates.
//
// Two kinds:
//   "video" — a full video clip; generation runs sync.so lipsync (sync/lipsync-2)
//             so the person appears to say the new script.
//   "photo" — a still image; generation runs HeyGen photo-video (heygen/photo-video)
//             to animate the face speaking the new script.
//
// Assets live in the studio bucket under platform-templates/.
// Thumbnails live in public/videos/thumbs/ and are served statically.

export type PlatformTemplateKind = "video" | "photo";

export type PlatformTemplate = {
  id: string;
  kind: PlatformTemplateKind;
  name: string;
  description: string;
  storagePath: string;
  thumbnailPath: string;
};

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    id: "street-floor",
    kind: "photo",
    name: "Street Floor",
    description: "Cinematic street-level still",
    storagePath: "platform-templates/street-floor.png",
    thumbnailPath: "/videos/thumbs/street-floor.jpg",
  },
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
