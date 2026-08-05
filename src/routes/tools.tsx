import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Every Tool — Aurora Studio" },
      { name: "description", content: "Perform Anywhere, Colors, TikTok30, Video Agent, Music Video, Lip Sync, Motion Control. 7 AI tools built for artists." },
    ],
  }),
});
