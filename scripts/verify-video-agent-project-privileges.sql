\set ON_ERROR_STOP on

-- Read-only privilege regression check for
-- 20260908110000_harden_video_agent_project_privileges.sql.
begin read only;

do $$
declare
  role_name text;
  privilege_name text;
  column_name text;
begin
  if not (
    select c.relrowsecurity
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'video_agent_projects'
  ) then
    raise exception 'video_agent_projects must retain RLS';
  end if;

  foreach role_name in array array['anon', 'authenticated'] loop
    if not has_table_privilege(
      role_name,
      'public.video_agent_projects',
      'SELECT'
    ) then
      raise exception '% must retain SELECT on video_agent_projects', role_name;
    end if;

    foreach privilege_name in array
      array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
    loop
      if has_table_privilege(
        role_name,
        'public.video_agent_projects',
        privilege_name
      ) then
        raise exception
          '% must not have % on video_agent_projects (including via PUBLIC or inherited roles)',
          role_name,
          privilege_name;
      end if;
    end loop;

    for column_name in
      select a.attname
      from pg_catalog.pg_attribute a
      where a.attrelid = 'public.video_agent_projects'::regclass
        and a.attnum > 0
        and not a.attisdropped
    loop
      foreach privilege_name in array array['INSERT', 'UPDATE', 'REFERENCES']
      loop
        if has_column_privilege(
          role_name,
          'public.video_agent_projects',
          column_name,
          privilege_name
        ) then
          raise exception
            '% must not have column-level % on video_agent_projects.%',
            role_name,
            privilege_name,
            column_name;
        end if;
      end loop;
    end loop;
  end loop;

  foreach privilege_name in array
    array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  loop
    if not has_table_privilege(
      'service_role',
      'public.video_agent_projects',
      privilege_name
    ) then
      raise exception
        'service_role must retain % on video_agent_projects',
        privilege_name;
    end if;
  end loop;
end
$$;

rollback;