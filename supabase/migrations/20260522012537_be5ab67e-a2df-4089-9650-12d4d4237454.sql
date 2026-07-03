
create or replace function public.touch_updated_at()
returns trigger language plpgsql
security invoker
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

revoke execute on function public.deduct_credits(uuid, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
