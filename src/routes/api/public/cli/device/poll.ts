import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cli/device/poll")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { device_code } = (await request.json().catch(() => ({}))) as { device_code?: string };
        if (!device_code) {
          return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: cors });
        }
        const { data } = await supabaseAdmin
          .from("cli_device_codes")
          .select("status, api_key_plain, expires_at")
          .eq("device_code", device_code)
          .maybeSingle();
        if (!data) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });
        if (new Date(data.expires_at).getTime() < Date.now()) {
          return new Response(JSON.stringify({ error: "expired_token" }), { status: 410, headers: cors });
        }
        if (data.status !== "approved" || !data.api_key_plain) {
          return new Response(JSON.stringify({ error: "authorization_pending" }), { status: 202, headers: cors });
        }
        // One-shot: clear the plaintext key so it cannot be re-fetched.
        const apiKey = data.api_key_plain;
        await supabaseAdmin
          .from("cli_device_codes")
          .update({ api_key_plain: null, status: "consumed" })
          .eq("device_code", device_code);
        return new Response(JSON.stringify({ api_key: apiKey }), { status: 200, headers: cors });
      },
    },
  },
});