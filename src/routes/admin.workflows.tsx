import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/workflows")({
  head: () => ({
    meta: [
      { title: "Guided Workflows — Admin · Aurora" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
