import { createFileRoute } from "@tanstack/react-router";
import { safeAuthReturnPath } from "@/lib/auth-return-path";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { next?: string } => {
    // Only retain an internal, path-relative return location. This keeps
    // sign-in return links useful without turning the auth route into an
    // open redirect.
    return {
      next: safeAuthReturnPath(search.next),
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in — Aurora Performance Studio" },
      { name: "description", content: "Sign in or create an Aurora Performance Studio account. Built by artists, for artists and creators who need to scale." },
      { property: "og:title", content: "Sign in to Aurora Performance Studio" },
      { property: "og:description", content: "Sign in or create an account. Aurora Performance Studio — built for artists and creators." },
      { property: "og:url", content: "https://auroraperformancestudio.com/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/auth" }],
  }),
});
