import { createFileRoute } from "@tanstack/react-router";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/heygen-templates")({
  loader: featureVisibilityLoader("heygen-templates"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "HeyGen Templates — Aurora" },
      {
        name: "description",
        content:
          "Paste any HeyGen template ID and generate the same video with your own avatar or photo — one scene, infinite characters.",
      },
      featureVisibilityRobotsMeta(loaderData),
    ],
  }),
});

