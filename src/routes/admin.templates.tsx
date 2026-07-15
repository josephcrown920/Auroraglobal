import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/templates")({
  head: () => ({
    meta: [
      { title: "Template Review — Admin · Aurora" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
