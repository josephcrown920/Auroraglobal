-- Resumable Colors / Perform Anywhere workflow drafts.
-- Browser clients may only read their own row. All inserts, updates and deletes
-- are intentionally server-owned through the service-role server functions.
create table if not exists public.performance_workflow_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('colors', 'anywhere')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);

alter table public.performance_workflow_drafts enable row level security;
alter table public.performance_workflow_drafts force row level security;

revoke all on table public.performance_workflow_drafts from anon, authenticated;
grant select on table public.performance_workflow_drafts to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'performance_workflow_drafts'
      and policyname = 'performance_workflow_drafts_select_own'
  ) then
    create policy performance_workflow_drafts_select_own
      on public.performance_workflow_drafts
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

create index if not exists performance_workflow_drafts_updated_idx
  on public.performance_workflow_drafts (updated_at desc);