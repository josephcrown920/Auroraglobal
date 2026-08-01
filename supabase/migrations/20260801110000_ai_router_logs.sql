-- AI Router decision log table.
-- Stores one row per routed LLM call for admin visibility and debugging.
-- RLS enabled with anon/authenticated access revoked so only service-role
-- (server functions) can write, and only admin server fns can read.

create table if not exists public.ai_router_logs (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  provider_used text not null,
  fallback_count int not null default 0,
  latency_ms    int not null default 0,
  success       boolean not null,
  failure_reason text,
  estimated_cost numeric(10, 2) not null default 0,
  created_at    timestamptz not null default now()
);

-- Index for the admin panel query (most recent first).
create index if not exists ai_router_logs_created_at_idx
  on public.ai_router_logs (created_at desc);

-- Index for filtering by category.
create index if not exists ai_router_logs_category_idx
  on public.ai_router_logs (category);

-- RLS: enable but lock out direct client access.
alter table public.ai_router_logs enable row level security;

-- Revoke direct access from anon and authenticated roles.
-- All reads/writes go through service-role server functions only.
revoke all on public.ai_router_logs from anon;
revoke all on public.ai_router_logs from authenticated;
