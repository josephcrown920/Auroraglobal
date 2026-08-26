import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/soul/train")({
  loader: featureVisibilityLoader("soul"),
  validateSearch: (search: Record<string, unknown>): { soulId?: string } => ({
    soulId: typeof search.soulId === "string" ? z.string().uuid().catch("").parse(search.soulId) || undefined : undefined,
  }),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Train Your Soul — Aurora" },
      { name: "description", content: "Upload at least 10 photos to train an identity-locked face LoRA." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/soul/train` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/soul/train` }],
  }),
});
