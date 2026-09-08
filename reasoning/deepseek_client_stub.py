"""
Simple DeepSeek reasoning client stub for local testing.
"""

class DeepSeekClient:
    def enhance_prompt(self, prompt: str) -> str:
        return f"{prompt} [enhanced by DeepSeek]"

    def optimize_tts_params(self, text: str, voice: str, speed: float):
        # no-op optimization for stubs
        return text, voice, speed

    def optimize_motion_inputs(self, ref: str, drv: str, n: int = None):
        return ref, drv, n

    def validate_av_inputs(self, audio_url: str, image_url: str):
        return audio_url, image_url

    def handle_video_failure(self, prompt: str, error=None):
        return {"recovered": True, "prompt": prompt}

    def handle_tts_failure(self, text: str, error=None):
        return {"recovered": True, "text": text}

    def handle_motion_failure(self, ref: str, drv: str, error=None):
        return {"recovered": True, "ref": ref, "drv": drv}

    def handle_lipsync_failure(self, audio_url: str, image_url: str, error=None):
        return {"recovered": True, "audio": audio_url, "image": image_url}

    def analyze_text(self, text: str):
        return {"analysis": "ok", "text": text}

    def analyze_audio(self, audio_url: str):
        return {"analysis": "ok", "audio": audio_url}
