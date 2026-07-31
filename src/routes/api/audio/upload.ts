import { createFileRoute } from "@tanstack/react-router";

// Minimal audio upload endpoint — stores the file in Aurora's object storage
// and returns a public URL for LANDR to fetch.
export const Route = createFileRoute("/api/audio/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
          return new Response("Missing file", { status: 400 });
        }

        const allowed = /\.(mp3|wav|aiff|aif|flac|ogg)$/i;
        if (!allowed.test(file.name)) {
          return new Response("Unsupported audio format", { status: 400 });
        }

        if (file.size > 200 * 1024 * 1024) {
          return new Response("File must be under 200MB", { status: 400 });
        }

        // Use Aurora's object storage (PRIVATE_OBJECT_DIR / DEFAULT_OBJECT_STORAGE_BUCKET_ID)
        // Fall back to a data URL approach for LANDR if storage isn't configured.
        // LANDR needs a publicly accessible URL, so we use the object storage public path.
        try {
          // Dynamic import to avoid SSR issues with the storage SDK
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
          );

          const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
          const path = `mastering/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const arrayBuf = await file.arrayBuffer();

          const { error } = await supabase.storage
            .from("studio")
            .upload(path, arrayBuf, {
              contentType: file.type || "audio/mpeg",
              upsert: false,
            });

          if (error) throw new Error(error.message);

          const { data: urlData } = supabase.storage.from("studio").getPublicUrl(path);
          return new Response(JSON.stringify({ url: urlData.publicUrl, path }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
