// POST /api/admin/verify-passcode
// Server-side admin passcode check for the Aurora Adult operator portal.
// Reads process.env.ADMIN_PASSCODE (never exposed to the client).
import { createFileRoute } from "@tanstack/react-router";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/admin/verify-passcode")({
  component: () => null,
});

export const POST = async ({ request }: { request: Request }) => {
  // Same-origin callers need no CORS header; deliberately omitting
  // Access-Control-Allow-Origin keeps cross-origin pages from reading the
  // response, which removes the easiest online brute-force channel.
  const headers = {
    "Content-Type": "application/json",
  };

  // Brute-force throttle: shared sliding-window limiter keyed by client IP
  // (instance-local floor — the constant-time delay below plus the removal of
  // cross-origin read access are the primary barriers).
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  try {
    assertRateLimit(`verify-passcode:${ip}`, 10, 60_000);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return new Response(JSON.stringify({ ok: false, error: "Too many attempts" }), {
        status: 429,
        headers,
      });
    }
    throw e;
  }

  let passcode = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    passcode = typeof body.passcode === "string" ? body.passcode : "";
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
      status: 400,
      headers,
    });
  }

  const expected = process.env.ADMIN_PASSCODE ?? "";
  if (!expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "Admin passcode not configured on server" }),
      { status: 500, headers },
    );
  }

  // Constant-time-ish delay to slow brute-force attempts.
  await new Promise<void>((r) => setTimeout(r, 400));

  const ok = passcode === expected;
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 403,
    headers,
  });
};
