"""Unit tests for the free-GPU ComfyUI launcher's capability gating.

No GPU, ComfyUI process, or network access needed: `servable_caps()` is a pure
function of (requested caps, model files on disk, node classes ComfyUI loaded).
These tests stand in for "does an under-provisioned worker correctly drop
capabilities it can't serve" from Task #93 — the one part of that acceptance
criterion that doesn't require a live Kaggle/Colab GPU to prove.

Run with (from repo root):  python3 -m unittest discover -s workers/comfyui -p "test_launcher.py" -v
Or (from this directory):   python3 -m unittest test_launcher -v
"""

import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aurora_comfyui_launcher as launcher  # noqa: E402


class ServableCapsTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._orig_comfy_dir = launcher.COMFY_DIR
        launcher.COMFY_DIR = self._tmpdir.name

    def tearDown(self):
        launcher.COMFY_DIR = self._orig_comfy_dir
        self._tmpdir.cleanup()

    def _touch(self, rel_path: str) -> None:
        full = os.path.join(launcher.COMFY_DIR, rel_path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(b"\0")

    def test_full_16gb_worker_serves_image_and_lipsync(self):
        """16 GB free-tier default caps (image, lipsync) with everything present."""
        for rel, _, _ in launcher.CAP_MODEL_SETS["image"][0]:
            self._touch(rel)
        available_classes = set(launcher.CAP_NODE_CLASSES["lipsync"])
        available_classes.add("LoadImageFromUrl")
        result = launcher.servable_caps(["image", "lipsync"], available_classes)
        self.assertEqual(
            sorted(result),
            ["comfy:image:flux2:edit", "comfy:image:flux2:t2i", "image", "lipsync"],
        )

    def test_underprovisioned_worker_drops_video_missing_weights(self):
        """No model weights on disk at all -> video (and image) never advertised.

        motion is deliberately excluded here: unlike image/video, CAP_MODELS["motion"]
        is empty by design (its weights live inside the MimicMotion wrapper pack and
        self-download on first run), so motion is gated on node classes only — see
        test_lipsync_gated_purely_on_node_classes_not_weights for that path.
        """
        available_classes = set(launcher.CAP_NODE_CLASSES["video"])
        result = launcher.servable_caps(["image", "video"], available_classes)
        self.assertNotIn("video", result)
        # image has no node-class requirement and no weights present either.
        self.assertNotIn("image", result)

    def test_underprovisioned_worker_drops_video_missing_node_pack(self):
        """Weights present but AnimateDiff-Evolved / VideoHelperSuite failed to import.

        This is the actual free-tier failure mode: a custom-node pack clones but
        raises on import (missing dependency), so it's absent from ComfyUI's
        /object_info even though the directory exists on disk.
        """
        for rel, _, _ in launcher.CAP_MODELS["video"]:
            self._touch(rel)
        # Only LoadImageFromUrl loaded; VHS_VideoCombine + AnimateDiff-Evolved did not.
        result = launcher.servable_caps(["video"], {"LoadImageFromUrl"})
        self.assertEqual(result, [])

    def test_lipsync_gated_purely_on_node_classes_not_weights(self):
        """lipsync/motion have empty CAP_MODELS — weights ship inside the wrapper
        pack and self-download on first run, so gating must rely on /object_info
        alone, never on a weights-file check that would always pass trivially."""
        missing_one = set(launcher.CAP_NODE_CLASSES["lipsync"]) - {"LatentSyncSampler"}
        result = launcher.servable_caps(["lipsync"], missing_one)
        self.assertEqual(result, [])

        full = set(launcher.CAP_NODE_CLASSES["lipsync"])
        result = launcher.servable_caps(["lipsync"], full)
        self.assertEqual(result, ["lipsync"])

    def test_high_vram_worker_serves_all_four_when_fully_provisioned(self):
        for cap in ("image", "video"):
            for rel, _, _ in launcher.CAP_MODELS[cap]:
                self._touch(rel)
        available_classes = (
            set(launcher.CAP_NODE_CLASSES["video"])
            | set(launcher.CAP_NODE_CLASSES["lipsync"])
            | set(launcher.CAP_NODE_CLASSES["motion"])
        )
        result = launcher.servable_caps(
            ["image", "video", "lipsync", "motion"], available_classes
        )
        self.assertEqual(
            sorted(result),
            [
                "comfy:image:flux2:edit", "comfy:image:flux2:t2i",
                "comfy:image:legacy:t2i", "comfy:video:legacy:i2v",
                "comfy:video:legacy:t2v", "comfy:video:ltx:i2v",
                "comfy:video:ltx:t2v", "comfy:video:wan:i2v",
                "comfy:video:wan:t2v", "image", "lipsync", "motion", "video",
            ],
        )

    def test_ltx_provision_set_only_advertises_ltx_variants(self):
        for rel, _, _ in launcher.CAP_MODEL_SETS["video"][0]:
            self._touch(rel)
        result = launcher.servable_caps(["video"], set(launcher.CAP_NODE_SETS["video"][0]))
        self.assertIn("comfy:video:ltx:t2v", result)
        self.assertIn("comfy:video:ltx:i2v", result)
        self.assertNotIn("comfy:video:wan:t2v", result)
        self.assertNotIn("comfy:video:legacy:t2v", result)

    def test_wan_provision_set_only_advertises_wan_variants(self):
        for rel, _, _ in launcher.CAP_MODEL_SETS["video"][1]:
            self._touch(rel)
        result = launcher.servable_caps(["video"], set(launcher.CAP_NODE_SETS["video"][1]))
        self.assertIn("comfy:video:wan:t2v", result)
        self.assertIn("comfy:video:wan:i2v", result)
        self.assertNotIn("comfy:video:ltx:t2v", result)
        self.assertNotIn("comfy:video:legacy:t2v", result)

    def test_legacy_provision_set_only_advertises_legacy_variants(self):
        for rel, _, _ in launcher.CAP_MODEL_SETS["video"][2]:
            self._touch(rel)
        result = launcher.servable_caps(["video"], set(launcher.CAP_NODE_SETS["video"][2]))
        self.assertIn("comfy:video:legacy:i2v", result)
        self.assertNotIn("comfy:video:legacy:t2v", result)
        self.assertNotIn("comfy:video:ltx:t2v", result)
        self.assertNotIn("comfy:video:wan:t2v", result)

    def test_animatediff_provision_set_only_advertises_legacy_t2v(self):
        for rel, _, _ in launcher.CAP_MODEL_SETS["video"][3]:
            self._touch(rel)
        result = launcher.servable_caps(["video"], set(launcher.CAP_NODE_SETS["video"][3]))
        self.assertIn("comfy:video:legacy:t2v", result)
        self.assertNotIn("comfy:video:legacy:i2v", result)


class GraphLauncherContractTests(unittest.TestCase):
    """Static drift check: every model filename / node class the default graphs
    (src/lib/comfy-default-workflows.server.ts, lipsync-workflows.server.ts,
    motion-workflows.server.ts) reference must appear in the launcher's
    CAP_MODELS / CAP_NODE_CLASSES contract, and vice versa, or a live run fails
    at /prompt with an unknown node/checkpoint error instead of at registration.
    """

    # Mirrors the *.server.ts graph builders byte-for-byte (see module docstrings
    # for the source of truth); kept here as plain literals so this test has no
    # TS/bun dependency and can run standalone in the Python worker toolchain.
    GRAPH_CKPT_NAMES = {
        "image": {
            "flux2_dev_fp8mixed.safetensors", "mistral_3_small_flux2_bf16.safetensors",
            "full_encoder_small_decoder.safetensors", "sd_xl_base_1.0.safetensors",
        },
        "video": {
            "ltx-2.3-22b-dev-fp8.safetensors", "gemma_3_12B_it_fp4_mixed.safetensors",
            "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors",
            "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors",
            "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
            "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
            "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "wan_2.1_vae.safetensors",
            "svd_xt_1_1.safetensors", "v1-5-pruned-emaonly.safetensors",
        },
    }
    GRAPH_MODEL_NAMES = {
        "video": {"mm_sd_v15_v2.ckpt"},
    }
    GRAPH_NODE_CLASSES = {
        "video": {
            "VHS_VideoCombine", "ADE_AnimateDiffLoaderGen1", "LoadImageFromUrl",
            "LTXAVTextEncoderLoader", "LTXVAudioVAELoader", "LTXVConditioning",
            "LTXVEmptyLatentAudio", "LTXVConcatAVLatent", "LTXVSeparateAVLatent",
            "LTXVAudioVAEDecode", "LTXVPreprocess", "LTXVImgToVideoInplace",
            "EmptyLTXVLatentVideo",
            "ResizeImagesByLongerEdge", "WanImageToVideo", "EmptyHunyuanLatentVideo",
        },
        "lipsync": {
            "LatentSyncSampler",
            "LoadVideoFromUrl",
            "LoadAudioFromUrl",
            "VideoCombine",
            "SaveVideo",
        },
        "motion": {
            "MimicMotionSampler",
            "LoadImageFromUrl",
            "LoadVideoFromUrl",
            "VideoCombine",
            "SaveVideo",
        },
    }

    def test_checkpoint_filenames_match(self):
        """dest_rel (first tuple element) is the on-disk filename the graph's
        ckpt_name must match; the HF source `fname` (third element) is unrelated
        and may legitimately differ (e.g. a differently-named upstream file
        copied under the name our graph expects)."""
        for cap, names in self.GRAPH_CKPT_NAMES.items():
            launcher_names = {
                os.path.basename(dest_rel) for dest_rel, _, _ in launcher.CAP_MODELS[cap]
            }
            self.assertTrue(
                names.issubset(launcher_names),
                f"{cap}: graph expects {names}, launcher ships {launcher_names}",
            )

    def test_animatediff_model_name_matches(self):
        for cap, names in self.GRAPH_MODEL_NAMES.items():
            launcher_names = {
                os.path.basename(dest_rel) for dest_rel, _, _ in launcher.CAP_MODELS[cap]
            }
            self.assertTrue(names.issubset(launcher_names))

    def test_node_classes_match_exactly(self):
        for cap, classes in self.GRAPH_NODE_CLASSES.items():
            self.assertEqual(
                set(launcher.CAP_NODE_CLASSES[cap]),
                classes,
                f"{cap}: launcher's required node classes drifted from the default graph",
            )


class AllNodePacksLockTests(unittest.TestCase):
    """Deterministic lock on the AURORA_INSTALL_ALL_NODES curated set.

    The boot-time/disk budget documented in README.md was computed for EXACTLY
    this set; an accidental addition/removal must fail this test (and the
    launcher's own module-level guard) instead of silently drifting the budget.
    """

    # The intended curated set, spelled out in full — not derived from the
    # launcher list — so an edit to ALL_NODE_PACKS cannot self-validate.
    EXPECTED_PACKS = [
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

    def test_all_node_packs_is_exactly_the_curated_16(self):
        self.assertEqual(launcher.ALL_NODE_PACKS, self.EXPECTED_PACKS)
        self.assertEqual(len(launcher.ALL_NODE_PACKS), launcher.EXPECTED_ALL_NODE_PACK_COUNT)
        self.assertEqual(launcher.EXPECTED_ALL_NODE_PACK_COUNT, 16)

    def test_all_node_packs_has_no_duplicates(self):
        self.assertEqual(len(set(launcher.ALL_NODE_PACKS)), len(launcher.ALL_NODE_PACKS))

    def test_every_capability_pack_is_in_the_all_nodes_set(self):
        """ALL_NODES mode is additive but must still cover every per-capability
        pack, or an all-nodes worker could serve FEWER caps than a targeted one."""
        for cap, repos in launcher.CAP_NODE_PACKS.items():
            for repo in repos:
                self.assertIn(
                    repo, launcher.ALL_NODE_PACKS,
                    f"{cap}: {repo} missing from ALL_NODE_PACKS",
                )

    def test_public_download_launcher_is_byte_identical(self):
        download = os.path.join(
            os.path.dirname(__file__), "..", "..",
            "public", "downloads", "gpu", "aurora_comfyui_launcher.py",
        )
        source = os.path.join(os.path.dirname(__file__), "aurora_comfyui_launcher.py")
        with open(source, "rb") as a, open(download, "rb") as b:
            self.assertEqual(a.read(), b.read(), "public download copy drifted from workers/comfyui source")


class LegacyRegisterKeyWarningTests(unittest.TestCase):
    def test_legacy_key_warning_names_the_replacement_and_requires_new_secret(self):
        original_legacy = os.environ.get("AURORA_REGISTER_KEY")
        original_secret = os.environ.get("AURORA_REGISTER_SECRET")
        try:
            os.environ["AURORA_REGISTER_KEY"] = "old-public-key"
            os.environ.pop("AURORA_REGISTER_SECRET", None)
            output = StringIO()
            with redirect_stdout(output):
                launcher.warn_if_register_secrets_missing()
            text = output.getvalue()
            self.assertIn("retired AURORA_REGISTER_KEY", text)
            self.assertIn("AURORA_REGISTER_SECRET", text)
            self.assertIn("NEW private operator secret", text)
        finally:
            if original_legacy is None:
                os.environ.pop("AURORA_REGISTER_KEY", None)
            else:
                os.environ["AURORA_REGISTER_KEY"] = original_legacy
            if original_secret is None:
                os.environ.pop("AURORA_REGISTER_SECRET", None)
            else:
                os.environ["AURORA_REGISTER_SECRET"] = original_secret

    def test_public_download_launcher_carries_the_same_legacy_key_warning(self):
        """The advertised download at public/downloads/gpu/ must not drift:
        operators who fetch that copy need the same migration warning."""
        download = os.path.join(
            os.path.dirname(__file__), "..", "..",
            "public", "downloads", "gpu", "aurora_comfyui_launcher.py",
        )
        with open(download) as fh:
            src = fh.read()
        self.assertIn('"AURORA_REGISTER_KEY"', src)
        self.assertIn("retired AURORA_REGISTER_KEY", src)
        self.assertIn("NEW private operator secret", src)


if __name__ == "__main__":
    unittest.main()
