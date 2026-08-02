import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Aurora" },
      {
        name: "description",
        content: "Manage your Aurora account, Aura balance, plan, creator tools, and settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});