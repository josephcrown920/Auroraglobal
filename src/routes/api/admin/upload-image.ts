import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITE_IMAGE_DEFAULTS, type SiteImageKey } from "@/lib/site-images.shared";

const BUCKET = "site-images";

async function ensureBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAdminUser(request: Request): Promise<string | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.slice(7);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return json({ error: "Backend not configured" }, 500);

  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return json({ error: "Unauthorized" }, 401);

  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return json({ error: "Forbidden — admin only" }, 403);

  return data.user.id;
}

export const Route = createFileRoute("/api/admin/upload-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAdminUser(request);
        if (typeof auth !== "string") return auth;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Invalid form data" }, 400);
        }

        await ensureBucket();

        // Accept either a single (file,key) or bulk uploads via repeated
        // "files" entries. In bulk mode we match each file's basename to a
        // known SiteImageKey (e.g. hero_1.jpg → hero_1).
        const results: Array<{ key: string; url: string; skipped?: string }> = [];

        const singleFile = form.get("file") as File | null;
        const singleKey = form.get("key") as string | null;
        const bulkFiles = form.getAll("files").filter((f): f is File => f instanceof File);

        const targets: Array<{ file: File; key: string }> = [];
        if (singleFile && singleKey) targets.push({ file: singleFile, key: singleKey });

        for (const file of bulkFiles) {
          const base = (file.name.split("/").pop() ?? file.name).replace(/\.[^.]+$/, "").toLowerCase();
          const match = Object.keys(SITE_IMAGE_DEFAULTS).find((k) => k.toLowerCase() === base) as SiteImageKey | undefined;
          if (!match) {
            results.push({ key: base, url: "", skipped: "no matching slot" });
            continue;
          }
          targets.push({ file, key: match });
        }

        if (targets.length === 0) {
          return json({ error: "No files matched a known slot. Name files hero_1.jpg / creator_2.png etc., or use single upload." }, 400);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;

        for (const { file, key } of targets) {
          const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
          const path = `${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const buffer = new Uint8Array(await file.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });
          if (upErr) {
            results.push({ key, url: "", skipped: upErr.message });
            continue;
          }
          const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
          const publicUrl = urlData.publicUrl;
          await db
            .from("site_images")
            .upsert({ slug: key, url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: "slug" });
          results.push({ key, url: publicUrl });
        }

        return json({ results });
      },
    },
  },
  component: () => null,
});
