import { createFileRoute } from "@tanstack/react-router";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

// ssr: false is intentionally NOT set here — removing it lets TanStack Run the
// loader server-side so `head()` receives real loaderData and can emit the
// correct `noindex` meta tag during SSR. The actual page component renders
// only on the client (it lives in eromify.lazy.tsx) so there is no SSR HTML
// for the page content itself; only the <head> metadata is server-rendered.
export const Route = createFileRoute("/eromify")({
  loader: featureVisibilityLoader("adult-school"),
  head: ({ loaderData }) => ({
    meta: [featureVisibilityRobotsMeta(loaderData)],
  }),
});
