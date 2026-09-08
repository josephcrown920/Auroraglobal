from pathlib import Path
import importlib.util


def load_module_from_path(name, path: Path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ROOT = Path(__file__).parent

# aurora-video
video_dir = ROOT / "aurora-video"
video_mod = load_module_from_path("aurora_video.coordinator", video_dir / "coordinator_agent.py")
video_clients = load_module_from_path("aurora_video.clients", video_dir / "clients_stub.py")
VideoAgent = getattr(video_mod, "CoordinatorAgent")
seedream = video_clients.SeedreamClient()
seedream_fb = video_clients.SeedreamFallbackClient()

# reasoning
deepseek_mod = load_module_from_path("reasoning.deepseek", ROOT / "reasoning" / "deepseek_client_stub.py")
DeepSeekClient = getattr(deepseek_mod, "DeepSeekClient")
reasoning = DeepSeekClient()

video_agent = VideoAgent(primary_client=seedream, fallback_client=seedream_fb, reasoning_client=reasoning)
print("video:", video_agent.generate_video("sunset", duration=2, camera_movement="zoom_in"))

# aurora-tts
tts_dir = ROOT / "aurora-tts"
tts_mod = load_module_from_path("aurora_tts.coordinator", tts_dir / "coordinator_agent.py")
tts_clients = load_module_from_path("aurora_tts.clients", tts_dir / "clients_stub.py")
TTSAgent = getattr(tts_mod, "CoordinatorAgent")
kokoro = tts_clients.KokoroClient()

tts_agent = TTSAgent(primary_client=kokoro, fallback_client=None, reasoning_client=reasoning)
print("tts:", tts_agent.generate_tts("hello world", voice="af_sky"))

# aurora-motion-studio
motion_dir = ROOT / "aurora-motion-studio"
motion_mod = load_module_from_path("aurora_motion.coordinator", motion_dir / "coordinator_agent.py")
motion_clients = load_module_from_path("aurora_motion.clients", motion_dir / "clients_stub.py")
MotionAgent = getattr(motion_mod, "CoordinatorAgent")
champ = motion_clients.ChampClient()
animatediff = motion_clients.AnimateDiffClient()

motion_agent = MotionAgent(primary_client=champ, fallback_client=animatediff, reasoning_client=reasoning)
print("motion:", motion_agent.generate_motion("ref.png", "drv.mp4", num_frames=8))

# aurora-lipsync
lipsync_dir = ROOT / "aurora-lipsync"
lipsync_mod = load_module_from_path("aurora_lipsync.coordinator", lipsync_dir / "coordinator_agent.py")
lipsync_clients = load_module_from_path("aurora_lipsync.clients", lipsync_dir / "clients_stub.py")
LipsyncAgent = getattr(lipsync_mod, "CoordinatorAgent")
latentsync = lipsync_clients.LatentSyncClient()

lipsync_agent = LipsyncAgent(primary_client=latentsync, fallback_client=None, reasoning_client=reasoning)
print("lipsync:", lipsync_agent.generate_lipsync("audio.mp3", "face.png"))
