# Aurora Soul Seedance Video Generation Design

## Goal

Implement Aurora Soul video generation as a native, end-to-end capability. A
user can submit an identity-locked video request, Aurora reserves credits,
dispatches a Seedance job, records and tracks its lifecycle, and makes a
completed video playable from the Soul library.

The deployment must provide `SEEDANCE_API_URL` and `SEEDANCE_API_KEY` as
server-only secrets. No credential is committed to the repository or exposed
to client-side code.

## Scope

This work adds:

- Soul generation and library routes.
- Server-side request validation and a Seedance provider adapter.
- Database persistence for Soul video jobs, ownership, lifecycle state, and
  output metadata.
- Credit reservation before dispatch, release on unsuccessful dispatch or a
  terminal provider failure, and finalization on completion.
- Status polling with bounded retry behavior and clear client-visible errors.
- Environment-variable documentation and a roadmap verification record.
- Automated tests for validation, provider-status normalization, and credit
  handling.

It does not add other video providers or a general-purpose queueing platform.

## Architecture

`/soul/generate/video` submits validated user input to the server-side Soul
service. The service owns the sequence below and is the only module that may
read the Seedance secret values:

1. Validate prompt, reference media, requested duration, and aspect ratio.
2. Create a queued `soul_video_jobs` row owned by the requesting user.
3. Reserve the applicable credits through `reserveOrchestrateRecord`.
4. Submit the normalized request through `SeedanceVideoProvider`.
5. Store the returned provider job ID and transition the row to `processing`.
6. Poll the provider through the same adapter until it reports a terminal
   outcome.
7. Persist the playable output URL on success, mark the row `completed`, and
   finalize the reservation. On terminal failure, mark it `failed` and release
   the reservation.

The provider adapter centralizes Seedance request construction, authentication,
timeouts, response validation, and mapping of provider states to Aurora's
`queued`, `processing`, `completed`, and `failed` states. The exact endpoint
path and request/response field mapping will follow the enabled Seedance
account's API documentation without changing the rest of Soul.

## Data and access control

The `soul_video_jobs` table stores a generated identifier, user/project owner,
Aurora status, provider job ID, sanitized request metadata, output URL,
failure code/message, timestamps, and an idempotency key. RLS permits users to
read only their own jobs and prevents browser clients from directly changing
job state. Server-side privileged operations perform all lifecycle updates.

The library reads only completed, owned jobs and renders the saved video URL
in a native video player. It must not render raw provider error text.

## Failure handling

- Missing Seedance configuration returns a clear configuration error before any
  provider request is made.
- A provider timeout or invalid response is recorded as a dispatch failure and
  releases the reservation.
- Polling uses a bounded interval and stop condition; it never loops
  indefinitely in a request handler.
- Duplicate submissions are deduplicated by idempotency key.
- Provider error text is logged safely on the server and reduced to a
  user-safe message for the UI.

## Configuration and verification

`.env.example` and `docs/ENV.md` will document the two required variables,
their server-only nature, and the deployment secret-store setup. They will use
placeholders only.

`ROADMAP.md` will move the video-generation item from blocked to verified only
after an authorized deployment has completed a real request. The evidence will
include the environment, timestamp, sanitized provider/job identifiers, and
observed lifecycle (`queued → processing → completed`), without including
credentials or user media.

## Testing

Unit tests will cover input validation, missing configuration, provider state
normalization, idempotency, and each credit outcome. Integration tests will use
a mocked Seedance server to prove job dispatch and polling transitions. A
manual deployment verification will confirm the authenticated provider call,
database rows, and library playback before the roadmap is updated.
