-- Optional shared audio reference for Multishot direction. This does not imply
-- native-audio rendering; capability resolution controls that independently.
alter table public.multishot_projects
  add column if not exists audio_reference_url text;