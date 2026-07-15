import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/smoke")({
  head: () => ({
    meta: [
      { title: "Smoke Test — Aurora Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
