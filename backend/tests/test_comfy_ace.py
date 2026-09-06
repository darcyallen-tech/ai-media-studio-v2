"""ACE-Step Comfy queue order, 405 copy, API-export patch by class_type."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.comfy_ace import (  # noqa: E402
    _UI_PORT,
    load_workflow,
    patch_workflow,
    queue_post_urls,
    queue_prompt,
)


class QueueOrderTests(unittest.TestCase):
    def test_api_prompt_then_prompt(self):
        rows = queue_post_urls("http://127.0.0.1:8188")
        self.assertEqual(
            [u for u, _ in rows],
            [
                "http://127.0.0.1:8188/api/prompt",
                "http://127.0.0.1:8188/prompt",
            ],
        )
        self.assertEqual({o for _, o in rows}, {"http://127.0.0.1:8188"})

    def test_desktop_8000_also_tries_8188(self):
        rows = queue_post_urls("http://127.0.0.1:8000")
        self.assertEqual(
            [u for u, _ in rows],
            [
                "http://127.0.0.1:8000/api/prompt",
                "http://127.0.0.1:8000/prompt",
                "http://127.0.0.1:8188/prompt",
                "http://127.0.0.1:8188/api/prompt",
            ],
        )


class Queue405Tests(unittest.TestCase):
    def test_message(self):
        self.assertEqual(_UI_PORT, "UI port, not API. Try /api/prompt or :8188")

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
            if url.endswith("/api/prompt"):
                return 405, {}
            return 200, {"prompt_id": "abc"}

        graph = {"1": {"class_type": "KSampler"}}
        with patch("app.comfy_ace._post_json", side_effect=fake_post):
            origin, post_url, body = queue_prompt(
                "http://127.0.0.1:8188",
                graph,
            )
        self.assertEqual(hits, [
            "http://127.0.0.1:8188/api/prompt",
            "http://127.0.0.1:8188/prompt",
        ])
        self.assertEqual(origin, "http://127.0.0.1:8188")
        self.assertEqual(post_url, "http://127.0.0.1:8188/prompt")
        self.assertEqual(body.get("prompt_id"), "abc")
        self.assertEqual(payloads[0]["prompt"], graph)
        self.assertTrue(str(payloads[0].get("client_id") or ""))


class WorkflowTests(unittest.TestCase):
    def test_pinned_is_api_export(self):
        graph = load_workflow()
        self.assertNotIn("nodes", graph)
        self.assertNotIn("last_node_id", graph)
        types = {
            str(v.get("class_type"))
            for v in graph.values()
            if isinstance(v, dict)
        }
        self.assertIn("TextEncodeAceStepAudio1.5", types)
        self.assertIn("EmptyAceStep1.5LatentAudio", types)
        self.assertIn("KSampler", types)
        self.assertIn("SaveAudioMP3", types)

    def test_rejects_ui_graph(self):
        fake = MagicMock()
        fake.is_file.return_value = True
        fake.read_text.return_value = json.dumps(
            {"last_node_id": 1, "nodes": [{"id": 1, "type": "KSampler"}]}
        )
        with patch("app.comfy_ace.workflow_path", return_value=fake):
            with self.assertRaises(ValueError) as ctx:
                load_workflow()
        self.assertIn("UI graph", str(ctx.exception))

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
            if isinstance(v, dict) and v.get("class_type") == "TextEncodeAceStepAudio1.5"
        )
        self.assertEqual(enc["inputs"]["tags"], "castle choir")
        self.assertEqual(enc["inputs"]["lyrics"], "")
        self.assertEqual(enc["inputs"]["duration"], 42.0)
        self.assertEqual(enc["inputs"]["bpm"], 90)
        self.assertEqual(enc["inputs"]["keyscale"], "A minor")
        self.assertEqual(enc["inputs"]["seed"], 7)
        latent = next(
            v
            for v in graph.values()
            if isinstance(v, dict) and v.get("class_type") == "EmptyAceStep1.5LatentAudio"
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
