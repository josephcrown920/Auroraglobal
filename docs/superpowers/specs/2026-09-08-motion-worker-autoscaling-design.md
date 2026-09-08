# Motion worker autoscaling design

## Goal

Make Aurora able to supply MimicMotion capacity automatically for queued motion
work without allowing unattended GPU spending to become unbounded. The system
must bring up one suitable Vast.ai worker only when it is needed, wait until
Aurora can safely use it, and remove it promptly once it is idle.

## Baseline

Aurora already has a managed Vast lifecycle for an administrator-controlled
manual launch. It verifies a proposed offer twice, limits the price to
$0.35/hour, records a one-hour destruction deadline before renting, and keeps
the worker bootstrap and registration secret server-side. A cron endpoint
removes expired managed instances.

The missing layer is a demand-aware controller. The existing code does not
decide when to provision capacity, detect a failed bootstrap quickly, or scale
an otherwise healthy worker down when the motion backlog is empty.

## Chosen approach

Add a server-side autoscaling controller invoked by the protected Aurora cron
workflow. The controller manages only Vast rows created by Aurora and only
when an explicit autoscaling policy is enabled by an administrator.

The policy is intentionally narrow:

- one non-terminal, non-adopted managed instance may exist at a time;
- only `motion` backlog can trigger provisioning;
- the selected offer must be verified, rentable, have at least 24 GB VRAM,
  expose port 8000, and be at or below the existing $0.35/hour ceiling;
- the existing one-hour destruction deadline remains a non-negotiable hard
  backstop, not a renewal target;
- a worker is dispatch-eligible only after it registers, is approved/active,
  advertises `motion`, has a fresh heartbeat, and has spare concurrency;
- idle capacity is destroyed after a short quiet window; a worker with queued
  or processing motion work is not destroyed by the idle sweep;
- repeated offer, bootstrap, registration, or health failures enter a
  cooldown. The controller will not repeatedly create billable instances
  during an outage.

Automatic provisioning is policy activation, not a hidden fallback inside a
generation request. A user request still fails clearly while capacity is
starting or unavailable. It cannot reserve motion credits until a worker is
actually eligible.

## Components and flow

1. **Autoscale policy and controller**
   - Store one server-controlled policy/state record for the managed motion
     pool, including whether it is enabled, activity timestamps, and a
     bounded failure cooldown.
   - The controller reads only the current motion backlog and current managed
     instance/worker state, then atomically claims a scale decision before it
     can call Vast.
   - It reuses the existing lifecycle provisioner rather than adding a second
     direct Vast API path. The controller supplies a server-issued
     confirmation internally only after all policy checks pass.

2. **Provisioning**
   - When enabled backlog exists and no managed worker is active or
     provisioning, the controller searches eligible offers and chooses the
     lowest safe price.
   - It records the reservation before calling Vast, carries the existing
     $0.35/hour and one-hour limits through the managed lifecycle, and sends
     only the `motion` capability set required for this pool.
   - A failed create is recorded once and begins cooldown. No success is
     reported until Aurora observes a registered active worker.

3. **Readiness and recovery**
   - A starting worker has a bounded readiness window. If it does not expose a
     healthy, approved `motion` capability before that deadline, the
     controller destroys it and records a non-sensitive failure reason.
   - The scheduled expiry sweep remains responsible for final destruction and
     retries failures. Every destroy action remains managed-row scoped.

4. **Scale-to-zero**
   - The controller refreshes activity from queued/processing motion jobs and
     eligible-worker state.
   - Once no motion job is queued or processing for the idle interval, it
     destroys the managed worker. Stopping is not used as a spend-control
     substitute because Vast storage still accrues charges.
   - The absolute one-hour deadline wins over activity, so backlog cannot
     silently extend a rental.

5. **Admin visibility**
   - Admin orchestration/status surfaces show the autoscale policy state,
     current cooldown/reason, registered worker readiness, price/deadline,
     and the last scale decision.
   - They must never display the Vast key, registration secret, bearer token,
     or raw upstream error bodies.

## Security and production-spend controls

- The autoscaler is cron-only/server-only. It has no public user-controlled
  provision endpoint and uses existing administrator authentication for policy
  changes.
- Inputs from Vast are allow-listed and type/range checked before selection.
  No offer ID, endpoint, URL, or shell command from a request is interpreted
  unsafely.
- Database access uses the service role and atomic conditional claims. A
  second cron tick or concurrent request cannot create a second rental.
- The system caps one worker, $0.35/hour, 60 minutes per rental, one
  provisioning attempt per cooldown, and a bounded readiness timeout.
- All downstream API calls have bounded timeouts and safe error summaries.
  Credentials remain server-side; user-visible responses never echo upstream
  request content.
- Motion generation continues to require ownership checks, preview/final
  binding, reservation, and an active healthy worker before credits are
  reserved or a job is dispatched.

## Verification

- Unit tests cover eligibility filtering, one-worker admission, no-backlog
  behavior, stale/failed readiness, idle destruction, cooldown, deadline
  precedence, and concurrent decision fencing.
- Lifecycle tests continue to prove offer price revalidation and compensation
  if persistence fails after creation.
- A rollback-only database fixture proves the autoscale claim cannot double
  provision.
- A non-billable, read-only account/offer check confirms the Vast credential
  can perform account actions before any real launch.
- After explicit production readiness, a capped one-hour worker can be
  launched through the managed controller and verified only through its
  registration/health path. No user media or paid generation is needed for
  that operational check.

## Deferred scope

This design does not introduce multi-worker scaling, automatic deadline
renewal, generic GPU provider selection, or a silent hosted-model fallback.
Those would weaken the predictable spending and motion-transfer guarantees of
the first production autoscaling release.