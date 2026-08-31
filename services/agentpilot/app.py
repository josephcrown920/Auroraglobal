"""Internal HTTP adapter for AgentPilot prompt, telemetry, and evaluation APIs."""

from __future__ import annotations

import hmac
import json
import os
import re
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Final

import agent_pilot

MAX_BODY_BYTES: Final = 64 * 1024
MAX_TEXT_LENGTH: Final = 12_000
AGENT_KEY_RE: Final = re.compile(r"^[a-z][a-z0-9-]{0,63}$")
AGENTS: Final = {"director": "DIRECTOR", "production": "PRODUCTION"}


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required configuration: {name}")
    return value


def agent_config(agent_key: str) -> tuple[str, str]:
    if agent_key not in AGENTS:
        raise ValueError("Unknown agent key")
    prefix = f"AGENTPILOT_{AGENTS[agent_key]}"
    return required_env(f"{prefix}_TASK_ID"), required_env(f"{prefix}_PROMPT_VERSION")


def bounded_text(value: Any, field: str, *, required: bool = True) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    text = value.strip()
    if required and not text:
        raise ValueError(f"{field} is required")
    if len(text) > MAX_TEXT_LENGTH:
        raise ValueError(f"{field} exceeds {MAX_TEXT_LENGTH} characters")
    return text


def normalize_messages(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list) or not value or len(value) > 12:
        raise ValueError("messages must contain 1 to 12 items")
    messages: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict) or item.get("role") not in {"user", "assistant", "system"}:
            raise ValueError("messages contain an invalid role")
        messages.append({"role": item["role"], "content": bounded_text(item.get("content"), "message content")})
    return messages


def json_model(value: Any) -> Any:
    return value.model_dump() if hasattr(value, "model_dump") else value


class AuroraHandler(BaseHTTPRequestHandler):
    server_version = "AuroraAgentPilot/1.0"

    def log_message(self, _format: str, *_args: Any) -> None:
        # Inputs and model output may contain personal or sensitive content; never log either.
        return

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        expected = os.environ.get("AURORA_INTERNAL_SERVICE_TOKEN", "")
        received = self.headers.get("Authorization", "").removeprefix("Bearer ")
        return bool(expected) and hmac.compare_digest(expected, received)

    def read_payload(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY_BYTES:
            raise ValueError("invalid request size")
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ValueError("request body must be an object")
        return value

    def do_GET(self) -> None:  # noqa: N802
        if not self.authorized():
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return
        match = re.fullmatch(r"/v1/agents/([a-z0-9-]+)/prompt", self.path)
        if not match or not AGENT_KEY_RE.fullmatch(match.group(1)):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        try:
            task_id, version = agent_config(match.group(1))
            prompt = agent_pilot.get_prompt(task_id, version, workspace_id=required_env("AGENTPILOT_WORKSPACE_ID"))
            self.send_json(HTTPStatus.OK, {
                "taskId": prompt.task_id,
                "version": prompt.version,
                "messages": prompt.messages or [],
                "model": prompt.model_name,
            })
        except (RuntimeError, ValueError):
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "prompt unavailable"})

    def do_POST(self) -> None:  # noqa: N802
        if not self.authorized():
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return
        try:
            payload = self.read_payload()
            if self.path == "/v1/runs":
                self.record_run(payload)
            elif self.path == "/v1/evaluations":
                self.evaluate_run(payload)
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        except (ValueError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid request"})
        except RuntimeError:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "AgentPilot unavailable"})

    def record_run(self, payload: dict[str, Any]) -> None:
        agent_key = bounded_text(payload.get("agentKey"), "agentKey")
        run_id = bounded_text(payload.get("runId"), "runId")
        model = bounded_text(payload.get("model"), "model")
        output = bounded_text(payload.get("output"), "output")
        messages = normalize_messages(payload.get("messages"))
        task_id, version = agent_config(agent_key)
        agent_pilot.track_event(
            run_type="llm", event_name="end", run_id=run_id, task_id=task_id, version=version,
            workspace_id=required_env("AGENTPILOT_WORKSPACE_ID"), model_name=model,
            input_messages=messages, output_message={"role": "assistant", "content": output},
            tags=[f"aurora:{agent_key}"], runtime="aurora-agentpilot-service",
        )
        threading.Thread(target=agent_pilot.flush, daemon=True).start()
        self.send_json(HTTPStatus.ACCEPTED, {"runId": run_id})

    def evaluate_run(self, payload: dict[str, Any]) -> None:
        agent_key = bounded_text(payload.get("agentKey"), "agentKey")
        run_id = bounded_text(payload.get("runId"), "runId")
        output = bounded_text(payload.get("output"), "output")
        messages = normalize_messages(payload.get("messages"))
        task_id, version = agent_config(agent_key)
        metric = agent_pilot.get_metric(task_id, version, workspace_id=required_env("AGENTPILOT_WORKSPACE_ID"))
        result = agent_pilot.eval.evaluate(
            {"example_id": run_id, "messages": messages, "response": output},
            json_model(metric), workspace_id=required_env("AGENTPILOT_WORKSPACE_ID"),
        )
        self.send_json(HTTPStatus.OK, {"runId": run_id, "result": json_model(result)})


def main() -> None:
    required_env("AGENTPILOT_API_KEY")
    required_env("AGENTPILOT_WORKSPACE_ID")
    required_env("AURORA_INTERNAL_SERVICE_TOKEN")
    host = os.environ.get("AGENTPILOT_SERVICE_HOST", "127.0.0.1")
    port = int(os.environ.get("AGENTPILOT_SERVICE_PORT", "8788"))
    ThreadingHTTPServer((host, port), AuroraHandler).serve_forever()


if __name__ == "__main__":
    main()
