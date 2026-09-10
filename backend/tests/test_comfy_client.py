"""Comfy bindings match the three API workflows. ACE is not wired."""

from __future__ import annotations

import sys
import unittest
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.comfy_character import ANGLE_CAM, CAMERA_LOCK  # noqa: E402
from app.comfy_client import (  # noqa: E402
    apply_binding_patches,
    find_nodes,
    load_bindings,
    load_workflow_file,
    node_matches,
    patch_input,
    workflow_dir,
)


class BindingMapTests(unittest.TestCase):
    def test_three_keys_and_files(self):
        spec = load_bindings()
        self.assertIn("zimage_t2i", spec)
        self.assertIn("qwen_angle", spec)
        self.assertIn("seedvr_confirm", spec)
        self.assertNotIn("ace", spec)
        self.assertFalse((workflow_dir() / spec["zimage_t2i"]["file"]).name.startswith("audio_"))
        for key in ("zimage_t2i", "qwen_angle", "seedvr_confirm"):
            graph = load_workflow_file(spec[key]["file"])
            for field, raw in spec[key].items():
                if field == "file":
                    continue
                selector, inp = raw[0], raw[1]
                nodes = find_nodes(graph, selector)
                self.assertTrue(nodes, f"{key}.{field}: no node for {selector!r}")
                self.assertTrue(
                    any(
                        inp in (n.get("inputs") or {})
                        or field in ("prompt",)
                        for _i, n in nodes
                    ),
                    f"{key}.{field}: input {inp!r} missing on {selector}",
                )

    def test_zimage_real_widgets(self):
        graph = load_workflow_file("ZimageTurbo T2I.json")
        enc = find_nodes(graph, "CLIPTextEncode")
        self.assertTrue(enc)
        self.assertIn("text", enc[0][1]["inputs"])
        noise = find_nodes(graph, "RandomNoise")
        self.assertIn("noise_seed", noise[0][1]["inputs"])
        res = find_nodes(graph, "ResolutionSelector")
        self.assertIn("aspect_ratio", res[0][1]["inputs"])
        self.assertIn("megapixels", res[0][1]["inputs"])

    def test_qwen_image1_and_camera_keys(self):
        graph = load_workflow_file("Qwen R2I - Multiple Angles Generator.json")
        img = find_nodes(graph, "IMAGE1")
        self.assertTrue(img)
        self.assertEqual(img[0][1]["class_type"], "LoadImage")
        cam = find_nodes(graph, "QwenMultiangleCameraNode")
        self.assertIn("horizontal_angle", cam[0][1]["inputs"])
        self.assertIn("vertical_angle", cam[0][1]["inputs"])
        self.assertIn("zoom", cam[0][1]["inputs"])
        self.assertNotIn("Horizontal Angle", cam[0][1]["inputs"])

    def test_seedvr_force_keys(self):
        graph = load_workflow_file("SeedVR2 Image Upscale.json")
        up = find_nodes(graph, "SeedVR2VideoUpscaler")
        self.assertTrue(up)
        inputs = up[0][1]["inputs"]
        self.assertEqual(inputs["batch_size"], 1)
        self.assertEqual(inputs["max_resolution"], 3840)
        self.assertEqual(inputs["temporal_overlap"], 0)
        self.assertEqual(inputs["prepend_frames"], 0)

    def test_patch_zimage_prompt_and_seed(self):
        spec = load_bindings()["zimage_t2i"]
        graph = deepcopy(load_workflow_file(spec["file"]))
        apply_binding_patches(
            graph,
            spec,
            {
                "prompt": "test identity",
                "aspect_ratio": "9:16 (Portrait Widescreen)",
                "megapixels": 2,
                "seed": 42,
            },
        )
        enc = find_nodes(graph, "CLIPTextEncode")[0][1]
        self.assertEqual(enc["inputs"]["text"], "test identity")
        noise = find_nodes(graph, "RandomNoise")[0][1]
        self.assertEqual(noise["inputs"]["noise_seed"], 42)

    def test_qwen_prompt_replaces_link(self):
        spec = load_bindings()["qwen_angle"]
        graph = deepcopy(load_workflow_file(spec["file"]))
        apply_binding_patches(
            graph,
            spec,
            {"h_angle": 90, "v_angle": 0, "zoom": 4, "prompt": "side lock", "seed": 1},
            replace_links={"prompt": True},
        )
        cam = find_nodes(graph, "QwenMultiangleCameraNode")[0][1]
        self.assertEqual(cam["inputs"]["horizontal_angle"], 90)
        patched = [
            n
            for _i, n in find_nodes(graph, "TextEncodeQwenImageEditPlus")
            if n["inputs"].get("prompt") == "side lock"
        ]
        self.assertTrue(patched)

    def test_seedvr_force_patch(self):
        spec = load_bindings()["seedvr_confirm"]
        graph = deepcopy(load_workflow_file(spec["file"]))
        apply_binding_patches(
            graph,
            spec,
            {
                "max_resolution": 3840,
                "batch_size": 1,
                "temporal_overlap": 0,
                "prepend_frames": 0,
            },
        )
        up = find_nodes(graph, "SeedVR2VideoUpscaler")[0][1]
        self.assertEqual(up["inputs"]["batch_size"], 1)
        self.assertEqual(up["inputs"]["max_resolution"], 3840)

    def test_angle_table(self):
        self.assertEqual(ANGLE_CAM["side"][:3], (90, 0, 4))
        self.assertEqual(ANGLE_CAM["threequarter_front"][:3], (45, 0, 4))
        self.assertEqual(ANGLE_CAM["threequarter_back"][:3], (135, 0, 4))
        self.assertEqual(ANGLE_CAM["back"][:3], (180, 0, 4))
        self.assertEqual(ANGLE_CAM["closeup"][:3], (0, 0, 9))
        self.assertEqual(ANGLE_CAM["top"][:3], (0, 70, 4))
        self.assertIn("clothing", CAMERA_LOCK)

    def test_ace_file_present_not_bound(self):
        ace = workflow_dir() / "audio_ace_step_1_5_split.json"
        self.assertTrue(ace.is_file())
        self.assertNotIn("ace", load_bindings())
        self.assertFalse(node_matches({"class_type": "KSampler"}, "nope"))


if __name__ == "__main__":
    unittest.main()
