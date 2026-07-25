import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path — the program is now Aurora Partners.
export const Route = createFileRoute("/affiliate")({
  beforeLoad: () => {
    throw redirect({ to: "/partners" });
  },
});
