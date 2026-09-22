"""YuE2 local Comfy music: node targets, WAV prefix, no fal when Comfy is down."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.audio_registry import MUSIC_MODELS  # noqa: E402
from app.audio_service import duration_tokens, generate_audio  # noqa: E402
from app.comfy_yue2 import generate_yue2  # noqa: E402
from app.comfy_ace import is_ace_step  # noqa: E402
from app.comfy_yue2 import (  # noqa: E402
    _POLL_MAX_S,
    _annotate_duration_error,
    _clamp_duration,
    _history_abc,
    _opt_seed,
    _set_duration,
    _status_error,
    apply_instrumental_lock,
    is_yue2,
    load_graph,
    patch_cover,
    patch_rerender,
    patch_t2m,
    preflight_duration,
    set_workflow_scalar,
    yue2_kind,
)
from app.config import PROJECT_ROOT  # noqa: E402


def _link(graph, node_id, field):
    return graph[str(node_id)]["inputs"][field]


class Yue2GraphTests(unittest.TestCase):
    def test_poll_window_is_15_to_20_minutes(self):
        self.assertGreaterEqual(_POLL_MAX_S, 15 * 60)
        self.assertLessEqual(_POLL_MAX_S, 20 * 60)

    def test_registry_is_free_and_not_ace(self):
        keys = ("yue2 text to music", "yue2 cover", "yue2 rerender abc")
        endpoints = {
            "yue2 text to music": "comfy:yue2-t2m",
            "yue2 cover": "comfy:yue2-cover",
            "yue2 rerender abc": "comfy:yue2-rerender",
        }
        for key in keys:
            spec = MUSIC_MODELS[key]
            self.assertEqual(spec.cost_estimate_usd, 0.0)
            self.assertEqual(spec.endpoint, endpoints[key])
            self.assertTrue(is_yue2(spec))
            self.assertFalse(is_ace_step(spec))
            self.assertEqual(yue2_kind(spec), {
                "yue2 text to music": "t2m",
                "yue2 cover": "cover",
                "yue2 rerender abc": "rerender",
            }[key])
        self.assertFalse(is_yue2(MUSIC_MODELS["ace step 1.5"]))
        self.assertFalse(is_yue2(MUSIC_MODELS["minimax music 3"]))

    def test_bindings_point_style_lyrics_at_primitives(self):
        path = PROJECT_ROOT / "workflows" / "comfy" / "bindings.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for key in ("yue2_t2m", "yue2_grok_rock"):
            bindings = data[key]["bindings"]
            self.assertEqual(bindings["style"], {"node": "113", "field": "value"})
            self.assertEqual(bindings["lyrics"], {"node": "114", "field": "value"})
            self.assertNotIn("style_music", bindings)
            self.assertNotIn("lyrics_music", bindings)

    def test_t2m_patches_113_114_and_keeps_links(self):
        raw = load_graph("t2m")
        style_link = list(_link(raw, "24", "style"))
        lyrics_link = list(_link(raw, "25", "lyrics"))
        self.assertEqual(raw["113"]["class_type"], "PrimitiveStringMultiline")
        self.assertEqual(raw["114"]["class_type"], "PrimitiveStringMultiline")
        patched = patch_t2m(
            raw,
            style="arena rock, crushing guitars",
            lyrics="[Verse]\nhello",
            max_duration=240,
            mode="full",
            seed_abc=7,
            seed_music=8,
            seed_sampler=9,
            steps=32,
            pasted_abc="X:1\nK:G\n",
            use_pasted_abc=True,
        )
        self.assertEqual(patched["113"]["inputs"]["value"], "arena rock, crushing guitars")
        self.assertEqual(patched["114"]["inputs"]["value"], "[Verse]\nhello")
        self.assertEqual(_link(patched, "24", "style"), style_link)
        self.assertEqual(_link(patched, "25", "style"), ["113", 0])
        self.assertEqual(_link(patched, "24", "lyrics"), ["114", 0])
        self.assertEqual(_link(patched, "25", "lyrics"), lyrics_link)
        self.assertNotIn("30", patched)
        self.assertNotIn("50", patched)
        self.assertNotIn("51", patched)
        self.assertEqual(patched["25"]["inputs"]["abc"], ["24", 0])
        self.assertEqual(patched["24"]["inputs"]["mode"], "full")
        self.assertEqual(patched["25"]["inputs"]["mode"], "full")
        self.assertEqual(patched["25"]["inputs"]["max_duration"], 240.0)
        self.assertEqual(patched["5"]["inputs"]["seconds"], ["25", 1])
        self.assertIsInstance(patched["5"]["inputs"]["seconds"], list)
        self.assertEqual(patched["109"]["inputs"]["filename_prefix"], "AIMS_YuE2_T2M")
        self.assertEqual(patched["109"]["inputs"]["format"], "wav")
        self.assertTrue(str(patched["109"]["inputs"]["filename_prefix"]).startswith("AIMS_YuE2_"))

    def test_t2m_clears_paste_when_switch_is_off(self):
        patched = patch_t2m(
            load_graph("t2m"),
            style="indie",
            lyrics="",
            max_duration=300,
            mode="full",
            seed_abc=None,
            seed_music=None,
            seed_sampler=None,
            steps=32,
            pasted_abc="should not stick",
            use_pasted_abc=False,
        )
        self.assertNotIn("30", patched)
        self.assertNotIn("50", patched)
        self.assertNotIn("51", patched)
        self.assertEqual(patched["25"]["inputs"]["abc"], ["24", 0])
        self.assertEqual(patched["5"]["inputs"]["seconds"], ["25", 1])
        self.assertEqual(_link(patched, "24", "style"), ["113", 0])

    def test_refuses_to_smash_t2m_style_link(self):
        graph = load_graph("t2m")
        with self.assertRaises(RuntimeError):
            set_workflow_scalar(graph, "24", "style", "nope")
        with self.assertRaises(RuntimeError):
            set_workflow_scalar(graph, "25", "lyrics", "nope")
        self.assertEqual(_link(graph, "24", "style"), ["113", 0])
        self.assertEqual(_link(graph, "25", "lyrics"), ["114", 0])

    def test_cover_style_is_scalar_on_25_and_wav_prefix(self):
        patched = patch_cover(
            load_graph("cover"),
            audio_name="ref.wav",
            style="modern hard rock cover",
            lyrics="[Chorus]\nhey",
            sheetsage_mode="melody",
            music_mode="melody",
            max_duration=120,
            seed_music=3,
            seed_sampler=4,
            steps=32,
        )
        self.assertEqual(patched["45"]["inputs"]["audio"], "ref.wav")
        self.assertEqual(patched["25"]["inputs"]["style"], "modern hard rock cover")
        self.assertEqual(patched["25"]["inputs"]["lyrics"], "[Chorus]\nhey")
        self.assertEqual(patched["41"]["inputs"]["mode"], "melody")
        self.assertEqual(patched["25"]["inputs"]["max_duration"], 120.0)
        self.assertEqual(patched["5"]["inputs"]["seconds"], ["25", 1])
        self.assertEqual(patched["109"]["inputs"]["filename_prefix"], "AIMS_YuE2_Cover")
        self.assertEqual(patched["109"]["inputs"]["format"], "wav")

    def test_rerender_abc_and_wav_prefix(self):
        patched = patch_rerender(
            load_graph("rerender"),
            abc="X:1\nT:test\nK:C\nCDEF|",
            style="hard rock",
            lyrics="[Verse]\nyo",
            mode="full",
            max_duration=120,
            seed_music=1,
            seed_sampler=2,
            steps=16,
        )
        self.assertEqual(patched["50"]["inputs"]["value"], "X:1\nT:test\nK:C\nCDEF|")
        self.assertEqual(patched["25"]["inputs"]["style"], "hard rock")
        self.assertEqual(patched["8"]["inputs"]["steps"], 16)
        self.assertEqual(patched["25"]["inputs"]["mode"], "full")
        self.assertEqual(patched["25"]["inputs"]["max_duration"], 120.0)
        self.assertEqual(patched["5"]["inputs"]["seconds"], ["25", 1])
        self.assertEqual(patched["109"]["inputs"]["filename_prefix"], "AIMS_YuE2_Rerender")
        self.assertEqual(patched["109"]["inputs"]["format"], "wav")


class Yue2DurationAndAbcTests(unittest.TestCase):
    def test_error_status_fails_before_completed(self):
        err = _status_error(
            {
                "status_str": "error",
                "completed": False,
                "messages": [
                    [
                        "execution_error",
                        {
                            "exception_message": "indices[0, 1537] = 1537 is out of bounds",
                            "node_id": "25",
                            "node_type": "YuE2GenerateMusic",
                        },
                    ]
                ],
            }
        )
        self.assertIn("indices[0, 1537]", err or "")
        interrupted = _status_error(
            {
                "status_str": "",
                "completed": False,
                "messages": [["execution_interrupted", {}]],
            }
        )
        self.assertIn("interrupted", (interrupted or "").lower())
        self.assertIsNone(_status_error({"status_str": "success", "completed": False, "messages": []}))

    def test_t2m_duration_is_budget_only_and_latent_stays_linked(self):
        for request in (120, 180, 240, 300, 360):
            capped, warn = _clamp_duration("t2m", request)
            self.assertEqual(capped, float(request))
            self.assertIsNone(warn)
        long_run, long_warn = _clamp_duration("t2m", 481)
        self.assertEqual(long_run, 481.0)
        self.assertIn("long run", long_warn or "")
        widget, widget_warn = _clamp_duration("t2m", 901)
        self.assertEqual(widget, 900.0)
        self.assertIn("900", widget_warn or "")
        for request in (60, 120, 180, 240):
            graph = patch_t2m(
                load_graph("t2m"),
                style="arena rock",
                lyrics="[Verse]\nhi",
                max_duration=request,
                mode="melody" if request == 180 else "full",
                seed_abc=None,
                seed_music=None,
                seed_sampler=None,
                steps=32,
                pasted_abc="must not land",
                use_pasted_abc=True,
            )
            self.assertEqual(graph["25"]["inputs"]["max_duration"], float(request))
            self.assertEqual(graph["5"]["inputs"]["seconds"], ["25", 1])
            self.assertEqual(graph["24"]["inputs"]["mode"], "melody" if request == 180 else "full")
            self.assertEqual(graph["25"]["inputs"]["mode"], graph["24"]["inputs"]["mode"])
            preflight_duration(graph, request)
        broken = patch_t2m(
            load_graph("t2m"),
            style="arena rock",
            lyrics="[Verse]\nhi",
            max_duration=120,
            mode="full",
            seed_abc=None,
            seed_music=None,
            seed_sampler=None,
            steps=32,
            pasted_abc="",
            use_pasted_abc=False,
        )
        broken["5"]["inputs"]["seconds"] = 59.0
        with self.assertRaises(RuntimeError):
            preflight_duration(broken, 120)
        _set_duration(broken, 120)
        self.assertEqual(broken["5"]["inputs"]["seconds"], ["25", 1])
        self.assertEqual(broken["25"]["inputs"]["max_duration"], 120.0)
        preflight_duration(broken, 120)

    def test_t2m_graph_has_one_abc_music_latent_and_no_switch(self):
        raw = load_graph("t2m")
        kinds = [
            node.get("class_type")
            for node in raw.values()
            if isinstance(node, dict)
        ]
        self.assertEqual(kinds.count("YuE2GenerateABC"), 1)
        self.assertEqual(kinds.count("YuE2GenerateMusic"), 1)
        self.assertEqual(kinds.count("EmptyYuE2LatentAudio"), 1)
        self.assertNotIn("ComfySwitchNode", kinds)
        self.assertNotIn("PrimitiveBoolean", kinds)
        for gone in ("30", "50", "51"):
            self.assertNotIn(gone, raw)
        self.assertEqual(raw["25"]["inputs"]["abc"], ["24", 0])
        self.assertEqual(raw["5"]["inputs"]["seconds"], ["25", 1])
        self.assertEqual(raw["52"]["inputs"]["source"], ["24", 0])
        bindings = json.loads(
            (PROJECT_ROOT / "workflows" / "comfy" / "bindings.json").read_text(encoding="utf-8")
        )
        for key in ("yue2_t2m", "yue2_grok_rock"):
            self.assertNotIn("pasted_abc", bindings[key]["bindings"])
            self.assertNotIn("use_pasted_abc", bindings[key]["bindings"])

    def test_duration_dropdown_offers_long_yue2_budgets(self):
        toks, default = duration_tokens(MUSIC_MODELS["yue2 text to music"])
        for token in ("120", "180", "240", "300", "360", "480", "900"):
            self.assertIn(token, toks)
        self.assertEqual(default, "240")
        ace, _ace_default = duration_tokens(MUSIC_MODELS["ace step 1.5"])
        self.assertNotIn("360", ace)
        self.assertNotIn("900", ace)

    def test_sixty_seconds_sets_max_duration_and_keeps_latent_link(self):
        patched = patch_t2m(
            load_graph("t2m"),
            style="arena rock",
            lyrics="[Verse]\nhi",
            max_duration=60,
            mode="full",
            seed_abc=None,
            seed_music=None,
            seed_sampler=None,
            steps=32,
            pasted_abc="",
            use_pasted_abc=False,
        )
        self.assertEqual(patched["25"]["inputs"]["max_duration"], 60.0)
        self.assertEqual(patched["5"]["class_type"], "EmptyYuE2LatentAudio")
        self.assertEqual(patched["5"]["inputs"]["seconds"], ["25", 1])
        self.assertEqual(_link(patched, "24", "style"), ["113", 0])
        self.assertEqual(_link(patched, "25", "lyrics"), ["114", 0])

    def test_duration_error_is_not_retried_and_logs_telemetry(self):
        text = _annotate_duration_error(
            "indices[0, 1537] = 1537 is out of bounds",
            max_duration=240,
            mode="full",
            abc_chars=12,
            status={
                "messages": [
                    [
                        "execution_error",
                        {"traceback": ["File model.py", "YuE2 music budget reduced to 100 tokens"]},
                    ]
                ]
            },
        )
        self.assertIn("indices[0, 1537]", text)
        self.assertIn("max_duration=240", text)
        self.assertIn("music out1 seconds", text)
        self.assertIn("latent shape[-1]", text)
        self.assertIn("budget reduced", text)
        self.assertIn("stack:", text)
        plain = _annotate_duration_error(
            "connection refused", max_duration=120, mode="full", abc_chars=0
        )
        self.assertEqual(plain, "connection refused")

    def test_instrumental_lock_allows_empty_lyrics(self):
        style, lyrics = apply_instrumental_lock("arena rock", "", instrumental=True)
        self.assertIn("no vocals", style)
        self.assertIn("no choir", style)
        self.assertIn("no vocals", lyrics)
        self.assertIn("no choir", lyrics)
        kept, sung = apply_instrumental_lock("arena rock", "[Verse]\nhello", instrumental=False)
        self.assertEqual(kept, "arena rock")
        self.assertEqual(sung, "[Verse]\nhello")

    def test_t2m_abc_is_the_score_that_fed_music(self):
        hist = {
            "outputs": {
                "14": {"text": ["X:1\nT:Planned\nK:G\nGABc|"]},
                "52": {"text": ["X:1\nT:Switched\nK:C\nCDEF|"]},
            }
        }
        text = _history_abc(hist, "t2m")
        self.assertIn("T:Switched", text)
        self.assertNotIn("T:Planned", text)
        self.assertEqual(
            _history_abc({"outputs": {"44": {"text": ["X:1\nT:Cover\nK:C\nC|"]}}}, "cover"),
            "X:1\nT:Cover\nK:C\nC|",
        )

    def test_seed_randomize_flags_are_independent(self):
        extra = {"seed_music": 11, "seed_sampler": ""}
        self.assertEqual(_opt_seed(extra, "seed_music", randomize=False), 11)
        self.assertIsNone(_opt_seed(extra, "seed_abc", randomize=False))
        sampled = _opt_seed(extra, "seed_sampler", randomize=True)
        self.assertIsInstance(sampled, int)


class Yue2DispatchTests(unittest.TestCase):
    def test_execution_error_returns_before_completed(self):
        payload = json.dumps(
            {
                "pid": {
                    "status": {
                        "status_str": "error",
                        "completed": False,
                        "messages": [
                            [
                                "execution_error",
                                {
                                    "exception_message": "YuE2 latent duration must match the seconds output of YuE2 Text Encode.",
                                    "node_id": "5",
                                    "node_type": "EmptyYuE2LatentAudio",
                                },
                            ]
                        ],
                    },
                    "outputs": {},
                }
            }
        ).encode()
        spec = MUSIC_MODELS["yue2 text to music"]
        with tempfile.TemporaryDirectory() as tmp:
            with patch("app.comfy_yue2.resolve_comfy_url", return_value=("http://127.0.0.1:8188", None)):
                with patch(
                    "app.comfy_yue2.queue_prompt",
                    return_value=("http://127.0.0.1:8188", "http://127.0.0.1:8188/prompt", {"prompt_id": "pid"}),
                ) as queued:
                    with patch("app.comfy_yue2._get", return_value=payload):
                        with patch("app.comfy_yue2.time.sleep"):
                            result = generate_yue2(
                                prompt="arena rock",
                                duration_s=240,
                                extra={"lyrics": "[Verse]\nhi", "instrumental": False, "mode": "full"},
                                output_dir=tmp,
                                spec=spec,
                            )
        self.assertEqual(queued.call_count, 1)
        submitted = queued.call_args.args[1]
        self.assertEqual(submitted["25"]["inputs"]["max_duration"], 240.0)
        self.assertEqual(submitted["5"]["inputs"]["seconds"], ["25", 1])
        self.assertFalse(result.ok)
        self.assertIn("latent duration must match", result.status)
        self.assertIn("max_duration=240", result.status)
        self.assertIn("music out1 seconds", result.status)
        self.assertIn("latent shape[-1]", result.status)

    def test_dead_comfy_fails_on_the_next_poll(self):
        spec = MUSIC_MODELS["yue2 text to music"]
        with tempfile.TemporaryDirectory() as tmp:
            with patch("app.comfy_yue2.resolve_comfy_url", return_value=("http://127.0.0.1:8188", None)):
                with patch(
                    "app.comfy_yue2.queue_prompt",
                    return_value=("http://127.0.0.1:8188", "http://127.0.0.1:8188/prompt", {"prompt_id": "pid"}),
                ):
                    with patch(
                        "app.comfy_yue2._get",
                        side_effect=urllib.error.URLError("connection refused"),
                    ):
                        with patch("app.comfy_yue2.time.sleep") as slept:
                            result = generate_yue2(
                                prompt="arena rock",
                                duration_s=120,
                                extra={"lyrics": "[Verse]\nhi", "instrumental": False},
                                output_dir=tmp,
                                spec=spec,
                            )
        self.assertFalse(result.ok)
        self.assertIn("connection refused", result.status.lower())
        self.assertLessEqual(slept.call_count, 2)

    def test_comfy_down_matches_ace_error_and_skips_fal(self):
        down = "http://127.0.0.1:8188/system_stats connection refused"
        with tempfile.TemporaryDirectory() as tmp:
            with patch("app.comfy_yue2.resolve_comfy_url", return_value=(None, down)):
                with patch("app.audio_service.subscribe") as subscribe:
                    result = generate_audio(
                        modality="music",
                        model_id="audio:yue2 text to music",
                        prompt="arena rock",
                        duration="30",
                        extra={"lyrics": "[Verse]\nhi"},
                        output_dir=tmp,
                    )
        subscribe.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.status, down)
        self.assertEqual(result.cost_label, "Cost: $0.00")
        self.assertEqual(result.model_key, "yue2 text to music")

    def test_ace_still_rejects_empty_prompt_before_comfy(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch("app.comfy_ace.resolve_comfy_url") as probe:
                result = generate_audio(
                    modality="music",
                    model_id="audio:ace step 1.5",
                    prompt="  ",
                    output_dir=tmp,
                )
        probe.assert_not_called()
        self.assertFalse(result.ok)
        self.assertEqual(result.status, "Enter a prompt.")
