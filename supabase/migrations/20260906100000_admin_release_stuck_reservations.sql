-- Admin-only repair for terminal job reservations that have remained
-- unsettled for more than one hour. Job id, user, amount, terminal status, and
-- credits_settled_at form a compare-and-swap fence, so this cannot refund
-- active work or a newer reservation on the same profile.
CREATE OR REPLACE FUNCTION public.admin_reconcile_stuck_reservation(
  _job uuid,
  _user uuid,
  _expected_amount integer,
  _actor uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.jobs;
  _reason text;
  _ledger_reason text;
BEGIN
  IF _expected_amount <= 0 THEN
    RAISE EXCEPTION 'admin_reconcile_stuck_reservation: amount must be positive';
  END IF;

  UPDATE public.jobs
     SET credits_settled_at = now()
   WHERE id = _job
     AND user_id = _user
     AND status IN ('succeeded', 'failed')
     AND credits_reserved = _expected_amount
     AND credits_reserved > 0
     AND updated_at < now() - interval '1 hour'
     AND credits_settled_at IS NULL
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN 'changed';
  END IF;

  _reason := 'admin_reconcile_' || _row.kind;
  IF _row.status = 'succeeded' THEN
    PERFORM public.commit_reservation(_row.user_id, _row.credits_reserved, _reason, _row.id);
    _ledger_reason := 'commit:' || _reason;
  ELSE
    PERFORM public.release_reservation(_row.user_id, _row.credits_reserved, _reason, _row.id);
    _ledger_reason := 'release:' || _reason;
  END IF;

  UPDATE public.credit_ledger
     SET actor_id = _actor
   WHERE user_id = _row.user_id
     AND ref_id = _row.id
     AND reason = _ledger_reason
     AND actor_id IS NULL;

  RETURN CASE WHEN _row.status = 'succeeded' THEN 'committed' ELSE 'released' END;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reconcile_stuck_reservation(uuid, uuid, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_stuck_reservation(uuid, uuid, integer, uuid)
  TO service_role;