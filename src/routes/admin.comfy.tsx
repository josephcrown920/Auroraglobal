import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/comfy")({
  head: () => ({
    meta: [
      { title: "ComfyUI admin — Aurora" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
