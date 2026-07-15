import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/guides" }],
    meta: [
      { title: "Viral Guides — Aurora" },
      {
        name: "description",
        content:
          "Step-by-step playbooks from viral AI music videos — follow along and generate every shot inside Aurora.",
      },
      { property: "og:title", content: "Viral Guides — Aurora" },
      {
        property: "og:description",
        content: "Proven viral video playbooks you can run step by step inside Aurora.",
      },
    ],
  }),
});
