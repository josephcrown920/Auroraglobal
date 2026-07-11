import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Aurora" },
      { name: "description", content: "Aurora internal admin console for operators." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

