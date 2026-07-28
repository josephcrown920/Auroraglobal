import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — Aurora Studio" },
      { name: "description", content: "Your personalised Aurora creative studio — recent work, featured tools, and quick-start actions in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
});
