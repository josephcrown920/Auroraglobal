-- Multishot Studio projects and independently mutable shots.  Paid operations
-- always consume a server-side snapshot of these rows.
create table if not exists public.multishot_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Multishot',
  style text not null default '',
  aspect_ratio text not null default '16:9'
    check (aspect_ratio in ('16:9', '9:16', '1:1', '4:3', '3:4', '21:9')),
  reference_urls jsonb not null default '[]'::jsonb,
  identity_anchor text not null default '',
  strict_google_only boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.multishot_shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.multishot_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null check (position between 0 and 7),
  prompt text not null,
  engine text not null check (engine in (
    'google/gemini-3.1-flash-image-preview',
    'fal-ai/seedream-5'
  )),
  revision integer not null default 1 check (revision > 0),
  preview_status text not null default 'idle'
    check (preview_status in ('idle', 'processing', 'succeeded', 'failed')),
  preview_url text,
  preview_generation_id uuid references public.generations(id) on delete set null,
  requested_model text,
  serving_model text,
  fallback_used boolean not null default false,
  input_digest text,
  preview_error text,
  selected boolean not null default false,
  approval_digest text,
  approved_at timestamptz,
  temporal_status text not null default 'idle'
    check (temporal_status in ('idle', 'processing', 'succeeded', 'failed')),
  temporal_url text,
  temporal_generation_id uuid references public.generations(id) on delete set null,
  temporal_serving_model text,
  temporal_input_digest text,
  temporal_approval_digest text,
  temporal_approved_at timestamptz,
  temporal_error text,
  promoted_generation_id uuid references public.generations(id) on delete set null,
  promoted_url text,
  promoted_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, position)
);

create index if not exists multishot_projects_owner_updated_idx
  on public.multishot_projects(user_id, updated_at desc);
create index if not exists multishot_shots_project_position_idx
  on public.multishot_shots(project_id, position);

alter table public.multishot_projects enable row level security;
alter table public.multishot_shots enable row level security;

-- Browser clients may read their records, but every write (especially
-- approvals and serving provenance) goes through authenticated server
-- functions using the service role.
revoke all on table public.multishot_projects from anon, authenticated;
revoke all on table public.multishot_shots from anon, authenticated;
grant select on table public.multishot_projects to authenticated;
grant select on table public.multishot_shots to authenticated;

create policy "Owners read multishot projects" on public.multishot_projects
  for select using (auth.uid() = user_id);
create policy "Owners read multishot shots" on public.multishot_shots
  for select using (auth.uid() = user_id);

create trigger multishot_projects_touch_updated before update on public.multishot_projects
  for each row execute function public.touch_updated_at();
create trigger multishot_shots_touch_updated before update on public.multishot_shots
  for each row execute function public.touch_updated_at();
