import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  GATEABLE_FEATURES,
  isFeatureKey,
  resolveHiddenKeys,
} from "@/lib/feature-visibility";
import {
  getFeatureOverrides,
  resetFeatureVisibility,
  setFeatureVisibility,
} from "@/lib/feature-visibility.server";

/**
 * Admin feature-visibility API. Two callers, two credentials (the standing
 * /api/admin/* duality): the /admin dashboard may send the shared owner
 * passcode as x-aurora-admin, or a signed-in admin's Supabase bearer token.
 * The bearer path is verified against the real `admin` role in user_roles.
 */
async function isAuthorized(request: Request): Promise<boolean> {
  const adminPass = process.env.ADMIN_PASSCODE ?? "";
  const passcode = request.headers.get("x-aurora-admin") ?? "";
  if (adminPass && passcode === adminPass) return true;

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) return false;

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(bearer);
  if (userErr || !userData.user) return false;

  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !!role;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function currentState() {
  const overrides = await getFeatureOverrides();
  const hidden = new Set(resolveHiddenKeys(overrides));
  return {
    features: GATEABLE_FEATURES.map((f) => ({
      key: f.key,
      label: f.label,
      description: f.description,
      defaultHidden: f.defaultHidden,
      override: overrides[f.key] ?? null,
      visible: !hidden.has(f.key),
    })),
  };
}

export const Route = createFileRoute("/api/admin/feature-visibility")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAuthorized(request))) return json({ error: "Forbidden" }, 403);
        return json(await currentState());
      },
      POST: async ({ request }) => {
        if (!(await isAuthorized(request))) return json({ error: "Forbidden" }, 403);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const o = (body ?? {}) as { key?: unknown; visible?: unknown; reset?: unknown };

        if (o.reset === true) {
          await resetFeatureVisibility();
          return json(await currentState());
        }
        if (!isFeatureKey(o.key) || typeof o.visible !== "boolean") {
          return json({ error: "Expected { key, visible } or { reset: true }" }, 400);
        }
        await setFeatureVisibility(o.key, o.visible);
        return json(await currentState());
      },
    },
  },
  component: () => null,
});
