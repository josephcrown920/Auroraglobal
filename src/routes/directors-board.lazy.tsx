import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/directors-board")({
  component: () => (
    <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
      Opening Director's Room…
    </div>
  ),
});
