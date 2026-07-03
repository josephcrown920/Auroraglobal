-- Delete the grey-shirt "downtown rooftop at golden hour" generation the user no longer wants.
DELETE FROM public.generations WHERE id = '9a4e99c7-de85-4da7-82b2-ce545eb25202';

-- Lock down user_roles: only service_role may insert/update/delete (prevents self-promotion to admin).
DROP POLICY IF EXISTS "service role manages roles insert" ON public.user_roles;
DROP POLICY IF EXISTS "service role manages roles update" ON public.user_roles;
DROP POLICY IF EXISTS "service role manages roles delete" ON public.user_roles;

CREATE POLICY "service role manages roles insert" ON public.user_roles
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service role manages roles update" ON public.user_roles
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages roles delete" ON public.user_roles
  FOR DELETE TO service_role USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;