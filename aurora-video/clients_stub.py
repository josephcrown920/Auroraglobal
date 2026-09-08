"""
Stub clients for aurora-video to allow local smoke tests without external services.
"""

class SeedreamClient:
    def generate_video(self, prompt, duration=5, camera_movement=None, **kwargs):
        return {"client": "seedream", "prompt": prompt, "duration": duration, "camera_movement": camera_movement}

class SeedreamFallbackClient:
    def generate_video(self, prompt, duration=5, camera_movement=None, **kwargs):
        return {"client": "seedream_fallback", "prompt": prompt, "duration": duration, "camera_movement": camera_movement}
