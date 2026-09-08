"""
Kokoro TTS HTTP adapter skeleton.
This is a generic HTTP adapter which expects the following env vars:
- KOKORO_API_URL (full base URL)
- KOKORO_API_KEY

If you provide the actual API details I can tailor the body/endpoint to the real shape.
"""
from __future__ import annotations
import os
from typing import Any, Dict, Optional
import requests


class KokoroAdapter:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None, timeout: int = 30):
        self.api_url = api_url or os.environ.get("KOKORO_API_URL")
        self.api_key = api_key or os.environ.get("KOKORO_API_KEY")
        self.timeout = timeout
        if not self.api_url or not self.api_key:
            raise RuntimeError("KOKORO_API_URL and KOKORO_API_KEY must be set to use KokoroAdapter")

    def generate_tts(self, text: str, voice: str = "af_sky", speed: float = 1.0, **kwargs) -> Dict[str, Any]:
        url = f"{self.api_url.rstrip('/')}/generate-tts"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"text": text, "voice": voice, "speed": speed}
        payload.update(kwargs)
        resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return {"client": "kokoro", "response": resp.json()}
