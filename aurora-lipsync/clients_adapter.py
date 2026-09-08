"""
Adapter skeletons for LatentSync lipsync SDK.
"""
import os


class LatentSyncAdapter:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("LATENTSYNC_API_KEY")
        # TODO: initialize LatentSync SDK

    def generate_lipsync(self, audio_url, image_url, **kwargs):
        raise NotImplementedError("Implement LatentSyncAdapter.generate_lipsync using the real SDK")
