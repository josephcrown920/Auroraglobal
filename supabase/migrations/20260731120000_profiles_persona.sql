-- profiles.persona — is this account holder an ARTIST (musician / performer /
-- visual artist) or a CREATOR (content, UGC, short-form)?  Captured at signup so
-- the studio can open on the right side and rank tools for them.
--
-- Nullable on purpose: every account that existed before this migration has never
-- been asked, and the UI falls back to showing both sides plus a one-time picker.
alter table public.profiles
  add column if not exists persona text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_persona_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_persona_check
      check (persona is null or persona in ('artist', 'creator'));
  end if;
end $$;

comment on column public.profiles.persona is
  'artist | creator — chosen at signup; decides which side of the studio opens by default.';
