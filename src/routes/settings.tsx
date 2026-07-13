import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, string>) => ({
    tiktok: (search["tiktok"] as string | undefined) ?? undefined,
    msg: (search["msg"] as string | undefined) ?? undefined,
  }),
}).lazy(() => import("./settings.lazy").then((d) => d.Route));
