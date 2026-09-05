import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/social-studio")({
  head: () => ({
    meta: [
      { title: "Aurora Marketing Studio — Aurora Admin" },
      { name: "description", content: "Plan, create, review, and export Aurora's official social campaigns." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
