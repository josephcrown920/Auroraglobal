import { createFileRoute } from "@tanstack/react-router";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/creator/dashboard")({
  loader: featureVisibilityLoader("creator-hub"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Creator Dashboard — Aurora" },
      { name: "description", content: "Submit templates and track your earnings on Aurora." },
      featureVisibilityRobotsMeta(loaderData),
    ],
  }),
});

