create table if not exists public.performance_variant_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('colors', 'anywhere')),
  workflow_kind text not null check (workflow_kind in ('build_scene', 'luxury_interior')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode, workflow_kind)
);

alter table public.performance_variant_drafts enable row level security;
alter table public.performance_variant_drafts force row level security;
revoke all on public.performance_variant_drafts from anon, authenticated;
grant select on public.performance_variant_drafts to authenticated;

create policy performance_variant_drafts_select_own
  on public.performance_variant_drafts
  for select to authenticated
  using ((select auth.uid()) = user_id);