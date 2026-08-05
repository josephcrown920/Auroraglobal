// POST /api/adult-admin/generate
// Dedicated endpoint for the Aurora Adult School admin portal.
// Authentication: Authorization: Bearer <ADMIN_PASSCODE>
// Accepts base64 data-URLs in `base64Images`; uploads them server-side to the
// studio bucket (bypassing the SSRF guard that rejects data: URLs) then calls
// the shared credit/orchestrator core with the operator's admin userId.
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
          // ── 1. Validate admin passcode ──────────────────────────────────
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
          const expected = process.env.ADMIN_PASSCODE ?? "";
          if (!expected || token !== expected) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 401, headers: cors },
            );
          }

          // ── 2. Parse body ───────────────────────────────────────────────
          const body: unknown = await request.json();
          const data = Schema.parse(body);

          // ── 3. Resolve admin userId ─────────────────────────────────────
          const userId = await adminUserId();
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
