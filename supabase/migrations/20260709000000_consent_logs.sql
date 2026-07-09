-- Persist voice/likeness consent acknowledgements so an in-app confirmation
-- can be relied on in a dispute (see AI & Content Policy). Append-only log;
-- no updates/deletes are ever performed by the app.
create table if not exists public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  policy_version text not null,
  consented_at timestamptz not null default now()
);

create index if not exists consent_logs_user_id_idx on public.consent_logs(user_id);

alter table public.consent_logs enable row level security;

-- Users may read their own consent history (transparency), but all writes go
-- through the service-role server function — never a direct client insert.
create policy "consent_logs_select_own" on public.consent_logs
  for select
  using (auth.uid() = user_id);
