import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cli/")({
  head: () => ({
    meta: [
      { title: "Aurora CLI — render images, video & lip-sync from your terminal" },
      {
        name: "description",
        content:
          "The Aurora CLI brings the whole studio to your command line. Generate images, video and lip-sync, script it, pipe it, drop it into CI — same models, same Aura.",
      },
      { property: "og:title", content: "Aurora CLI" },
      {
        property: "og:description",
        content:
          "Render images, video and lip-sync from your terminal. Script it, pipe it, automate it.",
      },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/cli" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/cli" }],
  }),
});
