import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/avatar")({
  head: () => ({
    meta: [
      { title: "Talking Avatar Studio — Aurora" },
      { name: "description", content: "Upload a photo, write a script, and get a studio-quality talking-head video. AI-powered lip sync with your voice — no camera or crew required." },
      { property: "og:title", content: "Talking Avatar Studio — Aurora" },
      { property: "og:description", content: "Photo + script = talking-head video. Studio-quality lip sync, your voice, zero crew." },
      { property: "og:url", content: "https://auroraperformancestudio.com/avatar" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/avatar" }],
  }),
});

