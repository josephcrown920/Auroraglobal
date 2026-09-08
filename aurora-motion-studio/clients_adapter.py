"""
Adapter skeletons for Champ and AnimateDiff (motion generation).
"""
import os


class ChampAdapter:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("CHAMP_API_KEY")
        # TODO: initialize Champ SDK client

    def generate_motion(self, reference_image_url, driving_video_url, num_frames=16, **kwargs):
        raise NotImplementedError("Implement ChampAdapter.generate_motion using the Champ SDK")


class AnimateDiffAdapter:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("ANIMATEDIFF_API_KEY")
        # TODO: initialize AnimateDiff client / wrapper

    def generate_motion(self, reference_image_url, driving_video_url, num_frames=16, **kwargs):
        raise NotImplementedError("Implement AnimateDiffAdapter.generate_motion using AnimateDiff")
