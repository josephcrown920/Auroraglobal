"""
Stub clients for aurora-lipsync to allow local smoke tests without external services.
"""

class LatentSyncClient:
    def generate_lipsync(self, audio_url, image_url, **kwargs):
        return {"client": "latentsync", "audio": audio_url, "image": image_url}

class LatentSyncFallbackClient:
    def generate_lipsync(self, audio_url, image_url, **kwargs):
        return {"client": "latentsync_fallback", "audio": audio_url, "image": image_url}
