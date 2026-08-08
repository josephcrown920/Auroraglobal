import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/design")({
  head: () => ({
    meta: [
      { title: "Design Studio — Aurora Admin" },
      { name: "description", content: "Create, save, preview and activate front-end design skins for Aurora." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
