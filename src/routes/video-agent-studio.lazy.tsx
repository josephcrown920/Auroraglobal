import { createLazyFileRoute } from "@tanstack/react-router";
import { VideoAgentStudio } from "@/components/video-agent/VideoAgentStudio";

export const Route = createLazyFileRoute("/video-agent-studio")({
  component: VideoAgentStudio,
});
