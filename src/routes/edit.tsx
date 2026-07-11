import { createFileRoute } from "@tanstack/react-router";
type EditSearch = { job?: string };

export const Route = createFileRoute("/edit")({
  validateSearch: (search: Record<string, unknown>): EditSearch => ({
    job: typeof search.job === "string" ? search.job : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AutoCut — Aurora" },
      {
        name: "description",
        content:
          "Drop your clips, pick a style and music, and Aurora cuts a polished 9:16 short-form video for you in minutes.",
      },
      { property: "og:title", content: "AutoCut — Aurora" },
      {
        property: "og:description",
        content: "Upload clips · pick a style · get a finished 9:16 short.",
      },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/edit" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/edit" }],
  }),
});

