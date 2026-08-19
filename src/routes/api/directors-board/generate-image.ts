import { createFileRoute } from "@tanstack/react-router";
import { handleDirectorRoomImageRequest } from "@/lib/director-room-generate.server";

export const Route = createFileRoute("/api/directors-board/generate-image")({
  server: {
    handlers: {
      POST: ({ request }) => handleDirectorRoomImageRequest(request),
    },
  },
});
