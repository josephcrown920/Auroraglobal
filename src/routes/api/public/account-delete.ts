// Account deletion — public endpoint for the mobile app (and future web UI).
// POST /api/public/account-delete   body: { confirm: "DELETE" }
//
// Required by Apple (App Store 5.1.1(v)) and Google Play's account-deletion
// policy: any app that offers account creation must let users delete the
// account in-app.
//
// Deletion strategy:
//   1. Best-effort recursive purge of every user-owned `studio` storage
//      namespace: <uid>/** (uploads, spin, video-agent, audio, avatars),
//      tts/<uid>/**, ffmpeg-free/<uid>/**, plus user_photo_avatars row paths.
//   2. Explicit row deletes for legacy core tables that have NO FK to
//      auth.users (generations / credit_ledger / profiles) — a cascade will
//      never clean these.
//   3. supabaseAdmin.auth.admin.deleteUser() — cascades every modern table
//      whose FK is ON DELETE CASCADE (avatars, sessions, chat, consents…).
// Retained on purpose: payments (financial records) and legal_acceptances
// (consent evidence) — permitted retention categories under store and data
// protection rules; they hold no media or free-form content.
//
// Bearer sessions only — deliberately NOT accepting aurk_* CLI API keys:
// account destruction must come from an interactive login, and a leaked CLI
// key must not be enough to erase an account.
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const Route = createFileRoute("/api/public/account-delete")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const h = request.headers.get("authorization") || request.headers.get("Authorization");
          if (!h?.startsWith("Bearer ") || h.slice(7).startsWith("aurk_")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: CORS,
            });
          }
          const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(h.slice(7));
          if (authError || !authData.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: CORS,
            });
          }
          const userId = authData.user.id;

          const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
          if (body?.confirm !== "DELETE") {
            return new Response(
              JSON.stringify({ error: 'Missing confirmation — send { "confirm": "DELETE" }' }),
              { status: 400, headers: CORS },
            );
          }

          // 1. Storage purge — exhaustive: recursive + paginated BFS over every
          // known user-owned namespace, plus row-recorded avatar paths (read
          // BEFORE the auth cascade deletes those rows). Best-effort: the
          // bucket is private and rows are deleted below, so a partial failure
          // only leaves orphaned bytes, never accessible data.
          //
          // Namespaces (see uploadBytesToStudio call sites):
          //   <uid>/...            uploads, spin/<job>/, video-agent/<proj>/, audio/, avatars/
          //   tts/<uid>/...        HF text-to-speech artifacts
          //   ffmpeg-free/<uid>/.. local ffmpeg assembles
          try {
            const bucket = supabaseAdmin.storage.from("studio");
            const { data: avatarRows } = await supabaseAdmin
              .from("user_photo_avatars")
              .select("storage_path")
              .eq("user_id", userId);
            const explicit = (avatarRows ?? []).map((r) => r.storage_path).filter(Boolean);

            const files: string[] = [];
            const queue = [userId, `tts/${userId}`, `ffmpeg-free/${userId}`];
            const LIMIT = 1000;
            const MAX_FILES = 20000;
            const MAX_DIRS = 2000;
            let dirs = 0;
            while (queue.length > 0 && files.length < MAX_FILES && dirs < MAX_DIRS) {
              const prefix = queue.shift() as string;
              dirs++;
              for (let offset = 0; ; offset += LIMIT) {
                const { data: entries, error } = await bucket.list(prefix, {
                  limit: LIMIT,
                  offset,
                });
                if (error) {
                  console.error(`[account-delete] list ${prefix}:`, error.message);
                  break;
                }
                for (const entry of entries ?? []) {
                  // Folders come back with id === null; files have an id.
                  if (entry.id === null) queue.push(`${prefix}/${entry.name}`);
                  else files.push(`${prefix}/${entry.name}`);
                }
                if (!entries || entries.length < LIMIT) break;
              }
            }
            if (files.length >= MAX_FILES || dirs >= MAX_DIRS) {
              console.error(
                `[account-delete] purge caps hit for ${userId} (${files.length} files, ${dirs} dirs) — remainder orphaned in private bucket`,
              );
            }

            const all = [...new Set([...explicit, ...files])];
            for (let i = 0; i < all.length; i += 100) {
              const { error } = await bucket.remove(all.slice(i, i + 100));
              if (error) console.error("[account-delete] storage remove:", error.message);
            }
          } catch (e) {
            console.error("[account-delete] storage purge failed:", e);
          }

          // 2. Legacy tables without an auth FK — explicit deletes, hard-fail
          // (an account must never look deleted while its data survives).
          for (const table of ["generations", "credit_ledger", "profiles"] as const) {
            const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
            if (error) {
              console.error(`[account-delete] ${table} delete failed:`, error.message);
              return new Response(
                // Generic + retry-safe: earlier deletes are idempotent no-ops
                // on a second attempt, and no internals are leaked.
                JSON.stringify({ error: "Account deletion incomplete — please try again." }),
                { status: 500, headers: CORS },
              );
            }
          }

          // 3. Auth user last — cascades all FK'd modern tables.
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (delErr) {
            console.error("[account-delete] auth deleteUser failed:", delErr.message);
            return new Response(
              JSON.stringify({
                error: "Account rows were cleared but auth deletion failed — contact support.",
              }),
              { status: 500, headers: CORS },
            );
          }

          console.log(`[account-delete] user ${userId} deleted`);
          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
        } catch (e) {
          // Log the detail server-side; never echo internals to the client.
          console.error("[account-delete] fatal:", e instanceof Error ? e.message : e);
          return new Response(
            JSON.stringify({ error: "Account deletion failed — please try again." }),
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
