-- Lock down site_images.
--
-- Every path that touches this table uses the SERVICE ROLE client, which bypasses
-- RLS entirely:
--   * read  — /api/public/site-images (supabaseAdmin)
--   * write — adminUpdateSiteImage / adminResetSiteImage server fns (supabaseAdmin)
--   * write — /api/admin/upload-site-image (supabaseAdmin, passcode gated)
-- Nothing reaches it with the anon or authenticated key.
--
-- The original site_images migration never enabled RLS, so Supabase's default
-- grants left anon holding INSERT/UPDATE/DELETE/TRUNCATE — i.e. anyone with the
-- publishable key could rewrite the landing page imagery. RLS on with zero
-- policies + revoked grants is the correct posture here: deny everything except
-- the service role.
-- Guarded: some environments have drifted and may not carry site_images at all.
-- Hardening a table that isn't there should be a no-op, not a failed migration.
do $$
begin
  if to_regclass('public.site_images') is null then
    raise notice 'public.site_images not present in this environment — nothing to harden';
    return;
  end if;
  execute 'alter table public.site_images enable row level security';
  execute 'revoke all on table public.site_images from anon';
  execute 'revoke all on table public.site_images from authenticated';
end $$;
