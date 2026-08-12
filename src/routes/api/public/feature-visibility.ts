import { createFileRoute } from "@tanstack/react-router";
import { getEffectiveHiddenKeys } from "@/lib/feature-visibility.server";
import { defaultHiddenKeys } from "@/lib/feature-visibility";

/**
 * Public read layer for feature visibility — same pattern as
 * /api/public/site-images: the client renders with bundled defaults during
 * SSR/first paint, then this endpoint delivers the live override state.
 * Fail-safe: any error returns the artist-only seeded defaults.
 */
export const Route = createFileRoute("/api/public/feature-visibility")({
  server: {
    handlers: {
      GET: async () => {
        let hidden: string[];
        try {
          hidden = await getEffectiveHiddenKeys();
        } catch {
          hidden = defaultHiddenKeys();
        }
        return new Response(JSON.stringify({ hidden }), {
          headers: {
            "Content-Type": "application/json",
            // Toggles must take effect without a redeploy — never cache long.
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
  component: () => null,
});
