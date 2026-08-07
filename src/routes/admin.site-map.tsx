import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/site-map")({
  head: () => ({
    meta: [
      { title: "Site Map — Aurora Admin" },
      { name: "description", content: "Manage Aurora's page inventory and creator flow." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});