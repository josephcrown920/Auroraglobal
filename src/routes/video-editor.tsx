import { createFileRoute } from "@tanstack/react-router";

type VideoEditorSearch = { session?: string };

export const Route = createFileRoute("/video-editor")({
  validateSearch: (search: Record<string, unknown>): VideoEditorSearch => ({
    session: typeof search.session === "string" ? search.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI Video Editor — Aurora" },
      {
        name: "description",
        content:
          "Arrange clips, direct your edit in plain language, and export a polished short-form video — all from a conversational AI editor.",
      },
      { property: "og:title", content: "AI Video Editor — Aurora" },
      {
        property: "og:description",
        content: "Chat-directed video editing. Add clips, give commands, export.",
      },
      { property: "og:url", content: "https://auroraperformancestudio.com/editor/video" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/editor/video" }],
  }),
});
