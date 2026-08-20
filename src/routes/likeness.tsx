import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/likeness")({
  head: () => ({
    meta: [
      { title: "Aurora Soul — Studio Shoot | Aurora" },
      {
        name: "description",
        content:
          "Lock your digital likeness once, then run music-synced multi-angle studio shoots — identity, wardrobe and environment held constant while camera and pose change per beat.",
      },
      { property: "og:title", content: "Aurora Soul — Studio Shoot | Aurora" },
      {
        property: "og:description",
        content:
          "Frozen face, frozen fit, twelve camera angles synced to your BPM — a real studio shoot with your avatar, in one click.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/likeness" }],
  }),
});
