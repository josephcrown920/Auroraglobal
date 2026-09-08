"""
Real client adapter skeletons for wiring production SDKs. These adapters are placeholders — implement the SDK calls inside the methods and handle auth via environment variables.
"""
import os


class SeedreamAdapter:
    """Adapter for Seedream / Wan2.1 video generation SDK.

    Usage:
        adapter = SeedreamAdapter(api_key=os.environ.get('SEEDREAM_API_KEY'))
        adapter.generate_video(prompt, duration=5)

    Implement the real SDK calls inside generate_video and map the response to the dict format expected by CoordinatorAgent.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("SEEDREAM_API_KEY")
        # TODO: import and instantiate the real SDK client here, e.g.:
        # from seedream import SeedreamClient as SDK
        # self.client = SDK(api_key=self.api_key)

    def generate_video(self, prompt, duration=5, camera_movement=None, **kwargs):
        # TODO: call real SDK and return a structured response
        raise NotImplementedError("Implement SeedreamAdapter.generate_video with the real SDK")


class SeedreamFallbackAdapter(SeedreamAdapter):
    def generate_video(self, prompt, duration=5, camera_movement=None, **kwargs):
        # TODO: implement fallback behaviour (another model/endpoint) or subprocess invocation
        raise NotImplementedError("Implement fallback pathway")
