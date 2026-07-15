import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cli/authorize")({
  head: () => ({
    meta: [
      { title: "Authorize Aurora CLI" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
