"""
Aurora ComfyUI swarm worker — free-GPU launcher (Kaggle + Colab).

Runs **stock ComfyUI** as an Aurora backend behind a stable ngrok tunnel and
**registers itself** as `protocol=comfyui` on boot, so a free Kaggle/Colab GPU
auto-joins the orchestrator with zero Admin → Workers edits. Aurora ships the
prompt graph for every job (SDXL image, SVD/AnimateDiff video, LatentSync
lip-sync, MimicMotion motion) — this worker just needs the matching custom nodes
and model weights installed (see workers/comfyui/*.workflow.json for the exact
node class names Aurora patches against).

Run it in ONE cell with **GPU ON** + **Internet ON**:
  - Kaggle: paste this file into a cell (secrets via Add-ons → Secrets), or import
    the companion notebook, then Run All.
  - Colab: paste into a cell; set secrets via the 🔑 panel (google.colab.userdata)
    or `os.environ[...]` at the top of the cell, then run.

Secrets / env it reads (Kaggle Secrets, Colab userdata, or plain env vars):
  NGROK_AUTHTOKEN       ngrok account token (dashboard.ngrok.com)
  NGROK_STATIC_DOMAIN   free static domain, e.g. "foo-bar.ngrok-free.app"
                        (claim one at dashboard.ngrok.com/domains) — keeps the
                        registered endpoint stable across restarts.
  AURORA_URL            your Aurora base URL, e.g. "https://your-app.replit.app"
  AURORA_REGISTER_SECRET   private operator secret (the register `apikey`); set the
                        same value as AURORA_REGISTER_SECRET in Aurora's env — this
                        is NOT the Supabase anon/publishable key.
  AURORA_WORKER_NAME    (optional) row name in Admin → Workers.
  AURORA_CAPABILITIES   (optional) comma list to force which caps to serve, e.g.
                        "image,video". Default is chosen from detected VRAM:
                        <20 GB → "image,lipsync"; ≥20 GB → "image,video,lipsync,motion".
                        A cap is only ADVERTISED if its model weights are actually
                        present after setup — Aurora never routes a job we can't run.
  AURORA_INSTALL_ALL_NODES  (optional) "1" to also install the broad curated
                        custom-node set (Manager, LTX, Wan, ControlNet aux, Impact,
                        KJNodes, essentials, rgthree, WAS, IPAdapter+, frame
                        interpolation, …) plus comfy-cli for on-demand installs.
"""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

# ── Platform + paths ──────────────────────────────────────────────────────────
# Kaggle writes to /kaggle/working; Colab/local use the CWD. ComfyUI is cloned in.
ROOT = "/kaggle/working" if os.path.isdir("/kaggle/working") else os.getcwd()
COMFY_DIR = os.path.join(ROOT, "ComfyUI")
PORT = 8188

CONFIG_KEYS = [
    "NGROK_AUTHTOKEN",
    "NGROK_STATIC_DOMAIN",
    "AURORA_URL",
    "AURORA_REGISTER_SECRET",
    "AURORA_REGISTER_KEY",  # retired name; loaded only so we can explain the migration
    "AURORA_WORKER_NAME",
    "AURORA_CAPABILITIES",
    "AURORA_INSTALL_ALL_NODES",
]

# Custom-node packs that provide the class names our default graphs reference.
# Core nodes (KSampler, CheckpointLoaderSimple, SVD_img2vid_Conditioning, …) ship
# with ComfyUI itself, so only the non-core packs are listed per capability.
CAP_NODE_PACKS = {
    "image": [
        "https://github.com/sipherxyz/comfyui-art-venture",  # LoadImageFromUrl (Flux.2 edit)
    ],
    "video": [
        "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",  # VHS_VideoCombine
        "https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved",  # ADE_AnimateDiffLoaderGen1
        "https://github.com/sipherxyz/comfyui-art-venture",  # LoadImageFromUrl (SVD i2v)
        "https://github.com/Lightricks/ComfyUI-LTXVideo",  # LTX-2.3 nodes
        "https://github.com/kijai/ComfyUI-WanVideoWrapper",  # Wan 2.2 nodes
    ],
    "lipsync": [
        "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",  # VideoCombine / Load*FromUrl
        "https://github.com/ShmuelRonen/ComfyUI-LatentSyncWrapper",  # LatentSyncSampler
        "https://github.com/sipherxyz/comfyui-art-venture",  # LoadAudioFromUrl / LoadVideoFromUrl
    ],
    "motion": [
        "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",
        "https://github.com/kijai/ComfyUI-MimicMotionWrapper",  # MimicMotionSampler
        "https://github.com/sipherxyz/comfyui-art-venture",
    ],
}

# Model weights each capability needs, as (dest_rel_path, hf_repo, hf_file). After
# setup we ADVERTISE a capability only if ALL its dest files exist on disk, so a
# missing/oversized download fails closed (Aurora won't route there) instead of
# erroring mid-job. lipsync/motion wrapper weights are large and pack-specific —
# the packs above self-download most on first run; we verify presence below.
CAP_MODELS = {
    "image": [
        ("models/diffusion_models/flux2_dev_fp8mixed.safetensors",
         "Comfy-Org/flux2-dev", "flux2_dev_fp8mixed.safetensors"),
        ("models/text_encoders/mistral_3_small_flux2_bf16.safetensors",
         "Comfy-Org/flux2-dev", "mistral_3_small_flux2_bf16.safetensors"),
        ("models/vae/full_encoder_small_decoder.safetensors",
         "black-forest-labs/FLUX.2-small-decoder", "full_encoder_small_decoder.safetensors"),
        ("models/checkpoints/sd_xl_base_1.0.safetensors",
         "stabilityai/stable-diffusion-xl-base-1.0", "sd_xl_base_1.0.safetensors"),
    ],
    "video": [
        ("models/checkpoints/ltx-2.3-22b-dev-fp8.safetensors",
         "Lightricks/LTX-2.3-fp8", "ltx-2.3-22b-dev-fp8.safetensors"),
        ("models/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors",
         "Comfy-Org/ltx-2", "gemma_3_12B_it_fp4_mixed.safetensors"),
        ("models/loras/ltx-2.3-22b-distilled-lora-384.safetensors",
         "Lightricks/LTX-2.3", "ltx-2.3-22b-distilled-lora-384.safetensors"),
        ("models/upscale_models/ltx-2.3-spatial-upscaler-x2-1.1.safetensors",
         "Lightricks/LTX-2.3", "ltx-2.3-spatial-upscaler-x2-1.1.safetensors"),
        ("models/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors"),
        ("models/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"),
        ("models/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors"),
        ("models/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"),
        ("models/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors"),
        ("models/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors"),
        ("models/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"),
        ("models/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"),
        ("models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
         "Comfy-Org/Wan_2.1_ComfyUI_repackaged", "umt5_xxl_fp8_e4m3fn_scaled.safetensors"),
        ("models/vae/wan_2.1_vae.safetensors",
         "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", "wan_2.1_vae.safetensors"),
        # Filename MUST match the SVD graph's ckpt_name (svd-image-to-video.workflow.json).
        ("models/checkpoints/svd_xt_1_1.safetensors",
         "stabilityai/stable-video-diffusion-img2vid-xt-1-1", "svd_xt_1_1.safetensors"),
        ("models/checkpoints/v1-5-pruned-emaonly.safetensors",
         "Comfy-Org/stable-diffusion-v1-5-archive", "v1-5-pruned-emaonly-fp16.safetensors"),
        ("models/animatediff_models/mm_sd_v15_v2.ckpt",
         "guoyww/animatediff", "mm_sd_v15_v2.ckpt"),
    ],
    # lipsync/motion model weights live inside their wrapper packs (self-downloaded
    # on first graph run); these caps are gated on their node classes (see
    # CAP_NODE_CLASSES + /object_info) rather than a single weights file.
    "lipsync": [],
    "motion": [],
}

# A capability can be served by one complete provision set. This preserves the
# legacy SDXL/SVD/AnimateDiff path while letting new workers advertise Flux.2,
# LTX-2.3, or Wan 2.2 only when their own graph's files and nodes are ready.
CAP_MODEL_SETS = {
    "image": [
        [x for x in CAP_MODELS["image"] if x[0].split("/")[-1] in {
            "flux2_dev_fp8mixed.safetensors",
            "mistral_3_small_flux2_bf16.safetensors",
            "full_encoder_small_decoder.safetensors",
        }],
        [x for x in CAP_MODELS["image"] if x[0].split("/")[-1] == "sd_xl_base_1.0.safetensors"],
    ],
    "video": [
        [x for x in CAP_MODELS["video"] if x[0].split("/")[-1] in {
            "ltx-2.3-22b-dev-fp8.safetensors",
            "gemma_3_12B_it_fp4_mixed.safetensors",
        }],
        [x for x in CAP_MODELS["video"] if x[0].split("/")[-1] in {
            "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors",
            "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors",
            "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
            "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
            "wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors",
            "wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors",
            "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
            "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
            "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
            "wan_2.1_vae.safetensors",
        }],
        [x for x in CAP_MODELS["video"] if x[0].split("/")[-1] in {
            "svd_xt_1_1.safetensors",
        }],
        [x for x in CAP_MODELS["video"] if x[0].split("/")[-1] in {
            "v1-5-pruned-emaonly.safetensors",
            "mm_sd_v15_v2.ckpt",
        }],
    ],
}

# Custom node classes each default graph references (workers/comfyui/*.json). Core
# nodes (KSampler, CheckpointLoaderSimple, SVD_img2vid_Conditioning, EmptyLatentImage,
# VAEDecode, CLIPTextEncode, SaveImage, …) ship with ComfyUI, so are not listed. A
# cap is advertised only when every class below is present in ComfyUI's loaded set.
CAP_NODE_CLASSES = {
    "image": [],
    "video": [
        "VHS_VideoCombine", "ADE_AnimateDiffLoaderGen1", "LoadImageFromUrl",
        "LTXAVTextEncoderLoader", "LTXVAudioVAELoader", "LTXVConditioning",
        "LTXVEmptyLatentAudio", "LTXVConcatAVLatent", "LTXVSeparateAVLatent",
        "LTXVAudioVAEDecode", "LTXVPreprocess", "LTXVImgToVideoInplace",
        "EmptyLTXVLatentVideo",
        "ResizeImagesByLongerEdge", "WanImageToVideo", "EmptyHunyuanLatentVideo",
    ],
    "lipsync": ["LatentSyncSampler", "LoadVideoFromUrl", "LoadAudioFromUrl", "VideoCombine", "SaveVideo"],
    "motion": ["MimicMotionSampler", "LoadImageFromUrl", "LoadVideoFromUrl", "VideoCombine", "SaveVideo"],
}

CAP_NODE_SETS = {
    "image": [[], []],
    "video": [
        ["LoadImageFromUrl", "LTXAVTextEncoderLoader", "LTXVAudioVAELoader", "LTXVConditioning", "LTXVEmptyLatentAudio", "LTXVConcatAVLatent", "LTXVSeparateAVLatent", "LTXVAudioVAEDecode", "LTXVPreprocess", "LTXVImgToVideoInplace", "EmptyLTXVLatentVideo"],
        ["LoadImageFromUrl", "WanImageToVideo", "EmptyHunyuanLatentVideo"],
        ["VHS_VideoCombine", "LoadImageFromUrl"],
        ["VHS_VideoCombine", "ADE_AnimateDiffLoaderGen1", "LoadImageFromUrl"],
    ],
}

CAP_VARIANTS = {
    "image": {
        "flux2_t2i": "comfy:image:flux2:t2i",
        "flux2_edit": "comfy:image:flux2:edit",
        "legacy_t2i": "comfy:image:legacy:t2i",
    },
    "video": {
        "ltx_t2v": "comfy:video:ltx:t2v",
        "ltx_i2v": "comfy:video:ltx:i2v",
        "wan_t2v": "comfy:video:wan:t2v",
        "wan_i2v": "comfy:video:wan:i2v",
        "legacy_t2v": "comfy:video:legacy:t2v",
        "legacy_i2v": "comfy:video:legacy:i2v",
    },
}


def sh(cmd: str, cwd: str | None = None, check: bool = True):
    print(f"$ {cmd}", flush=True)
    subprocess.run(cmd, shell=True, check=check, cwd=cwd)


def load_secrets():
    """Mirror Kaggle Secrets / Colab userdata into os.environ (no-op when absent).

    An explicit env var always wins, so you can override any single value inline.
    """
    # Kaggle: Secrets are NOT env vars — read them via UserSecretsClient.
    try:
        from kaggle_secrets import UserSecretsClient  # type: ignore

        client = UserSecretsClient()
        for key in CONFIG_KEYS:
            if os.environ.get(key):
                continue
            try:
                val = client.get_secret(key)
            except Exception:
                val = None
            if val:
                os.environ[key] = val.strip()
    except Exception:
        pass
    # Colab: secrets live in google.colab.userdata.
    try:
        from google.colab import userdata  # type: ignore

        for key in CONFIG_KEYS:
            if os.environ.get(key):
                continue
            try:
                val = userdata.get(key)
            except Exception:
                val = None
            if val:
                os.environ[key] = val.strip()
    except Exception:
        pass


def detect_vram_gb() -> float:
    """Best-effort GPU VRAM in GB (0.0 if torch/CUDA is unavailable)."""
    try:
        import torch  # type: ignore

        if not torch.cuda.is_available():
            return 0.0
        return torch.cuda.get_device_properties(0).total_memory / (1024**3)
    except Exception:
        return 0.0


def requested_caps() -> list[str]:
    """Caps the operator asked for, or a VRAM-appropriate default.

    Kaggle/Colab free cards are ~16 GB → image + lipsync fit. Video (SVD/AnimateDiff)
    and motion (MimicMotion) want ≥20–24 GB, so they're only defaulted on a big card.
    """
    override = os.environ.get("AURORA_CAPABILITIES", "").strip()
    if override:
        return [c.strip() for c in override.split(",") if c.strip()]
    vram = detect_vram_gb()
    print(f"[caps] detected ~{vram:.0f} GB VRAM", flush=True)
    if vram >= 20:
        return ["image", "video", "lipsync", "motion"]
    return ["image", "lipsync"]


def install_comfyui():
    # comfy-cli gives `comfy node install <pack>` (ComfyUI registry) on top of the
    # raw git-clone path below — used by the ALL_NODES option and handy for manual
    # node management inside the session.
    sh("pip install -q requests pyngrok 'huggingface_hub[cli]' comfy-cli")
    if not os.path.isdir(COMFY_DIR):
        sh(f"git clone --depth 1 https://github.com/comfyanonymous/ComfyUI '{COMFY_DIR}'")
    sh("pip install -q -r requirements.txt", cwd=COMFY_DIR)
    # manager_requirements.txt exists on current ComfyUI (0.31+) — needed when the
    # built-in Manager is enabled; harmless no-op on older checkouts.
    if os.path.exists(os.path.join(COMFY_DIR, "manager_requirements.txt")):
        sh("pip install -q -r manager_requirements.txt", cwd=COMFY_DIR, check=False)


# Broad, curated "everything" node set for AURORA_INSTALL_ALL_NODES=1: the packs
# behind Aurora's default graphs PLUS the most-used community packs (video, editing,
# control, utility). Installing the literal full registry (thousands of packs) is
# infeasible on a free session — ComfyUI-Manager is included so any remaining pack
# can be installed on demand from the UI/API.
ALL_NODE_PACKS = [
    "https://github.com/Comfy-Org/ComfyUI-Manager",
    "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",
    "https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved",
    "https://github.com/sipherxyz/comfyui-art-venture",
    "https://github.com/ShmuelRonen/ComfyUI-LatentSyncWrapper",
    "https://github.com/kijai/ComfyUI-MimicMotionWrapper",
    "https://github.com/Lightricks/ComfyUI-LTXVideo",
    "https://github.com/kijai/ComfyUI-WanVideoWrapper",
    "https://github.com/kijai/ComfyUI-KJNodes",
    "https://github.com/Fannovel16/comfyui_controlnet_aux",
    "https://github.com/ltdrdata/ComfyUI-Impact-Pack",
    "https://github.com/cubiq/ComfyUI_essentials",
    "https://github.com/rgthree/rgthree-comfy",
    "https://github.com/WASasquatch/was-node-suite-comfyui",
    "https://github.com/Fannovel16/ComfyUI-Frame-Interpolation",
    "https://github.com/cubiq/ComfyUI_IPAdapter_plus",
]

# Deterministic lock on the curated set: the boot-time budget documented in
# README.md was computed for EXACTLY this many packs. An accidental addition or
# removal must fail loudly here (and in the repo test suite, which parses this
# file) instead of silently drifting the budget.
EXPECTED_ALL_NODE_PACK_COUNT = 16
if len(ALL_NODE_PACKS) != EXPECTED_ALL_NODE_PACK_COUNT:
    raise SystemExit(
        f"[nodes] ALL_NODE_PACKS has {len(ALL_NODE_PACKS)} entries, expected "
        f"{EXPECTED_ALL_NODE_PACK_COUNT} — update EXPECTED_ALL_NODE_PACK_COUNT and "
        "the README boot-time budget together."
    )
if len(set(ALL_NODE_PACKS)) != len(ALL_NODE_PACKS):
    raise SystemExit("[nodes] ALL_NODE_PACKS contains duplicate repo URLs.")


def clone_node_pack(repo: str, nodes_dir: str) -> bool:
    """Best-effort clone+deps for one custom-node pack (never aborts the boot).

    Returns True if the pack directory exists after the attempt; failures are
    printed loudly so a dead repo URL is visible in the session log instead of
    silently shrinking the installed set.
    """
    name = repo.rstrip("/").split("/")[-1]
    dest = os.path.join(nodes_dir, name)
    if os.path.isdir(dest):
        return True
    sh(f"git clone --depth 1 {repo} '{dest}'", check=False)
    if not os.path.isdir(dest):
        print(f"[nodes] WARNING: failed to clone {repo} — pack '{name}' NOT installed", flush=True)
        return False
    req = os.path.join(dest, "requirements.txt")
    if os.path.exists(req):
        sh(f"pip install -q -r '{req}'", check=False)
    return True


def install_all_node_packs():
    """AURORA_INSTALL_ALL_NODES=1 — install the broad curated pack set.

    Additive on top of the per-capability packs; capability advertisement still
    fails closed on /object_info, so a pack that fails to import never causes a
    cap to be advertised that the graphs can't actually serve.

    Boot-time budget (estimated from per-step dry runs; a live session log
    confirms via the per-pack + end-to-end timing printed below):
      - 16 packs × ~12–20 s each (git clone + pip) ≈ 4–6 min
      - 2 heavy packs (controlnet_aux, WAS suite) add ~1–2 min of pip installs
      - Total all-nodes overhead: ~5–8 min on top of the base ComfyUI setup
      - Kaggle/Colab free-session budget: 12 h → >98 % headroom remains
      - Disk: ~235 MB pack sources + ~2 GB extra pip deps; well under the
        ~19 GB Kaggle working directory limit
    A pack that fails to clone prints a WARNING but never aborts the boot.
    """
    nodes_dir = os.path.join(COMFY_DIR, "custom_nodes")
    os.makedirs(nodes_dir, exist_ok=True)
    t0 = time.time()
    print(f"[nodes] ALL_NODES mode: installing {len(ALL_NODE_PACKS)} packs…", flush=True)
    failed = []
    for i, repo in enumerate(ALL_NODE_PACKS, 1):
        name = repo.rstrip("/").split("/")[-1]
        print(f"[nodes] [{i}/{len(ALL_NODE_PACKS)}] {name}…", flush=True)
        t_pack = time.time()
        ok = clone_node_pack(repo, nodes_dir)
        # Per-pack completion duration + status: a real session log shows exactly
        # which pack is eating the boot budget (clone vs pip-heavy packs).
        print(
            f"[nodes] [{i}/{len(ALL_NODE_PACKS)}] {name} "
            f"{'done' if ok else 'FAILED'} in {time.time() - t_pack:.0f}s "
            f"(elapsed {time.time() - t0:.0f}s)",
            flush=True,
        )
        if not ok:
            failed.append(repo)
    total = time.time() - t0
    if failed:
        print(
            f"[nodes] ALL_NODES done in {total:.0f}s — "
            f"{len(failed)} pack(s) FAILED to install: {failed}",
            flush=True,
        )
    else:
        print(f"[nodes] ALL_NODES: all {len(ALL_NODE_PACKS)} packs installed in {total:.0f}s.", flush=True)


def install_node_packs(caps: list[str]):
    nodes_dir = os.path.join(COMFY_DIR, "custom_nodes")
    os.makedirs(nodes_dir, exist_ok=True)
    seen: set[str] = set()
    for cap in caps:
        for repo in CAP_NODE_PACKS.get(cap, []):
            if repo in seen:
                continue
            seen.add(repo)
            # Best-effort: a flaky third-party clone must not abort the whole boot.
            clone_node_pack(repo, nodes_dir)


def download_models(caps: list[str]):
    from huggingface_hub import hf_hub_download  # type: ignore

    for cap in caps:
        # Download the first (modern) provision set. Legacy workers can still
        # register with pre-existing SDXL/SVD files; a fresh launcher boots the
        # new graphs by default instead of downloading every model family.
        model_sets = CAP_MODEL_SETS.get(cap)
        models = model_sets[0] if model_sets else CAP_MODELS.get(cap, [])
        for dest_rel, repo, fname in models:
            dest = os.path.join(COMFY_DIR, dest_rel)
            if os.path.exists(dest):
                continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            try:
                cached = hf_hub_download(repo_id=repo, filename=fname)
                shutil.copy(cached, dest)  # copy under the exact name our graph expects
                print(f"[models] {cap}: {dest_rel} ready", flush=True)
            except Exception as e:
                print(f"[models] {cap}: could not fetch {repo}/{fname}: {e}", flush=True)


def fetch_node_classes() -> set[str]:
    """Class names ComfyUI actually loaded (keys of GET /object_info).

    Used to fail closed: a cap is advertised only if every custom node its default
    graph references is genuinely loaded — not merely if a pack directory cloned (a
    pack can clone yet fail to import due to a missing dependency).
    """
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/object_info", timeout=60) as r:
            return set(json.loads(r.read().decode()).keys())
    except Exception as e:  # noqa: BLE001 — any failure means "treat as no custom nodes".
        print(f"[caps] could not read /object_info ({e}); assuming no custom nodes.", flush=True)
        return set()


def servable_caps(caps: list[str], available_classes: set[str]) -> list[str]:
    """Keep only caps with one complete model/node provision set.

    Fail closed: advertising a cap we can't serve would let Aurora route a job that
    errors. Modern and legacy graphs are alternatives, so a worker only needs all
    weights and nodes for one complete set.
    """
    ok: list[str] = []
    for cap in caps:
        model_sets = CAP_MODEL_SETS.get(cap, [CAP_MODELS.get(cap, [])])
        node_sets = CAP_NODE_SETS.get(cap, [CAP_NODE_CLASSES.get(cap, [])])
        provisioned = []
        missing_descriptions = []
        for index, model_set in enumerate(model_sets):
            missing_models = [
                rel for rel, _, _ in model_set
                if not os.path.exists(os.path.join(COMFY_DIR, rel))
            ]
            required_nodes = node_sets[index] if index < len(node_sets) else []
            missing_nodes = [c for c in required_nodes if c not in available_classes]
            if not missing_models and not missing_nodes:
                provisioned.append(index)
            missing_descriptions.append(
                f"set {index + 1}: weights={missing_models}, nodes={missing_nodes}"
            )
        if not provisioned:
            print(f"[caps] dropping '{cap}' — no complete provision set ({'; '.join(missing_descriptions)})", flush=True)
            continue
        ok.append(cap)
        variants = CAP_VARIANTS.get(cap, {})
        if cap == "image":
            if 0 in provisioned:
                ok.extend([variants["flux2_t2i"]])
                if "LoadImageFromUrl" in available_classes:
                    ok.append(variants["flux2_edit"])
            if 1 in provisioned:
                ok.append(variants["legacy_t2i"])
        elif cap == "video":
            if 0 in provisioned:
                ok.extend([variants["ltx_t2v"], variants["ltx_i2v"]])
            if 1 in provisioned:
                ok.extend([variants["wan_t2v"], variants["wan_i2v"]])
            if 2 in provisioned:
                ok.append(variants["legacy_i2v"])
            if 3 in provisioned:
                ok.append(variants["legacy_t2v"])
    return ok


def start_comfyui() -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, "main.py", "--listen", "0.0.0.0", "--port", str(PORT)],
        cwd=COMFY_DIR,
    )


def wait_healthy(proc: subprocess.Popen, attempts: int = 90) -> bool:
    """Gate on ComfyUI's /system_stats — the same probe Aurora's health check uses.

    Refuse to tunnel/register a dead server (that would mark a broken worker Active).
    """
    for _ in range(attempts):
        if proc.poll() is not None:
            raise SystemExit(f"[serve] ComfyUI exited early (code {proc.returncode}); see logs above.")
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/system_stats", timeout=2)
            return True
        except Exception:
            time.sleep(2)
    return False


def open_tunnel() -> str:
    from pyngrok import ngrok  # type: ignore

    token = os.environ.get("NGROK_AUTHTOKEN")
    if token:
        ngrok.set_auth_token(token)
    domain = os.environ.get("NGROK_STATIC_DOMAIN", "").strip()
    host = domain.replace("https://", "").replace("http://", "").rstrip("/")
    if host:
        ngrok.connect(addr=str(PORT), domain=host)  # pin the free static domain
        return f"https://{host}"
    public = ngrok.connect(PORT).public_url
    print("[ngrok] NGROK_STATIC_DOMAIN not set — URL changes each restart; "
          "claim a free static domain for zero-touch reconnects.", flush=True)
    return public


# Secrets required to auto-register (see the module docstring). Checked up
# front — before ComfyUI install + model downloads, which can take many
# minutes — so a missing/misspelled secret is loud immediately instead of
# discovered only after a long wait, deep inside register().
_REQUIRED_FOR_REGISTER = [
    ("NGROK_AUTHTOKEN", "ngrok dashboard -> Your Authtoken (dashboard.ngrok.com/get-started/your-authtoken)"),
    ("NGROK_STATIC_DOMAIN", "ngrok dashboard -> Domains -> claim a free static domain (dashboard.ngrok.com/domains)"),
    ("AURORA_URL", "your Aurora app base URL, e.g. https://your-app.replit.app"),
    ("AURORA_REGISTER_SECRET", "private operator secret -- set the SAME value as AURORA_REGISTER_SECRET in Aurora's env; NEVER the Supabase anon/publishable or service-role key"),
]


def warn_if_register_secrets_missing():
    """Print a loud, actionable warning before setup if auto-register can't work.

    Does not raise: the worker still serves without registering (an owner can
    add the URL by hand in Admin -> Workers), but they should know that before
    waiting through ComfyUI install + model downloads, not after.
    """
    legacy_key = os.environ.get("AURORA_REGISTER_KEY", "").strip()
    if legacy_key:
        print("\n" + "!" * 80, flush=True)
        print("[bootstrap] WARNING: this worker still has the retired AURORA_REGISTER_KEY", flush=True)
        print("[bootstrap] configured. Rename it to AURORA_REGISTER_SECRET and replace it", flush=True)
        print("[bootstrap] with a NEW private operator secret. Do NOT reuse the Supabase", flush=True)
        print("[bootstrap] anon/publishable key or the old AURORA_REGISTER_KEY value.", flush=True)
        print("!" * 80 + "\n", flush=True)

    missing = [(k, hint) for k, hint in _REQUIRED_FOR_REGISTER if not os.environ.get(k, "").strip()]
    if not missing:
        print("[bootstrap] all auto-register secrets present — will self-register after setup.", flush=True)
        return
    print("\n" + "!" * 72, flush=True)
    print("[bootstrap] WARNING: missing secret(s) needed to auto-register in", flush=True)
    print("Admin -> Workers. The worker will still install and serve, but it will", flush=True)
    print("NOT appear in Aurora until these are set and the cell is re-run:", flush=True)
    for key, hint in missing:
        print(f"  - {key}: {hint}", flush=True)
    print("!" * 72 + "\n", flush=True)


def register(public_url: str, caps: list[str]) -> bool:
    """Upsert this worker as protocol=comfyui via /api/public/workers/register.

    Auth = the private AURORA_REGISTER_SECRET in the `apikey` header (NOT the
    Supabase anon key — that's public). The endpoint base (…:8188 origin) is
    enough — Aurora appends /prompt, /history, /view
    itself (normalizeWorkerBase de-dupes bare-origin vs full-path registrations).
    Never raises: a registration miss must not stop the worker from serving.
    """
    aurora_url = os.environ.get("AURORA_URL", "").strip().rstrip("/")
    register_key = os.environ.get("AURORA_REGISTER_SECRET", "").strip()
    if not (aurora_url and register_key):
        print("[register] skipped — set AURORA_URL + AURORA_REGISTER_SECRET to auto-register "
              "(worker still serves jobs; add the URL in Admin → Workers).", flush=True)
        return False
    payload = {
        "name": os.environ.get("AURORA_WORKER_NAME") or "comfyui-free-gpu",
        "endpoint_url": public_url,
        "protocol": "comfyui",
        "capabilities": caps,
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{aurora_url}/api/public/workers/register",
        data=body,
        headers={"apikey": register_key, "content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"[register] OK — {public_url} registered (caps={','.join(caps)}).", flush=True)
            return 200 <= r.status < 300
    except Exception as e:
        print(f"[register] failed (worker still serving): {e}", flush=True)
        return False


def main():
    t_boot = time.time()
    load_secrets()
    warn_if_register_secrets_missing()
    caps = requested_caps()
    all_nodes = os.environ.get("AURORA_INSTALL_ALL_NODES", "").strip() in ("1", "true", "yes")
    print(
        f"[boot] requested caps: {caps}"
        + (" | AURORA_INSTALL_ALL_NODES=1 (broad node set)" if all_nodes else ""),
        flush=True,
    )
    install_comfyui()
    install_node_packs(caps)
    if all_nodes:
        install_all_node_packs()
    download_models(caps)
    t_setup = time.time() - t_boot
    print(f"[boot] setup phase complete in {t_setup:.0f}s — starting ComfyUI…", flush=True)

    t_start = time.time()
    proc = start_comfyui()
    if not wait_healthy(proc):
        proc.terminate()
        raise SystemExit("[serve] ComfyUI never became healthy on /system_stats — not registering.")
    t_startup = time.time() - t_start
    # End-to-end boot timing THROUGH the health gate: the documented cold-boot
    # budget includes ComfyUI startup + /system_stats, not just installs.
    print(
        f"[boot] healthy: setup {t_setup:.0f}s + startup/health {t_startup:.0f}s "
        f"= {time.time() - t_boot:.0f}s total",
        flush=True,
    )

    # Advertise only caps ComfyUI can truly serve: weights on disk AND the graph's
    # custom nodes actually loaded (checked against /object_info). Fail closed.
    caps = servable_caps(caps, fetch_node_classes())
    if not caps:
        proc.terminate()
        raise SystemExit("[boot] no servable capabilities after setup — check the logs above.")

    public_url = open_tunnel()
    register(public_url, caps)

    print("\n" + "=" * 64)
    print(f"ComfyUI worker live (protocol=comfyui, caps={','.join(caps)}):")
    print(f"  Endpoint: {public_url}  (Aurora sends the prompt graph)")
    print("  Keep this cell running; on restart re-run it to re-register the same row.")
    print("=" * 64 + "\n", flush=True)
    proc.wait()


if __name__ == "__main__":
    main()
