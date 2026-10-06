import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/colors-show")({
  validateSearch: (search: Record<string, unknown>): { mode?: "anywhere"; flow?: "build_scene" | "luxury_interior" } => ({
    mode: search.mode === "anywhere" ? "anywhere" : undefined,
    flow: search.flow === "build_scene" || search.flow === "luxury_interior" ? search.flow : undefined,
  }),
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
      { property: "og:url", content: `${CANONICAL_ORIGIN}/colors-show` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/colors-show` }],
  }),
});
