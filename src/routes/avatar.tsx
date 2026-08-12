import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/avatar")({
  loader: featureVisibilityLoader("talking-avatars"),
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "script" | "preview" | "avatars" | "shots" } => ({
    tab:
      search.tab === "script" ||
      search.tab === "preview" ||
      search.tab === "avatars" ||
      search.tab === "shots"
        ? search.tab
        : undefined,
  }),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Talking Avatar Studio — Aurora" },
      { name: "description", content: "Upload a photo, write a script, and get a studio-quality talking-head video. AI-powered lip sync with your voice — no camera or crew required." },
      { property: "og:title", content: "Talking Avatar Studio — Aurora" },
      { property: "og:description", content: "Photo + script = talking-head video. Studio-quality lip sync, your voice, zero crew." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/avatar` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/avatar` }],
  }),
});

