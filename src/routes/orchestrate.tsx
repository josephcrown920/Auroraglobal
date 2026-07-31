import { createFileRoute, redirect } from "@tanstack/react-router";

// The Orchestrate studio was retired and the Video Agent screen that
// absorbed it has been removed. The full Studio replaces both. This
// redirect keeps deep links working — sitemap history and guided-workflow
// `toolLink` rows already stored in the database.
export const Route = createFileRoute("/orchestrate")({
  beforeLoad: () => {
    throw redirect({ to: "/studio" });
  },
});
