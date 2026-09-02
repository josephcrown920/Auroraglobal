-- Persist editor/rough-cut terminal state into the same Production Brain used by
-- the editor session. This makes export a production lifecycle phase, not an
-- unrelated utility result.
create or replace function public.sync_edit_session_to_video_brain()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  phase_name text := case when new.status = 'done' then 'delivery' when new.status = 'exporting' then 'render' else 'edit' end;
  result jsonb := case when new.result_url is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id','edit-export','url',new.result_url,'format','editor','resolution','source','createdAt',now()::text)) end;
begin
  update public.video_production_projects
  set brain = brain
    || jsonb_build_object('phase', phase_name)
    || jsonb_build_object('creativeReview', jsonb_build_object(
      'issues', case when new.status = 'done' then '[]'::jsonb else coalesce(brain->'creativeReview'->'issues','[]'::jsonb) end,
      'approved', new.status = 'done'
    ))
    || jsonb_build_object('delivery', coalesce(brain->'delivery','{}'::jsonb) || jsonb_build_object('outputs', result)),
    version = version + 1,
    updated_at = now()
  where id = new.id and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists edit_sessions_video_brain_sync on public.edit_sessions;
create trigger edit_sessions_video_brain_sync
after insert or update of status, result_url on public.edit_sessions
for each row execute function public.sync_edit_session_to_video_brain();
