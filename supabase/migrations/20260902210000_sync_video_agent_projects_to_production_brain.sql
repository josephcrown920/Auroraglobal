-- Bridge the dedicated Video Agent project store into the canonical brain.
-- This covers the Director Workspace and NBA Josh production workspace without
-- requiring clients to know about the internal Production Brain table.
create or replace function public.sync_video_agent_project_to_brain()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nodes jsonb := jsonb_build_array(jsonb_build_object('id','brief','type','brief','dependsOn','[]'::jsonb,'sourceAssetIds','[]'::jsonb,'status','approved','version',1,'payload',jsonb_build_object('text',coalesce(new.prompt,''))));
  scene jsonb;
  shot jsonb;
  scene_id text;
begin
  if jsonb_typeof(coalesce(new.scenes,'[]'::jsonb)) = 'array' then
    for scene in select value from jsonb_array_elements(coalesce(new.scenes,'[]'::jsonb)) loop
      scene_id := coalesce(scene->>'id', 'scene-' || coalesce(scene->>'index','0'));
      nodes := nodes || jsonb_build_array(jsonb_build_object('id',scene_id,'type','scene','dependsOn',jsonb_build_array('brief'),'sourceAssetIds','[]'::jsonb,'status','planned','version',1,'payload',scene));
    end loop;
  end if;

  insert into public.video_production_projects(id,user_id,name,brain,version)
  values (
    new.id,
    new.user_id,
    coalesce(new.title,'Aurora Video Agent production'),
    jsonb_build_object(
      'version',1,
      'projectId',new.id,
      'phase',case when new.status in ('rendering','done','succeeded') then 'render' when new.status in ('editing','planned') then 'edit' else 'intake' end,
      'intent',jsonb_build_object('objective',coalesce(new.prompt,''),'audience','Infer from the project','emotionalGoal','Infer from the project','durationSeconds',new.target_duration,'aspectRatios','[]'::jsonb),
      'creative',jsonb_build_object('brief',coalesce(new.prompt,''),'script','','treatment','','characterBible','[]'::jsonb,'worldBible','[]'::jsonb,'styleBible',case when new.style is not null then jsonb_build_array(new.style) else '[]'::jsonb end,'assumptions','[]'::jsonb),
      'references','[]'::jsonb,
      'nodes',nodes,
      'timeline','[]'::jsonb,
      'audio',jsonb_build_object('voiceId',new.voice,'musicDirection','','sfxDirection','','mixNotes','[]'::jsonb),
      'delivery',jsonb_build_object('formats','[]'::jsonb,'resolutions','[]'::jsonb,'captions',false,'cleanVersion',false,'variants','[]'::jsonb,'outputs',case when new.export_url is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id','project-export','url',new.export_url,'format','project','resolution','source','createdAt',now()::text)) end),
      'routing','[]'::jsonb,
      'qa','[]'::jsonb,
      'creativeReview',jsonb_build_object('issues','[]'::jsonb,'approved',new.status in ('done','succeeded')),
      'history','[]'::jsonb
    ),
    1
  )
  on conflict(id) do update set name=excluded.name, brain=excluded.brain, version=public.video_production_projects.version+1, updated_at=now();
  return new;
end;
$$;

drop trigger if exists video_agent_projects_brain_sync on public.video_agent_projects;
create trigger video_agent_projects_brain_sync
after insert or update of prompt,title,style,voice,target_duration,scenes,status,export_url on public.video_agent_projects
for each row execute function public.sync_video_agent_project_to_brain();
