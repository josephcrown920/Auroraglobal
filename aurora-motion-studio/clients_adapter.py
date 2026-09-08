"""
Champ & AnimateDiff HTTP adapter skeletons.
These expect env vars:
- CHAMP_API_URL, CHAMP_API_KEY
- ANIMATEDIFF_API_URL, ANIMATEDIFF_API_KEY

If you supply SDK docs or exact endpoints I will tailor the calls.
"""
from __future__ import annotations
import os
from typing import Any, Dict, Optional
import requests


class ChampAdapter:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None, timeout: int = 60):
        self.api_url = api_url or os.environ.get("CHAMP_API_URL")
        self.api_key = api_key or os.environ.get("CHAMP_API_KEY")
        self.timeout = timeout
        if not self.api_url or not self.api_key:
            raise RuntimeError("CHAMP_API_URL and CHAMP_API_KEY must be set to use ChampAdapter")

    def generate_motion(self, reference_image_url: str, driving_video_url: str, num_frames: int = 16, **kwargs) -> Dict[str, Any]:
        url = f"{self.api_url.rstrip('/')}/generate-motion"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"reference_image_url": reference_image_url, "driving_video_url": driving_video_url, "num_frames": num_frames}
        payload.update(kwargs)
        resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return {"client": "champ", "response": resp.json()}


class AnimateDiffAdapter:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None, timeout: int = 60):
        self.api_url = api_url or os.environ.get("ANIMATEDIFF_API_URL")
        self.api_key = api_key or os.environ.get("ANIMATEDIFF_API_KEY")
        self.timeout = timeout
        if not self.api_url or not self.api_key:
            raise RuntimeError("ANIMATEDIFF_API_URL and ANIMATEDIFF_API_KEY must be set to use AnimateDiffAdapter")

    def generate_motion(self, reference_image_url: str, driving_video_url: str, num_frames: int = 16, **kwargs) -> Dict[str, Any]:
        url = f"{self.api_url.rstrip('/')}/generate-motion"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"reference_image_url": reference_image_url, "driving_video_url": driving_video_url, "num_frames": num_frames}
        payload.update(kwargs)
        resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return {"client": "animatediff", "response": resp.json()}
