// POST /api/adult-admin/generate
// Dedicated endpoint for the Aurora Adult School portal.
// Authentication (dual, verified SERVER-side):
//   1. Authorization: Bearer <verified Supabase user JWT> — the signed-in
//      creator generates and is charged on their OWN account (preferred path;
//      the client never holds a privileged credential).
//   2. Authorization: Bearer <ADMIN_PASSCODE> — legacy operator portal only;
//      charges the admin account.
// Accepts base64 data-URLs in `base64Images`; uploads them server-side to the
// studio bucket (bypassing the SSRF guard that rejects data: URLs) then calls
// the shared credit/orchestrator core with the resolved userId.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { GenerateKind } from "@/lib/orchestrator.server";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { computeCost, detectFeatures } from "@/lib/pricing";

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const Schema = z.object({
  kind: z.enum(["image", "video", "lipsync", "upscale"]),
  prompt: z.string().max(2000).optional(),
  /** Base64 data-URLs (data:<mime>;base64,<data>) — uploaded server-side. */
  base64Images: z.array(z.string().max(20_000_000)).max(4).optional(),
  editStrict: z.boolean().optional(),
  model: z.string().max(120).optional(),
  /** Adult School history metadata — persisted onto the authoritative
   *  generations row (model column) so the creator's private gallery can
   *  filter by model and recover the look label after reload. */
  historyModelId: z.string().max(80).regex(/^[a-z0-9_-]+$/i).optional(),
  historyLookId: z.string().max(80).regex(/^[a-z0-9_-]+$/i).optional(),
});

async function adminUserId(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function uploadBase64(
  b64DataUrl: string,
): Promise<string | null> {
  const match = b64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  const [, mime, b64] = match;
  const ext = (mime.split("/")[1] ?? "jpg").replace(/[^a-z0-9]/gi, "");
  const path = `adult-admin-refs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(b64, "base64");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (error) {
    console.error("[adult-admin/generate] upload error:", error.message);
    return null;
  }
  const { data: signed } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, 7200);
  return signed?.signedUrl ?? null;
}

export const Route = createFileRoute("/api/adult-admin/generate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        try {
          // ── 1. Authenticate: verified Supabase user JWT OR admin passcode ─
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
          if (!token) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 401, headers: cors },
            );
          }
          const expected = process.env.ADMIN_PASSCODE ?? "";
          let authedUserId: string | null = null;
          if (expected && token === expected) {
            // Legacy operator path — resolved to the admin account below.
            authedUserId = null;
          } else {
            // Creator path: the token must be a valid Supabase session JWT,
            // verified server-side. The creator is charged on their own account.
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
            if (userErr || !userData?.user?.id) {
              return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: cors },
              );
            }
            authedUserId = userData.user.id;
          }

          // ── 2. Parse body ───────────────────────────────────────────────
          const body: unknown = await request.json();
          const data = Schema.parse(body);

          // ── 3. Resolve billed userId ────────────────────────────────────
          // Creator JWT → the creator's own account; passcode → admin account.
          const userId = authedUserId ?? (await adminUserId());
          if (!userId) {
            return new Response(
              JSON.stringify({ error: "No admin user found — create an admin role first" }),
              { status: 500, headers: cors },
            );
          }

          // ── 4. Upload base64 images → signed storage URLs ───────────────
          const imageUrls: string[] = [];
          for (const b64 of data.base64Images ?? []) {
            const url = await uploadBase64(b64);
            if (url) imageUrls.push(url);
          }
          if ((data.base64Images ?? []).length > 0 && imageUrls.length === 0) {
            return new Response(
              JSON.stringify({ error: "Image upload failed — check studio bucket permissions" }),
              { status: 400, headers: cors },
            );
          }

          // ── 5. Price ────────────────────────────────────────────────────
          const { features } = detectFeatures({
            kind: data.kind as Parameters<typeof detectFeatures>[0]["kind"],
          });
          const quote = computeCost({ features });

          // ── 6. Reserve → orchestrate → commit ───────────────────────────
          const outcome = await reserveOrchestrateRecord({
            userId,
            kind: data.kind as GenerateKind,
            prompt: data.prompt,
            imageUrls: imageUrls.length ? imageUrls : undefined,
            model: data.model,
            editStrict: data.editStrict,
            cost: quote.total,
            reason: "adult_admin_generate",
          });

          if (!outcome.ok) {
            return new Response(
              JSON.stringify({ error: outcome.error }),
              { status: outcome.insufficient ? 402 : 400, headers: cors },
            );
          }

          // ── 7. Tag the authoritative generation row with Adult School
          //       metadata (single server-side row — the client never inserts
          //       its own history record). Failure to tag is logged, never
          //       fatal: the render is already delivered and charged.
          if (data.historyModelId) {
            const marker = data.historyLookId
              ? `adult-school/${data.historyModelId}/${data.historyLookId}`
              : `adult-school/${data.historyModelId}`;
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error: tagErr } = await supabaseAdmin
              .from("generations")
              .update({ model: marker })
              .eq("id", outcome.generationId)
              .eq("user_id", userId);
            if (tagErr) console.error("[adult-admin/generate] history tag failed:", tagErr.message);
          }

          return new Response(JSON.stringify(outcome), { status: 200, headers: cors });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Internal error";
          console.error("[adult-admin/generate]", msg);
          return new Response(
            JSON.stringify({ error: msg }),
            { status: 400, headers: cors },
          );
        }
      },
    },
  },
});
