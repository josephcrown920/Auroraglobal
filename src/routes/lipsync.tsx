import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lipsync")({
  // Deep-link prefill used by Guided Workflows (/guides/$slug): hand off a
  // generated still image straight into the image-based (xAI UGC) engine.
  validateSearch: (search: Record<string, unknown>): { image?: string } => ({
    image:
      typeof search.image === "string" && /^https:\/\//.test(search.image)
        ? search.image
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Lip Sync Studio — Aurora" },
      { name: "description", content: "Drop a clip and a vocal — Aurora's lip-sync studio matches mouth shapes to the audio frame-perfect." },
      { property: "og:title", content: "Lip Sync Studio — Aurora" },
      { property: "og:description", content: "Frame-perfect AI lip-sync. Bring a clip, a vocal, get a music video." },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/lipsync" }],
  }),
});

