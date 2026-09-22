"""ACE Enhance pack + structure lyrics. No MiniMax/Suno essay."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.comfy_ace import (  # noqa: E402
    looks_like_ace,
    patch_workflow,
    resolve_ace_lyrics,
    split_tags_lyrics,
    structure_only_lyrics,
)
from app.enhance import (  # noqa: E402
    _chips_only_style,
    enforce_sung_lyrics,
    ensure_musical_cues,
    lift_timbre,
    merge_sonic_notes,
    _parse_style_lyrics,
    ACE_PACK,
    ace_enhance_target,
    _parse_ace_payload,
)


class DetectTests(unittest.TestCase):
    def test_ace_label_and_key(self):
        self.assertTrue(looks_like_ace("audio:ace step 1.5", "ACE-Step 1.5 (local Comfy)"))
        self.assertTrue(ace_enhance_target(model_id="audio:ace step 1.5", modality="music"))
        self.assertFalse(ace_enhance_target(model_id="minimax music 3", modality="music"))
        self.assertFalse(ace_enhance_target(model_id="lyria 3 pro", modality="music"))

    def test_pack_is_ace_not_suno(self):
        self.assertIn("not Suno/MiniMax prose", ACE_PACK)
        self.assertIn("comma-separated", ACE_PACK)
        self.assertIn("flare is color only", ACE_PACK.lower())
        self.assertIn("prompt MUST equal tags", ACE_PACK)


class ParseTests(unittest.TestCase):
    def test_json_prompt_equals_tags(self):
        raw = json.dumps(
            {
                "tags": "hard rock, instrumental, dual distorted electric guitars, 140 bpm",
                "lyrics": "[Intro]\n\n[Guitar Solo]\n\n[Outro - fade out]",
                "bpm": 140,
                "keyscale": "D major",
                "timesignature": "4",
                "language": "en",
                "instrumental": True,
                "prompt": "hard rock, instrumental, dual distorted electric guitars, 140 bpm",
            }
        )
        out = _parse_ace_payload(raw, "fallback")
        self.assertEqual(out["prompt"], out["tags"])
        self.assertIn("hard rock", out["tags"])
        self.assertIn("[Intro]", out["lyrics"])
        self.assertEqual(out["bpm"], 140)
        self.assertEqual(out["keyscale"], "D major")
        self.assertTrue(out["instrumental"])

    def test_style_key_maps_to_tags(self):
        raw = json.dumps(
            {
                "style": "classic hard rock, explosive energy, ~140 BPM",
                "lyrics": "[Intro]\n(cold-open riff, no vocals)\n\n[Verse]\n(instrumental groove kicks in)",
            }
        )
        out = _parse_ace_payload(raw, "fallback")
        self.assertEqual(out["tags"], "classic hard rock, explosive energy, ~140 BPM")
        self.assertIn("[Verse]", out["lyrics"])

    def test_yue_style_drops_section_tags(self):
        raw = json.dumps(
            {
                "style": "hard rock, ~140 BPM\n[Verse]\nwe ride",
                "lyrics": "",
            }
        )
        out = _parse_style_lyrics(raw, "hard rock", "[Intro]\n(riff)")
        self.assertNotIn("[Verse]", out["style"])
        self.assertIn("[Intro]", out["lyrics"])

    def test_style_drops_lyric_premise(self):
        style = _chips_only_style(
            "Classic hard rock, explosive energy, fused with hip-hop, lyrics about the ghetto"
        )
        self.assertNotIn("lyrics", style.lower())
        self.assertNotIn("ghetto", style.lower())
        self.assertIn("Classic hard rock", style)

    def test_sung_enhance_keeps_musical_cues(self):
        raw = (
            "[Intro]\n(cold-open riff, no vocals)\nDust on the porch\n\n"
            "[Verse]\n(instrumental groove kicks in)\nwe ride\n\n"
            "[Chorus]\n(full band, groove)\n(gritty male voice)\nsing it\n"
            "male voice raw\n"
        )
        cleaned = enforce_sung_lyrics(raw, "lyrics about the ghetto")
        self.assertNotIn("no vocals", cleaned.lower())
        self.assertNotIn("instrumental", cleaned.lower())
        self.assertIn("(cold-open riff)", cleaned)
        self.assertIn("(groove kicks in)", cleaned)
        self.assertIn("(full band, groove)", cleaned)
        self.assertNotIn("lyrics about the ghetto", cleaned)
        style, lyrics = lift_timbre("hard rock", cleaned)
        shaped = ensure_musical_cues(lyrics, creative=False)
        self.assertIn("gritty", style.lower())
        self.assertNotIn("gritty", shaped.lower())
        self.assertNotIn("male voice", shaped.lower())
        self.assertIn("(full band, groove)", shaped)
        self.assertIn("we ride", shaped)
        self.assertIn("Dust on the porch", shaped)
        self.assertRegex(shaped, r"\[Intro\]\n\([^)]+\)\nDust on the porch")
        self.assertRegex(shaped, r"\[Verse\]\n\([^)]+\)\nwe ride")
        bare = ensure_musical_cues("[Verse]\nwe ride\n\n[Chorus]\nsing", creative=False)
        self.assertIn("[Verse]\n(full band, groove)\nwe ride", bare)
        self.assertIn("[Chorus]\n(full band, big hit)\nsing", bare)
        rich = ensure_musical_cues("[Intro]\nhello", creative=True)
        self.assertIn("record scratches", rich)
        self.assertIn("hello", rich)

    def test_style_keeps_fusion_and_voice(self):
        style = merge_sonic_notes(
            "hard rock, forward energy",
            "hip-hop pocket, boom-bap, lyrics about the ghetto",
            "hard rock, male lead, gritty, belted vocal",
        )
        self.assertIn("hip-hop pocket", style)
        self.assertIn("boom-bap", style)
        self.assertNotIn("lyrics about", style.lower())
        self.assertIn("gritty", style)
        self.assertIn("belted vocal", style)

    def test_sung_enhance_lifts_timbre_to_style(self):
        style, lyrics = lift_timbre(
            "hard rock, male lead vocal",
            "[Verse]\n(gritty, belted)\nwe ride\n\n[Chorus]\n(full band enters)\nsing",
        )
        self.assertIn("gritty", style.lower())
        self.assertIn("belted", style.lower())
        self.assertNotIn("gritty", lyrics.lower())
        self.assertIn("(full band enters)", lyrics)
        self.assertIn("we ride", lyrics)
        self.assertIn("[Verse]", lyrics)

    def test_delimiter_fallback(self):
        raw = "TAGS:\nhard rock, instrumental, 120 bpm\n\nLYRICS:\n[Intro]\n\n[Outro]"
        tags, lyrics = split_tags_lyrics(raw)
        self.assertEqual(tags, "hard rock, instrumental, 120 bpm")
        self.assertIn("[Intro]", lyrics)


class LyricsTests(unittest.TestCase):
    def test_instrumental_keeps_structure_not_blank(self):
        lyrics = "[Intro]\n\n[Guitar Solo]\n\n[Chorus - high energy]\n\n[Outro - fade out]"
        out = resolve_ace_lyrics(lyrics, instrumental=True)
        self.assertIn("[Intro]", out)
        self.assertIn("[Guitar Solo]", out)
        self.assertTrue(out.strip())

    def test_instrumental_strips_sung_text(self):
        lyrics = "[Verse]\nwe ride at dawn together\n\n[Chorus]\nhold the line"
        out = structure_only_lyrics(lyrics)
        self.assertIn("[Verse]", out)
        self.assertIn("[Chorus]", out)
        self.assertNotIn("we ride", out)
        self.assertNotIn("hold the line", out)

    def test_vocal_keeps_sung_lines(self):
        lyrics = "[Verse]\nwe ride at dawn\n"
        self.assertEqual(resolve_ace_lyrics(lyrics, instrumental=False), lyrics)


class PatchTests(unittest.TestCase):
    def test_ksampler_and_encoder_class_type(self):
        from app.comfy_ace import load_workflow

        graph = patch_workflow(
            load_workflow(),
            tags="hard rock, instrumental, 140 bpm",
            lyrics="[Intro]\n\n[Outro]",
            duration_s=30,
            bpm=140,
            keyscale="D major",
            seed=1,
            steps=8,
            cfg=1.0,
            sampler_name="er_sde",
            scheduler="linear_quadratic",
            denoise=1.0,
            timesignature="4",
            language="en",
        )
        enc = next(
            v
            for v in graph.values()
            if isinstance(v, dict)
            and str(v.get("class_type") or "").startswith("TextEncodeAceStepAudio")
        )
        self.assertEqual(enc["inputs"]["tags"], "hard rock, instrumental, 140 bpm")
        self.assertIn("[Intro]", enc["inputs"]["lyrics"])
        self.assertEqual(enc["inputs"]["timesignature"], "4")
        samp = next(
            v
            for v in graph.values()
            if isinstance(v, dict) and v.get("class_type") == "KSampler"
        )
        self.assertEqual(samp["inputs"]["steps"], 8)
        self.assertEqual(samp["inputs"]["cfg"], 1.0)
        self.assertEqual(samp["inputs"]["sampler_name"], "er_sde")
        self.assertEqual(samp["inputs"]["scheduler"], "linear_quadratic")
        self.assertEqual(samp["inputs"]["denoise"], 1.0)


if __name__ == "__main__":
    unittest.main()
