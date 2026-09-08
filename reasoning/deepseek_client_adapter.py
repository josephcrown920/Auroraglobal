"""
DeepSeek adapter that calls a configurable HTTP reasoning service.
If DEEPSEEK_API_URL is not set, methods fall back to local no-op behaviour to preserve compatibility.

Environment variables:
- DEEPSEEK_API_URL (optional)
- DEEPSEEK_API_KEY (optional)
"""
from __future__ import annotations
import os
from typing import Any, Dict, Tuple
import requests


class DeepSeekAdapter:
    def __init__(self, api_url: str = None, api_key: str = None, timeout: int = 30):
        self.api_url = api_url or os.environ.get("DEEPSEEK_API_URL")
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        self.timeout = timeout

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_url:
            # Fallback to noop/stub behaviour
            return {"stub": True, "payload": payload}
        url = f"{self.api_url.rstrip('/')}/{path.lstrip('/')}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def enhance_prompt(self, prompt: str) -> str:
        if not self.api_url:
            return f"{prompt} [enhanced by DeepSeekAdapter-stub]"
        r = self._post("enhance_prompt", {"prompt": prompt})
        return r.get("enhanced_prompt", r.get("prompt", prompt))

    def optimize_tts_params(self, text: str, voice: str, speed: float):
        if not self.api_url:
            return text, voice, speed
        r = self._post("optimize_tts", {"text": text, "voice": voice, "speed": speed})
        return r.get("text", text), r.get("voice", voice), r.get("speed", speed)

    def optimize_motion_inputs(self, ref: str, drv: str, n: int = None):
        if not self.api_url:
            return ref, drv, n
        r = self._post("optimize_motion", {"reference": ref, "driving": drv, "num_frames": n})
        return r.get("reference", ref), r.get("driving", drv), r.get("num_frames", n)

    def validate_av_inputs(self, audio_url: str, image_url: str):
        if not self.api_url:
            return audio_url, image_url
        r = self._post("validate_av", {"audio_url": audio_url, "image_url": image_url})
        return r.get("audio_url", audio_url), r.get("image_url", image_url)

    def handle_video_failure(self, prompt: str, error=None):
        if not self.api_url:
            return {"recovered": True, "prompt": prompt}
        r = self._post("recover_video", {"prompt": prompt, "error": str(error)})
        return r

    def handle_tts_failure(self, text: str, error=None):
        if not self.api_url:
            return {"recovered": True, "text": text}
        return self._post("recover_tts", {"text": text, "error": str(error)})

    def handle_motion_failure(self, ref: str, drv: str, error=None):
        if not self.api_url:
            return {"recovered": True, "ref": ref, "drv": drv}
        return self._post("recover_motion", {"reference": ref, "driving": drv, "error": str(error)})

    def handle_lipsync_failure(self, audio_url: str, image_url: str, error=None):
        if not self.api_url:
            return {"recovered": True, "audio": audio_url, "image": image_url}
        return self._post("recover_lipsync", {"audio_url": audio_url, "image_url": image_url, "error": str(error)})

    def analyze_text(self, text: str):
        if not self.api_url:
            return {"analysis": "stub", "text": text}
        return self._post("analyze_text", {"text": text})

    def analyze_audio(self, audio_url: str):
        if not self.api_url:
            return {"analysis": "stub", "audio": audio_url}
        return self._post("analyze_audio", {"audio_url": audio_url})
