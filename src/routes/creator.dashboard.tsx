import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/creator/dashboard")({
  head: () => ({
    meta: [
      { title: "Creator Dashboard — Aurora" },
      { name: "description", content: "Submit templates and track your earnings on Aurora." },
    ],
  }),
});

