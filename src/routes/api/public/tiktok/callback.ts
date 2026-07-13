// TikTok OAuth callback — receives the authorization code from TikTok and
// exchanges it for an access token, then redirects the user to /settings?tiktok=connected.
import { createFileRoute } from "@tanstack/react-router";
import { exchangeTiktokCode } from "@/lib/tiktok-posting.server";

export const Route = createFileRoute("/api/public/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");

        // TikTok sends error=access_denied when user cancels.
        if (errorParam) {
          return Response.redirect(
            new URL("/settings?tiktok=cancelled", url.origin).href,
            302,
          );
        }

        if (!code || !state) {
          return Response.redirect(
            new URL("/settings?tiktok=error&msg=missing_params", url.origin).href,
            302,
          );
        }

        try {
          const origin = `${url.protocol}//${url.host}`;
          await exchangeTiktokCode(code, state, origin);
          return Response.redirect(
            new URL("/settings?tiktok=connected", url.origin).href,
            302,
          );
        } catch (e) {
          const msg = encodeURIComponent(
            e instanceof Error ? e.message.slice(0, 120) : "unknown_error",
          );
          return Response.redirect(
            new URL(`/settings?tiktok=error&msg=${msg}`, url.origin).href,
            302,
          );
        }
      },
    },
  },
});
