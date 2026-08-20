import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CANONICAL_ORIGIN } from "@/lib/seo";

type AdsSearch = { generationId?: string };

export const Route = createFileRoute("/ads")({
  validateSearch: (search: Record<string, unknown>): AdsSearch => {
    return z.object({ generationId: z.string().uuid().optional() }).parse(search);
  },
  head: () => ({
    meta: [
      { title: "Ads Studio — Aurora" },
      { name: "description", content: "Turn finished Aurora images and videos into Meta and TikTok-ready creative packs without generating a new asset." },
      { property: "og:title", content: "Ads Studio — Aurora" },
      { property: "og:description", content: "Build visual placements, copy sheets, and TikTok Spark Ads handoff packs from your finished work." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/ads` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/ads` }],
  }),
});