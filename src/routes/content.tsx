import { createFileRoute } from "@tanstack/react-router";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/content")({
  loader: featureVisibilityLoader("content-funnel"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Content — Aurora" },
      {
        name: "description",
        content: "Create UGC ads, TikTok content, lip-sync videos, and talking-avatar posts from one clear starting point.",
        },
      featureVisibilityRobotsMeta(loaderData),
    ],
  }),
});