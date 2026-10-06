import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// Route definition only — component is in video-agent-edit.lazy.tsx
export const Route = createFileRoute("/video-agent-edit")({
  validateSearch: z.object({ id: z.string().optional() }),
  beforeLoad: ({ search }) => {
    if (!search.id) throw redirect({ to: "/video-agent", replace: true });
  },
});
