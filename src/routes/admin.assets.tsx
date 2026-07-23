import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/assets")({
  head: () => ({
    meta: [
      { title: "Asset Library — Aurora Admin" },
      { name: "description", content: "Curate outfit sheets and world/environment packs available to every user." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
