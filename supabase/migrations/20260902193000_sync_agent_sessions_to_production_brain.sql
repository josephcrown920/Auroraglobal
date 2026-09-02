-- Bridge the legacy conversational Agent session into the canonical Production Brain.
-- This keeps existing agent/session APIs backward-compatible while ensuring that
-- a conversational video plan has a persistent project representation.
create or replace function public.sync_agent_session_to_video_brain()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  shot_nodes jsonb := '[]'::jsonb;
  shot jsonb;
begin
  if new.plan is not null and jsonb_typeof(new.plan) = 'object' then
    for shot in select value from jsonb_array_elements(coalesce(new.plan->'shots', '[]'::jsonb)) loop
      shot_nodes := shot_nodes || jsonb_build_array(jsonb_build_object(
        'id', coalesce(shot->>'id', 'shot-' || floor(random() * 1000000)::text),
        'type', 'shot',
        'dependsOn', jsonb_build_array('brief'),
        'sourceAssetIds', '[]'::jsonb,
        'status', 'planned',
        'version', 1,
        'payload', shot
      ));
    end loop;
  end if;

  insert into public.video_production_projects (id, user_id, name, brain, version)
  values (
    new.id,
    new.user_id,
    coalesce(new.title, 'Aurora Agent production'),
    jsonb_build_object(
      'version', 1,
      'projectId', new.id,
      'phase', case when new.status = 'ready' then 'storyboard' else 'intake' end,
      'intent', jsonb_build_object(
        'objective', coalesce(new.brief, ''),
        'audience', 'Infer from the brief',
        'emotionalGoal', 'Infer from the brief',
        'aspectRatios', '[]'::jsonb
      ),
      'creative', jsonb_build_object(
        'brief', coalesce(new.brief, ''),
        'script', '',
        'treatment', coalesce(new.plan->>'direction', ''),
        'characterBible', '[]'::jsonb,
        'worldBible', '[]'::jsonb,
        'styleBible', case when new.plan ? 'direction' then jsonb_build_array(new.plan->>'direction') else '[]'::jsonb end,
        'assumptions', '[]'::jsonb
      ),
      'references', '[]'::jsonb,
      'nodes', jsonb_build_array(jsonb_build_object('id','brief','type','brief','dependsOn','[]'::jsonb,'sourceAssetIds','[]'::jsonb,'status','approved','version',1,'payload',jsonb_build_object('text',coalesce(new.brief,'')))) || shot_nodes,
      'timeline', '[]'::jsonb,
      'audio', jsonb_build_object('musicDirection','','sfxDirection','','mixNotes','[]'::jsonb),
      'delivery', jsonb_build_object('formats','[]'::jsonb,'resolutions','[]'::jsonb,'captions',false,'cleanVersion',false,'variants','[]'::jsonb,'outputs','[]'::jsonb),
      'routing', '[]'::jsonb,
      'qa', '[]'::jsonb,
      'creativeReview', jsonb_build_object('issues','[]'::jsonb,'approved',false),
      'history', '[]'::jsonb
    ),
    1
  )
  on conflict (id) do update set
    user_id = excluded.user_id,
    name = excluded.name,
    brain = excluded.brain,
    version = public.video_production_projects.version + 1,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists agent_sessions_video_brain_sync on public.agent_sessions;
create trigger agent_sessions_video_brain_sync
after insert or update of title, brief, plan, status on public.agent_sessions
for each row execute function public.sync_agent_session_to_video_brain();
