"""
LatentSync HTTP adapter skeleton for lipsync generation.
Expects:
- LATENTSYNC_API_URL
- LATENTSYNC_API_KEY
"""
from __future__ import annotations
import os
from typing import Any, Dict, Optional
import requests


class LatentSyncAdapter:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None, timeout: int = 60):
        self.api_url = api_url or os.environ.get("LATENTSYNC_API_URL")
        self.api_key = api_key or os.environ.get("LATENTSYNC_API_KEY")
        self.timeout = timeout
        if not self.api_url or not self.api_key:
            raise RuntimeError("LATENTSYNC_API_URL and LATENTSYNC_API_KEY must be set to use LatentSyncAdapter")

    def generate_lipsync(self, audio_url: str, image_url: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.api_url.rstrip('/')}/generate-lipsync"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"audio_url": audio_url, "image_url": image_url}
        payload.update(kwargs)
        resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return {"client": "latentsync", "response": resp.json()}
