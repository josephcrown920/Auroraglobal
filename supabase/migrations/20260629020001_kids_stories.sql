-- Faceless Kids Story Studio: one row per generated kids story.
-- A story turns a short brief (content type, age range, topic, length, character)
-- into a finished faceless MP4 via a single reserved `kids_story` job (see
-- runKidsStory in jobs.server.ts): LLM script -> per-scene illustration ->
-- image-to-video clip -> per-scene narration -> ffmpeg assembly on a self-hosted
-- GPU worker. `scenes` holds the ordered script plus per-scene render progress so
-- the /kids page can show step-by-step status and per-stage errors.
--
-- Owner-scoped: the user CRUDs their own rows; the job runner writes through the
-- service-role server (which bypasses RLS), so RLS only needs owner access.

create table if not exists public.kids_stories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  generation_id   uuid references public.generations(id) on delete set null,
  job_id          uuid references public.jobs(id) on delete set null,
  title           text,
  -- The user's request: content_type, age_range, topic, length, character ref,
  -- music choice, aspect — exactly what was submitted, for re-rendering/auditing.
  brief           jsonb not null default '{}'::jsonb,
  -- Ordered scenes: { narration, illustrationPrompt, status, imageUrl, clipUrl,
  -- narrationUrl, error }[]. Updated in place as each stage completes.
  scenes          jsonb not null default '[]'::jsonb,
  status          text not null default 'pending'
                    check (status in ('pending', 'scripting', 'rendering', 'assembling', 'succeeded', 'failed')),
  error           text,
  poster_url      text,
  final_video_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists kids_stories_user_created_idx
  on public.kids_stories (user_id, created_at desc);
create index if not exists kids_stories_generation_idx
  on public.kids_stories (generation_id);

grant select, insert, update, delete on public.kids_stories to authenticated;
grant all on public.kids_stories to service_role;

alter table public.kids_stories enable row level security;

drop policy if exists "kids_stories_select_own" on public.kids_stories;
create policy "kids_stories_select_own" on public.kids_stories
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "kids_stories_insert_own" on public.kids_stories;
create policy "kids_stories_insert_own" on public.kids_stories
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "kids_stories_update_own" on public.kids_stories;
create policy "kids_stories_update_own" on public.kids_stories
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "kids_stories_delete_own" on public.kids_stories;
create policy "kids_stories_delete_own" on public.kids_stories
  for delete to authenticated using (auth.uid() = user_id);

-- Reuse the project's shared updated_at trigger function.
drop trigger if exists kids_stories_touch on public.kids_stories;
create trigger kids_stories_touch
  before update on public.kids_stories
  for each row execute function public.touch_updated_at();
