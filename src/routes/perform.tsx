import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/perform")({
  beforeLoad: () => {
    throw redirect({ to: "/live-studio", replace: true });
  },
});
