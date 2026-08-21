import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSpinner } from "@/components/PageSpinner";

function DefaultErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page hit an unexpected error. Refresh to try again.
        </p>
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

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
