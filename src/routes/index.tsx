import React, { Suspense, lazy } from "react";

const Hero = lazy(() => import("@/components/landing/Hero").then((m) => ({ default: m.Hero })));
const ProcessCards = lazy(() => import("@/components/landing/ProcessCards").then((m) => ({ default: m.ProcessCards })));
const FeaturesGrid = lazy(() => import("@/components/landing/FeaturesGrid").then((m) => ({ default: m.FeaturesGrid })));
const ProductShowcase = lazy(() => import("@/components/landing/ProductShowcase").then((m) => ({ default: m.ProductShowcase })));
const FeaturedTools = lazy(() => import("@/components/landing/FeaturedTools").then((m) => ({ default: m.FeaturedTools })));
const ToolsDirectory = lazy(() => import("@/components/landing/ToolsDirectory").then((m) => ({ default: m.ToolsDirectory })));
const Gallery = lazy(() => import("@/components/landing/Gallery").then((m) => ({ default: m.Gallery })));
const GalleryHighlights = lazy(() => import("@/components/landing/GalleryHighlights").then((m) => ({ default: m.GalleryHighlights })));
const Testimonials = lazy(() => import("@/components/landing/Testimonials").then((m) => ({ default: m.Testimonials })));
const PricingSection = lazy(() => import("@/components/landing/PricingSection").then((m) => ({ default: m.PricingSection })));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA").then((m) => ({ default: m.FinalCTA })));
const CollaboratorsStrip = lazy(() => import("@/components/landing/CollaboratorsStrip").then((m) => ({ default: m.CollaboratorsStrip })));
const FAQ = lazy(() => import("@/components/landing/FAQ").then((m) => ({ default: m.FAQ })));
const Newsletter = lazy(() => import("@/components/landing/Newsletter").then((m) => ({ default: m.Newsletter })));
const Footer = lazy(() => import("@/components/landing/Footer").then((m) => ({ default: m.Footer })));

export default function Index() {
  return (
    <main>
      <Suspense fallback={null}>
        <Hero />
      </Suspense>

      <Suspense fallback={null}>
        <ProcessCards />
      </Suspense>

      <Suspense fallback={null}>
        <FeaturesGrid />
      </Suspense>

      <Suspense fallback={null}>
        <ProductShowcase />
      </Suspense>

      <Suspense fallback={null}>
        <FeaturedTools />
      </Suspense>

      <Suspense fallback={null}>
        <ToolsDirectory />
      </Suspense>

      <Suspense fallback={null}>
        <Gallery />
      </Suspense>

      <Suspense fallback={null}>
        <GalleryHighlights />
      </Suspense>

      <Suspense fallback={null}>
        <Testimonials />
      </Suspense>

      <Suspense fallback={null}>
        <PricingSection />
      </Suspense>

      <Suspense fallback={null}>
        <FinalCTA />
      </Suspense>

      <Suspense fallback={null}>
        <CollaboratorsStrip />
      </Suspense>

      <Suspense fallback={null}>
        <FAQ />
      </Suspense>

      <Suspense fallback={null}>
        <Newsletter />
      </Suspense>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </main>
  );
}
