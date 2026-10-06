import os
import time
import csv
import requests
import ffmpeg
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIG (EDIT ONLY THESE VALUES)
# ---------------------------------------------------------------------------
MODELARK_API_KEY = "YOUR_MODELARK_API_KEY_HERE"
API_BASE = "https://api.modelark.ai/v1"
MODE = "mixed"  # Options: "seedance-2.5", "dola-seed-2.1-turbo", "mixed"
NUM_VIDEOS = 40  # Max 40 (matches VIDEO_DB length)

# Reference asset paths
REF_FACE = "references/face_primary.jpg"  # Front-facing face reference
REF_PROFILE = "references/profile.jpg"  # Side/profile reference
HOOK_AUDIO = "references/hook_audio.mp3"  # Audio for lip-sync
STREET_AMBIENCE = "references/street_ambience.mp3"  # Optional: 5s ambient noise
WHOOSH_SFX = "references/whoosh.mp3"  # Optional: 1s whoosh sound effect

# Optional: Reference image for police officers (leave empty if none)
COP_REFERENCE = ""  # e.g., "references/cops.jpg"

# ---------------------------------------------------------------------------
# VIDEO DATABASE (40 PRESET SCENES)
# ---------------------------------------------------------------------------
VIDEO_DB = [
    {"id": 1, "location": "Surulere, outside a suya spot", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Local suya restaurant", "vibe": "Golden hour sunset, smoke from the suya grill in the air, danfo buses parked on the side", "ending": "casually walks out of frame to the right", "flair": "Suya vendor standing in the far background"},
    {"id": 2, "location": "Victoria Island, outside a fancy rooftop restaurant", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Fancy rooftop eatery", "vibe": "Blue hour dusk, city skyline lights coming on", "ending": "walks into the bar, holds the door open", "flair": "Luxury SUV parked behind you on the street, 'MuddyHits' text watermark in corner"},
    {"id": 3, "location": "Ikeja, outside a popular amala joint", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Popular amala restaurant", "vibe": "Warm dusk light, plates of amala and ewedu on a nearby table", "ending": "greets the barber with a head nod as he walks off", "flair": "Local customers eating at plastic tables in background"},
    {"id": 4, "location": "Lekki Phase 1, sunset beach road", "outfit": "Black sleeveless green ski mask graphic tee + matching black shorts + snake print ski mask + backpack", "eatery": "Beach bar", "vibe": "Sunset golden hour, ocean visible behind palm trees", "ending": "walks into the studio door", "flair": "Surfboard leaning against a wall near you"},
    {"id": 5, "location": "Yaba, outside a streetwear shop", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Fast food spot next to the shop", "vibe": "Late night, neon shop signs glowing wet pavement after rain", "ending": "hops on an okada (motorcycle) ride as he leaves", "flair": "Custom ankara jackets hanging in the shop window"},
    {"id": 6, "location": "Festac Town, 24hr cold room", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Late night fried rice spot", "vibe": "Midnight, fluorescent light from the cold room", "ending": "gets into his grey Dodge Challenger parked out front", "flair": "Street vendor selling cold drinks on the sidewalk"},
    {"id": 7, "location": "Oniru, outside a concert venue", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Food truck outside the venue", "vibe": "Pre-show golden hour, concert marquee sign with your name", "ending": "greets the barber with a head nod as he walks off", "flair": "Line of fans waiting to get in behind you"},
    {"id": 8, "location": "Ajah, local bakery", "outfit": "Black sleeveless green ski mask graphic tee + matching black shorts + snake print ski mask + backpack", "eatery": "Bakery", "vibe": "Early morning, sunrise light, smell of fresh bread", "ending": "carries a stack of custom show posters as he leaves", "flair": "Stack of puff puff on a counter next to you"},
    {"id": 9, "location": "Oshodi, busy market street", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Local canteen", "vibe": "Dawn, market stalls setting up", "ending": "hops on an okada (motorcycle) ride as he leaves", "flair": "Danfo buses passing in the far background"},
    {"id": 10, "location": "Banana Island, mansion gate", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Private estate restaurant", "vibe": "Golden hour sunset, luxury homes behind you", "ending": "walks down a forest path away from the camera", "flair": "Your grey Dodge Challenger parked at the gate next to the mic"},
    {"id": 11, "location": "Ikoyi, upscale cocktail bar", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Fancy cocktail bar", "vibe": "Blue hour dusk, warm neon bar sign glow", "ending": "walks into the bar, holds the door open", "flair": "'MuddyHits' text watermark in corner"},
    {"id": 12, "location": "Gbagada, barbershop", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Local shawarma spot next to the barber shop", "vibe": "Late night, neon barber pole sign", "ending": "greets the barber with a head nod as he walks off", "flair": "Barber standing in the shop doorway behind you"},
    {"id": 13, "location": "Mushin, local music studio", "outfit": "Black sleeveless green ski mask graphic tee + matching black shorts + snake print ski mask + backpack", "eatery": "Late night jollof rice spot", "vibe": "Midnight, hand-painted 'Afrobeats Studio' sign glowing", "ending": "walks into the studio door", "flair": "Studio speaker stack visible in the background"},
    {"id": 14, "location": "Apapa port area", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Local street food canteen", "vibe": "Golden hour sunset, container trucks in background", "ending": "hops on an okada (motorcycle) ride as he leaves", "flair": "Okada driver waiting for him on the sidewalk"},
    {"id": 15, "location": "Maryland, shopping mall", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Food court exit", "vibe": "Late night, mall lights reflecting on wet pavement", "ending": "gets into his grey Dodge Challenger parked out front", "flair": "Your face on a billboard for MuddyHits above the mall entrance"},
    {"id": 16, "location": "Ilupeju, ankara fashion shop", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Local meat pie bakery", "vibe": "Warm afternoon sunlight", "ending": "holds up a custom ankara jacket as he walks off", "flair": "Mannequins with ankara designs outside the shop"},
    {"id": 17, "location": "Magodo residential estate", "outfit": "Shirtless + black leather pants + gold iced watch", "eatery": "Private estate restaurant", "vibe": "Golden hour sunset, bungalows with red roofs", "ending": "walks into the gate of a luxury home", "flair": "White dog walking in the background"},
    {"id": 18, "location": "Ogba, print shop", "outfit": "Black sleeveless green ski mask graphic tee + matching black shorts + snake print ski mask + backpack", "eatery": "Late night indomie spot", "vibe": "Midnight, neon 'PHARMACY' sign next door", "ending": "carries a stack of custom show posters as he leaves", "flair": "Your album posters displayed in the shop window"},
    {"id": 19, "location": "Badagry coastal town", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Seafood restaurant", "vibe": "Sunset golden hour, coconut trees, ocean view", "ending": "holds red baseball bat over his shoulder as he walks off", "flair": "Old colonial-style buildings in the background"},
    {"id": 20, "location": "Lekki Conservation area", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Outdoor jungle restaurant", "vibe": "Golden hour, tall palm trees, greenery", "ending": "walks down a forest path away from the camera", "flair": "Monkeys climbing trees in the far background"},
    {"id": 21, "location": "Ikorodu, outside a local football viewing center", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Street food spot next to the viewing center", "vibe": "Match night, blue hour, TV light glowing from inside", "ending": "casually walks out of frame to the right", "flair": "People cheering inside, TV visible through the window"},
    {"id": 22, "location": "Ikotun, outside a popular church entrance", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Food vendor outside the church", "vibe": "Sunday morning, bright sunlight, church crowd", "ending": "walks into the bar, holds the door open", "flair": "Church sign, ushers standing by the door"},
    {"id": 23, "location": "Ojota, busy interchange", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Local roadside canteen", "vibe": "Rush hour dusk, traffic lights, danfo buses", "ending": "greets the barber with a head nod as he walks off", "flair": "Traffic of danfo buses with headlights on in distance"},
    {"id": 24, "location": "Agege, outside a bread bakery", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Bakery", "vibe": "Early morning sunrise, fresh bread smell", "ending": "holds up a custom ankara jacket as he walks off", "flair": "Giant stacks of Agege bread on display"},
    {"id": 25, "location": "Oworonshoki, waterfront street", "outfit": "Black sleeveless green ski mask graphic tee + matching black shorts + snake print ski mask + backpack", "eatery": "Street seafood spot", "vibe": "Dusk, lagoon view, canoes in the distance", "ending": "walks into the studio door", "flair": "Canoes on the lagoon in the background"},
    {"id": 26, "location": "Abule Egba, outside a popular mechanic shop", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Local canteen next to the shop", "vibe": "Late afternoon, car engines, grease, golden light", "ending": "gets into his grey Dodge Challenger parked out front", "flair": "Cars being repaired, your Challenger in the lot"},
    {"id": 27, "location": "Alimosho, outside a video rental shop", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Street food spot", "vibe": "Retro 90s vibe, dusk, old Nollywood posters", "ending": "walks down a forest path away from the camera", "flair": "Old Nollywood movie posters on the walls"},
    {"id": 28, "location": "Isolo, outside a fashion design studio", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Local shawarma spot", "vibe": "Warm afternoon, tailor working in the window", "ending": "holds up a custom ankara jacket as he walks off", "flair": "Custom made agbada outfits on mannequins"},
    {"id": 29, "location": "Okota, outside a local pharmacy", "outfit": "Black sleeveless green ski mask graphic tee + matching black shorts + snake print ski mask + backpack", "eatery": "Late night indomie spot", "vibe": "Midnight, glowing green pharmacy sign, wet street", "ending": "carries a stack of custom show posters as he leaves", "flair": "Neon 'PHARMACY' sign glowing at night"},
    {"id": 30, "location": "Ketu, bustling market street", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Local canteen", "vibe": "Market day, midday, women selling fruits and vegetables", "ending": "casually walks out of frame to the right", "flair": "Women selling fruits and vegetables on the sidewalk"},
    {"id": 31, "location": "Mile 2, highway overpass", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Roadside suya spot", "vibe": "Sunset, highway traffic, okadas", "ending": "holds red baseball bat over his shoulder as he walks off", "flair": "Traffic of okada (motorcycles) in the distance"},
    {"id": 32, "location": "Iyana Ipaja, outside a popular hotel", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Hotel restaurant", "vibe": "Blue hour, hotel neon sign, valet", "ending": "walks into the bar, holds the door open", "flair": "Hotel sign, valet standing by the entrance"},
    {"id": 33, "location": "Ilashe, beach resort street", "outfit": "Shirtless + black leather pants + gold iced watch", "eatery": "Beach restaurant", "vibe": "Golden hour, beach umbrellas, ocean breeze", "ending": "walks down a forest path away from the camera", "flair": "Beach umbrellas, ocean breeze moving palm trees"},
    {"id": 34, "location": "Marina, downtown Lagos", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Upscale restaurant", "vibe": "Night time, tall glass buildings, city lights", "ending": "gets into his grey Dodge Challenger parked out front", "flair": "Tall office buildings with glass facades, city lights"},
    {"id": 35, "location": "Jibowu, outside a popular eba soup spot", "outfit": "Red/Black Zillman long sleeve jersey + black frayed stacked jeans + white striped sneakers", "eatery": "Local eba soup spot", "vibe": "Dusk, locals sitting at plastic tables", "ending": "greets the barber with a head nod as he walks off", "flair": "Locals sitting at plastic tables eating"},
    {"id": 36, "location": "Fadeyi, outside a vintage record shop", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Local shawarma spot", "vibe": "Retro afternoon, old Afrobeat vinyls on display", "ending": "holds up a custom ankara jacket as he walks off", "flair": "Old Afrobeat vinyl records displayed in the window"},
    {"id": 37, "location": "Iponri, outside a gym entrance", "outfit": "Shirtless + black leather pants + gold iced watch", "eatery": "Protein shake bar next to the gym", "vibe": "Early morning sunrise, gym lights", "ending": "walks into the gate of a luxury home", "flair": "Guys lifting weights visible through the glass door"},
    {"id": 38, "location": "Surulere, outside a popular club", "outfit": "Black quilted hooded puffer vest + black graphic tee + black leather pants + skull belt", "eatery": "Club entrance", "vibe": "Late night, club neon signs, line of people", "ending": "walks into the bar, holds the door open", "flair": "Line of people waiting to get in, bouncer at the door"},
    {"id": 39, "location": "Lekki Conservation area", "outfit": "White 'How To Stay Cool' sleeveless graphic tee + light wash jeans", "eatery": "Outdoor jungle restaurant", "vibe": "Midday, bright sunlight, green jungle, wildlife", "ending": "casually walks out of frame to the right", "flair": "Monkeys, tall palm trees, greenery"},
    {"id": 40, "location": "Tarkwa Bay, beach street", "outfit": "Black sleeveless green ski mask graphic tee + matching black shorts + snake print ski mask + backpack", "eatery": "Beach bar", "vibe": "Sunset, waves, surfboards", "ending": "carries a stack of custom show posters as he leaves", "flair": "Surfboards leaning against a wall, ocean waves in background"}
]

# ---------------------------------------------------------------------------
# MODELARK API HELPERS
# ---------------------------------------------------------------------------
HEADERS = {"Authorization": f"Bearer {MODELARK_API_KEY}"}
MODEL_IDS = {
    "seedance-2.5": "video-generation/seedance-2-5",
    "dola-seed-2.1-turbo": "video-generation/dola-seed-2-1-turbo"
}
TASK_TIMEOUT = 600  # 10 minute max per generation task


def upload_asset(file_path):
    """Upload reference image/audio to ModelArk asset library, return asset URL"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Reference file not found: {file_path}")
    
    file_name = os.path.basename(file_path)
    with open(file_path, "rb") as f:
        files = {"file": (file_name, f)}
        res = requests.post(f"{API_BASE}/assets/upload", headers=HEADERS, files=files)
    
    if res.status_code != 200:
        raise Exception(f"Upload failed for {file_name}: {res.text}")
    
    data = res.json()
    if "asset_url" not in data:
        raise Exception(f"Upload response missing asset_url: {data}")
    
    return data["asset_url"]


def submit_video_generation(
    prompt, model_id, duration,
    reference_image_url=None, lip_sync=False, audio_url=None,
    motion_bucket=3, reference_strength=0.78
):
    """Submit async video generation task to ModelArk"""
    payload = {
        "model_id": model_id,
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": "16:9",
        "motion_bucket": motion_bucket,
        "face_enhance": True
    }

    # Add reference image only if provided
    if reference_image_url:
        payload["reference_image_url"] = reference_image_url
        payload["reference_strength"] = reference_strength

    # Add lip sync config only if enabled
    if lip_sync and audio_url:
        payload["lip_sync"] = True
        payload["audio_url"] = audio_url

    res = requests.post(f"{API_BASE}/tasks/submit", headers=HEADERS, json=payload)
    
    if res.status_code != 200:
        raise Exception(f"Task submission failed: {res.text}")
    
    data = res.json()
    if "task_id" not in data:
        raise Exception(f"Submission response missing task_id: {data}")
    
    return data["task_id"]


def get_task_status(task_id):
    """Poll task status until complete (with timeout)"""
    start_time = time.time()
    while time.time() - start_time < TASK_TIMEOUT:
        res = requests.get(f"{API_BASE}/tasks/{task_id}", headers=HEADERS)
        
        if res.status_code != 200:
            raise Exception(f"Status check failed: {res.text}")
        
        data = res.json()
        status = data.get("status")
        
        if status == "success":
            if "output_video_url" not in data:
                raise Exception(f"Task success but missing output URL: {data}")
            return data["output_video_url"]
        
        if status == "failed":
            raise Exception(f"Task failed: {data.get('error', 'Unknown error')}")
        
        # Still processing, wait before next poll
        time.sleep(5)
    
    raise TimeoutError(f"Task {task_id} timed out after {TASK_TIMEOUT} seconds")


def generate_clip(
    prompt, model, duration,
    reference_image_url=None, lip_sync=False, audio_url=None,
    motion_bucket=3, ref_strength=None
):
    """Full generate flow: submit + poll + return URL, with 2 retries"""
    if model not in MODEL_IDS:
        raise ValueError(f"Invalid model: {model}. Options: {list(MODEL_IDS.keys())}")
    
    model_id = MODEL_IDS[model]
    
    # Set default reference strength based on model (only if reference is provided)
    if reference_image_url and not ref_strength:
        ref_strength = 0.82 if model == "seedance-2.5" else 0.78

    for attempt in range(3):
        try:
            task_id = submit_video_generation(
                prompt, model_id, duration,
                reference_image_url=reference_image_url,
                lip_sync=lip_sync, audio_url=audio_url,
                motion_bucket=motion_bucket,
                reference_strength=ref_strength
            )
            return get_task_status(task_id)
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {str(e)[:100]}..., retrying...")
            # Increase reference strength slightly on retry (only if using reference)
            if reference_image_url:
                ref_strength = min(ref_strength + 0.03, 0.95)
            time.sleep(2)
    
    raise Exception("All 3 generation attempts failed")


def download_file(url, save_path):
    """Download a file from URL to local path with error handling"""
    try:
        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(save_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
    except Exception as e:
        raise Exception(f"Failed to download {url}: {e}")


# ---------------------------------------------------------------------------
# FFMPEG COMPOSITION
# ---------------------------------------------------------------------------
def composite_final_video(
    video_id, walk_url, perf_url, end_url,
    cop_idle_url, cop_run_url, total_duration
):
    """Auto-composite all clips with FFMPEG, apply effects and audio mix"""
    temp_dir = Path("temp_clips")
    out_dir = Path("outputs")
    temp_dir.mkdir(exist_ok=True)
    out_dir.mkdir(exist_ok=True)

    print("  Downloading clips...")
    walk_path = str(temp_dir / f"{video_id}_walk.mp4")
    perf_path = str(temp_dir / f"{video_id}_perf.mp4")
    end_path = str(temp_dir / f"{video_id}_end.mp4")
    cop_idle_path = str(temp_dir / f"{video_id}_cop_idle.mp4")
    cop_run_path = str(temp_dir / f"{video_id}_cop_run.mp4")

    download_file(walk_url, walk_path)
    download_file(perf_url, perf_path)
    download_file(end_url, end_path)
    download_file(cop_idle_url, cop_idle_path)
    download_file(cop_run_url, cop_run_path)

    # Loop cop running clip to fill remaining time after idle clip
    cop_idle_duration = 5  # Matches generated cop idle clip length
    cop_loop_duration = max(total_duration - cop_idle_duration, 1)
    cop_loop_path = str(temp_dir / f"{video_id}_cop_loop.mp4")
    
    (
        ffmpeg.input(cop_run_path, stream_loop=-1)
        .output(
            cop_loop_path, t=cop_loop_duration,
            vcodec="libx264", acodec="aac", r=60, s="1920x1080"
        )
        .overwrite_output()
        .run(quiet=True)
    )

    # Load all input clips, normalize to 1080p 60fps
    def normalize_clip(path):
        return (
            ffmpeg.input(path)
            .filter("scale", 1920, 1080, force_original_aspect_ratio="decrease", flags="lanczos")
            .filter("pad", 1920, 1080, "(ow-iw)/2", "(oh-ih)/2")
            .filter("fps", fps=60, round="near")
        )

    walk_in = normalize_clip(walk_path)
    perf_in = normalize_clip(perf_path)
    end_in = normalize_clip(end_path)
    cop_idle_in = normalize_clip(cop_idle_path)
    cop_loop_in = normalize_clip(cop_loop_path)

    # Audio inputs
    has_ambience = os.path.exists(STREET_AMBIENCE)
    has_whoosh = os.path.exists(WHOOSH_SFX)

    # Step 1: Concatenate foreground clips (character + green screen)
    fg_video, fg_audio = ffmpeg.concat(walk_in, perf_in, end_in, v=1, a=1).node

    # Step 2: Concatenate background cop clips (full scene background)
    bg_video, bg_audio = ffmpeg.concat(cop_idle_in, cop_loop_in, v=1, a=1).node
    bg_audio = ffmpeg.filter(bg_audio, "volume", 0.0)  # Mute cop clip audio

    # Step 3: Apply effects to background
    bg_video = ffmpeg.filter(bg_video, "gblur", sigma=1.5)  # Subtle background blur
    bg_video = ffmpeg.filter(bg_video, "colorbalance", rs=-0.1, gs=-0.05, bs=0.2)  # Teal shift
    bg_video = ffmpeg.filter(bg_video, "eq", contrast=1.15, brightness=-0.08, saturation=0.9)

    # Step 4: Remove green screen from foreground clips
    # Adjust similarity/blend if green screen key is not clean
    fg_video = ffmpeg.filter(
        fg_video, "chromakey",
        color="#00FF00", similarity=0.12, blend=0.08
    )

    # Step 5: Overlay foreground character on background
    # Character is already positioned bottom-right in the foreground prompt
    combined = ffmpeg.overlay(bg_video, fg_video, x=0, y=0, eof_action="endall")

    # Step 6: Global cinematic effects
    combined = ffmpeg.filter(combined, "vignette", a=25, x=0.5, y=0.5)
    combined = ffmpeg.filter(combined, "eq", contrast=1.2, brightness=-0.07, saturation=0.88)
    combined = ffmpeg.filter(combined, "unsharp", lx=5, ly=5, la=0.8)  # Subtle sharpen

    # Step 7: Audio mixing
    # Base silent audio track matching total video duration
    final_audio = ffmpeg.input(
        "anullsrc=r=48000:cl=stereo", format="lavfi", t=total_duration
    ).audio

    # Add street ambience (first 5s)
    if has_ambience:
        ambience_in = (
            ffmpeg.input(STREET_AMBIENCE).audio
            .filter("atrim", duration=5)
            .filter("apad", whole_dur=1, pad_dur=5)
            .filter("volume", 0.15)
        )
        final_audio = ffmpeg.filter(
            [final_audio, ambience_in], "amix", inputs=2, duration="first"
        )

    # Add whoosh SFX at 5s (when cops start running)
    if has_whoosh:
        whoosh_in = (
            ffmpeg.input(WHOOSH_SFX).audio
            .filter("atrim", duration=1)
            .filter("adelay", 5000, all=True)
            .filter("volume", 0.5)
        )
        final_audio = ffmpeg.filter(
            [final_audio, whoosh_in], "amix", inputs=2, duration="first"
        )

    # Add hook audio starting at 6s (1s after whoosh)
    hook_in = (
        ffmpeg.input(HOOK_AUDIO).audio
        .filter("atrim", duration=total_duration - 6)  # Trim to fit remaining time
        .filter("adelay", 6000, all=True)
        .filter("volume", 1.0)
    )
    final_audio = ffmpeg.filter(
        [final_audio, hook_in], "amix", inputs=2, duration="first"
    )

    # Step 8: Export final video
    output_path = str(out_dir / f"NBAJosh_LoopVideo_{video_id}.mp4")
    (
        ffmpeg.output(
            combined, final_audio, output_path,
            vcodec="libx264", acodec="aac",
            r=60, s="1920x1080", crf=18,
            audio_bitrate="320k", pix_fmt="yuv420p"
        )
        .overwrite_output()
        .run(quiet=True)
    )

    # Cleanup temp files
    for f in [walk_path, perf_path, end_path, cop_idle_path, cop_run_path, cop_loop_path]:
        if os.path.exists(f):
            os.remove(f)

    print(f"✅ Video {video_id} exported to outputs/")


# ---------------------------------------------------------------------------
# PROMPT TEMPLATES
# ---------------------------------------------------------------------------
def build_walk_prompt(video):
    return f"""
    Cinematic music video shot, STATIC LOCKED-OFF CAMERA, pure solid green screen background.
    NBA Josh (black dreadlocks with bright red tips, full goatee, diamond stud in left ear, NBA JOSH old english lettering tattoo with 2 stars on right bicep, rose tattoo on right wrist, cloud/scale pattern tattoo sleeve on left arm, angel figure tattoo on left inner forearm, diamond NBA JOSH cuban link chain, fully iced watch) wearing {video['outfit']}, walks from the center background of the frame toward the bottom right corner, stopping in the bottom right of the frame.
    {video['vibe']} lighting on the character, realistic shadows, natural skin texture.
    Casual swagger, natural walking motion. Cinematic, realistic, shallow depth of field on the character, 35mm film grain.
    No other objects in the background, solid pure green only.
    """


def build_perf_prompt(video):
    return f"""
    Cinematic music video shot, STATIC LOCKED-OFF CAMERA, ZERO camera movement, pure solid green screen background.
    NBA Josh (black dreadlocks with bright red tips, full goatee, diamond stud in left ear, NBA JOSH old english lettering tattoo with 2 stars on right bicep, rose tattoo on right wrist, cloud/scale pattern tattoo sleeve on left arm, angel figure tattoo on left inner forearm, diamond NBA JOSH cuban link chain, fully iced watch) wearing {video['outfit']}, stands in the BOTTOM RIGHT of frame, facing slightly left. A vintage silver hanging microphone dangles in front of him at face height.
    First 3 seconds: he glances off to the TOP LEFT of frame, pauses, does a subtle double take, then casually turns to face the microphone.
    Remaining time: he LIP-SYNCS his rap hook with calm, cocky, unbothered energy, subtle hand gestures, professional performance, calm confidence, zero fear.
    {video['vibe']} lighting on the character, realistic shadows, natural skin texture.
    He stays in the bottom right of frame the entire time. High contrast, moody lighting on the character, shallow depth of field, realistic cinematic music video aesthetic, 35mm film grain.
    No other objects in the background, solid pure green only.
    """


def build_end_prompt(video):
    return f"""
    Same static locked-off camera, same character position (bottom right), same outfit, pure solid green screen background.
    He finishes performing, pauses for 1 second, then slowly glances over his LEFT SHOULDER toward the top left of frame, smirks confidently.
    Then he turns away from the mic, and {video['ending']}.
    {video['vibe']} lighting on the character. Calm, unbothered, confident energy. Cinematic, realistic, 35mm film grain.
    No other objects in the background, solid pure green only.
    """


def build_cop_idle_prompt(video):
    return f"""
    Cinematic wide shot, STATIC LOCKED-OFF CAMERA, full scene background.
    2 male Nigerian police officers in full navy uniform with silver badges and black tactical belts stand on the sidewalk across the street in {video['location']}, {video['vibe']}.
    They are leaning in close together, whispering quietly to each other, eyes locked toward the bottom right of the frame with suspicious, focused expressions, like they are confirming if he is their suspect.
    {video['flair']}. Authentic Lagos street setting, dramatic high contrast lighting, realistic, cinematic, 35mm film grain.
    The officers stay in the TOP LEFT of the frame the entire time.
    """


def build_cop_run_prompt(video):
    return f"""
    Exact same location, exact same 2 officers, exact same starting position in top left of frame, same static locked-off camera.
    Now they run aggressively toward the right side of the screen, full body visible. Arms pumping intensely, leaning forward, determined urgent expressions, yelling.
    {video['vibe']}. Dramatic high contrast lighting. Motion blur on their bodies. Static locked-off camera.
    Cinematic, realistic, 4 seconds of strong running motion, 35mm film grain.
    Start and end poses are similar for seamless looping.
    """


# ---------------------------------------------------------------------------
# MAIN BATCH WORKFLOW
# ---------------------------------------------------------------------------
def validate_config():
    """Check required files and settings before starting"""
    # Check required references
    required_files = [REF_FACE, REF_PROFILE, HOOK_AUDIO]
    for f in required_files:
        if not os.path.exists(f):
            raise FileNotFoundError(f"Required reference file missing: {f}")
    
    # Validate mode
    if MODE not in ["seedance-2.5", "dola-seed-2.1-turbo", "mixed"]:
        raise ValueError(f"Invalid MODE: {MODE}. Must be one of: seedance-2.5, dola-seed-2.1-turbo, mixed")
    
    # Validate NUM_VIDEOS
    if NUM_VIDEOS < 1 or NUM_VIDEOS > len(VIDEO_DB):
        raise ValueError(f"NUM_VIDEOS must be between 1 and {len(VIDEO_DB)}")
    
    # Check API key is set
    if MODELARK_API_KEY == "YOUR_MODELARK_API_KEY_HERE":
        raise ValueError("Please set your MODELARK_API_KEY in the config section")


if __name__ == "__main__":
    try:
        validate_config()
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        exit(1)

    # Upload all reference assets once at start
    print("Uploading reference assets to ModelArk...")
    try:
        face_url = upload_asset(REF_FACE)
        profile_url = upload_asset(REF_PROFILE)
        audio_url = upload_asset(HOOK_AUDIO)
        
        # Upload cop reference if provided
        cop_ref_url = upload_asset(COP_REFERENCE) if COP_REFERENCE and os.path.exists(COP_REFERENCE) else None
        
        print(f"✅ Assets uploaded successfully")
    except Exception as e:
        print(f"❌ Asset upload failed: {e}")
        exit(1)

    # Set models based on mode
    if MODE == "seedance-2.5":
        fg_model = "seedance-2.5"
        bg_model = "seedance-2.5"
    elif MODE == "dola-seed-2.1-turbo":
        fg_model = "dola-seed-2.1-turbo"
        bg_model = "dola-seed-2.1-turbo"
    else:  # mixed mode
        fg_model = "seedance-2.5"  # Higher quality for foreground character
        bg_model = "dola-seed-2.1-turbo"  # Faster for background cops

    # Performance clip duration (seedance supports longer clips)
    perf_duration = 20 if fg_model == "seedance-2.5" else 10
    total_video_duration = 5 + perf_duration + 5  # walk + perf + end

    print(f"\nMode: {MODE}")
    print(f"Foreground model: {fg_model} (perf clip: {perf_duration}s)")
    print(f"Background model: {bg_model}")
    print(f"Total video duration: {total_video_duration}s")
    print(f"Generating {NUM_VIDEOS} videos...\n")

    # Initialize log file
    with open("modelark_generation_log.csv", "w", newline="") as logf:
        log_writer = csv.writer(logf)
        log_writer.writerow([
            "Video ID", "Location", "Foreground Model", "Background Model",
            "Status", "Error", "Timestamp"
        ])

        for video in VIDEO_DB[:NUM_VIDEOS]:
            vid_id = video["id"]
            print(f"\n🎬 Generating Video {vid_id}: {video['location']}")

            try:
                # Generate foreground clips (character on green screen)
                print("  Generating walk clip...")
                walk_url = generate_clip(
                    build_walk_prompt(video), fg_model, 5,
                    reference_image_url=profile_url, motion_bucket=4
                )

                print("  Generating performance clip...")
                perf_url = generate_clip(
                    build_perf_prompt(video), fg_model, perf_duration,
                    reference_image_url=face_url, lip_sync=True, audio_url=audio_url
                )

                print("  Generating ending clip...")
                end_url = generate_clip(
                    build_end_prompt(video), fg_model, 5,
                    reference_image_url=face_url
                )

                # Generate background cop clips (full scene)
                print("  Generating cop idle clip...")
                cop_idle_url = generate_clip(
                    build_cop_idle_prompt(video), bg_model, 5,
                    reference_image_url=cop_ref_url, motion_bucket=2,
                    ref_strength=0.6 if cop_ref_url else None
                )

                print("  Generating cop running clip...")
                cop_run_url = generate_clip(
                    build_cop_run_prompt(video), bg_model, 4,
                    reference_image_url=cop_ref_url, motion_bucket=5,
                    ref_strength=0.6 if cop_ref_url else None
                )

                # Composite final video
                print("  Compositing final video with FFMPEG...")
                composite_final_video(
                    vid_id, walk_url, perf_url, end_url,
                    cop_idle_url, cop_run_url, total_video_duration
                )

                log_writer.writerow([
                    vid_id, video["location"], fg_model, bg_model,
                    "SUCCESS", "", time.strftime("%Y-%m-%d %H:%M:%S")
                ])
                logf.flush()  # Ensure log is written immediately

            except Exception as e:
                error_msg = str(e)[:200]  # Truncate long error messages
                print(f"❌ Video {vid_id} failed: {error_msg}")
                log_writer.writerow([
                    vid_id, video["location"], fg_model, bg_model,
                    "FAILED", error_msg, time.strftime("%Y-%m-%d %H:%M:%S")
                ])
                logf.flush()
                continue

    print("\n🎉 Batch generation complete! Check outputs/ folder for results.")
    print("Log file saved to modelark_generation_log.csv")
