"""Song name is a label and the next export's slug. It does not rename saved files."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.library import _item, record_generated, set_generated_song_name  # noqa: E402
from app.naming import make_output_stem, music_output_stem, song_slug  # noqa: E402
from app.resolve_export import resolve_clip_name  # noqa: E402


class SongNameTests(unittest.TestCase):
    def test_slug_trailer_park_bed_and_style_head(self):
        self.assertEqual(song_slug("Trailer Park Bed"), "trailer-park-bed")
        self.assertEqual(song_slug("Hard rock 140"), "hard-rock-140")
        style = "Hard rock 140 BPM, distorted guitars and a huge chorus tonight"
        slug = song_slug(style)
        self.assertTrue(slug.startswith("hard-rock-140"))
        self.assertLessEqual(len(slug), 40)
        self.assertEqual(song_slug(""), "")
        self.assertEqual(song_slug("   "), "")
        self.assertEqual(song_slug("a hard rock"), "a-hard-rock")

    def test_blank_keeps_timestamp_stem_and_named_save_is_slug(self):
        stamp = "20260923_120000"
        yue = f"AIMS_YuE2_T2M_{stamp}"
        fal = make_output_stem(
            "hard rock bed",
            "minimax music 3",
            stamp=stamp,
            kind="music",
        )
        self.assertEqual(music_output_stem(song_name="", stamp=stamp, fallback=yue), yue)
        self.assertEqual(music_output_stem(song_name="  ", stamp=stamp, fallback=fal), fal)
        self.assertNotIn("trailer-park-bed", fal)
        self.assertEqual(
            music_output_stem(song_name="Trailer Park Bed", stamp=stamp, fallback=yue),
            f"trailer-park-bed_{stamp}",
        )
        self.assertEqual(
            music_output_stem(song_name="Hard rock 140", stamp=stamp, fallback=fal),
            f"hard-rock-140_{stamp}",
        )

    def test_library_label_does_not_rename_the_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            wav = root / "AIMS_YuE2_T2M_20260923_120000.wav"
            wav.write_bytes(b"RIFF")
            row = _item(
                source="generated",
                path=wav,
                root=root,
                extra={"song_name": "Trailer Park Bed", "cost": "Cost: $0.00"},
            )
            self.assertIsNotNone(row)
            assert row is not None
            self.assertEqual(row["name"], "Trailer Park Bed")
            self.assertEqual(row["song_name"], "Trailer Park Bed")
            self.assertTrue(str(row["path"]).endswith("AIMS_YuE2_T2M_20260923_120000.wav"))
            blank = _item(source="generated", path=wav, root=root, extra={"song_name": "  "})
            assert blank is not None
            self.assertEqual(blank["name"], wav.name)
            self.assertNotIn("song_name", blank)

            index = root / "generated.json"
            with patch("app.library.GENERATED_INDEX", index):
                saved = set_generated_song_name(wav, "Trailer Park Bed")
                self.assertFalse(saved["renamed"])
                self.assertEqual(saved["song_name"], "Trailer Park Bed")
                record_generated([str(wav)], cost="Cost: $0.00")
                rows = json.loads(index.read_text(encoding="utf-8"))
                self.assertEqual(rows[0]["song_name"], "Trailer Park Bed")
                set_generated_song_name(wav, "")
                cleared = json.loads(index.read_text(encoding="utf-8"))
                self.assertNotIn("song_name", cleared[0])
            self.assertTrue(wav.is_file())
            self.assertEqual(wav.name, "AIMS_YuE2_T2M_20260923_120000.wav")
            self.assertFalse((root / "trailer-park-bed_20260923_120000.wav").exists())

    def test_resolve_clip_name_falls_back_when_blank(self):
        self.assertEqual(resolve_clip_name("Trailer Park Bed"), "Trailer Park Bed")
        self.assertEqual(resolve_clip_name("  "), "")
        self.assertEqual(resolve_clip_name(None), "")


if __name__ == "__main__":
    unittest.main()
