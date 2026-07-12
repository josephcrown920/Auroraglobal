import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/colors-show")({
  head: () => ({
    meta: [
      { title: "Colors Show Creator — Aurora" },
      {
        name: "description",
        content:
          "A 7-step guided wizard to build your Colors Show-style performance video: pick your color theme, outfit, shot types and energy — then generate cinematic studio stills in one click.",
      },
      { property: "og:title", content: "Colors Show Creator — Aurora" },
      {
        property: "og:description",
        content:
          "Upload your portrait, choose a color theme, and let Aurora generate wide and close-up performance stills — then animate them with Motion Control.",
      },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/colors-show" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/colors-show" }],
  }),
});
