
DROP POLICY IF EXISTS "aff events insert validated" ON public.affiliate_events;
CREATE POLICY "aff events insert validated" ON public.affiliate_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    kind = 'click'
    AND (amount_usd IS NULL OR amount_usd = 0)
    AND (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.affiliates a WHERE a.code = affiliate_events.code)
  );
