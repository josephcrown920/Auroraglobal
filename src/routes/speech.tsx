import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/speech")({
  head: () => ({
    meta: [
      { title: "Speech Studio · Aurora" },
      { name: "description", content: "Generate AI voiceovers and narration from text in seconds." },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/speech" }],
  }),
});

