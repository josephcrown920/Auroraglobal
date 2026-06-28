-- Harden comfy_workflows publishing authz.
--
-- The base migration granted `authenticated` direct insert/update with a check of
-- only `auth.uid() = owner_user_id`. Because the browser holds the public
-- anon/publishable key, a non-admin could call PostgREST directly and create or
-- update their own row with `is_public = true` / `created_by_admin = true`,
-- bypassing the admin-only publish gate in the `saveComfyTemplate` server fn.
--
-- Admin publishing flows through the service-role server functions, which bypass
-- RLS entirely, so restricting the `authenticated` policies to private,
-- non-admin rows closes the bypass without affecting legitimate admin publishing
-- or a user's own private-template CRUD.

drop policy if exists "comfy_workflows_insert_own" on public.comfy_workflows;
create policy "comfy_workflows_insert_own" on public.comfy_workflows
  for insert to authenticated
  with check (auth.uid() = owner_user_id and is_public = false and created_by_admin = false);

drop policy if exists "comfy_workflows_update_own" on public.comfy_workflows;
create policy "comfy_workflows_update_own" on public.comfy_workflows
  for update to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id and is_public = false and created_by_admin = false);
