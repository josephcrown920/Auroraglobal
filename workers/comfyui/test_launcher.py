"""Unit tests for the free-GPU ComfyUI launcher's capability gating.

No GPU, ComfyUI process, or network access needed: `servable_caps()` is a pure
function of (requested caps, model files on disk, node classes ComfyUI loaded).
These tests stand in for "does an under-provisioned worker correctly drop
capabilities it can't serve" from Task #93 — the one part of that acceptance
criterion that doesn't require a live Kaggle/Colab GPU to prove.

Run with:  python3 -m unittest workers/comfyui/test_launcher.py -v
"""

import os
import tempfile
import unittest

import aurora_comfyui_launcher as launcher


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
        self._touch("models/checkpoints/sd_xl_base_1.0.safetensors")
        available_classes = set(launcher.CAP_NODE_CLASSES["lipsync"])
        result = launcher.servable_caps(["image", "lipsync"], available_classes)
        self.assertEqual(sorted(result), ["image", "lipsync"])

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
        self.assertEqual(sorted(result), ["image", "lipsync", "motion", "video"])


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
        "image": {"sd_xl_base_1.0.safetensors"},
        "video": {"svd_xt_1_1.safetensors", "v1-5-pruned-emaonly.safetensors"},
    }
    GRAPH_MODEL_NAMES = {
        "video": {"mm_sd_v15_v2.ckpt"},
    }
    GRAPH_NODE_CLASSES = {
        "video": {"VHS_VideoCombine", "ADE_AnimateDiffLoaderGen1", "LoadImageFromUrl"},
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


if __name__ == "__main__":
    unittest.main()
