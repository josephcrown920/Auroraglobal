import { createFileRoute, redirect } from "@tanstack/react-router";

// The Video Agent screen was removed. This redirect-only route keeps old
// entry points working instead of 404-ing them: bookmarks, previously
// indexed search results, and guided-workflow `toolLink` rows already
// stored in the database that still point at "/agent".
export const Route = createFileRoute("/agent")({
  beforeLoad: () => {
    throw redirect({ to: "/video-agent" });
  },
});
