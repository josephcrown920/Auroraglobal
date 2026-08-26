-- Aurora Soul: character-consistency studio (LoRA training + identity-locked
-- generation). Ported from the soulmagic reference product; adapted to
-- Aurora's credit ledger (reserveOrchestrateRecord), not a separate billing
-- provider. See ROADMAP.md for the source commit + scope.
--
-- Three tables, owner-only RLS throughout (no public/shared Souls):
--   souls                 — one row per trained persona.
--   soul_reference_assets — individual uploaded training/reference photos.
--   soul_video_jobs       — async Seedance video render jobs tied to a soul.

create table if not exists public.souls (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  name                     text not null,
  description              text,
  trigger_word             text not null default 'sks person',
  status                   text not null default 'pending'
                             check (status in ('pending', 'training', 'ready', 'failed')),
  progress                 int not null default 0 check (progress between 0 and 100),
  error_message            text,
  training_image_paths     text[] not null default '{}',
  reference_image_paths    text[] not null default '{}',
  fal_training_id          text,
  lora_url                 text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint souls_name_not_empty check (char_length(name) > 0)
);

create index if not exists idx_souls_user_id on public.souls(user_id);
create index if not exists idx_souls_user_status on public.souls(user_id, status);
-- Ownership lookup by the fal training-webhook handler (service-role only).
create index if not exists idx_souls_fal_training_id on public.souls(fal_training_id) where fal_training_id is not null;

alter table public.souls enable row level security;

create policy "souls_select_own" on public.souls
  for select using (auth.uid() = user_id);
create policy "souls_insert_own" on public.souls
  for insert with check (auth.uid() = user_id);
create policy "souls_update_own" on public.souls
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "souls_delete_own" on public.souls
  for delete using (auth.uid() = user_id);

create trigger souls_touch
  before update on public.souls
  for each row execute function public.touch_updated_at();

create table if not exists public.soul_reference_assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  soul_id      uuid not null references public.souls(id) on delete cascade,
  storage_path text not null,
  label        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_soul_reference_assets_user_id on public.soul_reference_assets(user_id);
create index if not exists idx_soul_reference_assets_soul_id on public.soul_reference_assets(soul_id);

alter table public.soul_reference_assets enable row level security;

create policy "soul_reference_assets_select_own" on public.soul_reference_assets
  for select using (auth.uid() = user_id);
create policy "soul_reference_assets_insert_own" on public.soul_reference_assets
  for insert with check (auth.uid() = user_id);
create policy "soul_reference_assets_delete_own" on public.soul_reference_assets
  for delete using (auth.uid() = user_id);

create table if not exists public.soul_video_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  soul_id          uuid not null references public.souls(id) on delete cascade,
  provider         text not null default 'seedance',
  model            text not null default 'seedance-soul',
  status           text not null default 'queued'
                     check (status in ('queued', 'processing', 'completed', 'failed')),
  progress         int not null default 0 check (progress between 0 and 100),
  prompt           text not null,
  aspect_ratio     text not null default '9:16',
  duration_secs    int not null default 5 check (duration_secs between 1 and 60),
  provider_job_id  text,
  result_url       text,
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_soul_video_jobs_user_id on public.soul_video_jobs(user_id);
create index if not exists idx_soul_video_jobs_soul_id on public.soul_video_jobs(soul_id);
create index if not exists idx_soul_video_jobs_provider_job_id on public.soul_video_jobs(provider_job_id) where provider_job_id is not null;

alter table public.soul_video_jobs enable row level security;

create policy "soul_video_jobs_select_own" on public.soul_video_jobs
  for select using (auth.uid() = user_id);
create policy "soul_video_jobs_insert_own" on public.soul_video_jobs
  for insert with check (auth.uid() = user_id);
create policy "soul_video_jobs_update_own" on public.soul_video_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "soul_video_jobs_delete_own" on public.soul_video_jobs
  for delete using (auth.uid() = user_id);

create trigger soul_video_jobs_touch
  before update on public.soul_video_jobs
  for each row execute function public.touch_updated_at();

-- ── Lock down default grants ────────────────────────────────────────────────
-- New public tables get broad anon/authenticated grants by default on this
-- project; RLS policies above are the real gate, but strip the anon grant
-- entirely (Soul has no anonymous surface) and drop the destructive/DDL
-- grants from authenticated so only the owner-scoped CRUD policies apply.
revoke all on public.souls from anon;
revoke truncate, references, trigger on public.souls from authenticated;

revoke all on public.soul_reference_assets from anon;
revoke truncate, references, trigger, update on public.soul_reference_assets from authenticated;

revoke all on public.soul_video_jobs from anon;
revoke truncate, references, trigger on public.soul_video_jobs from authenticated;
