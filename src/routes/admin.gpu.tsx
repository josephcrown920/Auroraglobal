import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/gpu")({
  head: () => ({
    meta: [
      { title: "GPU launch — Aurora admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
