import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /agent — the Orchestrate studio now lives on the Video page's
// "Generate" tab. Redirect keeps deep links (sitemap history, guided-workflow
// toolLinks stored in DB rows) working.
export const Route = createFileRoute("/orchestrate")({
  beforeLoad: () => {
    // "Generate" tab was retired — land on the Prime Director Workspace instead.
    throw redirect({ to: "/agent" });
  },
});
