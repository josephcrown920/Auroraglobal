create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text,
  user_id uuid,
  session_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index events_created_at_idx on public.events (created_at desc);
create index events_name_idx on public.events (name);

alter table public.events enable row level security;

-- Anyone (anon + authenticated) can insert events for tracking
create policy "anyone can insert events"
  on public.events
  for insert
  to anon, authenticated
  with check (true);

-- Only admins can read events
create policy "admin reads events"
  on public.events
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));