
CREATE POLICY "ad-photos owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ad-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ad-photos owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ad-photos owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ad-photos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
