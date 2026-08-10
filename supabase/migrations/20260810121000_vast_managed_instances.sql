-- Aurora-managed Vast.ai instance records (Task: automate Vast GPU lifecycle).
-- Tracks every instance Aurora rented (or the owner explicitly adopted) so the
-- CLI + cron can safely reconcile lifecycle state across runs: budget ceiling,
-- creation time, hard destruction deadline, and the linked gpu_workers row.
-- Lifecycle actions are restricted server-side to rows in this table — Aurora
-- never touches Vast instances it does not manage.

create table if not exists public.vast_managed_instances (
  id uuid primary key default gen_random_uuid(),
  -- Vast.ai numeric instance id. Unique so re-running a CLI command can never
  -- create a duplicate managed record for the same rental.
  vast_instance_id bigint not null unique,
  label text not null default 'aurora-vast',
  gpu_name text,
  -- Price ceiling enforcement is server-side; we persist what was approved.
  hourly_usd numeric(8,4) not null,
  -- True when the owner adopted an already-rented instance (no Aurora create).
  adopted boolean not null default false,
  -- Public worker endpoint once known (from Vast port mapping / registration).
  endpoint_url text,
  -- Linked gpu_workers row once the worker self-registers.
  worker_id uuid references public.gpu_workers(id) on delete set null,
  -- Lifecycle: renting -> running -> (stopped|destroyed|expired|failed)
  state text not null default 'renting'
    check (state in ('renting','running','stopped','destroyed','expired','failed')),
  failure_reason text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Hard auto-destruction deadline (creation + 1h). The expiry cron destroys
  -- anything past this regardless of CLI state, so a rental can never keep
  -- billing beyond the approved window.
  destroy_deadline timestamptz not null,
  destroyed_at timestamptz
);

-- Service-role only: rows contain provider instance identity and lifecycle
-- control state. Nothing here is client-readable; all access goes through
-- owner-authenticated server routes.
alter table public.vast_managed_instances enable row level security;
revoke all on public.vast_managed_instances from anon, authenticated;

create index if not exists vast_managed_instances_active_idx
  on public.vast_managed_instances (state, destroy_deadline)
  where state in ('renting','running','stopped');
