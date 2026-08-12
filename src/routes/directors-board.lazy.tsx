import { createLazyFileRoute } from "@tanstack/react-router";
import { StudioPage } from "@/features/storyboard/studio/StudioPage";

export const Route = createLazyFileRoute("/directors-board")({
  component: StudioPage,
});
