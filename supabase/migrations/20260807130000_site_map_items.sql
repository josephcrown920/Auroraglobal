-- Admin-only catalog for managing Aurora's visible page flow.
-- This deliberately stores catalog metadata, not live route definitions.
create table if not exists public.site_map_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  path text not null,
  kind text not null check (kind in ('public', 'admin', 'internal', 'archived')),
  description text not null default '',
  flow_order integer not null default 0,
  archived_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists site_map_items_path_key on public.site_map_items (path);
create index if not exists site_map_items_flow_order_idx on public.site_map_items (flow_order);

alter table public.site_map_items enable row level security;
revoke all on table public.site_map_items from anon;
revoke all on table public.site_map_items from authenticated;