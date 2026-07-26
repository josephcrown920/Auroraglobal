import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/orchestration")({
  head: () => ({
    meta: [
      { title: "Orchestration — Aurora Admin" },
      {
        name: "description",
        content: "Live view of AI provider fallback chains and worker health.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
