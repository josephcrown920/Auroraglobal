import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/soul/generate/video")({
  loader: featureVisibilityLoader("soul"),
  validateSearch: (search: Record<string, unknown>): { soulId?: string } => ({
    soulId: typeof search.soulId === "string" ? z.string().uuid().catch("").parse(search.soulId) || undefined : undefined,
  }),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Generate Video — Aurora Soul" },
      { name: "description", content: "Generate identity-locked video of your trained character." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/soul/generate/video` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/soul/generate/video` }],
  }),
});
