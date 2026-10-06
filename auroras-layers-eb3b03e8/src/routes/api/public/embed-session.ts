import { createFileRoute } from "@tanstack/react-router";
import { embedCorsHeaders, isAllowedEmbedOrigin, normalizeEmbedOrigin } from "@/lib/embedCors";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_TRACKED_CLIENTS = 2_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...embedCorsHeaders(origin) },
  });
}

function clientAddress(request: Request): string {
  const forwarded =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function rateLimited(request: Request): boolean {
  const key = clientAddress(request);
  const now = Date.now();

  if (attempts.size > MAX_TRACKED_CLIENTS) {
    for (const [address, record] of attempts) {
      if (record.resetAt <= now) attempts.delete(address);
    }
  }

  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) return true;
  current.count += 1;
  return false;
}

export const Route = createFileRoute("/api/public/embed-session")({
  server: {
    handlers: {
      OPTIONS: ({ request }) =>
        new Response(null, {
          status: 204,
          headers: embedCorsHeaders(request.headers.get("origin")),
        }),

      POST: async ({ request }) => {
        const origin = request.headers.get("origin");

        if (rateLimited(request)) {
          return json({ error: "Too many session requests. Try again shortly." }, 429, origin);
        }

        const contentLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(contentLength) && contentLength > 10_240) {
          return json({ error: "Request body is too large." }, 413, origin);
        }

        let body: { token?: unknown; hostOrigin?: unknown };
        try {
          body = (await request.json()) as { token?: unknown; hostOrigin?: unknown };
        } catch {
          return json({ error: "Invalid JSON body." }, 400, origin);
        }

        const accessToken = typeof body.token === "string" ? body.token : "";
        const hostOrigin = normalizeEmbedOrigin(body.hostOrigin);
        if (accessToken.length === 0 || accessToken.length > 8192) {
          return json({ error: "A valid Aurora session token is required." }, 400, origin);
        }
        if (!hostOrigin || !isAllowedEmbedOrigin(hostOrigin)) {
          return json({ error: "This host is not approved for embed SSO." }, 403, origin);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
        const user = authData.user;

        if (authError || !user) {
          return json({ error: "Invalid or expired Aurora session." }, 401, origin);
        }

        if (!user.email) {
          return json({ error: "The Aurora account has no email address for embedded SSO." }, 400, origin);
        }

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: user.email,
        });

        if (error || !data?.properties?.hashed_token) {
          console.error("Could not create Aurora Layers session.", error);
          return json({ error: "Could not establish an embed session." }, 500, origin);
        }

        return json(
          { email: user.email, tokenHash: data.properties.hashed_token },
          200,
          origin,
        );
      },
    },
  },
});
