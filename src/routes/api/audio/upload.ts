import { createFileRoute } from "@tanstack/react-router";

// Audio upload (Mastering / Live Studio source files).
//
// Bearer session REQUIRED (aurk_* CLI keys rejected): the file lands in the
// caller's own namespace — <uid>/mastering/<ts>-<rand>.<ext> — so the
// account-deletion storage purge can discover and remove it. The previous
// version wrote unauthenticated, service-role uploads to anonymous
// mastering/<timestamp> paths: undeletable per-user (a Play/App Store
// compliance gap) and an open door for arbitrary storage consumption.
//
// Returns a 24h signed URL — the studio bucket is private, so getPublicUrl
// links don't resolve; LANDR (and the player UI) fetch via the signed URL.
const JSON_HEADERS = { "Content-Type": "application/json" };

export const Route = createFileRoute("/api/audio/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const h = request.headers.get("authorization") || request.headers.get("Authorization");
          if (!h?.startsWith("Bearer ") || h.slice(7).startsWith("aurk_")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: JSON_HEADERS,
            });
          }
          const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(h.slice(7));
          if (authError || !authData.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: JSON_HEADERS,
            });
          }
          const userId = authData.user.id;

          const formData = await request.formData();
          const file = formData.get("file");
          if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: "Missing file" }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          const allowed = /\.(mp3|wav|aiff|aif|flac|ogg)$/i;
          if (!allowed.test(file.name)) {
            return new Response(JSON.stringify({ error: "Unsupported audio format" }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          if (file.size > 200 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: "File must be under 200MB" }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }

          const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
          const path = `${userId}/mastering/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
          const arrayBuf = await file.arrayBuffer();

          const { error } = await supabaseAdmin.storage.from("studio").upload(path, arrayBuf, {
            contentType: file.type || "audio/mpeg",
            upsert: false,
          });
          if (error) throw new Error(error.message);

          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from("studio")
            .createSignedUrl(path, 60 * 60 * 24);
          if (signErr || !signed?.signedUrl) {
            throw new Error(signErr?.message ?? "Failed to sign URL");
          }

          return new Response(JSON.stringify({ url: signed.signedUrl, path }), {
            headers: JSON_HEADERS,
          });
        } catch (err) {
          // Log detail server-side; never echo storage internals to the client.
          console.error("[audio-upload]", err instanceof Error ? err.message : err);
          return new Response(JSON.stringify({ error: "Upload failed" }), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }
      },
    },
  },
});
