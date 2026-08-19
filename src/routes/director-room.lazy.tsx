import { createLazyFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const StudioPage = lazy(() =>
  import("@/features/storyboard/studio/StudioPage").then(({ StudioPage }) => ({
    default: StudioPage,
  })),
);

export const Route = createLazyFileRoute("/director-room")({
  component: () => (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground grid place-items-center">
          <p className="text-sm text-muted-foreground">Loading your studio…</p>
        </div>
      }
    >
      <StudioPage />
    </Suspense>
  ),
});
