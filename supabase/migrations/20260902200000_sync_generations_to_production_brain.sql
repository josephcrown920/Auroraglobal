-- Keep per-shot generation state synchronized with the canonical Production Brain.
-- Only fields already used by the existing generations table are referenced.
create or replace function public.sync_generation_to_video_brain()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  next_status text := case
    when new.status = 'succeeded' then 'approved'
    when new.status = 'processing' then 'processing'
    when new.status = 'failed' then 'failed'
    when new.status in ('queued','pending') then 'queued'
    else 'planned'
  end;
  result_url text := coalesce(new.result_video_url, new.result_image_url);
begin
  if new.session_id is null or new.agent_shot_id is null then return new; end if;

  update public.video_production_projects
  set brain = jsonb_set(
    brain,
    '{nodes}',
    coalesce((
      select jsonb_agg(
        case when node->>'id' = new.agent_shot_id then
          node || jsonb_build_object(
            'status', next_status,
            'version', coalesce((node->>'version')::integer, 1) + 1,
            'payload', coalesce(node->'payload','{}'::jsonb) || jsonb_build_object(
              'latestGenerationId', new.id,
              'latestResultUrl', result_url,
              'generationStatus', new.status
            )
          )
        else node end
      )
      from jsonb_array_elements(coalesce(brain->'nodes','[]'::jsonb)) node
    ), '[]'::jsonb),
    false
  ),
  version = version + 1,
  updated_at = now()
  where id = new.session_id;

  return new;
end;
$$;

drop trigger if exists generations_video_brain_sync on public.generations;
create trigger generations_video_brain_sync
after insert or update of status, result_video_url, result_image_url on public.generations
for each row execute function public.sync_generation_to_video_brain();
