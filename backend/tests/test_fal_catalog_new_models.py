"""Lane, cost, and payload checks for the Oct 2026 Fal catalog additions."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.aspect_omit import apply_aspect_policy  # noqa: E402
from app.create_catalog import list_models_for_ui  # noqa: E402
from app.fal.models import (  # noqa: E402
    IMAGE_EDIT_MODELS,
    VIDEO_MODELS,
    apply_h3_max_middle_frame,
    build_edit_arguments,
    build_i2v_arguments,
    build_video_edit_arguments,
    flux3_image_unit_usd,
    ltx23_outpaint_cost_usd,
)
from app.tools_registry import REASPECT_VIDEO_MODELS  # noqa: E402
from app.vision_registry import (  # noqa: E402
    EXTEND_MODELS,
    T2I_MODELS,
    T2V_MODELS,
    build_vision_arguments,
    estimate_vision_cost,
)

LANES = ("t2i", "i2i", "r2i", "t2v", "i2v", "r2v", "v2v", "bridge", "extend")


def lanes_for(endpoint: str) -> list[str]:
    found: list[str] = []
    for modality in LANES:
        mode = "image" if modality in ("t2i", "i2i", "r2i") else "video"
        rows = list_models_for_ui(mode, modality)
        if any((row.endpoint or "") == endpoint for row in rows):
            found.append(modality)
    return found


def row_for(endpoint: str, modality: str):
    mode = "image" if modality in ("t2i", "i2i", "r2i") else "video"
    for row in list_models_for_ui(mode, modality):
        if (row.endpoint or "") == endpoint:
            return row
    raise AssertionError(f"{endpoint} missing from {modality}")


class NewFalCatalogTests(unittest.TestCase):
    def test_each_endpoint_is_only_in_its_lane(self):
        expected = {
            "blackforestlabs/flux-3/text-to-image": ["t2i"],
            "blackforestlabs/flux-3/edit-image": ["i2i", "r2i"],
            "minimax/h3-max/recast": ["v2v"],
            "minimax/h3-max/extend-video": ["extend"],
            "minimax/h3-max-turbo/extend-video": ["extend"],
            "xai/grok-imagine-video/v1.5/lite/text-to-video": ["t2v"],
            "xai/grok-imagine-video/v1.5/lite/image-to-video": ["i2v"],
            "fal-ai/ltx-2.3-quality/outpaint": ["v2v"],
        }
        for endpoint, lanes in expected.items():
            self.assertEqual(lanes_for(endpoint), lanes, endpoint)

    def test_best_for_notes_and_promo_date(self):
        notes = {
            "blackforestlabs/flux-3/text-to-image": "t2i",
            "blackforestlabs/flux-3/edit-image": "i2i",
            "minimax/h3-max/recast": "v2v",
            "minimax/h3-max/extend-video": "extend",
            "minimax/h3-max-turbo/extend-video": "extend",
            "xai/grok-imagine-video/v1.5/lite/text-to-video": "t2v",
            "xai/grok-imagine-video/v1.5/lite/image-to-video": "i2v",
            "fal-ai/ltx-2.3-quality/outpaint": "v2v",
        }
        for endpoint, modality in notes.items():
            text = row_for(endpoint, modality).notes
            self.assertIn("Best for", text, endpoint)
        for endpoint in (
            "blackforestlabs/flux-3/text-to-image",
            "blackforestlabs/flux-3/edit-image",
        ):
            self.assertIn("Oct 8", row_for(endpoint, "t2i" if "text-to-image" in endpoint else "i2i").notes)

    def test_no_flux3_outpaint_and_reframe_stays(self):
        blob = []
        for modality in LANES:
            mode = "image" if modality in ("t2i", "i2i", "r2i") else "video"
            blob.extend(row.endpoint or "" for row in list_models_for_ui(mode, modality))
        self.assertFalse(any("flux-3" in ep and "outpaint" in ep for ep in blob))
        keys = list(REASPECT_VIDEO_MODELS)
        self.assertLess(keys.index("ltx reframe"), keys.index("ltx 2.3 quality outpaint"))
        reframe = REASPECT_VIDEO_MODELS["ltx reframe"]
        self.assertEqual(reframe.endpoint, "fal-ai/ltx-2.3/reframe")
        self.assertEqual(reframe.label, "LTX 2.3 Reframe")
        self.assertEqual(lanes_for("fal-ai/ltx-2.3/reframe"), [])

    def test_flux3_image_price_scales_and_promo_ends_oct_8(self):
        self.assertAlmostEqual(flux3_image_unit_usd("1k", today="2026-10-03"), 0.024)
        self.assertAlmostEqual(flux3_image_unit_usd("1k", today="2026-10-08"), 0.024)
        self.assertAlmostEqual(flux3_image_unit_usd("1k", today="2026-10-09"), 0.048)
        self.assertAlmostEqual(flux3_image_unit_usd("512sq", today="2026-10-03"), 0.0205)
        self.assertAlmostEqual(flux3_image_unit_usd("2k", today="2026-10-03"), 0.050)
        self.assertAlmostEqual(flux3_image_unit_usd("4k", today="2026-10-03"), 0.3035)
        self.assertAlmostEqual(flux3_image_unit_usd("4k", today="2026-10-09"), 0.607)
        spec = T2I_MODELS["flux 3 t2i"]
        self.assertAlmostEqual(
            estimate_vision_cost(spec, resolution="1k"), 0.024, places=4
        )
        self.assertAlmostEqual(
            estimate_vision_cost(spec, resolution="4k"), 0.3035, places=4
        )
        self.assertGreater(
            estimate_vision_cost(spec, resolution="4k"),
            estimate_vision_cost(spec, resolution="1k"),
        )
        edit = IMAGE_EDIT_MODELS["flux 3 edit"]
        self.assertAlmostEqual(edit.estimate_cost(1, "2k") or 0, 0.050, places=4)
        self.assertAlmostEqual(edit.estimate_cost(2, "1k") or 0, 0.048, places=4)

    def test_video_costs_scale_with_resolution_and_duration(self):
        lite = T2V_MODELS["grok imagine 1.5 lite t2v"]
        self.assertAlmostEqual(
            estimate_vision_cost(lite, duration_token="6", resolution="720p"),
            0.18,
            places=3,
        )
        self.assertAlmostEqual(
            estimate_vision_cost(lite, duration_token="10", resolution="480p"),
            0.20,
            places=3,
        )
        self.assertAlmostEqual(
            estimate_vision_cost(lite, duration_token="4", resolution="1080p"),
            0.56,
            places=3,
        )
        i2v = VIDEO_MODELS["grok imagine 1.5 lite i2v"]
        self.assertAlmostEqual(i2v.estimate_cost(6, resolution="720p") or 0, 0.19, places=3)
        self.assertAlmostEqual(i2v.estimate_cost(10, resolution="1080p") or 0, 1.41, places=3)
        extend = EXTEND_MODELS["h3 max extend"]
        turbo = EXTEND_MODELS["h3 max turbo extend"]
        self.assertAlmostEqual(
            estimate_vision_cost(extend, duration_token="5", resolution="768P"),
            0.40,
            places=3,
        )
        self.assertAlmostEqual(
            estimate_vision_cost(extend, duration_token="4", resolution="2K"),
            1.28,
            places=3,
        )
        self.assertAlmostEqual(
            estimate_vision_cost(turbo, duration_token="8", resolution="1080P"),
            0.64,
            places=3,
        )
        self.assertAlmostEqual(
            estimate_vision_cost(turbo, duration_token="2", resolution="480P"),
            0.05,
            places=3,
        )
        recast = VIDEO_MODELS["h3 max recast"]
        self.assertAlmostEqual(recast.estimate_cost(5, resolution="1080P") or 0, 2.25, places=3)
        self.assertAlmostEqual(recast.estimate_cost(10, resolution="768P") or 0, 3.00, places=3)
        out = VIDEO_MODELS["ltx 2.3 quality outpaint"]
        cheap = out.estimate_cost(5, resolution="480p") or 0
        mid = out.estimate_cost(5, resolution="720p") or 0
        hi = out.estimate_cost(10, resolution="1080p") or 0
        self.assertLess(cheap, mid)
        self.assertLess(mid, hi)
        example = ltx23_outpaint_cost_usd(121 / 24, "720p")
        self.assertAlmostEqual(example, 0.27, places=2)

    def test_payloads_use_schema_field_names(self):
        t2i = build_vision_arguments(
            T2I_MODELS["flux 3 t2i"],
            prompt="a red door",
            aspect_ratio="16:9",
            resolution="2k",
            num_images=4,
        )
        self.assertEqual(t2i["aspect_ratio"], "16:9")
        self.assertEqual(t2i["resolution"], "2k")
        self.assertNotIn("image_size", t2i)
        self.assertNotIn("num_images", t2i)

        edit_args, _notes = build_edit_arguments(
            IMAGE_EDIT_MODELS["flux 3 edit"],
            prompt="repaint the door",
            image_urls=["https://example.com/a.jpg", "https://example.com/b.jpg"],
            parameters={"aspect_ratio": "auto", "resolution": "1k", "strength": 0.4},
        )
        self.assertEqual(edit_args["image_urls"], [
            "https://example.com/a.jpg",
            "https://example.com/b.jpg",
        ])
        self.assertEqual(edit_args["aspect_ratio"], "auto")
        self.assertEqual(edit_args["resolution"], "1k")
        self.assertNotIn("strength", edit_args)
        self.assertNotIn("image_size", edit_args)
        self.assertNotIn("num_images", edit_args)
        self.assertFalse(row_for("blackforestlabs/flux-3/edit-image", "i2i").supports_strength)

        recast, _ = build_video_edit_arguments(
            VIDEO_MODELS["h3 max recast"],
            prompt="",
            video_url="https://example.com/src.mp4",
            image_urls=["https://example.com/p1.jpg", "https://example.com/p2.jpg"],
            parameters={"resolution": "768p", "duration": 12},
        )
        self.assertEqual(recast["reference_image_urls"], [
            "https://example.com/p1.jpg",
            "https://example.com/p2.jpg",
        ])
        self.assertEqual(recast["resolution"], "768P")
        self.assertNotIn("duration", recast)
        self.assertNotIn("prompt", recast)

        extend = build_vision_arguments(
            EXTEND_MODELS["h3 max extend"],
            prompt="she keeps walking",
            source_video_url="https://example.com/src.mp4",
            duration="7",
            resolution="1080P",
            aspect_ratio="auto",
            ref_audio_urls=["https://example.com/a.mp3"],
        )
        self.assertEqual(extend["duration"], 7)
        self.assertEqual(extend["resolution"], "1080P")
        self.assertEqual(extend["aspect_ratio"], "auto")
        self.assertEqual(extend["reference_audio_urls"], ["https://example.com/a.mp3"])
        self.assertEqual(extend["output"], "extended")
        self.assertNotIn("video_urls", extend)

        lite_t2v = build_vision_arguments(
            T2V_MODELS["grok imagine 1.5 lite t2v"],
            prompt="a draft pan",
            duration="4",
            resolution="480p",
            aspect_ratio="9:16",
        )
        self.assertEqual(lite_t2v["duration"], 4)
        self.assertEqual(lite_t2v["resolution"], "480p")
        self.assertEqual(lite_t2v["aspect_ratio"], "9:16")

        lite_i2v, _ = build_i2v_arguments(
            VIDEO_MODELS["grok imagine 1.5 lite i2v"],
            prompt="animate",
            image_url="https://example.com/still.jpg",
            parameters={"duration": 6, "resolution": "720p", "aspect_ratio": "auto"},
        )
        self.assertEqual(lite_i2v["image_url"], "https://example.com/still.jpg")
        self.assertEqual(lite_i2v["duration"], 6)
        self.assertEqual(lite_i2v["resolution"], "720p")
        self.assertNotIn("aspect_ratio", lite_i2v)
        stripped = apply_aspect_policy(
            {"prompt": "x", "aspect_ratio": "auto"},
            endpoint="xai/grok-imagine-video/v1.5/lite/image-to-video",
            requested="16:9",
        )
        self.assertNotIn("aspect_ratio", stripped)

        out, _ = build_video_edit_arguments(
            VIDEO_MODELS["ltx 2.3 quality outpaint"],
            prompt="fill the new margins with a hallway",
            video_url="https://example.com/src.mp4",
            parameters={
                "duration": 5,
                "resolution": "720p",
                "aspect_ratio": "21:9",
                "source_scale": 0.8,
                "video_strength": 0.6,
            },
        )
        self.assertEqual(out["aspect_ratio"], "21:9")
        self.assertEqual(out["output_resolution"], "720p")
        self.assertEqual(out["source_scale"], 0.8)
        self.assertEqual(out["video_strength"], 0.6)
        self.assertEqual(out["num_frames"], 120)
        self.assertNotIn("duration", out)
        self.assertNotIn("resolution", out)

    def test_h3_max_middle_frame(self):
        spec = VIDEO_MODELS["minimax h3 max reference"]
        self.assertEqual(spec.endpoint, "minimax/h3-max/reference-to-video")
        self.assertEqual(lanes_for(spec.endpoint), ["r2v"])
        self.assertTrue(row_for(spec.endpoint, "r2v").supports_end_frame)
        plain, _ = build_i2v_arguments(
            spec,
            prompt="keep the walk",
            image_url="https://example.com/start.jpg",
            parameters={"duration": 5, "resolution": "768P"},
        )
        self.assertNotIn("middle_image_url", plain)
        self.assertNotIn("image_url", plain)

        happy, notes = build_i2v_arguments(
            spec,
            prompt="keep the walk",
            image_url="https://example.com/start.jpg",
            parameters={
                "duration": 6,
                "resolution": "480P",
                "end_image_url": "https://example.com/end.jpg",
                "middle_image_url": "https://example.com/mid.jpg",
                "middle_frame_time": 2.5,
            },
        )
        self.assertEqual(happy["image_url"], "https://example.com/start.jpg")
        self.assertEqual(happy["end_image_url"], "https://example.com/end.jpg")
        self.assertEqual(happy["middle_image_url"], "https://example.com/mid.jpg")
        self.assertEqual(happy["middle_frame_time"], 2.5)
        self.assertEqual(happy["resolution"], "480P")
        self.assertTrue(any("Middle frame" in n for n in notes))

        with self.assertRaises(ValueError):
            apply_h3_max_middle_frame(
                {"duration": 5, "resolution": "768P"},
                endpoint=spec.endpoint,
                start_image_url="https://example.com/start.jpg",
                middle_image_url="https://example.com/mid.jpg",
                middle_frame_time=2,
            )
        with self.assertRaises(ValueError):
            apply_h3_max_middle_frame(
                {"duration": 5, "resolution": "768P"},
                endpoint=spec.endpoint,
                start_image_url="https://example.com/start.jpg",
                end_image_url="https://example.com/end.jpg",
                middle_image_url="https://example.com/mid.jpg",
                middle_frame_time=5,
            )
        with self.assertRaises(ValueError):
            apply_h3_max_middle_frame(
                {"duration": 5, "resolution": "1080P"},
                endpoint=spec.endpoint,
                start_image_url="https://example.com/start.jpg",
                end_image_url="https://example.com/end.jpg",
                middle_image_url="https://example.com/mid.jpg",
                middle_frame_time=2,
            )


if __name__ == "__main__":
    unittest.main()
