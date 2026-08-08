import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job Queue Dashboard — Aurora Performance Studio" },
      {
        name: "description",
        content:
          "Live status of every likeness lock, music-synced deck render, and ad-variation export — with per-job error logs.",
      },
      { property: "og:title", content: "Job Queue Dashboard — Aurora" },
      {
        property: "og:description",
        content: "One place to watch every render in your Aurora pipeline finish, retry, or fail loudly.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
