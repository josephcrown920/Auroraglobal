alter table public.edit_sessions
  add column if not exists soundtrack_offset_sec double precision not null default 0,
  add column if not exists soundtrack_trim_start_sec double precision not null default 0,
  add column if not exists soundtrack_trim_end_sec double precision not null default 0,
  add column if not exists soundtrack_volume double precision not null default 1,
  add column if not exists soundtrack_mode text not null default 'mix',
  add column if not exists result_path text;

alter table public.edit_sessions
  drop constraint if exists edit_sessions_soundtrack_values_check;
alter table public.edit_sessions
  add constraint edit_sessions_soundtrack_values_check check (
    soundtrack_offset_sec >= 0 and soundtrack_offset_sec <= 120 and
    soundtrack_trim_start_sec >= 0 and soundtrack_trim_start_sec <= 3600 and
    soundtrack_trim_end_sec >= 0 and soundtrack_trim_end_sec <= 3600 and
    soundtrack_volume >= 0 and soundtrack_volume <= 2 and
    soundtrack_mode in ('mix', 'replace')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editor-exports', 'editor-exports', false, 536870912, array['video/mp4'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "editor exports owner read"
  on storage.objects for select
  using (
    bucket_id = 'editor-exports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "editor exports owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'editor-exports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );