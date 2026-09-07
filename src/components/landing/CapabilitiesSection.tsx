import { Suspense, lazy } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { ScrollReveal } from "@/components/visual/ScrollReveal";
import { TOOL_DIRECTORY } from "@/lib/tool-directory";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForRoute } from "@/lib/feature-visibility";

const ModelSpotlight = lazy(() =>
  import("@/components/landing/ModelSpotlight").then((m) => ({ default: m.ModelSpotlight })),
);

const AppScreenshotsSection = lazy(() =>
  import("@/components/landing/AppScreenshotsSection").then((m) => ({ default: m.AppScreenshotsSection })),
);

const UGCAdsSection = lazy(() =>
  import("@/components/landing/UGCAdsSection").then((m) => ({ default: m.UGCAdsSection })),
);

const ViralEngine = lazy(() =>
  import("@/components/landing/ViralEngine").then((m) => ({ default: m.ViralEngine })),
);

const BalloonLipsync = lazy(() =>
  import("@/components/landing/BalloonLipsync").then((m) => ({ default: m.BalloonLipsync })),
);

const CliSection = lazy(() =>
  import("@/components/landing/CliSection").then((m) => ({ default: m.CliSection })),
);

const OutputGallery = lazy(() =>
  import("@/components/visual/OutputGallery").then((m) => ({ default: m.OutputGallery })),
);

import { DEMO_ASSETS } from "@/lib/demo-assets";

export function CapabilitiesSection() {
  const { showFeature } = useFeatureVisibility();

  return (
    <>
      <ScrollReveal><Suspense fallback={null}><ModelSpotlight /></Suspense></ScrollReveal>
      
      <ScrollReveal><Suspense fallback={null}><AppScreenshotsSection /></Suspense></ScrollReveal>
      <Suspense fallback={null}>
        <OutputGallery
          items={DEMO_ASSETS.landing.colors}
          kicker="Colors Studio"
          title="Grade the feeling before you commit."
          subtitle="Palette choices shown on finished Aurora frames, not color chips alone."
          className="px-5"
          showGalleryLink
        />
      </Suspense>

      {showFeature("ugc") && (
        <ScrollReveal>
          <Suspense fallback={null}><UGCAdsSection /></Suspense>
          <Suspense fallback={null}>
            <OutputGallery
              items={DEMO_ASSETS.landing.ugc}
              kicker="UGC proof"
              title="A brief people can see themselves in."
              subtitle="Creator presence, product focus, and the final campaign outcome in one visual story."
              className="px-5"
              showGalleryLink
            />
          </Suspense>
        </ScrollReveal>
      )}

      {showFeature("spin") && (
        <ScrollReveal>
          <Suspense fallback={null}><ViralEngine /></Suspense>
          <Suspense fallback={null}>
            <OutputGallery
              items={DEMO_ASSETS.landing.spin}
              kicker="TikTok30 proof"
              title="One direction. A month of distinct posts."
              subtitle="Templates, campaign stills, and moving vertical output from the same creative lane."
              className="px-5"
              showGalleryLink
            />
          </Suspense>
        </ScrollReveal>
      )}

      <Suspense fallback={null}><BalloonLipsync /></Suspense>

      <ScrollReveal><Suspense fallback={null}><CliSection /></Suspense></ScrollReveal>
      <Suspense fallback={null}>
        <OutputGallery
          items={DEMO_ASSETS.landing.canvas}
          kicker="Canvas workflow"
          title="Plan the world, then connect the shots."
          subtitle="Reference frames, scene direction, and a finished motion result in one visual workflow."
          className="px-5"
          showGalleryLink
        />
      </Suspense>
    </>
  );
}
