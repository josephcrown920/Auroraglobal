-- Video Agent project mutations are server-owned. Browsers may read their own
-- rows through the existing SELECT policy, but every application write uses
-- the service role.

revoke insert, update, delete, truncate, references, trigger
  on table public.video_agent_projects
  from public, anon, authenticated;

-- A column grant can preserve INSERT, UPDATE, or REFERENCES after its
-- table-level counterpart is revoked. Revoke those privileges on every live
-- column as defense against grant drift. (The production audit preceding this
-- migration found no explicit column ACLs.)
do $$
declare
  column_name name;
begin
  for column_name in
    select a.attname
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.video_agent_projects'::regclass
      and a.attnum > 0
      and not a.attisdropped
  loop
    execute format(
      'revoke insert (%1$I), update (%1$I), references (%1$I) on table public.video_agent_projects from public, anon, authenticated',
      column_name
    );
  end loop;
end
$$;

grant insert, update, delete, truncate, references, trigger
  on table public.video_agent_projects
  to service_role;