-- Atomic one-time email claims for lifecycle messages. Repeated cron ticks and
-- concurrent job finalizers must not send the same celebration twice.
ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS email_log_dedupe_key_idx
  ON public.email_log (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_email_delivery(
  _user uuid,
  _to_email text,
  _template text,
  _dedupe_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed uuid;
BEGIN
  INSERT INTO public.email_log (user_id, to_email, template, status, dedupe_key)
  VALUES (_user, _to_email, _template, 'queued', _dedupe_key)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO _claimed;

  IF _claimed IS NOT NULL THEN
    RETURN _claimed;
  END IF;

  -- A failed delivery may be retried by the next qualifying event. The
  -- status predicate makes this recovery claim atomic with concurrent retries.
  UPDATE public.email_log
  SET status = 'queued', error = NULL, sent_at = now()
  WHERE dedupe_key = _dedupe_key
    AND status = 'failed'
  RETURNING id INTO _claimed;

  RETURN _claimed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_email_delivery(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_delivery(uuid, text, text, text) TO service_role;