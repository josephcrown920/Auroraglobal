-- Security hardening: boards / board_items / chat_threads shipped with
-- fully permissive RLS ("Open access ..." USING (true) WITH CHECK (true),
-- plus separate open per-action policies) and full anon + authenticated
-- grants — including TRUNCATE, which bypasses RLS entirely. Despite each
-- table having a `user_id` ownership column, nothing ever checked it: any
-- caller holding only the public anon key could read, modify, delete, or
-- truncate every user's boards, board items (prompts/images/video URLs),
-- and chat threads. These tables have no confirmed frontend consumer today
-- (the storyboard studio's "board" concept in src/lib/board-store.ts is a
-- client-side localStorage store, unrelated to this table), but the
-- exposure is real regardless of in-app usage — the tables are reachable
-- directly via the Supabase REST API with the public anon key.
--
-- render_jobs (a genuinely live table backing src/lib/render-jobs.ts and the
-- storyboard studio's Video Agent panel) has the same class of gap: its
-- SELECT policy was USING (true) and it had no ownership column at all, so
-- any authenticated user could list every other user's render jobs. The
-- table has 0 live rows today, so adding a NOT NULL owner column needs no
-- backfill.

-- ── render_jobs: add real per-user ownership, scope existing policies ──────
alter table public.render_jobs
  add column if not exists user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade;

drop policy if exists "Render jobs readable by owner" on public.render_jobs;
create policy "Render jobs readable by owner" on public.render_jobs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Render jobs insertable by authenticated" on public.render_jobs;
create policy "Render jobs insertable by authenticated" on public.render_jobs
  for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.render_jobs from anon;

-- ── boards / board_items / chat_threads: owner-scoped policies + grants ────
do $$
declare
  t text;
begin
  foreach t in array array['boards', 'board_items', 'chat_threads'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

drop policy if exists "Open access boards" on public.boards;
drop policy if exists "Open delete boards" on public.boards;
drop policy if exists "Open insert boards" on public.boards;
drop policy if exists "Open read boards" on public.boards;
drop policy if exists "Open update boards" on public.boards;
drop policy if exists "boards owner select" on public.boards;
create policy "boards owner select" on public.boards
  for select using (auth.uid() = user_id);
drop policy if exists "boards owner insert" on public.boards;
create policy "boards owner insert" on public.boards
  for insert with check (auth.uid() = user_id);
drop policy if exists "boards owner update" on public.boards;
create policy "boards owner update" on public.boards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "boards owner delete" on public.boards;
create policy "boards owner delete" on public.boards
  for delete using (auth.uid() = user_id);

drop policy if exists "Open access board items" on public.board_items;
drop policy if exists "Open delete board items" on public.board_items;
drop policy if exists "Open insert board items" on public.board_items;
drop policy if exists "Open read board items" on public.board_items;
drop policy if exists "Open update board items" on public.board_items;
drop policy if exists "board items owner select" on public.board_items;
create policy "board items owner select" on public.board_items
  for select using (auth.uid() = user_id);
drop policy if exists "board items owner insert" on public.board_items;
create policy "board items owner insert" on public.board_items
  for insert with check (auth.uid() = user_id);
drop policy if exists "board items owner update" on public.board_items;
create policy "board items owner update" on public.board_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "board items owner delete" on public.board_items;
create policy "board items owner delete" on public.board_items
  for delete using (auth.uid() = user_id);

drop policy if exists "Open access threads" on public.chat_threads;
drop policy if exists "Open delete threads" on public.chat_threads;
drop policy if exists "Open insert threads" on public.chat_threads;
drop policy if exists "Open read threads" on public.chat_threads;
drop policy if exists "Open update threads" on public.chat_threads;
drop policy if exists "chat threads owner select" on public.chat_threads;
create policy "chat threads owner select" on public.chat_threads
  for select using (auth.uid() = user_id);
drop policy if exists "chat threads owner insert" on public.chat_threads;
create policy "chat threads owner insert" on public.chat_threads
  for insert with check (auth.uid() = user_id);
drop policy if exists "chat threads owner update" on public.chat_threads;
create policy "chat threads owner update" on public.chat_threads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "chat threads owner delete" on public.chat_threads;
create policy "chat threads owner delete" on public.chat_threads
  for delete using (auth.uid() = user_id);
