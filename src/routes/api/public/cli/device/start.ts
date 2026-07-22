import { createFileRoute } from "@tanstack/react-router";
import { newDeviceCode, newUserCode } from "@/lib/cli-device.server";

const BASE = process.env.SITE_URL?.trim() || "https://auroraperformancestudio.com";

export const Route = createFileRoute("/api/public/cli/device/start")({
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
      POST: async () => {
        const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const device_code = newDeviceCode();
        const user_code = newUserCode();
        const { error } = await supabaseAdmin.from("cli_device_codes").insert({
          device_code,
          user_code,
          status: "pending",
        });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        return new Response(
          JSON.stringify({
            device_code,
            user_code,
            verification_url: `${BASE}/cli/authorize`,
            verification_url_complete: `${BASE}/cli/authorize?code=${encodeURIComponent(user_code)}`,
            interval: 3,
            expires_in: 900,
          }),
          { status: 200, headers: cors },
        );
      },
    },
  },
});