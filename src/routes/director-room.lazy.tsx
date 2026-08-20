import { createLazyFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const DirectorsRoomPage = lazy(() =>
  import("@/features/director-room/DirectorsRoomPage").then(
    ({ DirectorsRoomPage }) => ({
      default: DirectorsRoomPage,
    }),
  ),
);

export const Route = createLazyFileRoute("/director-room")({
  component: () => (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background text-foreground">
          <p className="text-sm text-muted-foreground">
            Loading Directors Room…
          </p>
        </div>
      }
    >
      <DirectorsRoomPage />
    </Suspense>
  ),
});
