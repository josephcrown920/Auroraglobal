# AgentPilot Video Agents Design

**Date:** 2026-08-31
**Status:** Approved for implementation
**Scope:** Shared AgentPilot prompt, feedback, evaluation, reporting, and bad-case workflow for Aurora's present and future video agents. Searchable uploaded documents and RAG are explicitly out of scope.

## Goal

Use AgentPilot as Aurora's control plane for agent prompts and quality improvement without moving model inference out of Aurora. The current Director and Production agents, and every later video agent, must use one consistent integration boundary.

## Chosen architecture

Aurora's existing TypeScript/TanStack Start API routes remain responsible for request validation, model selection, and calls to the configured model gateway. A private Python AgentPilot service uses the official `agent-pilot-sdk` to retrieve versioned agent prompts, capture inference inputs and outputs, submit evaluation work, and retrieve evaluation reports and bad-case results.

The browser never calls AgentPilot and never receives AgentPilot, Ark, or model-provider credentials. Aurora sends only server-to-server requests to the Python service. The service reads `AGENTPILOT_API_KEY`, `AGENTPILOT_API_URL`, and `AGENTPILOT_WORKSPACE_ID` at runtime; it reads `ARK_API_KEY` only if a configured AgentPilot workflow uses ModelArk inference.

## Components

### Python AgentPilot service

A standalone, internal-only Python service owns all use of `agent-pilot-sdk`.

It exposes a narrow authenticated HTTP contract for Aurora:

- `GET /v1/agents/:agentKey/prompt`: resolve the active versioned prompt/task for an agent.
- `POST /v1/runs`: record a normalized inference run with prompt version, selected model, input summary, output, latency, and outcome.
- `POST /v1/evaluations`: submit an evaluation for a completed run using the agent's configured criteria.
- `GET /v1/evaluations/:evaluationId`: return evaluation status and scores.
- `GET /v1/reports/:agentKey`: return a bounded, sanitized report summary suitable for internal Aurora monitoring.
- `GET /v1/bad-cases`: return paginated bad cases filtered by agent and time range.

The API is deliberately provider-neutral. Its public payload uses Aurora agent keys rather than AgentPilot task IDs, so task identifiers and SDK details remain inside the service configuration.

### Aurora AgentPilot client

A small server-only TypeScript client wraps the service contract. It provides methods to:

- resolve a system prompt by `agentKey` with a safe local fallback;
- start and finish a run record;
- submit evaluation asynchronously after model output is available; and
- retrieve evaluation/report data for future internal views.

The client is the only AgentPilot-specific dependency used by Aurora routes. Future agents use it by declaring an agent key and calling the same lifecycle helpers.

### Agent registry

A typed, server-side registry defines each Aurora agent's stable key, local fallback prompt, AgentPilot task reference, expected output shape, and evaluation profile. Initial entries are `director` and `production`; additions such as a storyboard or video-generation agent are registry additions rather than custom one-off integrations.

## Request and evaluation flow

1. A browser calls an existing Aurora API route.
2. The route validates the request and resolves the selected Aurora model from the existing allow-list.
3. The route asks the AgentPilot client for the active prompt associated with its agent key. If the AgentPilot service is unavailable, it uses the local fallback prompt and records a degraded-mode event.
4. Aurora calls its existing model gateway using the resolved prompt and validated user context.
5. The route returns the model result with its current response contract, avoiding a breaking client change.
6. In parallel and best-effort, Aurora records the completed run. The record includes non-secret metadata, selected model, prompt version, redacted input/output, result status, and latency.
7. The AgentPilot service submits or triggers the configured evaluation. Aurora does not block the user response on evaluation completion.
8. Evaluation scores, reports, and bad-case flags become available through the internal service for monitoring and future quality-review UI.

## Reliability and error handling

- AgentPilot outages never prevent an otherwise valid Director or Production generation from completing.
- The prompt resolution call has a short timeout. Failure selects the local fallback prompt.
- Telemetry and evaluation submissions use strict timeouts, bounded payload sizes, and are best-effort.
- The service returns safe error codes; it never return-stack traces, credentials, full raw provider requests, or unredacted user data to browsers.
- Each run has a correlation ID that appears in Aurora logs and AgentPilot metadata.
- A failed evaluation is retriable independently of inference. Duplicate delivery is safe through an idempotency key based on the Aurora run ID.

## Security and privacy

- All secrets remain environment variables configured only in server runtimes. No `AGENTPILOT_*`, `ARK_API_KEY`, or internal service token is exposed through `VITE_*`, source code, client bundles, local storage, or API responses.
- The service is not public: Aurora authenticates with a separate internal token or platform service identity.
- Prompt input/output is minimized before telemetry: trim messages to the relevant window, impose size limits, and redact configured sensitive fields before sending to AgentPilot.
- AgentPilot workspace ID is required configuration. Startup/readiness reports a clear configuration error when required values are missing; it does not silently target a default workspace.

## Configuration

Aurora server runtime:

- `AGENTPILOT_SERVICE_URL`
- `AGENTPILOT_SERVICE_TOKEN`
- `AGENTPILOT_ENABLED` (explicit opt-in for rollout)

AgentPilot service runtime:

- `AGENTPILOT_API_KEY`
- `AGENTPILOT_API_URL`
- `AGENTPILOT_WORKSPACE_ID`
- `ARK_API_KEY` (optional)
- `AURORA_INTERNAL_SERVICE_TOKEN`

The repository's environment template documents variable names only and contains no live values.

## Rollout

1. Deploy the Python service with health/readiness checks and secret configuration.
2. Add AgentPilot tasks and evaluation criteria for `director` and `production` in the target workspace.
3. Enable the service integration behind `AGENTPILOT_ENABLED` for one agent first.
4. Verify resolved prompt version, run records, evaluation reports, and bad-case discovery using non-production test prompts.
5. Enable the other current agent and make all new video-agent routes use the registry/lifecycle client.

## Testing

- Unit test the TypeScript client for successful responses, timeouts, unavailable service, payload redaction, and fallback prompt selection.
- Unit test the Python service's SDK adapter with mocked SDK calls, required-workspace enforcement, authentication, idempotency, and error mapping.
- Route tests verify Director and Production preserve their current client-facing response formats when AgentPilot is enabled and when it is unavailable.
- Contract tests cover the Aurora-service HTTP schema.
- An integration smoke test in a test workspace confirms a run appears with the intended task/prompt version and produces an evaluation result.

## Explicit non-goals

- No uploaded-document store, document search, RAG pipeline, or knowledge-base UI.
- No model hosting or inference migration to AgentPilot.
- No browser-side SDK installation or browser-visible service credentials.
- No user-facing evaluation dashboard in the initial delivery; the service contract supports one later.
