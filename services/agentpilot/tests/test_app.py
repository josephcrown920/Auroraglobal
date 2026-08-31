import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


def load_app():
    fake_sdk = types.SimpleNamespace()
    original = sys.modules.get("agent_pilot")
    sys.modules["agent_pilot"] = fake_sdk
    spec = importlib.util.spec_from_file_location("agentpilot_app", Path(__file__).parents[1] / "app.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if original is None:
        del sys.modules["agent_pilot"]
    else:
        sys.modules["agent_pilot"] = original
    return module


app = load_app()


class AgentPilotServiceValidationTests(unittest.TestCase):
    def test_normalizes_valid_messages(self):
        self.assertEqual(
            app.normalize_messages([{"role": "user", "content": "Make a music video"}]),
            [{"role": "user", "content": "Make a music video"}],
        )

    def test_rejects_invalid_message_role(self):
        with self.assertRaises(ValueError):
            app.normalize_messages([{"role": "tool", "content": "not permitted"}])

    def test_rejects_oversized_content(self):
        with self.assertRaises(ValueError):
            app.bounded_text("x" * (app.MAX_TEXT_LENGTH + 1), "output")

    def test_only_known_agent_keys_are_configurable(self):
        with self.assertRaises(ValueError):
            app.agent_config("unknown-agent")

    def test_response_payload_is_compact_json(self):
        self.assertEqual(json.dumps({"ok": True}, separators=(",", ":")), '{"ok":true}')


if __name__ == "__main__":
    unittest.main()
