-- Aurora Soul storage: two PRIVATE buckets. Unlike the public `studio` bucket,
-- Soul training photos and generated identity-locked outputs are never
-- exposed via getPublicUrl — every read goes through a short-lived signed URL
-- minted server-side after an ownership check (see src/lib/soul.server.ts).

insert into storage.buckets (id, name, public)
values ('soul-training', 'soul-training', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('soul-generated', 'soul-generated', false)
on conflict (id) do nothing;

-- Folder convention: <user_id>/<soul_id>/... — ownership enforced by matching
-- the first path segment to the caller's auth.uid().
create policy "soul_training_own_folder_all" on storage.objects
  for all
  using (bucket_id = 'soul-training' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'soul-training' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "soul_generated_own_folder_all" on storage.objects
  for all
  using (bucket_id = 'soul-generated' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'soul-generated' and auth.uid()::text = (storage.foldername(name))[1]);
