// POST /api/admin/verify-passcode
// Server-side admin passcode check for the Aurora Adult operator portal.
// Reads process.env.ADMIN_PASSCODE (never exposed to the client).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/verify-passcode")({
  component: () => null,
});

export const POST = async ({ request }: { request: Request }) => {
  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  let passcode = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    passcode = typeof body.passcode === "string" ? body.passcode : "";
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
      status: 400,
      headers: cors,
    });
  }

  const expected = process.env.ADMIN_PASSCODE ?? "";
  if (!expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "Admin passcode not configured on server" }),
      { status: 500, headers: cors },
    );
  }

  // Constant-time-ish delay to slow brute-force attempts.
  await new Promise<void>((r) => setTimeout(r, 400));

  const ok = passcode === expected;
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 403,
    headers: cors,
  });
};
