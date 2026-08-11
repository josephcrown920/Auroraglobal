import { createFileRoute, redirect } from "@tanstack/react-router";

// /home was a second signed-in landing (persona toggle + tool rows) that
// competed with /studio and made the product feel like several different
// sites. Owner decision (2026-08-11): /studio is the ONLY signed-in front
// door — /home now just forwards there so old links and sessions never
// strand anyone on the retired page.
export const Route = createFileRoute("/home")({
  beforeLoad: () => {
    throw redirect({ to: "/studio" });
  },
});
