"""ACE-Step workflow file, /prompt queue, Comfy 400 detail."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.comfy_ace import (  # noqa: E402
    WORKFLOW_NAME,
    _EXPORT_API,
    _UI_PORT,
    format_comfy_error,
    is_api_graph,
    load_workflow,
    patch_workflow,
    queue_post_urls,
    queue_prompt,
    ui_to_api,
    workflow_path,
)


class QueueOrderTests(unittest.TestCase):
    def test_prompt_then_api_prompt(self):
        rows = queue_post_urls("http://127.0.0.1:8188")
        self.assertEqual(
            [u for u, _ in rows],
            [
                "http://127.0.0.1:8188/prompt",
                "http://127.0.0.1:8188/api/prompt",
            ],
        )

    def test_desktop_8000_tries_8188_prompt_first(self):
        rows = queue_post_urls("http://127.0.0.1:8000")
        self.assertEqual(
            [u for u, _ in rows],
            [
                "http://127.0.0.1:8188/prompt",
                "http://127.0.0.1:8000/prompt",
                "http://127.0.0.1:8000/api/prompt",
                "http://127.0.0.1:8188/api/prompt",
            ],
        )


class Queue400Tests(unittest.TestCase):
    def test_400_shows_message_and_node_errors(self):
        hits: list[str] = []
        body = {
            "error": {
                "type": "prompt_outputs_failed_validation",
                "message": "Prompt outputs failed validation",
                "details": "",
            },
            "node_errors": {
                "109": {
                    "class_type": "SaveAudioAdvanced",
                    "errors": [
                        {
                            "message": "Value not in list",
                            "details": "format: 'mp3' not in []",
                        }
                    ],
                }
            },
        }

        def fake_post(url, payload, *, origin, timeout=30.0):
            hits.append(url)
            return 400, body

        with patch("app.comfy_ace._post_json", side_effect=fake_post):
            with self.assertRaises(RuntimeError) as ctx:
                queue_prompt(
                    "http://127.0.0.1:8188",
                    {"1": {"class_type": "KSampler"}},
                )
        msg = str(ctx.exception)
        self.assertIn("Prompt outputs failed validation", msg)
        self.assertIn("node 109", msg)
        self.assertIn("SaveAudioAdvanced", msg)
        self.assertIn("Value not in list", msg)
        self.assertNotEqual(msg.strip(), "400")
        self.assertEqual(hits, ["http://127.0.0.1:8188/prompt"])

    def test_format_never_bare_400(self):
        text = format_comfy_error(400, {"error": {"message": "bad graph"}})
        self.assertEqual(text, "bad graph")
        self.assertNotEqual(text, "400")

    def test_all_405_raises_ui_port(self):
        def fake_post(url, payload, *, origin, timeout=30.0):
            return 405, {}

        with patch("app.comfy_ace._post_json", side_effect=fake_post):
            with self.assertRaises(RuntimeError) as ctx:
                queue_prompt("http://127.0.0.1:8000", {"1": {"class_type": "KSampler"}})
        self.assertEqual(str(ctx.exception), _UI_PORT)

    def test_stops_at_first_200(self):
        hits: list[str] = []
        payloads: list[dict] = []

        def fake_post(url, payload, *, origin, timeout=30.0):
            hits.append(url)
            payloads.append(payload)
            return 200, {"prompt_id": "abc"}

        graph = {"1": {"class_type": "KSampler"}}
        with patch("app.comfy_ace._post_json", side_effect=fake_post):
            origin, post_url, body = queue_prompt(
                "http://127.0.0.1:8188",
                graph,
            )
        self.assertEqual(hits, ["http://127.0.0.1:8188/prompt"])
        self.assertEqual(origin, "http://127.0.0.1:8188")
        self.assertEqual(post_url, "http://127.0.0.1:8188/prompt")
        self.assertEqual(body.get("prompt_id"), "abc")
        self.assertEqual(payloads[0]["prompt"], graph)
        self.assertTrue(str(payloads[0].get("client_id") or ""))


class WorkflowTests(unittest.TestCase):
    def test_loads_split_file_from_root_or_workflows(self):
        path = workflow_path()
        self.assertEqual(path.name, WORKFLOW_NAME)
        self.assertTrue(path.is_file())
        graph = load_workflow()
        self.assertTrue(is_api_graph(graph))
        self.assertNotIn("nodes", graph)
        self.assertNotIn("links", graph)
        types = {
            str(v.get("class_type"))
            for v in graph.values()
            if isinstance(v, dict)
        }
        self.assertIn("TextEncodeAceStepAudio1.5", types)
        self.assertIn("EmptyAceStep1.5LatentAudio", types)
        self.assertIn("KSampler", types)
        self.assertTrue(
            "SaveAudioAdvanced" in types or "SaveAudioMP3" in types or "SaveAudio" in types
        )

    def test_empty_ui_graph_asks_for_api_export(self):
        fake = MagicMock()
        fake.is_file.return_value = True
        fake.read_text.return_value = json.dumps({"nodes": [], "links": []})
        with patch("app.comfy_ace.workflow_path", return_value=fake):
            with self.assertRaises(ValueError) as ctx:
                load_workflow()
        self.assertEqual(str(ctx.exception), _EXPORT_API)

    def test_ui_graph_converts_to_api_map(self):
        ui = {
            "nodes": [
                {
                    "id": 94,
                    "type": "TextEncodeAceStepAudio1.5",
                    "inputs": [{"name": "clip", "link": 1}],
                    "widgets_values": [
                        "castle choir",
                        "",
                        0,
                        120,
                        30,
                        "4",
                        "en",
                        "C major",
                    ],
                },
                {
                    "id": 98,
                    "type": "EmptyAceStep1.5LatentAudio",
                    "inputs": [],
                    "widgets_values": [30, 1],
                },
                {
                    "id": 3,
                    "type": "KSampler",
                    "inputs": [
                        {"name": "model", "link": 2},
                        {"name": "positive", "link": 3},
                        {"name": "negative", "link": 4},
                        {"name": "latent_image", "link": 5},
                    ],
                    "widgets_values": [
                        7,
                        "fixed",
                        8,
                        1.0,
                        "er_sde",
                        "linear_quadratic",
                        1.0,
                    ],
                },
                {"id": 9, "type": "Note", "widgets_values": ["ignore me"]},
            ],
            "links": [
                [1, 105, 0, 94, 0, "CLIP"],
                [2, 78, 0, 3, 0, "MODEL"],
                [3, 94, 0, 3, 1, "CONDITIONING"],
                [4, 47, 0, 3, 2, "CONDITIONING"],
                [5, 98, 0, 3, 3, "LATENT"],
            ],
        }
        graph = ui_to_api(ui)
        self.assertTrue(is_api_graph(graph))
        self.assertNotIn("9", graph)
        enc = graph["94"]
        self.assertEqual(enc["class_type"], "TextEncodeAceStepAudio1.5")
        self.assertEqual(enc["inputs"]["tags"], "castle choir")
        self.assertEqual(enc["inputs"]["clip"], ["105", 0])
        samp = graph["3"]
        self.assertEqual(samp["inputs"]["steps"], 8)
        self.assertEqual(samp["inputs"]["sampler_name"], "er_sde")
        self.assertEqual(samp["inputs"]["scheduler"], "linear_quadratic")
        self.assertNotIn("control_after_generate", samp["inputs"])

    def test_patch_by_class_type_not_invented_ids(self):
        original = load_workflow()
        ids = set(original)
        graph = patch_workflow(
            original,
            tags="castle choir",
            lyrics="",
            duration_s=42,
            bpm=90,
            keyscale="A minor",
            seed=7,
            steps=8,
            cfg=1.0,
            sampler_name="er_sde",
            scheduler="linear_quadratic",
            denoise=1.0,
        )
        self.assertEqual(set(graph), ids)
        enc = next(
            v
            for v in graph.values()
            if isinstance(v, dict)
            and str(v.get("class_type") or "").startswith("TextEncodeAceStepAudio")
        )
        self.assertEqual(enc["inputs"]["tags"], "castle choir")
        self.assertEqual(enc["inputs"]["lyrics"], "")
        self.assertEqual(enc["inputs"]["duration"], 42.0)
        self.assertEqual(enc["inputs"]["bpm"], 90)
        latent = next(
            v
            for v in graph.values()
            if isinstance(v, dict)
            and str(v.get("class_type") or "").startswith("EmptyAceStep")
            and "LatentAudio" in str(v.get("class_type"))
        )
        self.assertEqual(latent["inputs"]["seconds"], 42.0)
        samp = next(
            v
            for v in graph.values()
            if isinstance(v, dict) and v.get("class_type") == "KSampler"
        )
        self.assertEqual(samp["inputs"]["seed"], 7)
        self.assertEqual(samp["inputs"]["steps"], 8)
        self.assertEqual(samp["inputs"]["cfg"], 1.0)
        self.assertEqual(samp["inputs"]["sampler_name"], "er_sde")
        self.assertEqual(samp["inputs"]["scheduler"], "linear_quadratic")
        self.assertEqual(samp["inputs"]["denoise"], 1.0)


if __name__ == "__main__":
    unittest.main()
