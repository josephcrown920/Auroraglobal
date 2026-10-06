-- Singleton, service-role-only state for the bounded motion worker autoscaler.
-- The controller is cron-only: this row prevents concurrent scheduler ticks from
-- starting more than one paid Vast rental while retaining a durable cooldown.

create table if not exists public.motion_autoscale_state (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  cooldown_until timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  failure_reason text,
  decision_lease_until timestamptz,
  last_activity_at timestamptz,
  last_decision_at timestamptz,
  last_decision_action text,
  last_decision_provider text check (last_decision_provider in ('runpod', 'vast') or last_decision_provider is null),
  last_decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.motion_autoscale_state (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.motion_autoscale_state enable row level security;
revoke all on public.motion_autoscale_state from public, anon, authenticated;

-- The queue status query only reads the rows that can require motion capacity.
create index if not exists jobs_motion_autoscale_backlog_idx
  on public.jobs (created_at)
  where kind = 'motion'
    and status in ('queued', 'pending', 'processing', 'finalizing');

-- A short database-time lease serializes cron decisions. It is intentionally
-- independent of the Vast lifecycle's pre-create reservation: this blocks
-- duplicate decision work; the existing lifecycle partial unique index remains
-- the billable-create backstop.
create or replace function public.claim_motion_autoscale_decision(
  _action text,
  _provider text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  state_row public.motion_autoscale_state%rowtype;
begin
  if _action not in ('provision', 'destroy', 'readiness_timeout') then
    raise exception 'invalid_motion_autoscale_action';
  end if;
  if _provider not in ('vast', 'runpod') then
    raise exception 'invalid_motion_autoscale_provider';
  end if;

  select *
  into state_row
  from public.motion_autoscale_state
  where singleton = true
  for update;

  if not state_row.enabled
    or (state_row.cooldown_until is not null and state_row.cooldown_until > now())
    or (state_row.decision_lease_until is not null and state_row.decision_lease_until > now()) then
    return false;
  end if;

  update public.motion_autoscale_state
  set decision_lease_until = now() + interval '2 minutes',
      last_decision_at = now(),
      last_decision_action = _action,
      last_decision_provider = _provider,
      last_decision_reason = 'decision claimed',
      updated_at = now()
  where singleton = true;

  return true;
end;
$$;

revoke all on function public.claim_motion_autoscale_decision(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_motion_autoscale_decision(text, text)
  to service_role;