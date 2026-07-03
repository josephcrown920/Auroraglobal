DROP POLICY IF EXISTS "device_codes auth read" ON public.cli_device_codes;
CREATE POLICY "device_codes own read" ON public.cli_device_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);