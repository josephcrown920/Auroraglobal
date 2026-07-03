
-- Tighten public contact_messages INSERT (replace USING true with validation)
DROP POLICY IF EXISTS "anyone can send contact message" ON public.contact_messages;
CREATE POLICY "anyone can send contact message"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(message,'')) BETWEEN 5 AND 5000
  AND length(coalesce(email,'')) BETWEEN 5 AND 320
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(coalesce(topic,'')) <= 64
  AND (name IS NULL OR length(name) <= 120)
  AND (user_id IS NULL OR user_id = auth.uid())
  AND status = 'new'
);

-- Revoke EXECUTE on credit-mutating SECURITY DEFINER functions from end users.
-- They are intended to be called from server functions using the service role.
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) TO service_role;
