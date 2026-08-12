import { createFileRoute } from "@tanstack/react-router";
import { SPIN_COUNT } from "@/lib/spin-engine";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/spin")({
  loader: featureVisibilityLoader("spin"),
  validateSearch: (search: Record<string, unknown>): { prompt?: string; jobId?: string } => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
    jobId: typeof search.jobId === "string" ? search.jobId : undefined,
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-white">Spin failed: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-white">Not found.</div>,
  head: ({ loaderData }) => ({
    meta: [
      { title: "TikTok 50 — Viral Post Generator · Aurora" },
      { name: "description", content: `Turn one prompt into ${SPIN_COUNT} scroll-stopping, high-variation posts — same face, endless looks. Ship a month of content in minutes.` },
      { property: "og:title", content: "TikTok 50 — Viral Post Generator · Aurora" },
      { property: "og:description", content: `${SPIN_COUNT} unique posts from one prompt. Same face, every outfit, every mood. Ship a month of content today.` },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/spin` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/spin` }],
  }),
});

