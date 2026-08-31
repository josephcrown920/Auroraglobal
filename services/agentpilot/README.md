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

## Container deployment

Build and run the service with an internal network only:

```bash
docker build -t aurora-agentpilot services/agentpilot
docker run --rm --env-file /secure/path/agentpilot.env -p 127.0.0.1:8788:8788 aurora-agentpilot
```

`agentpilot.env` must be provided by the deployment secret manager and must never
be committed. The service validates its required AgentPilot workspace and internal
authentication configuration at startup.

## Verification

```bash
python -m unittest discover -s services/agentpilot/tests -v
```
