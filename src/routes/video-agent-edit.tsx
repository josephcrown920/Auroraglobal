import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Route definition only — component is in video-agent-edit.lazy.tsx
export const Route = createFileRoute("/video-agent-edit")({
  validateSearch: z.object({ id: z.string() }),
});
