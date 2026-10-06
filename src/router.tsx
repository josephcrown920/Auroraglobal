import { useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSpinner } from "@/components/PageSpinner";
import { isStaleChunkError, reloadOnceForStaleChunk } from "@/lib/stale-chunk";

/**
 * Route-level error fallback for EVERY route that doesn't declare its own.
 *
 * Two very different failure classes land here:
 * 1. Stale-build chunk failures (dev-server restart / redeploy while the tab
 *    was open): the running client references lazy chunks that no longer
 *    exist. A single reload fixes it — do that automatically, guarded so a
 *    genuinely broken build can never cause a reload loop.
 * 2. Real runtime/loader errors: keep the user on a branded, recoverable
 *    card. "Try again" re-runs the failed loaders in place — no full reload,
 *    no losing app state, and one page's crash never takes down the shell.
 */
function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [autoRecovering, setAutoRecovering] = useState(false);

  useEffect(() => {
    console.error("[route-error]", error);
    if (isStaleChunkError(error)) {
      if (reloadOnceForStaleChunk(window.location.pathname)) {
        setAutoRecovering(true);
      }
    }
  }, [error]);

  // The reload is already in flight — show a quiet spinner, not a scary card.
  if (autoRecovering) return <PageSpinner />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page hit an unexpected error. The rest of Aurora is unaffected — you can retry
          this page or head back.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              reset();
              void router.invalidate();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Reload page
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Fail fast and visibly: one retry, then let the page's error/empty
        // state render. The old default (3 retries, exponential backoff) kept
        // broken pages in a fake "loading" state for ~7s per query.
        retry: 1,
        staleTime: 30_000,
        gcTime: 10 * 60 * 1000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start fetching a route's lazy chunk (+ its lightweight loader) the moment
    // a link is hovered/focused, so the page is usually ready before the click.
    defaultPreload: "intent",
    // A preload stays fresh for 30s — hovering the same link twice in a row
    // must not re-run the loader. Route loaders here are all cheap (feature
    // visibility flags / static docs); heavy data stays in react-query, which
    // owns its own cache and is unaffected by this value.
    defaultPreloadStaleTime: 30_000,
    defaultErrorComponent: DefaultErrorComponent,
    defaultPendingComponent: PageSpinner,
    defaultPendingMs: 200,
  });

  return router;
};
