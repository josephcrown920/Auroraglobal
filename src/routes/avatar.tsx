import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/avatar")({
  head: () => ({
    meta: [{ title: "Avatar Studio — Aurora" }],
  }),
});

