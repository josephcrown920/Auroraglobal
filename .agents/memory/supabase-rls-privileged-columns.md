---
name: Supabase RLS must guard privileged columns
description: Why tables that GRANT authenticated direct writes must restrict privileged columns in the RLS with-check
---

Any table that `grant ... insert/update ... to authenticated` is directly writable from the browser, because the client holds the public anon/publishable key (this repo exposes `VITE_SUPABASE_PUBLISHABLE_KEY` and uses it in client routes like tiktok.tsx). An RLS `with check` of only `auth.uid() = owner_user_id` does NOT stop a non-admin from setting privileged flags (e.g. `is_public`, `created_by_admin`) directly via PostgREST — bypassing any admin-only gate that lives only in a server function.

**Why:** the comfy_workflows base migration gated publishing solely in the `saveComfyTemplate` server fn, but that fn runs as service-role (`db()` → `supabaseAdmin`), which bypasses RLS. The RLS path for `authenticated` was the real attack surface and was unguarded → any logged-in user could publish a public/admin template.

**How to apply:** when a table grants direct `authenticated` writes AND has privileged columns enforced only in server code, add those columns to the RLS `with check` (e.g. `and is_public = false and created_by_admin = false`). Service-role server functions bypass RLS, so legitimate admin/privileged writes keep working. Alternatively revoke `authenticated` writes entirely and force all writes through service-role server fns (the gpu_workers pattern).
