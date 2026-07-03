
drop policy "studio read public" on storage.objects;
create policy "studio own folder select" on storage.objects
  for select using (
    bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]
  );
