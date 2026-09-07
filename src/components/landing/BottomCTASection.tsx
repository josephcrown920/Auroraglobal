import { Suspense, lazy } from "react";

const PricingSection = lazy(() =>
  import("@/components/landing/PricingSection").then((m) => ({ default: m.PricingSection })),
);

const FinalCTA = lazy(() =>
  import("@/components/landing/FinalCTA").then((m) => ({ default: m.FinalCTA })),
);

const CollaboratorsStrip = lazy(() =>
  import("@/components/landing/CollaboratorsStrip").then((m) => ({ default: m.CollaboratorsStrip })),
);

export function BottomCTASection() {
  return (
    <>
      <Suspense fallback={null}><PricingSection /></Suspense>
      <Suspense fallback={null}><FinalCTA /></Suspense>
      <Suspense fallback={null}><CollaboratorsStrip /></Suspense>
    </>
  );
}
