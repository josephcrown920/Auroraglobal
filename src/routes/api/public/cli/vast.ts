// POST /api/public/cli/vast — owner/admin-only Vast GPU lifecycle control
// plane for the Aurora CLI (`aurora vast …`).
//
// Auth: Bearer aurk_ CLI API key or Supabase JWT → user must be an admin
// (user_roles.role = 'admin'). Every guardrail (price ceiling, 1-hour runtime
// cap, explicit confirm token, managed-only scope) is enforced server-side in
// vast-lifecycle.server.ts — the CLI is a thin display layer.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const JSON_H = { "Content-Type": "application/json" };

async function authAdminUserId(req: Request): Promise<string | null> {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  let userId: string | null = null;
  if (token.startsWith("aurk_")) {
    const { userIdForApiKey } = await import("@/lib/cli-device.server");
    userId = await userIdForApiKey(token);
  } else {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    userId = error || !data.user ? null : data.user.id;
  }
  if (!userId) return null;
  const { isAdmin } = await import("@/lib/admin.server");
  return (await isAdmin(userId)) ? userId : null;
}

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), minGpuRamGb: z.number().min(1).max(200).optional(), limit: z.number().int().min(1).max(20).optional() }),
  z.object({
    action: z.literal("provision"),
    offerId: z.number().int().positive(),
    hourlyUsd: z.number().positive(),
    confirmToken: z.string().min(10),
    tasks: z.string().max(120).optional(),
    name: z.string().max(60).optional(),
  }),
  z.object({ action: z.literal("adopt"), vastInstanceId: z.number().int().positive() }),
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("stop"), instance: z.string().min(1) }),
  z.object({ action: z.literal("destroy"), instance: z.string().min(1) }),
]);

export const Route = createFileRoute("/api/public/cli/vast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await authAdminUserId(request);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized — Vast lifecycle is owner-only" }), {
            status: 401,
            headers: JSON_H,
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: JSON_H });
        }
        const parsed = ActionSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Bad request" }), {
            status: 400,
            headers: JSON_H,
          });
        }

        const { liveVastLifecycle } = await import("@/lib/vast-lifecycle-live.server");
        const { VastGuardrailError } = await import("@/lib/vast-lifecycle.server");
        const { VastApiError } = await import("@/lib/vast-api.server");

        try {
          const lc = liveVastLifecycle();
          const a = parsed.data;
          let result: unknown;
          switch (a.action) {
            case "search":
              result = { proposals: await lc.search({ minGpuRamGb: a.minGpuRamGb, limit: a.limit }) };
              break;
            case "provision": {
              const registerSecret = process.env.AURORA_REGISTER_SECRET ?? "";
              result = {
                instance: await lc.provision({
                  offerId: a.offerId,
                  hourlyUsd: a.hourlyUsd,
                  confirmToken: a.confirmToken,
                  userId,
                  tasks: a.tasks,
                  name: a.name,
                  registerSecret,
                }),
              };
              break;
            }
            case "adopt":
              result = { instance: await lc.adopt(a.vastInstanceId, userId) };
              break;
            case "status": {
              // Enrich with linked worker registration status so the CLI can
              // show "registered & approved" vs "waiting for registration".
              const rows = await lc.status();
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const endpoints = rows.map((r) => r.endpoint_url).filter((e): e is string => !!e);
              let workers: Array<{ id: string; name: string; status: string; endpoint_url: string }> = [];
              if (endpoints.length > 0) {
                const { data } = await supabaseAdmin
                  .from("gpu_workers")
                  .select("id, name, status, endpoint_url")
                  .in("protocol", ["vast"]);
                workers = (data ?? []) as typeof workers;
              }
              result = {
                instances: rows.map((r) => ({
                  ...r,
                  worker: workers.find((w) => r.endpoint_url && w.endpoint_url.startsWith(r.endpoint_url)) ?? null,
                })),
              };
              break;
            }
            case "stop":
              result = { instance: await lc.stop(a.instance) };
              break;
            case "destroy":
              result = { instance: await lc.destroy(a.instance, "destroyed via CLI") };
              break;
          }
          return new Response(JSON.stringify({ ok: true, ...(result as object) }), { status: 200, headers: JSON_H });
        } catch (e) {
          if (e instanceof VastGuardrailError) {
            return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 409, headers: JSON_H });
          }
          if (e instanceof VastApiError) {
            return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 502, headers: JSON_H });
          }
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: JSON_H });
        }
      },
    },
  },
});
