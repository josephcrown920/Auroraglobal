-- ComfyUI integration: saved workflow templates + run history.
-- Additive only. `comfy_workflows` holds a reusable ComfyUI /prompt graph plus a
-- declared-input schema (which "nodeId.inputName" fields the UI exposes) so users
-- can run a graph without editing JSON. `comfy_runs` records each execution
-- (status / progress / prompt_id / output) so the run page, admin tools, and
-- canvas can show live state and history.
--
-- Templates: owner can CRUD their own; everyone can READ public templates.
-- Admin-authored public templates are written through the service-role server
-- functions (which assert admin), so RLS only needs owner + public-read.
-- Runs are strictly owner-scoped.

create table if not exists public.comfy_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'image' check (kind in ('image', 'video')),
  workflow_json jsonb not null default '{}'::jsonb,
  declared_inputs jsonb not null default '[]'::jsonb,
  default_inputs jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comfy_workflows_owner_updated_idx
  on public.comfy_workflows (owner_user_id, updated_at desc);
create index if not exists comfy_workflows_public_idx
  on public.comfy_workflows (is_public) where is_public;

grant select, insert, update, delete on public.comfy_workflows to authenticated;
grant all on public.comfy_workflows to service_role;

alter table public.comfy_workflows enable row level security;

drop policy if exists "comfy_workflows_select" on public.comfy_workflows;
create policy "comfy_workflows_select" on public.comfy_workflows
  for select to authenticated using (auth.uid() = owner_user_id or is_public);

drop policy if exists "comfy_workflows_insert_own" on public.comfy_workflows;
create policy "comfy_workflows_insert_own" on public.comfy_workflows
  for insert to authenticated with check (auth.uid() = owner_user_id);

drop policy if exists "comfy_workflows_update_own" on public.comfy_workflows;
create policy "comfy_workflows_update_own" on public.comfy_workflows
  for update to authenticated using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop policy if exists "comfy_workflows_delete_own" on public.comfy_workflows;
create policy "comfy_workflows_delete_own" on public.comfy_workflows
  for delete to authenticated using (auth.uid() = owner_user_id);

create table if not exists public.comfy_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid references public.comfy_workflows(id) on delete set null,
  worker_id uuid references public.gpu_workers(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  progress_pct int not null default 0,
  prompt_id text,
  input_values jsonb not null default '{}'::jsonb,
  output_url text,
  output_kind text,
  error text,
  source text not null default 'run' check (source in ('run', 'admin', 'canvas')),
  generation_id uuid references public.generations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comfy_runs_user_created_idx
  on public.comfy_runs (user_id, created_at desc);
create index if not exists comfy_runs_workflow_idx
  on public.comfy_runs (workflow_id);

grant select, insert, update, delete on public.comfy_runs to authenticated;
grant all on public.comfy_runs to service_role;

alter table public.comfy_runs enable row level security;

drop policy if exists "comfy_runs_select_own" on public.comfy_runs;
create policy "comfy_runs_select_own" on public.comfy_runs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "comfy_runs_insert_own" on public.comfy_runs;
create policy "comfy_runs_insert_own" on public.comfy_runs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "comfy_runs_update_own" on public.comfy_runs;
create policy "comfy_runs_update_own" on public.comfy_runs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "comfy_runs_delete_own" on public.comfy_runs;
create policy "comfy_runs_delete_own" on public.comfy_runs
  for delete to authenticated using (auth.uid() = user_id);
