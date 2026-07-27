import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/site-images")({
  head: () => ({
    meta: [
      { title: "Site Images — Aurora Admin" },
      { name: "description", content: "Swap every landing-page photo without touching code." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
