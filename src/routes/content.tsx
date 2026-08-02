import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/content")({
  head: () => ({
    meta: [
      { title: "Content — Aurora" },
      {
        name: "description",
        content: "Create UGC ads, TikTok content, lip-sync videos, and talking-avatar posts from one clear starting point.",
        },
      { name: "robots", content: "noindex" },
    ],
  }),
});