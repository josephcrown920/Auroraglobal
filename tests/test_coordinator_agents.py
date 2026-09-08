"""Pytest unit tests for coordinator agents using the stub clients and DeepSeek reasoning stub."""
from pathlib import Path
import importlib.util
import pytest


def load_module_from_path(name, path: Path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

ROOT = Path(__file__).resolve().parent.parent

# load reasoning stub
deepseek_mod = load_module_from_path("reasoning.deepseek", ROOT / "reasoning" / "deepseek_client_stub.py")
DeepSeekClient = getattr(deepseek_mod, "DeepSeekClient")

# load aurora-video modules
video_mod = load_module_from_path("aurora_video.coordinator", ROOT / "aurora-video" / "coordinator_agent.py")
video_clients = load_module_from_path("aurora_video.clients", ROOT / "aurora-video" / "clients_stub.py")
VideoAgent = getattr(video_mod, "CoordinatorAgent")
SeedreamClient = getattr(video_clients, "SeedreamClient")
SeedreamFallbackClient = getattr(video_clients, "SeedreamFallbackClient")

# load aurora-tts modules
tts_mod = load_module_from_path("aurora_tts.coordinator", ROOT / "aurora-tts" / "coordinator_agent.py")
tts_clients = load_module_from_path("aurora_tts.clients", ROOT / "aurora-tts" / "clients_stub.py")
TTSAgent = getattr(tts_mod, "CoordinatorAgent")
KokoroClient = getattr(tts_clients, "KokoroClient")

# load motion modules
motion_mod = load_module_from_path("aurora_motion.coordinator", ROOT / "aurora-motion-studio" / "coordinator_agent.py")
motion_clients = load_module_from_path("aurora_motion.clients", ROOT / "aurora-motion-studio" / "clients_stub.py")
MotionAgent = getattr(motion_mod, "CoordinatorAgent")
ChampClient = getattr(motion_clients, "ChampClient")
AnimateDiffClient = getattr(motion_clients, "AnimateDiffClient")

# load lipsync modules
lipsync_mod = load_module_from_path("aurora_lipsync.coordinator", ROOT / "aurora-lipsync" / "coordinator_agent.py")
lipsync_clients = load_module_from_path("aurora_lipsync.clients", ROOT / "aurora-lipsync" / "clients_stub.py")
LipsyncAgent = getattr(lipsync_mod, "CoordinatorAgent")
LatentSyncClient = getattr(lipsync_clients, "LatentSyncClient")


def test_video_primary_success():
    reasoning = DeepSeekClient()
    primary = SeedreamClient()
    fallback = SeedreamFallbackClient()
    agent = VideoAgent(primary_client=primary, fallback_client=fallback, reasoning_client=reasoning)
    out = agent.generate_video("sunset", duration=1)
    assert out["client"] == "seedream"
    assert "sunset" in out["prompt"]


def test_video_primary_failure_fallback_used():
    class PrimaryRaises:
        def generate_video(self, *args, **kwargs):
            raise RuntimeError("primary down")

    primary = PrimaryRaises()
    fallback = SeedreamFallbackClient()
    reasoning = DeepSeekClient()
    agent = VideoAgent(primary_client=primary, fallback_client=fallback, reasoning_client=reasoning)
    out = agent.generate_video("sunset", duration=1)
    assert out["client"] == "seedream_fallback"


def test_video_both_fail_reasoning_recovers():
    class PrimaryRaises:
        def generate_video(self, *a, **k):
            raise RuntimeError("primary down")
    class FallbackRaises:
        def generate_video(self, *a, **k):
            raise RuntimeError("fallback down")

    agent = VideoAgent(primary_client=PrimaryRaises(), fallback_client=FallbackRaises(), reasoning_client=DeepSeekClient())
    out = agent.generate_video("sunset", duration=1)
    assert out.get("recovered") is True


def test_tts_with_reasoning_optimize():
    reasoning = DeepSeekClient()
    agent = TTSAgent(primary_client=KokoroClient(), fallback_client=None, reasoning_client=reasoning)
    out = agent.generate_tts("hello world", voice="af_sky")
    assert out["client"] == "kokoro"


def test_motion_fallback_path():
    class PrimaryRaises:
        def generate_motion(self, *a, **k):
            raise RuntimeError("champ down")

    agent = MotionAgent(primary_client=PrimaryRaises(), fallback_client=AnimateDiffClient(), reasoning_client=DeepSeekClient())
    out = agent.generate_motion("ref.png", "drv.mp4", num_frames=4)
    assert out["client"] == "animatediff"


def test_lipsync_primary_success():
    agent = LipsyncAgent(primary_client=LatentSyncClient(), fallback_client=None, reasoning_client=DeepSeekClient())
    out = agent.generate_lipsync("a.mp3", "i.png")
    assert out["client"] == "latentsync"
