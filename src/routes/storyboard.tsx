import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/storyboard")({
  head: () => ({
    meta: [
      { title: "Storyboard — Music Video Shot Deck | Aurora" },
      {
        name: "description",
        content:
          "A 10-shot music-video storyboard built from your avatar and reference looks — camera language, wardrobe cues, and emotional purpose for every frame.",
      },
      { property: "og:title", content: "Storyboard — Music Video Shot Deck | Aurora" },
      {
        property: "og:description",
        content:
          "Mixed-vibe 10-shot sequence — Miami neon, studio editorial, street noir, and performance frames — to map the visual arc before production.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/storyboard" }],
  }),
});
