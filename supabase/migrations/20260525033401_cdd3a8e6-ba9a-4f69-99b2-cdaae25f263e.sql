
-- GPU Workers registry
create table public.gpu_workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  endpoint_url text not null,
  auth_token text,
  region text default 'global',
  capabilities text[] not null default '{image}',
  models text[] not null default '{}',
  priority int not null default 100,
  status text not null default 'active',
  max_concurrency int not null default 4,
  in_flight int not null default 0,
  last_heartbeat timestamptz,
  created_at timestamptz not null default now()
);
alter table public.gpu_workers enable row level security;
create policy "admin manage workers" on public.gpu_workers for all to authenticated
  using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table public.worker_jobs (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.gpu_workers(id) on delete set null,
  user_id uuid,
  kind text not null,
  status text not null default 'queued',
  latency_ms int,
  cost_usd numeric,
  error text,
  ref_id uuid,
  created_at timestamptz not null default now()
);
alter table public.worker_jobs enable row level security;
create policy "admin reads worker jobs" on public.worker_jobs for select to authenticated
  using (has_role(auth.uid(),'admin'));

-- Workflows
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  graph jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workflows enable row level security;
create policy "wf self all" on public.workflows for all to authenticated
  using (auth.uid()=user_id or is_public=true) with check (auth.uid()=user_id);
create policy "wf admin read" on public.workflows for select to authenticated
  using (has_role(auth.uid(),'admin'));
create trigger workflows_touch before update on public.workflows
  for each row execute function public.touch_updated_at();

-- Affiliates
create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  code text not null unique,
  commission_pct int not null default 20,
  total_earned_usd numeric not null default 0,
  payout_email text,
  created_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
create policy "aff self read" on public.affiliates for select to authenticated using (auth.uid()=user_id);
create policy "aff self upsert" on public.affiliates for insert to authenticated with check (auth.uid()=user_id);
create policy "aff self update" on public.affiliates for update to authenticated using (auth.uid()=user_id);
create policy "aff admin read" on public.affiliates for select to authenticated using (has_role(auth.uid(),'admin'));

create table public.affiliate_events (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid,
  kind text not null,
  amount_usd numeric default 0,
  ref_id uuid,
  created_at timestamptz not null default now()
);
alter table public.affiliate_events enable row level security;
create policy "aff events insert anyone" on public.affiliate_events for insert to anon, authenticated with check (true);
create policy "aff events admin read" on public.affiliate_events for select to authenticated using (has_role(auth.uid(),'admin'));
create policy "aff events owner read" on public.affiliate_events for select to authenticated
  using (exists (select 1 from public.affiliates a where a.code = affiliate_events.code and a.user_id = auth.uid()));
