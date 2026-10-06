// TikTok OAuth callback — receives the authorization code from TikTok and
// exchanges it for an access token, then redirects back to where the flow
// began (/settings or /promotion) with a ?tiktok= status param.
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

        // Default landing is Settings; a Promotion-started flow flips this.
        const target = (base: string, params: string) =>
          Response.redirect(new URL(`${base}${params}`, url.origin).href, 302);

        if (errorParam || !code || !state) {
          const params = errorParam
            ? "?tiktok=cancelled"
            : "?tiktok=error&msg=missing_params";
          // On cancel we don't know the origin page without a state lookup;
          // Settings is the historical default.
          return target("/settings", params);
        }

        try {
          const origin = `${url.protocol}//${url.host}`;
          const { returnTo } = await exchangeTiktokCode(code, state, origin);
          return target(returnTo, "?tiktok=connected");
        } catch (e) {
          const msg = encodeURIComponent(
            e instanceof Error ? e.message.slice(0, 120) : "unknown_error",
          );
          return target("/settings", `?tiktok=error&msg=${msg}`);
        }
      },
    },
  },
});
