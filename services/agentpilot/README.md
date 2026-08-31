# Aurora AgentPilot service

This internal-only service connects Aurora's server routes to AgentPilot's Python SDK.

## Configuration

Set these values in the service runtime, never in the browser:

- `AGENTPILOT_API_KEY`
- `AGENTPILOT_API_URL`
- `AGENTPILOT_WORKSPACE_ID`
- `AURORA_INTERNAL_SERVICE_TOKEN`
- `AGENTPILOT_DIRECTOR_TASK_ID` and `AGENTPILOT_DIRECTOR_PROMPT_VERSION`
- `AGENTPILOT_PRODUCTION_TASK_ID` and `AGENTPILOT_PRODUCTION_PROMPT_VERSION`

Run locally with `python app.py`. It listens on `127.0.0.1:8788` by default; use
`AGENTPILOT_SERVICE_HOST` and `AGENTPILOT_SERVICE_PORT` to override that. It must
not be exposed directly to the public internet.
