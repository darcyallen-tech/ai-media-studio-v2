"""Partner routing: rewrite vs hard-pair switch. No safety-off. No auto-switch."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.partner_routing import (  # noqa: E402
    evaluate,
    family_of,
    soft_rewrite,
    switch_from_error,
)


class FamilyTests(unittest.TestCase):
    def test_seedance_r2v(self):
        self.assertEqual(
            family_of(endpoint="bytedance/seedance-2.5/reference-to-video"),
            "seedance",
        )

    def test_veo(self):
        self.assertEqual(family_of(label="Veo 3.1 Fast"), "veo")

    def test_omni(self):
        self.assertEqual(family_of(endpoint="google/gemini-omni-flash/v1.1/image-to-video"), "omni")


class SoftRewriteTests(unittest.TestCase):
    def test_recraft_sexy(self):
        out, _ = soft_rewrite("a sexy red dress on a model", family="recraft", modality="t2i")
        self.assertNotIn("sexy", out.lower())
        self.assertIn("editorial", out.lower())

    def test_qwen_logo_warn_does_not_invent_mark(self):
        out, warn = soft_rewrite("poster with a Nike swoosh", family="qwen", modality="t2i")
        self.assertIn("Nike", out)
        self.assertIsNotNone(warn)
        self.assertIn("not invent", warn.lower())

    def test_veo_drops_name_pair(self):
        out, _ = soft_rewrite(
            "Tom Cruise walks through a market",
            family="veo",
            modality="t2v",
        )
        self.assertNotIn("Tom Cruise", out)
        self.assertIn("unnamed adult", out.lower())


class HardPairTests(unittest.TestCase):
    def test_seedance_r2v_face_still_blocks_and_offers_wan(self):
        d = evaluate(
            model_id="seedance 2.5 reference",
            endpoint="bytedance/seedance-2.5/reference-to-video",
            modality="r2v",
            prompt="slow push on the character",
            start_still=r"D:\data\assets\characters\hero.jpg",
            catalog=[],
        )
        self.assertTrue(d.block)
        self.assertIsNotNone(d.switch)
        assert d.switch is not None
        self.assertIn("Seedance R2V blocks photoreal face refs", d.switch.message)
        self.assertEqual(d.switch.action_label, "Switch to Wan")
        self.assertIn("wan 3.0", d.switch.target_model_id.lower())

    def test_seedance_t2v_unnamed_adult_ok(self):
        d = evaluate(
            model_id="seedance 2.5 t2v",
            endpoint="bytedance/seedance-2.5/text-to-video",
            modality="t2v",
            prompt="an unnamed adult porter in a hotel lobby",
            catalog=[],
        )
        self.assertFalse(d.block)
        self.assertIsNone(d.switch)

    def test_does_not_read_photoreal_flag(self):
        # No photoreal kwarg exists — product still I2V without person words is allowed.
        d = evaluate(
            model_id="seedance 2.5 i2v",
            endpoint="bytedance/seedance-2.5/image-to-video",
            modality="i2v",
            prompt="slow camera push across the kitchen island",
            start_still=r"D:\uploads\listing-kitchen.jpg",
            catalog=[],
        )
        self.assertFalse(d.block)

    def test_kling_guns_block(self):
        d = evaluate(
            model_id="kling o3 standard i2v",
            endpoint="fal-ai/kling-video/o3/standard/image-to-video",
            modality="i2v",
            prompt="a real gun on the table",
            catalog=[],
        )
        self.assertTrue(d.block)
        assert d.switch is not None
        self.assertIn("Kling blocks real guns", d.switch.message)

    def test_hailuo_election_block(self):
        d = evaluate(
            model_id="minimax h3 i2v",
            endpoint="minimax/h3/image-to-video",
            modality="i2v",
            prompt="election campaign ad for the candidate",
            catalog=[],
        )
        self.assertTrue(d.block)

    def test_no_auto_switch_id_change(self):
        d = evaluate(
            model_id="seedance 2.5 reference",
            endpoint="bytedance/seedance-2.5/reference-to-video",
            modality="r2v",
            prompt="character walks",
            character_ids=["hero"],
            catalog=[],
        )
        self.assertTrue(d.block)
        self.assertEqual(d.family, "seedance")
        # Caller must click; evaluate never mutates the selected model id.


class ErrorMapTests(unittest.TestCase):
    def test_partner_validation_seedance(self):
        sw = switch_from_error(
            "HTTP 422 partner_validation_failed photoreal face",
            endpoint="bytedance/seedance-2.5/reference-to-video",
            modality="r2v",
        )
        self.assertIsNotNone(sw)
        assert sw is not None
        self.assertIn("Switch to Wan", sw.line)

    def test_content_policy_violation(self):
        sw = switch_from_error(
            "content_policy_violation: The content could not be processed",
            endpoint="bytedance/seedance-2.5/image-to-video",
            modality="i2v",
        )
        self.assertIsNotNone(sw)


if __name__ == "__main__":
    unittest.main()
