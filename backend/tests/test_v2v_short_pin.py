"""ID-V2V and Ray 3.2 V2V stay on Create V2V, not Frame Editor."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.aleph_service import frame_models_for_ui  # noqa: E402
from app.create_catalog import list_models_for_ui  # noqa: E402
from app.fal.models import VIDEO_MODELS, build_video_edit_arguments  # noqa: E402


class ShortPinV2VTests(unittest.TestCase):
    def test_catalog_is_v2v_only_and_frame_stays_aleph(self):
        rows = list_models_for_ui("video", "v2v")
        by_ep = {r.endpoint: r for r in rows}
        idv = by_ep["fal-ai/id-v2v"]
        relight = by_ep["fal-ai/id-v2v/relight"]
        ray = by_ep["luma/agent/ray/v3.2/video-to-video"]
        self.assertEqual(idv.modalities, ("v2v",))
        self.assertEqual(relight.modalities, ("v2v",))
        self.assertEqual(ray.modalities, ("v2v",))
        self.assertEqual(tuple(ray.duration_enum), ("5", "10"))
        self.assertEqual(tuple(idv.resolution_choices), ("480p", "720p"))
        self.assertNotIn("4k", idv.resolution_choices)
        self.assertNotIn("30", idv.duration_enum)
        self.assertNotIn("30", ray.duration_enum)
        self.assertNotIn("4k", ray.resolution_choices)
        frame = frame_models_for_ui()
        self.assertEqual(len(frame), 1)
        self.assertIn("aleph", frame[0]["endpoint"])
        self.assertNotIn("id-v2v", frame[0]["endpoint"])

    def test_id_v2v_payload_caps_and_cost(self):
        spec = VIDEO_MODELS["id v2v"]
        args, _notes = build_video_edit_arguments(
            spec,
            prompt="autumn forest",
            video_url="https://example.test/clip.mp4",
            image_urls=["https://example.test/first.png"],
            parameters={"duration": "30", "resolution": "4k"},
        )
        self.assertEqual(args["video_url"], "https://example.test/clip.mp4")
        self.assertEqual(args["image_url"], "https://example.test/first.png")
        self.assertEqual(args["resolution"], "720p")
        self.assertLessEqual(args["num_frames"], 241)
        self.assertNotIn("duration", args)
        self.assertNotIn("fal-ai/id-v2v/relight", spec.endpoint)
        with self.assertRaises(ValueError):
            build_video_edit_arguments(
                spec,
                prompt="autumn forest",
                video_url="",
                image_urls=["https://example.test/first.png"],
            )
        cost = spec.estimate_cost(10, resolution="720p")
        self.assertAlmostEqual(cost or 0, 2.0, places=2)
        relight = VIDEO_MODELS["id v2v relight"].estimate_cost(5)
        self.assertAlmostEqual(relight or 0, 1.0, places=2)

    def test_ray_v2v_is_five_or_ten_seconds(self):
        spec = VIDEO_MODELS["ray 3.2 v2v"]
        self.assertNotEqual(spec.endpoint, "luma/agent/ray/v3.2/text-to-video")
        args, _notes = build_video_edit_arguments(
            spec,
            prompt="watercolor",
            video_url="https://example.test/clip.mp4",
            image_urls=["https://example.test/start.png"],
            parameters={"duration": "30", "resolution": "4k"},
        )
        self.assertEqual(args["duration"], "10s")
        self.assertEqual(args["resolution"], "540p")
        self.assertEqual(args["start_image_url"], "https://example.test/start.png")
        self.assertNotIn("keyframes", args)
        five = spec.estimate_cost(5, resolution="540p")
        ten = spec.estimate_cost(10, resolution="1080p")
        self.assertAlmostEqual(five or 0, 0.72, places=2)
        self.assertAlmostEqual(ten or 0, 4.32, places=2)


if __name__ == "__main__":
    unittest.main()
