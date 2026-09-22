"""GPT Image 2.5 Flare and Sunburst stay on Fal and above GPT Image 2."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.fal.models import IMAGE_EDIT_MODELS, build_edit_arguments  # noqa: E402
from app.vision_registry import (  # noqa: E402
    GPT_IMAGE_25_QUALITY,
    I2I_MODELS,
    R2I_MODELS,
    T2I_MODELS,
    build_vision_arguments,
    estimate_vision_cost,
)


class GptImage25CatalogTests(unittest.TestCase):
    def test_rows_sit_above_gpt_image_2(self):
        t2i = list(T2I_MODELS)
        self.assertLess(t2i.index("gpt image 2.5 flare t2i"), t2i.index("gpt image 2 t2i"))
        self.assertLess(t2i.index("gpt image 2.5 sunburst t2i"), t2i.index("gpt image 2 t2i"))
        i2i = list(I2I_MODELS)
        self.assertLess(i2i.index("gpt image 2.5 flare i2i"), i2i.index("gpt image 2 i2i"))
        self.assertLess(i2i.index("gpt image 2.5 sunburst i2i"), i2i.index("gpt image 2 i2i"))
        r2i = list(R2I_MODELS)
        self.assertLess(r2i.index("gpt image 2.5 flare r2i"), r2i.index("gpt image 2 r2i"))
        self.assertLess(r2i.index("gpt image 2.5 sunburst r2i"), r2i.index("gpt image 2 r2i"))
        edits = list(IMAGE_EDIT_MODELS)
        self.assertLess(edits.index("gpt image 2.5 flare"), edits.index("gpt image 2"))
        self.assertLess(edits.index("gpt image 2.5 sunburst"), edits.index("gpt image 2"))

    def test_endpoints_and_labels(self):
        pairs = (
            (T2I_MODELS["gpt image 2.5 flare t2i"], "openai/gpt-image-2.5/flare/text-to-image"),
            (T2I_MODELS["gpt image 2.5 sunburst t2i"], "openai/gpt-image-2.5/sunburst/text-to-image"),
            (I2I_MODELS["gpt image 2.5 flare i2i"], "openai/gpt-image-2.5/flare/edit"),
            (I2I_MODELS["gpt image 2.5 sunburst i2i"], "openai/gpt-image-2.5/sunburst/edit"),
            (R2I_MODELS["gpt image 2.5 flare r2i"], "openai/gpt-image-2.5/flare/edit"),
            (R2I_MODELS["gpt image 2.5 sunburst r2i"], "openai/gpt-image-2.5/sunburst/edit"),
        )
        for spec, endpoint in pairs:
            self.assertEqual(spec.endpoint, endpoint)
            self.assertNotIn("openai/gpt-image-2/", spec.endpoint + "/")
            self.assertIn("xhigh", spec.resolution_choices)
            self.assertIn("max", spec.resolution_choices)
            self.assertEqual(spec.extra_defaults.get("background"), "auto")
        self.assertEqual(
            T2I_MODELS["gpt image 2.5 flare t2i"].label,
            "GPT Image 2.5 Flare (quality / speed)",
        )
        self.assertEqual(
            T2I_MODELS["gpt image 2.5 sunburst t2i"].label,
            "GPT Image 2.5 Sunburst (precision / multi-round edit)",
        )
        self.assertEqual(T2I_MODELS["gpt image 2 t2i"].endpoint, "openai/gpt-image-2")
        self.assertEqual(tuple(GPT_IMAGE_25_QUALITY), ("auto", "low", "medium", "high", "xhigh", "max"))
        self.assertEqual(I2I_MODELS["gpt image 2.5 flare i2i"].image_field, "image_urls")
        self.assertEqual(IMAGE_EDIT_MODELS["gpt image 2.5 flare"].max_ref_images, 16)
        self.assertTrue(I2I_MODELS["gpt image 2.5 sunburst i2i"].supports_mask)

    def test_generate_payload_uses_25_endpoint_fields(self):
        spec = T2I_MODELS["gpt image 2.5 flare t2i"]
        args = build_vision_arguments(
            spec,
            prompt="a red kettle",
            aspect_ratio="landscape_16_9",
            resolution="xhigh",
        )
        self.assertEqual(args["prompt"], "a red kettle")
        self.assertEqual(args["image_size"], "landscape_16_9")
        self.assertEqual(args["quality"], "xhigh")
        self.assertEqual(args["background"], "auto")
        self.assertNotIn("gpt-image-2/", spec.endpoint)
        edit, _notes = build_edit_arguments(
            IMAGE_EDIT_MODELS["gpt image 2.5 sunburst"],
            prompt="keep the face",
            image_urls=["https://example.test/a.png", "https://example.test/b.png"],
            parameters={"resolution": "max", "aspect_ratio": "auto"},
        )
        self.assertEqual(edit["image_urls"], ["https://example.test/a.png", "https://example.test/b.png"])
        self.assertEqual(edit["quality"], "max")
        self.assertEqual(edit["image_size"], "auto")
        self.assertEqual(edit["background"], "auto")

    def test_cost_changes_with_quality(self):
        spec = T2I_MODELS["gpt image 2.5 flare t2i"]
        low = estimate_vision_cost(spec, resolution="low", aspect_ratio="square")
        high = estimate_vision_cost(spec, resolution="high", aspect_ratio="square")
        top = estimate_vision_cost(spec, resolution="max", aspect_ratio="square")
        self.assertLess(low, high)
        self.assertLess(high, top)
        older = estimate_vision_cost(
            T2I_MODELS["gpt image 2 t2i"], resolution="high", aspect_ratio="square"
        )
        self.assertGreater(older, 0.1)


if __name__ == "__main__":
    unittest.main()
