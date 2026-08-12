// /aurora-adult (no trailing slash) is the main app's entry point into the
// separate Adult School artifact at /aurora-adult/ (proxy path). Artist-only
// mode: regular users must not be forwarded there while the "adult-school"
// feature is hidden — they land on /studio instead. Admins pass straight
// through. The artifact keeps its own internal gate; this guards the entry.
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
    // Full-page navigation: /aurora-adult/ is served by the artifact proxy,
    // not the TanStack router.
    window.location.replace("/aurora-adult/");
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
