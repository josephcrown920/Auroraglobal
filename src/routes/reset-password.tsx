import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — AURORA STUDIO" },
      { name: "description", content: "Choose a new password for your AURORA STUDIO account." },
      { name: "robots", content: "noindex" },
    ],
  }),
});
