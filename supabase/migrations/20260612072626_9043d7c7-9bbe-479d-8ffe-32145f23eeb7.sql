DROP POLICY IF EXISTS "device_codes auth approve" ON public.cli_device_codes;
CREATE POLICY "device_codes auth approve" ON public.cli_device_codes
  FOR UPDATE TO authenticated
  USING (status = 'pending' AND expires_at > now())
  WITH CHECK (user_id = auth.uid() AND status = 'approved');