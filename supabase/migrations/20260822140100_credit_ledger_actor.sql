-- Admin/billing auditability: credit_ledger currently records delta/reason/
-- ref_id/created_at but not WHO performed a grant. For ordinary purchase and
-- system grants that is fine (the reason + ref already say why), but for
-- admin-initiated adjustments ("admin_grant") there was no way to tell which
-- admin account made the change.
--
-- Adds a nullable actor_id column (null for non-admin/system grants, which
-- keeps every existing ledger row and every existing 4-arg grant_credits call
-- site working unchanged) and an optional 5th `_actor` parameter to
-- grant_credits with a default of NULL, so this is purely additive.
alter table public.credit_ledger add column if not exists actor_id uuid;

comment on column public.credit_ledger.actor_id is
  'User id of the admin/operator who initiated this ledger entry (e.g. admin_grant). NULL for purchases, system grants, and user-initiated spends.';

create or replace function public.grant_credits(
  _user uuid,
  _amount integer,
  _reason text,
  _ref uuid,
  _actor uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set credits = credits + _amount where id = _user;
  if _reason = 'purchase' then
    update public.profiles set lifetime_credits_purchased = lifetime_credits_purchased + _amount where id = _user;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref_id, actor_id) values (_user, _amount, _reason, _ref, _actor);
end; $$;

-- Re-grant execute: replacing the function definition does not change its
-- privileges, but PostgreSQL registers the 5-arg overload as a distinct
-- function signature that needs its own explicit grant.
revoke execute on function public.grant_credits(uuid, integer, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, uuid, uuid) to service_role;
