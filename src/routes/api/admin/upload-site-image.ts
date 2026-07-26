import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "site-images";

async function ensureBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
}

export const Route = createFileRoute("/api/admin/upload-site-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminPass = process.env.ADMIN_PASSCODE ?? "";
        const token = request.headers.get("x-aurora-admin") ?? "";
        if (!adminPass || token !== adminPass) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
        }

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid form data" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const file = formData.get("file") as File | null;
        const key = (formData.get("key") as string | null) ?? "";
        if (!file || !key) {
          return new Response(JSON.stringify({ error: "Missing file or key" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        await ensureBucket();

        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${key}/${Date.now()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType: file.type, upsert: true });

        if (uploadErr) {
          return new Response(JSON.stringify({ error: uploadErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_images table not yet in generated types.ts; cast until next type regen
        await (supabaseAdmin as any)
          .from("site_images")
          .upsert({ key, url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });

        return new Response(JSON.stringify({ url: publicUrl }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
  component: () => null,
});
