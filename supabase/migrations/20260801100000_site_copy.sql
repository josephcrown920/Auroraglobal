-- site_copy: editable landing/home text overrides.
--
-- Stores key/value pairs that override hardcoded copy strings in the UI.
-- Reading is done exclusively via the service-role public API endpoint
-- (/api/public/site-copy), so anon/authenticated access is completely revoked.
-- Writing is done via adminSetSiteCopy / adminDeleteSiteCopy server functions
-- (service-role, admin-gated in application code).

create table if not exists public.site_copy (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

-- Lock it down: deny anon and authenticated; service role bypasses RLS.
alter table public.site_copy enable row level security;
revoke all on table public.site_copy from anon;
revoke all on table public.site_copy from authenticated;
