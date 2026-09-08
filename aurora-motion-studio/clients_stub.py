"""
Stub clients for aurora-motion-studio to allow local smoke tests without external services.
"""

class ChampClient:
    def generate_motion(self, reference_image_url, driving_video_url, num_frames=16, **kwargs):
        return {"client": "champ", "ref": reference_image_url, "drv": driving_video_url, "num_frames": num_frames}

class AnimateDiffClient:
    def generate_motion(self, reference_image_url, driving_video_url, num_frames=16, **kwargs):
        return {"client": "animatediff", "ref": reference_image_url, "drv": driving_video_url, "num_frames": num_frames}
