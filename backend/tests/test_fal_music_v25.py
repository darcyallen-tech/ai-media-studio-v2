"""ElevenLabs Music v2.5 and Lyria 3.5 prompt packing and cost."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.audio_registry import (  # noqa: E402
    MUSIC_MODELS,
    build_music_args,
    estimate_audio_cost,
    format_audio_cost,
)


class FalMusicCatalogTests(unittest.TestCase):
    def test_rows_sit_above_minimax_and_older_siblings(self):
        keys = list(MUSIC_MODELS)
        self.assertLess(keys.index("elevenlabs music v2.5"), keys.index("minimax music 3"))
        self.assertLess(keys.index("lyria 3.5"), keys.index("minimax music 3"))
        self.assertLess(keys.index("elevenlabs music v2.5"), keys.index("elevenlabs music"))
        self.assertLess(keys.index("lyria 3.5"), keys.index("lyria 3 pro"))
        self.assertEqual(MUSIC_MODELS["elevenlabs music v2.5"].endpoint, "elevenlabs/music/v2.5")
        self.assertEqual(MUSIC_MODELS["elevenlabs music"].endpoint, "fal-ai/elevenlabs/music")
        self.assertEqual(MUSIC_MODELS["lyria 3.5"].endpoint, "google/lyria-3.5")
        self.assertEqual(MUSIC_MODELS["lyria 3 pro"].endpoint, "fal-ai/lyria3/pro")
        self.assertIn("v1/v2", MUSIC_MODELS["elevenlabs music"].label)

    def test_v25_instrumental_and_sung_prompts(self):
        spec = MUSIC_MODELS["elevenlabs music v2.5"]
        lyrics = "[Verse]\nwe ride\n\n[Chorus]\nhold on"
        off = build_music_args(
            spec, "hard rock, forward energy", duration_s=90, instrumental=False, lyrics=lyrics, seed=7
        )
        self.assertTrue(off["prompt"].startswith("hard rock, forward energy\n\nLyrics:\n"))
        self.assertIn("[Verse]", off["prompt"])
        self.assertFalse(off["force_instrumental"])
        self.assertEqual(off["music_length_ms"], 90000)
        self.assertEqual(off["seed"], 7)
        self.assertNotIn("composition_plan", off)
        on = build_music_args(
            spec, "hard rock", duration_s=30, instrumental=True, lyrics=lyrics
        )
        self.assertNotIn("Lyrics:", on["prompt"])
        self.assertTrue(on["force_instrumental"])
        self.assertEqual(on["music_length_ms"], 30000)
        tiny = build_music_args(spec, "pad", duration_s=1, instrumental=True)
        huge = build_music_args(spec, "pad", duration_s=9000, instrumental=True)
        self.assertEqual(tiny["music_length_ms"], 3000)
        self.assertEqual(huge["music_length_ms"], 600000)

    def test_v25_cost_rounds_up_by_minute(self):
        spec = MUSIC_MODELS["elevenlabs music v2.5"]
        self.assertEqual(estimate_audio_cost(spec, duration_s=30), 0.60)
        self.assertEqual(estimate_audio_cost(spec, duration_s=60), 0.60)
        self.assertEqual(estimate_audio_cost(spec, duration_s=61), 1.20)
        label = format_audio_cost(spec, duration_s=90)
        self.assertIn("$1.20", label)
        old = estimate_audio_cost(MUSIC_MODELS["elevenlabs music"], duration_s=30)
        self.assertNotEqual(old, 0.60)

    def test_lyria_35_prompt_and_flat_cost(self):
        spec = MUSIC_MODELS["lyria 3.5"]
        lyrics = "[Chorus]\nsing it"
        sung = build_music_args(
            spec,
            "bright pop",
            duration_s=45,
            instrumental=False,
            lyrics=lyrics,
            image_url="https://example.test/still.png",
        )
        self.assertIn("bright pop\n\nLyrics:\n[Chorus]\nsing it", sung["prompt"])
        self.assertNotIn("Instrumental only", sung["prompt"])
        self.assertEqual(sung["image_url"], "https://example.test/still.png")
        bare = build_music_args(spec, "arena rock", duration_s=45, instrumental=True, lyrics=lyrics)
        self.assertIn("Instrumental only, no vocals, no lyrics.", bare["prompt"])
        self.assertNotIn("Lyrics:", bare["prompt"])
        self.assertNotIn("sing it", bare["prompt"])
        self.assertNotIn("image_url", bare)
        self.assertEqual(estimate_audio_cost(spec, duration_s=180), 0.10)
        self.assertIn("$0.10", format_audio_cost(spec, duration_s=180))


if __name__ == "__main__":
    unittest.main()
