
import re
from typing import Dict, Any, List

PRESETS = {
    "bullet-time": {
        "name": "Bullet Time",
        "slug": "bullet-time",
        "aliases": ["freeze orbit", "time freeze", "orbit freeze"],
        "visual_description": "The subject appears frozen in a high-impact moment while the camera glides around them with glossy cinematic lighting and dramatic spatial tension.",
        "defaults": {"environment": "street", "camera": "low_angle_orbit", "energy": "cinematic", "aspect_ratio": "9:16", "duration": 5}
    },
    "neon-rim-hero": {
        "name": "Neon Rim Hero",
        "slug": "neon-rim-hero",
        "aliases": ["blue neon hero", "cold neon", "music video hero"],
        "visual_description": "The subject feels larger than life, wrapped in cold blue-white neon edging, with black shadows swallowing the frame and glossy purple-blue highlights carving out the silhouette.",
        "defaults": {"environment": "rooftop", "camera": "slow_push_in", "energy": "cinematic", "aspect_ratio": "9:16", "duration": 5}
    },
    "burning-city": {
        "name": "Burning City",
        "slug": "burning-city",
        "aliases": ["fire city", "apocalypse city", "embers"],
        "visual_description": "The subject walks through a city glowing with firelight, drifting embers, smoke, scorched atmosphere, and cinematic destruction, framed like a blockbuster trailer moment.",
        "defaults": {"environment": "burning_city", "camera": "walk_toward_camera", "energy": "cinematic", "aspect_ratio": "9:16", "duration": 5}
    }
}

def detect_preset(prompt: str) -> str:
    p = prompt.lower()
    for slug, preset in PRESETS.items():
        if preset["name"].lower() in p or slug in p:
            return slug
        for alias in preset.get("aliases", []):
            if alias.lower() in p:
                return slug
    if "neon" in p or "cold blue" in p:
        return "neon-rim-hero"
    if "fire" in p or "burning" in p or "embers" in p:
        return "burning-city"
    return "bullet-time"

def extract_aspect(prompt: str) -> str:
    for a in ["9:16", "16:9", "1:1"]:
        if a in prompt:
            return a
    return None

def extract_energy(prompt: str) -> str:
    vals = ["slow", "cinematic", "aggressive", "chaotic", "intense"]
    p = prompt.lower()
    for v in vals:
        if v in p:
            return v
    return None

def extract_environment(prompt: str) -> str:
    envs = ["diner", "nightclub", "street", "bedroom", "rooftop", "concert", "studio", "tunnel", "parking garage", "burning city", "destroyed street", "bridge", "industrial zone"]
    p = prompt.lower()
    for e in envs:
        if e in p:
            return e.replace(" ", "_")
    return None

def build_video_request(user_prompt: str, uploaded_images: List[str]) -> Dict[str, Any]:
    preset_slug = detect_preset(user_prompt)
    preset = PRESETS[preset_slug]
    resolved = dict(preset["defaults"])
    aspect = extract_aspect(user_prompt)
    energy = extract_energy(user_prompt)
    environment = extract_environment(user_prompt)
    if aspect: resolved["aspect_ratio"] = aspect
    if energy: resolved["energy"] = energy
    if environment: resolved["environment"] = environment
    primary_image = uploaded_images[0] if uploaded_images else None

    final_prompt = (
        f"Create a high-end cinematic music-video shot using the uploaded person as the exact primary subject. "
        f"Preserve identity, facial structure, hairstyle, clothing, body proportions, and recognizable features. "
        f"Preset: {preset['name']}. Visual feel: {preset['visual_description']}. "
        f"Environment: {resolved['environment']}. Camera: {resolved['camera']}. Energy: {resolved['energy']}. "
        f"Output {resolved['aspect_ratio']}, {resolved['duration']} seconds, photorealistic, premium color grading, film grain."
    )

    return {
        "selected_preset": preset_slug,
        "resolved_parameters": resolved,
        "identity_binding": {
            "primary_subject_image": primary_image,
            "identity_lock": True,
            "preserve_face": True,
            "preserve_hair": True,
            "preserve_clothing": True,
            "preserve_body_proportions": True
        },
        "model_routing": {
            "image_model": "seedream",
            "video_model": "seedance",
            "fallback_video_model": "kling"
        },
        "final_prompt": final_prompt,
        "negative_prompt": "identity drift, changed face, altered hairstyle, different clothing, extra people, duplicate limbs, unrealistic motion, cartoon look, blur, text, watermark"
    }
