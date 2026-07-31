import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Route definition only — component is in video-agent-process.lazy.tsx
export const Route = createFileRoute("/video-agent-process")({
  validateSearch: z.object({ id: z.string() }),
});
