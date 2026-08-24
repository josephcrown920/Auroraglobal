import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { safeErrorMessage } from "@/lib/safe-error.server";

const BUCKET = "site-images";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB per image

async function ensureBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
}

/**
 * Two callers, two credentials:
 *  • the /admin dashboard sends the shared owner passcode as x-aurora-admin
 *  • the "Edit landing" pill on the landing page sends the signed-in user's
 *    Supabase bearer token
 * Both are accepted, and the bearer path is verified against the real `admin`
 * role in user_roles — never trusted from the client.
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

type UploadResult = { key: string; url: string; skipped?: string };

async function storeOne(key: string, file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { key, url: "", skipped: "not an image" };
  }
  if (file.size > MAX_BYTES) {
    return { key, url: "", skipped: "larger than 10MB" };
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${key}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadErr) {
    safeErrorMessage(`upload-site-image:${key}`, uploadErr.message);
    return { key, url: "", skipped: "storage upload failed" };
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_images not yet in generated types.ts; cast until next type regen
  const { error: rowErr } = await (supabaseAdmin as any)
    .from("site_images")
    .upsert({ key, url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (rowErr) {
    safeErrorMessage(`upload-site-image:${key}`, rowErr.message);
    return { key, url: "", skipped: "database write failed" };
  }

  return { key, url: publicUrl };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/admin/upload-site-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAuthorized(request))) return json({ error: "Forbidden" }, 403);

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return json({ error: "Invalid form data" }, 400);
        }

        // Every write targets an existing slot. Unknown keys are reported back
        // as skipped rather than silently creating orphan rows the landing page
        // will never read.
        //
        // Fail CLOSED: if the slot list can't be read, or comes back empty, we
        // cannot tell a real slot from a junk one — so refuse the whole upload
        // rather than letting arbitrary keys through.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see note above
        const { data: slotRows, error: slotErr } = await (supabaseAdmin as any)
          .from("site_images")
          .select("key");
        if (slotErr) {
          return json({ error: safeErrorMessage("upload-site-image:slots", slotErr.message) }, 500);
        }
        const knownKeys = new Set<string>(((slotRows ?? []) as { key: string }[]).map((r) => r.key));
        if (knownKeys.size === 0) {
          return json({ error: "No image slots are configured — nothing can be uploaded yet." }, 409);
        }

        await ensureBucket();

        // Single-slot upload: explicit key + one file (the /admin dashboard).
        const single = formData.get("file");
        const explicitKey = (formData.get("key") as string | null)?.trim() ?? "";
        if (single instanceof File && explicitKey) {
          if (knownKeys.size && !knownKeys.has(explicitKey)) {
            return json({ error: `Unknown image slot "${explicitKey}"` }, 400);
          }
          const result = await storeOne(explicitKey, single);
          if (result.skipped) return json({ error: result.skipped }, 400);
          return json({ url: result.url, results: [result] });
        }

        // Bulk upload: key comes from each file's basename (the landing pill).
        const files = formData.getAll("files").filter((f): f is File => f instanceof File);
        if (!files.length) {
          return json({ error: "Missing file or key" }, 400);
        }

        const results: UploadResult[] = [];
        for (const f of files) {
          const key = (f.name.split("/").pop() ?? f.name).replace(/\.[^.]+$/, "").trim();
          if (!key) {
            results.push({ key: f.name, url: "", skipped: "unreadable file name" });
            continue;
          }
          if (knownKeys.size && !knownKeys.has(key)) {
            results.push({ key, url: "", skipped: "no matching slot" });
            continue;
          }
          results.push(await storeOne(key, f));
        }

        return json({ results });
      },
    },
  },
  component: () => null,
});
