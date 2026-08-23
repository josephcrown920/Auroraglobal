-- Production-readiness RLS audit (2026-08-22): five tables had policies that
-- effectively granted open read/write to anyone holding the public anon key,
-- reachable directly via the Supabase REST API regardless of app usage.
-- All are idempotent (drop-if-exists + recreate) so re-running is a no-op.

-- ── user_passkeys ───────────────────────────────────────────────────────────
-- "service_role_passkeys_all" was named for service_role but had no `TO`
-- clause, so it defaulted to PUBLIC — combined with full anon/authenticated
-- grants, ANY caller could read, insert, update, or delete ANY user's
-- WebAuthn credential (a real account-takeover vector). The app only ever
-- touches this table via the service-role client (src/lib/webauthn.functions.ts).
drop policy if exists "service_role_passkeys_all" on public.user_passkeys;
create policy "service_role_passkeys_all" on public.user_passkeys
  for all to service_role using (true) with check (true);

revoke all on public.user_passkeys from anon;
revoke insert, update, delete, truncate, references, trigger on public.user_passkeys from authenticated;
-- authenticated keeps SELECT, matched by the existing "users_own_passkeys_select" (auth.uid() = user_id) policy.

-- ── webauthn_challenges ─────────────────────────────────────────────────────
-- Same "named service_role, scoped to public" bug. Challenge nonces are
-- entirely server-managed (no legitimate client-side read/write path), so
-- lock this down to service_role only with no client access at all.
drop policy if exists "service_role_challenges_all" on public.webauthn_challenges;
create policy "service_role_challenges_all" on public.webauthn_challenges
  for all to service_role using (true) with check (true);

revoke all on public.webauthn_challenges from anon;
revoke all on public.webauthn_challenges from authenticated;

-- ── character_profiles ──────────────────────────────────────────────────────
-- "Open access characters" was USING(true)/WITH CHECK(true) for ALL on
-- `public` — any user could read/edit/delete any other user's character
-- profiles (identity prompts + reference image URLs). No migration file
-- backed this table (pure schema drift) and it currently has 0 rows, so this
-- is a zero-regression-risk fix. account-purge.server.ts already scopes its
-- delete by the deleting user's own auth id, unaffected by this change.
drop policy if exists "Open access characters" on public.character_profiles;
drop policy if exists "character_profiles_select_own" on public.character_profiles;
drop policy if exists "character_profiles_insert_own" on public.character_profiles;
drop policy if exists "character_profiles_update_own" on public.character_profiles;
drop policy if exists "character_profiles_delete_own" on public.character_profiles;

create policy "character_profiles_select_own" on public.character_profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "character_profiles_insert_own" on public.character_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "character_profiles_update_own" on public.character_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "character_profiles_delete_own" on public.character_profiles
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.character_profiles from anon;
revoke truncate, references, trigger on public.character_profiles from authenticated;

-- ── storyboards ──────────────────────────────────────────────────────────────
-- Same "Open access" mistake as character_profiles: no migration file, 0
-- rows, no active app code path reads/writes it (only referenced in prose
-- strings in the UI and in account-purge.server.ts's per-user delete sweep).
drop policy if exists "Open access storyboards" on public.storyboards;
drop policy if exists "storyboards_select_own" on public.storyboards;
drop policy if exists "storyboards_insert_own" on public.storyboards;
drop policy if exists "storyboards_update_own" on public.storyboards;
drop policy if exists "storyboards_delete_own" on public.storyboards;

create policy "storyboards_select_own" on public.storyboards
  for select to authenticated using (auth.uid() = user_id);
create policy "storyboards_insert_own" on public.storyboards
  for insert to authenticated with check (auth.uid() = user_id);
create policy "storyboards_update_own" on public.storyboards
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "storyboards_delete_own" on public.storyboards
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.storyboards from anon;
revoke truncate, references, trigger on public.storyboards from authenticated;

-- ── promo_codes ──────────────────────────────────────────────────────────────
-- "lookup promo codes" (SELECT, true) let any authenticated user list every
-- promo code — including admin-only/targeted bonus codes, their
-- bonus_credits/percent_off, and internal notes. src/lib/promo.functions.ts
-- (issue/list/redeem/apply-at-checkout) exclusively uses the service-role
-- client, so this policy served no legitimate app path.
drop policy if exists "lookup promo codes" on public.promo_codes;

revoke all on public.promo_codes from anon;
revoke select, insert, update, delete, truncate, references, trigger on public.promo_codes from authenticated;
-- "admin manage promo codes" (has_role check) is left in place for
-- defense-in-depth even though the app itself never queries this table as
-- `authenticated` today.

-- ── hygiene: drop stale anon grants on tables RLS already fully blocks ──────
-- These tables have RLS enabled with zero policies (default-deny), so anon
-- was never actually able to reach them — but the standing GRANT is
-- misleading and worth removing during a security audit.
revoke all on public.app_settings from anon;
revoke all on public.generation_health_state from anon;
revoke all on public.owner_withdrawals from anon;
revoke all on public.scheduler_heartbeats from anon;
revoke all on public.worker_register_attempts from anon;
