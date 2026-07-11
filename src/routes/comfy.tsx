import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/comfy")({
  head: () => ({
    meta: [
      { title: "ComfyUI — Aurora Studio" },
      {
        name: "description",
        content: "Run saved ComfyUI workflows on your own GPU workers, with declared inputs and live results.",
      },
    ],
  }),
});

