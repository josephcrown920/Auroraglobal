import { createFileRoute } from "@tanstack/react-router";
import { FREE_GPU_OPTIONS } from "../../lib/free-gpu";

export const Route = createFileRoute("/api/free-gpus")({
  server: { handlers: { GET: async () => Response.json({ providers: FREE_GPU_OPTIONS.map(p => ({ ...p, launcherUrl:p.launcherPath, notebookUrl:p.notebookPath })) }) } },
});
