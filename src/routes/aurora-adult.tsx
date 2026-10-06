// Keep the historical /aurora-adult URL as a compatibility entry point while
// Adult School now lives in the main TanStack app at /adult. Artist-only mode:
// regular users still land on /studio while the feature is hidden.
//
// NOTE: this must stay a client-side component guard (not a beforeLoad
// redirect) — SSR route guards don't reliably see browser session cookies in
// this project, so admin detection only works client-side.
import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/aurora-adult")({
  loader: featureVisibilityLoader("adult-school"),
  head: ({ loaderData }) => ({
    meta: [featureVisibilityRobotsMeta(loaderData)],
  }),
  component: AuroraAdultEntry,
});

function ForwardToArtifact() {
  useEffect(() => {
    window.location.replace("/adult");
  }, []);
  return null;
}

function AuroraAdultEntry() {
  return (
    <FeatureGuard feature="adult-school">
      <ForwardToArtifact />
    </FeatureGuard>
  );
}
