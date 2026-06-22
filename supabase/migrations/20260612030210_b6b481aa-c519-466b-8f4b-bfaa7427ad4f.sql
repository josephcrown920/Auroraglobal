
create policy "studio user upload" on storage.objects for insert with check (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "studio user update" on storage.objects for update using (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "studio user delete" on storage.objects for delete using (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "studio own folder select" on storage.objects for select using (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);
