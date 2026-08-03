-- Durable Video Agent projects. The browser is a client of this record, never
-- the source of truth for a paid render or its result.

create table if not exists public.video_agent_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  prompt text not null,
  title text not null default 'Untitled Video',
  style text not null default 'cinematic',
  voice text not null default 'narrator-warm',
  target_duration integer not null default 60 check (target_duration between 15 and 120),
  scenes jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  status_message text not null default 'Ready to plan',
  job_id uuid references public.jobs(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  export_url text,
  thumbnail_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_agent_projects_user_created_idx
  on public.video_agent_projects (user_id, created_at desc);
create index if not exists video_agent_projects_job_idx
  on public.video_agent_projects (job_id) where job_id is not null;

alter table public.video_agent_projects enable row level security;

create policy "Users read own video agent projects"
  on public.video_agent_projects for select
  using (auth.uid() = user_id);

create policy "Users create own video agent projects"
  on public.video_agent_projects for insert
  with check (auth.uid() = user_id);

create policy "Users update own video agent projects"
  on public.video_agent_projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger video_agent_projects_touch_updated
  before update on public.video_agent_projects
  for each row execute function public.touch_updated_at();