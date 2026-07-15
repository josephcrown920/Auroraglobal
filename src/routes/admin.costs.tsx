import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/costs")({
  head: () => ({
    meta: [
      { title: "Cost Dashboard — Aurora Admin" },
      { name: "description", content: "Generation spend analytics by kind and day." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
