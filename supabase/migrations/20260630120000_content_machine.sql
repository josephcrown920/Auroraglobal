-- AI UGC Content Machine (Task #102): products, reusable content templates,
-- batches and per-video batch items.
--
-- The Content Machine reuses Aurora's existing generation backend. A "batch" fans
-- out into N INDEPENDENT `ugc_ad` jobs (see runUGCAd in jobs.server.ts), each one
-- reserved through create_generation_and_reserve for a flat COST_UGC_AD. Faceless
-- videos carry NO avatar — the worker treats payload.avatarImageUrl as optional.
--
-- cm_batch_items links each queued video to its public.generations row, so the
-- Content Machine page can poll live status (queued → processing → succeeded /
-- failed), preview/download the finished MP4, and compute per-batch analytics by
-- joining to generations. Owner-scoped RLS throughout; system content templates
-- are readable by every authenticated user but cannot be edited by users.
--
-- Conventions mirror supabase/migrations/20260629020000_kids_stories.sql.

-- ── Products ──────────────────────────────────────────────────────────────────
create table if not exists public.cm_products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  brand_voice   text,
  audience      text,
  cta           text,
  link          text,
  -- string[] of product photo URLs (kept for display; not fed into the faceless
  -- generation as an avatar reference).
  photos        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cm_products_user_created_idx
  on public.cm_products (user_id, created_at desc);

grant select, insert, update, delete on public.cm_products to authenticated;
grant all on public.cm_products to service_role;
alter table public.cm_products enable row level security;

drop policy if exists "cm_products_select_own" on public.cm_products;
create policy "cm_products_select_own" on public.cm_products
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "cm_products_insert_own" on public.cm_products;
create policy "cm_products_insert_own" on public.cm_products
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "cm_products_update_own" on public.cm_products;
create policy "cm_products_update_own" on public.cm_products
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "cm_products_delete_own" on public.cm_products;
create policy "cm_products_delete_own" on public.cm_products
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists cm_products_touch on public.cm_products;
create trigger cm_products_touch
  before update on public.cm_products
  for each row execute function public.touch_updated_at();

-- ── Content templates (seeded system set + user-saved) ───────────────────────
-- A template bundles a reusable visual style + script/hook formula + motion style
-- + 9:16 short-form format, applicable to ANY product. System rows have user_id
-- null and is_system true; user rows are owner-scoped and always is_system false.
create table if not exists public.cm_templates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  is_system      boolean not null default false,
  name           text not null,
  description    text,
  scene_hint     text not null,                 -- visual style / scene (→ payload sceneHint)
  motion_hint    text,                          -- motion style (→ payload sceneName)
  script_formula text,                          -- hook/script approach for the LLM
  aspect         text not null default '9:16',
  duration       integer not null default 8 check (duration between 3 and 12),
  icon           text,                          -- lucide icon name for the UI
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint cm_templates_system_owner_chk
    check ((is_system and user_id is null) or (not is_system and user_id is not null))
);
create index if not exists cm_templates_user_idx
  on public.cm_templates (user_id, created_at desc);
create index if not exists cm_templates_system_idx
  on public.cm_templates (is_system) where is_system;

grant select, insert, update, delete on public.cm_templates to authenticated;
grant all on public.cm_templates to service_role;
alter table public.cm_templates enable row level security;

-- Readable: any system template, plus the caller's own templates.
drop policy if exists "cm_templates_select_visible" on public.cm_templates;
create policy "cm_templates_select_visible" on public.cm_templates
  for select to authenticated using (is_system or auth.uid() = user_id);
-- Writable: only the caller's own NON-system templates (cannot forge a system row).
drop policy if exists "cm_templates_insert_own" on public.cm_templates;
create policy "cm_templates_insert_own" on public.cm_templates
  for insert to authenticated with check (auth.uid() = user_id and is_system = false);
drop policy if exists "cm_templates_update_own" on public.cm_templates;
create policy "cm_templates_update_own" on public.cm_templates
  for update to authenticated
  using (auth.uid() = user_id and is_system = false)
  with check (auth.uid() = user_id and is_system = false);
drop policy if exists "cm_templates_delete_own" on public.cm_templates;
create policy "cm_templates_delete_own" on public.cm_templates
  for delete to authenticated using (auth.uid() = user_id and is_system = false);

drop trigger if exists cm_templates_touch on public.cm_templates;
create trigger cm_templates_touch
  before update on public.cm_templates
  for each row execute function public.touch_updated_at();

-- ── Batches ───────────────────────────────────────────────────────────────────
create table if not exists public.cm_batches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  product_id         uuid references public.cm_products(id) on delete set null,
  product_name       text,                       -- snapshot in case the product is later deleted
  template_ids       jsonb not null default '[]'::jsonb,
  count_per_template integer not null default 1,
  total_items        integer not null default 0,
  credits_reserved   integer not null default 0,
  status             text not null default 'queued'
                       check (status in ('queued', 'partial_queued', 'completed', 'failed')),
  note               text,                       -- e.g. "Queued 8/12; add Aura for the rest"
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists cm_batches_user_created_idx
  on public.cm_batches (user_id, created_at desc);

-- Writes happen through the service-role server (reserve + enqueue); users only
-- read their own batches and may delete them to tidy up history.
grant select, delete on public.cm_batches to authenticated;
grant all on public.cm_batches to service_role;
alter table public.cm_batches enable row level security;

drop policy if exists "cm_batches_select_own" on public.cm_batches;
create policy "cm_batches_select_own" on public.cm_batches
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "cm_batches_delete_own" on public.cm_batches;
create policy "cm_batches_delete_own" on public.cm_batches
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists cm_batches_touch on public.cm_batches;
create trigger cm_batches_touch
  before update on public.cm_batches
  for each row execute function public.touch_updated_at();

-- ── Batch items (one row per video) ───────────────────────────────────────────
create table if not exists public.cm_batch_items (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references public.cm_batches(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  template_id      uuid references public.cm_templates(id) on delete set null,
  template_name    text,
  generation_id    uuid references public.generations(id) on delete set null,
  job_id           uuid references public.jobs(id) on delete set null,
  seq              integer not null default 0,
  credits_reserved integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists cm_batch_items_batch_idx
  on public.cm_batch_items (batch_id, seq);
create index if not exists cm_batch_items_generation_idx
  on public.cm_batch_items (generation_id);
create index if not exists cm_batch_items_user_idx
  on public.cm_batch_items (user_id);

grant select on public.cm_batch_items to authenticated;
grant all on public.cm_batch_items to service_role;
alter table public.cm_batch_items enable row level security;

drop policy if exists "cm_batch_items_select_own" on public.cm_batch_items;
create policy "cm_batch_items_select_own" on public.cm_batch_items
  for select to authenticated using (auth.uid() = user_id);

-- ── Seed system templates (faceless, product-centric, 9:16) ──────────────────
-- Fixed ids make the seed idempotent across dev apply + publish-to-prod.
insert into public.cm_templates
  (id, user_id, is_system, name, description, scene_hint, motion_hint, script_formula, aspect, duration, icon)
values
  ('c0ffee00-0000-4000-8000-000000000001', null, true,
   'Honest review',
   'Close-up hand-held review with native social realism.',
   'Hyper-realistic iPhone-style close-up of the product held in one hand, soft window light, clean neutral room, native social-media aesthetic, no on-screen text',
   'subtle handheld sway with a slow push-in toward the product',
   'Relatable problem hook → honest first-person result → quick call to action',
   '9:16', 8, 'Smartphone'),
  ('c0ffee00-0000-4000-8000-000000000002', null, true,
   'Unboxing hands',
   'Top-down hands-only unboxing reveal.',
   'Top-down unboxing on a wooden desk, natural hands revealing the product from kraft packaging, warm directional light, photoreal',
   'hands opening the box and lifting the product into frame with a gentle camera tilt',
   'Tease what is inside → satisfying reveal → why it is worth it → call to action',
   '9:16', 8, 'Package'),
  ('c0ffee00-0000-4000-8000-000000000003', null, true,
   'Cafe lifestyle',
   'Aspirational cafe table scene.',
   'The product on a cafe table beside a latte, blurred warm background, golden-hour light through a window, lifestyle photography',
   'slow dolly across the table with drifting steam',
   'Aspirational scene hook → casual product mention → call to action',
   '9:16', 8, 'Coffee'),
  ('c0ffee00-0000-4000-8000-000000000004', null, true,
   'Gym b-roll',
   'High-energy fitness b-roll.',
   'The product on a gym bench beside a water bottle, post-workout fluorescent glow, gritty realistic detail',
   'slow pan across the bench with light flares',
   'Fitness pain point hook → product as the fix → call to action',
   '9:16', 8, 'Dumbbell'),
  ('c0ffee00-0000-4000-8000-000000000005', null, true,
   'Get-ready vanity',
   'Bright vanity get-ready setting.',
   'The product on a bright vanity with a ring light, morning get-ready setting, glossy highlights, photoreal',
   'slow rotate around the product with sparkle highlights',
   'Daily routine hook → where the product fits → call to action',
   '9:16', 8, 'Sparkles'),
  ('c0ffee00-0000-4000-8000-000000000006', null, true,
   'POV desk demo',
   'First-person desk demo.',
   'POV looking down at hands using the product on a desk, vertical framing, natural office light, photoreal',
   'first-person hands interacting with the product, lifelike micro-movements',
   'POV hook → quick hands-on demo → call to action',
   '9:16', 8, 'Camera'),
  ('c0ffee00-0000-4000-8000-000000000007', null, true,
   'Golden-hour car',
   'On-the-go car cup-holder scene.',
   'The product in a car cup-holder, sun-flare through the windshield, golden-hour light, cinematic realism',
   'subtle handheld with drifting lens flare',
   'On-the-go hook → product highlight → call to action',
   '9:16', 8, 'Sun')
on conflict (id) do nothing;
