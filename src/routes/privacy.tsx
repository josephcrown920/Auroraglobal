import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  beforeLoad: () => {
    throw redirect({
      to: "/legal/$slug",
      params: { slug: "privacy" },
      statusCode: 301,
    });
  },
});
