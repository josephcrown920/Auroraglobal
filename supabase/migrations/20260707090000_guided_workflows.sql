-- Guided Workflows: admin-curated, step-by-step viral video playbooks
-- (distilled from creator prompt guides) that users can run inside Aurora.
-- Content is managed exclusively through service-role server functions;
-- the only direct grant is read access to published rows.

create table if not exists public.guided_workflows (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tagline text not null default '',
  description text not null default '',
  category text not null default 'music-video',
  icon text not null default '🎬',
  source_credit text not null default '',
  steps jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guided_workflows enable row level security;

-- Published workflows are public site content (gallery is viewable pre-login).
drop policy if exists "guided_workflows_public_read" on public.guided_workflows;
create policy "guided_workflows_public_read"
  on public.guided_workflows
  for select
  using (is_published = true);

grant select on public.guided_workflows to anon, authenticated;
-- Deliberately no insert/update/delete grants for anon/authenticated:
-- all writes flow through admin server functions using the service role.

-- Keep updated_at fresh on every write (same convention as marketplace_templates).
create or replace function public.guided_workflows_set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guided_workflows_updated_at on public.guided_workflows;
create trigger guided_workflows_updated_at
  before update on public.guided_workflows
  for each row execute function public.guided_workflows_set_updated_at();
