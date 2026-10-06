-- Aurora Baby Agent durable run state.
-- This table stores the immutable production plan and lifecycle only; actual
-- media/jobs remain in the existing generation/job tables.
create table if not exists public.aurora_baby_agent_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  brief text not null,
  plan jsonb not null default '{}'::jsonb,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aurora_baby_agent_runs_status_check check (
    status in ('planned','dispatching','queued','processing','qa','revising','rendering','succeeded','failed','cancelled')
  )
);

create index if not exists aurora_baby_agent_runs_user_updated_idx
  on public.aurora_baby_agent_runs (user_id, updated_at desc);

alter table public.aurora_baby_agent_runs enable row level security;

create policy "aurora baby runs are owner readable"
  on public.aurora_baby_agent_runs
  for select
  using (auth.uid() = user_id);

create policy "aurora baby runs are owner insertable"
  on public.aurora_baby_agent_runs
  for insert
  with check (auth.uid() = user_id);

create policy "aurora baby runs are owner updatable"
  on public.aurora_baby_agent_runs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_aurora_baby_agent_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aurora_baby_agent_runs_touch_updated_at on public.aurora_baby_agent_runs;
create trigger aurora_baby_agent_runs_touch_updated_at
before update on public.aurora_baby_agent_runs
for each row execute function public.touch_aurora_baby_agent_runs_updated_at();
