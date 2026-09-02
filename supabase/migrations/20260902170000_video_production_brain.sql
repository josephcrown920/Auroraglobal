-- Canonical persistent Production Operating System state for every Aurora video agent.
create table if not exists public.video_production_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled production',
  brain jsonb not null,
  version integer not null default 1,
  status text not null default 'active' check (status in ('active','rendering','completed','failed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_production_projects_user_updated_idx
  on public.video_production_projects(user_id, updated_at desc);

alter table public.video_production_projects enable row level security;

drop policy if exists "video production projects owner read" on public.video_production_projects;
create policy "video production projects owner read"
  on public.video_production_projects for select
  using (auth.uid() = user_id);

drop policy if exists "video production projects owner insert" on public.video_production_projects;
create policy "video production projects owner insert"
  on public.video_production_projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "video production projects owner update" on public.video_production_projects;
create policy "video production projects owner update"
  on public.video_production_projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "video production projects owner delete" on public.video_production_projects;
create policy "video production projects owner delete"
  on public.video_production_projects for delete
  using (auth.uid() = user_id);

create or replace function public.touch_video_production_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists video_production_projects_touch_updated_at on public.video_production_projects;
create trigger video_production_projects_touch_updated_at
before update on public.video_production_projects
for each row execute function public.touch_video_production_projects_updated_at();
