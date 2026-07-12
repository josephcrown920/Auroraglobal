import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/scene-builder")({
  head: () => ({
    meta: [
      { title: "Scene Builder — Aurora" },
      {
        name: "description",
        content:
          "Upload up to 5 reference images, write your scene description, pick your camera angles, and generate a fully composited cinematic scene — then animate it with Motion Control.",
      },
      { property: "og:title", content: "Scene Builder — Aurora" },
      {
        property: "og:description",
        content:
          "5-reference-image compositor: wide, low angle, side profile, close-up, over shoulder, Dutch angle. Your references, your scene, every angle.",
      },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/scene-builder" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/scene-builder" }],
  }),
});
