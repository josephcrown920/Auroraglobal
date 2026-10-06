-- The actor-aware grant_credits migration added a five-argument function with
-- `_actor default null` but left the old four-argument function in place.
-- PostgREST cannot choose between those signatures when a caller supplies four
-- arguments, so grants fail with "Could not choose the best candidate function".
--
-- Keep the actor-aware function as the single API surface. SQL callers may
-- still omit `_actor` because its default remains NULL.
drop function if exists public.grant_credits(uuid, integer, text, uuid);

revoke execute on function public.grant_credits(uuid, integer, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, uuid, uuid)
  to service_role;