import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/avatar")({
  head: () => ({
    meta: [
      { title: "Talking Avatar Studio — Aurora" },
      { name: "description", content: "Upload a photo, write a script, and get a studio-quality talking-head video. AI-powered lip sync with your voice — no camera or crew required." },
      { property: "og:title", content: "Talking Avatar Studio — Aurora" },
      { property: "og:description", content: "Photo + script = talking-head video. Studio-quality lip sync, your voice, zero crew." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/avatar` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/avatar` }],
  }),
});

