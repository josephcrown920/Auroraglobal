import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guides/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: "Viral Guide — Aurora" },
      { name: "description", content: "Run a viral video playbook step by step inside Aurora." },
    ],
    links: [{ rel: "canonical", href: `https://aurorastudiostar.lovable.app/guides/${params.slug}` }],
  }),
});
