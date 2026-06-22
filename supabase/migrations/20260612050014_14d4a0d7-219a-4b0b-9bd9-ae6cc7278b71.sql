create table public.smoke_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_cost_usd numeric(10,4) default 0,
  summary jsonb
);

create table public.smoke_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.smoke_runs(id) on delete cascade,
  step int not null,
  name text not null,
  status text not null default 'pending',
  latency_ms int,
  cost_usd numeric(10,4),
  output_url text,
  error text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index smoke_checks_run_idx on public.smoke_checks(run_id, step);

grant select, insert, update on public.smoke_runs to authenticated;
grant all on public.smoke_runs to service_role;
grant select, insert, update on public.smoke_checks to authenticated;
grant all on public.smoke_checks to service_role;

alter table public.smoke_runs enable row level security;
alter table public.smoke_checks enable row level security;

create policy "admin manages smoke runs" on public.smoke_runs
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "admin manages smoke checks" on public.smoke_checks
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));