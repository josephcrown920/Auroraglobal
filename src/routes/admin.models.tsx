import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/models")({
  head: () => ({
    meta: [
      { title: "Model Watch — Aurora Admin" },
      { name: "description", content: "Newly released AI models spotted across providers." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
