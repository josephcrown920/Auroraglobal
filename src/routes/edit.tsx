import { createFileRoute } from "@tanstack/react-router";
import { AUTOCUT_STYLE_IDS, type AutocutStyle } from "@/lib/template-studio";

// All-optional return type — required so existing <Link to="/edit"> calls
// without search params keep typechecking.
type EditSearch = { job?: string; style?: AutocutStyle };

export const Route = createFileRoute("/edit")({
  validateSearch: (search: Record<string, unknown>): EditSearch => ({
    job: typeof search.job === "string" ? search.job : undefined,
    style:
      typeof search.style === "string" &&
      (AUTOCUT_STYLE_IDS as readonly string[]).includes(search.style)
        ? (search.style as AutocutStyle)
        : undefined,
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
      { property: "og:url", content: "https://auroraperformancestudio.com/edit" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/edit" }],
  }),
});

