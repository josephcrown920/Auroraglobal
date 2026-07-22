import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect Claude — Aurora MCP Connector" },
      { name: "description", content: "Connect Aurora to Claude in 5 minutes. Generate avatar images, talking UGC ads, videos and full campaigns from a chat — 13 MCP tools, one connection." },
      { property: "og:title", content: "Connect Claude — Aurora" },
      { property: "og:description", content: "Turn Claude into your creative engine. 13 tools, one connection — avatars, UGC ads, video and campaigns from chat." },
      { property: "og:url", content: "https://auroraperformancestudio.com/connect" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/connect" }],
  }),
});

