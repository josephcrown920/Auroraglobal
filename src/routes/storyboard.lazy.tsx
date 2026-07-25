import { createLazyFileRoute } from "@tanstack/react-router";
import { StoryboardGallery } from "@/components/storyboard/StoryboardGallery";

export const Route = createLazyFileRoute("/storyboard")({
  component: StoryboardPage,
});

function StoryboardPage() {
  return <StoryboardGallery />;
}
