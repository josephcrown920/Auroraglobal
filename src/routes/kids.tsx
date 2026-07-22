import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/kids")({
  head: () => ({
    meta: [
      { title: "Faceless Kids Story Studio — Aurora" },
      {
        name: "description",
        content:
          "Turn a simple brief into a finished faceless kids video — a narrated, illustrated story with gentle motion and royalty-free music, assembled into one MP4. Bedtime stories, nursery rhymes, educational shorts and little adventures.",
      },
      { property: "og:title", content: "Faceless Kids Story Studio — Aurora" },
      {
        property: "og:description",
        content:
          "A guided studio that writes, illustrates, animates and narrates a short kids story, then stitches it into a single ready-to-share video.",
      },
      { property: "og:url", content: "https://auroraperformancestudio.com/kids" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/kids" }],
  }),
});

