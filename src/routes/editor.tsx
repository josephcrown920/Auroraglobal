import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Aurora Playground — script the studio with code" },
      {
        name: "description",
        content:
          "An in-app code editor and playground. Write small scripts against the pre-authenticated aurora client to batch-generate images, video and lip-sync — same models, same Aura.",
      },
      { property: "og:title", content: "Aurora Playground" },
      {
        property: "og:description",
        content: "Script the whole studio from an in-app editor. Batches, pipelines, experiments.",
      },
    ],
  }),
});

