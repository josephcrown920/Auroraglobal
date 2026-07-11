import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/heygen-templates")({
  head: () => ({
    meta: [
      { title: "HeyGen Templates — Aurora" },
      {
        name: "description",
        content:
          "Paste any HeyGen template ID and generate the same video with your own avatar or photo — one scene, infinite characters.",
      },
    ],
  }),
});

