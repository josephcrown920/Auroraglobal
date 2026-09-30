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
      { title: "Video Studio — Aurora" },
      {
        name: "description",
        content:
          "Direct an AI-assisted video edit, arrange clips, and render a polished 9:16 short-form video.",
      },
      { property: "og:title", content: "Video Studio — Aurora" },
      {
        property: "og:description",
        content: "Direct with AI · arrange clips · render with AutoCut.",
      },
      { property: "og:url", content: "https://auroraperformancestudio.com/edit" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/edit" }],
  }),
});
