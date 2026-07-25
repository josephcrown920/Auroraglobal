import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/photo-edit")({
  head: () => ({
    meta: [
      { title: "Photo Editor — Aurora" },
      {
        name: "description",
        content:
          "Upload any photo and describe one change — Aurora edits exactly that and keeps everything else untouched. No prompts to learn, no re-generation roulette.",
      },
      { property: "og:title", content: "Photo Editor — Aurora" },
      {
        property: "og:description",
        content: "Describe the change, keep the photo. One edit, one Aura.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/photo-edit` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/photo-edit` }],
  }),
});

