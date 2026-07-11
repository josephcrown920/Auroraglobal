import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tiktok")({
  head: () => ({
    meta: [
      { title: "Urban Cuts — Aurora" },
      { name: "description", content: "Upload one video. Aurora remixes it into up to 10 TikTok-ready cuts from different hooks, angles, and beats." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/tiktok" }],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">Error: {error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-muted-foreground">Not found.</div>,
});

