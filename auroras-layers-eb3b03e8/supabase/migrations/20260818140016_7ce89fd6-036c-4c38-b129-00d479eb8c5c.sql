CREATE POLICY "Creators can read their own Aurora media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'aurora-projects' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Creators can upload their own Aurora media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'aurora-projects' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Creators can update their own Aurora media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'aurora-projects' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'aurora-projects' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Creators can delete their own Aurora media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'aurora-projects' AND (storage.foldername(name))[1] = auth.uid()::text);