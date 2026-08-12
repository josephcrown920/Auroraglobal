import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/social-studio")({
  head: () => ({
    meta: [
      { title: "Social Content Studio — Aurora Admin" },
      { name: "description", content: "Operator studio for producing on-brand social content assets." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
