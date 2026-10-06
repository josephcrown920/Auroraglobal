-- Production readiness: aggregate daily spend in PostgreSQL so financial
-- guardrails never read an unbounded credit_ledger result set into Node.
create or replace function public.get_daily_spend(
  _user uuid,
  _day_start timestamptz
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(-delta), 0)
  from public.credit_ledger
  where user_id = _user
    and created_at >= _day_start
    and (reason like 'reserve:%' or reason like 'release:%');
$$;

revoke all on function public.get_daily_spend(uuid, timestamptz) from public;
revoke all on function public.get_daily_spend(uuid, timestamptz) from anon;
revoke all on function public.get_daily_spend(uuid, timestamptz) from authenticated;

-- The application invokes this through the server-side service-role client.
grant execute on function public.get_daily_spend(uuid, timestamptz) to service_role;

-- Supports the aggregation's user/time predicate.
create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at);
