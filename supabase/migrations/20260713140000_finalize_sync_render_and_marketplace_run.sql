-- Task #214: Close the crash-window in synchronous renders and marketplace charges.
--
-- Two code paths used the old multi-step pattern: write a result row, then call
-- commit_reservation / release_reservation as separate Postgres calls. A process
-- crash or network failure between those two steps leaves credits_reserved stuck
-- (reservation never committed or released) and the result row in an inconsistent
-- state. This mirrors the problem task #94 fixed for the jobs worker queue via
-- finalize_job.
--
-- finalize_sync_render: folds the generations INSERT and commit_reservation into
-- a single plpgsql body. Postgres runs the body as one transaction, so any error
-- rolls back both writes atomically. Used by generate-core.server.ts (Aurora Agent
-- per-shot renders, /api/public/generate immediate renders).
--
-- finalize_marketplace_run: folds the marketplace_template_runs INSERT,
-- commit_reservation, and the creator grant_credits into one transaction. Used by
-- marketplace.functions.ts chargeMarketplaceTemplateRun. Multi-step compensating
-- logic (delete run + release + re-throw) is eliminated — the single transaction
-- either succeeds completely or rolls back completely.

-- ─── finalize_sync_render ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.finalize_sync_render(
  _user_id          uuid,
  _prompt           text,
  _kind             text,
  _mode             text,
  _input_images     jsonb,
  _audio_url        text,
  _model            text,
  _result_image_url text,
  _result_video_url text,
  _result_text      text,
  _credits_cost     integer,
  _session_id       uuid,
  _agent_shot_id    text,
  _amount           integer,
  _reason           text,
  _ref              uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gen_id uuid;
BEGIN
  INSERT INTO public.generations (
    user_id, prompt, kind, mode, status,
    input_images, audio_url, model,
    result_image_url, result_video_url, result_text,
    credits_cost, session_id, agent_shot_id
  ) VALUES (
    _user_id,
    COALESCE(_prompt, ''),
    _kind,
    COALESCE(_mode, 'performance'),
    'succeeded',
    COALESCE(_input_images, '[]'::jsonb),
    _audio_url,
    _model,
    _result_image_url,
    _result_video_url,
    _result_text,
    _credits_cost,
    _session_id,
    _agent_shot_id
  )
  RETURNING id INTO _gen_id;

  -- Commit the reservation in the same transaction as the INSERT.
  -- If anything here raises, Postgres rolls back both the generations row and the
  -- ledger entries — no partial state is possible.
  PERFORM public.commit_reservation(_user_id, _amount, _reason, _ref);

  RETURN _gen_id;
END; $$;

-- Server-only; same hardening as finalize_job.
REVOKE ALL ON FUNCTION public.finalize_sync_render(
  uuid, text, text, text, jsonb, text, text, text, text, text,
  integer, uuid, text, integer, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_sync_render(
  uuid, text, text, text, jsonb, text, text, text, text, text,
  integer, uuid, text, integer, text, uuid
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_sync_render(
  uuid, text, text, text, jsonb, text, text, text, text, text,
  integer, uuid, text, integer, text, uuid
) TO service_role;

-- ─── finalize_marketplace_run ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.finalize_marketplace_run(
  _runner_user_id    uuid,
  _creator_user_id   uuid,
  _template_id       uuid,
  _aura_charged      integer,
  _creator_cut_aura  integer,
  _platform_cut_aura integer,
  _amount            integer,
  _reason            text,
  _ref               uuid,
  _creator_ref       uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Record the run.
  INSERT INTO public.marketplace_template_runs (
    template_id, runner_user_id, creator_user_id,
    aura_charged, creator_cut_aura, platform_cut_aura
  ) VALUES (
    _template_id, _runner_user_id, _creator_user_id,
    _aura_charged, _creator_cut_aura, _platform_cut_aura
  );

  -- Commit buyer's reservation atomically with the run record.
  PERFORM public.commit_reservation(_runner_user_id, _amount, _reason, _ref);

  -- Grant the creator their cut in the same transaction. If the grant raises
  -- (e.g. the creator profile does not exist), the run INSERT and the commit
  -- both roll back — no partial state where the buyer is charged but creator
  -- is not paid.
  IF _creator_cut_aura > 0 AND _creator_user_id IS DISTINCT FROM _runner_user_id THEN
    PERFORM public.grant_credits(
      _creator_user_id,
      _creator_cut_aura,
      'marketplace_creator_cut:' || _template_id::text,
      _creator_ref
    );
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.finalize_marketplace_run(
  uuid, uuid, uuid, integer, integer, integer, integer, text, uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_marketplace_run(
  uuid, uuid, uuid, integer, integer, integer, integer, text, uuid, uuid
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_marketplace_run(
  uuid, uuid, uuid, integer, integer, integer, integer, text, uuid, uuid
) TO service_role;
