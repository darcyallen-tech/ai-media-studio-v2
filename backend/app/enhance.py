"""Prompt enhance — xAI rewrite, model-aware, policy-light (no lectures)."""

from __future__ import annotations

import json
import re
from typing import Any

from app.create_catalog import resolve_model
from app.xai_client import XAIConfigError, chat_json, chat_json_vision, still_data_url

SYSTEM = """You rewrite image/video generation prompts.

Rules:
- Preserve the user's creative intent, mood, camera, composition, and details.
- Adapt wording to the named model and modality (still, clip, music, SFX, or spoken voice).
- Replace likely-flagged trademark, franchise, celebrity, or brand names with
  short descriptive visual equivalents (look, costume, setting) — never the name.
- Do not add lectures, warnings, disclaimers, or meta commentary.
- Do not invent a new concept. Do not refuse. Just rewrite.
- If character / scene / source / prop references are listed, mention them by role
  (character, scene, source, prop) so the rewrite stays consistent with those
  identities, locations, and objects. Do not drop them.
- For storyboard boards: keep shot order, attributed dialogue (Name: "line"),
  camera/move, duration, and framing. Rewrite into one master video prompt
  (global notes) for the selected model. Do not collapse or omit shots.
- When a hard character cap is given, FIT under that cap: short Image N map
  (Image 1 = character/scene/costume) plus one line per shot. Do not dump
  costume seams, fabric, or unused stats.
- When a source still is attached, look at it. First briefly note what is
  visible (sky, house, smoke, people, furniture, lighting). Then rewrite the
  user's prompt for the selected edit model, keeping their intent, grounded
  in that same frame. Do not invent a different scene.
- For Scene stills, keep this sentence verbatim when the source is photoreal /
  photo realistic / photograph: "photoreal photograph, real materials and
  daylight/practicals, not concept art, not matte painting, not illustration."
  Fantasy lighting (torch, magic) is allowed; do not drop "photograph".
- Return JSON only: {"prompt": "<rewritten prompt>"}.
"""


def _parse_prompt(raw: str, fallback: str) -> str:
    text = (raw or "").strip()
    if not text:
        return fallback
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            out = str(data.get("prompt") or data.get("optimized_prompt") or "").strip()
            if out:
                return out
        if isinstance(data, str) and data.strip():
            return data.strip()
    except json.JSONDecodeError:
        pass
    quoted = re.search(
        r'"(?:prompt|optimized_prompt)"\s*:\s*"((?:\\.|[^"\\])*)"',
        text,
        re.DOTALL,
    )
    if quoted:
        try:
            return json.loads(f'"{quoted.group(1)}"').strip() or fallback
        except json.JSONDecodeError:
            cleaned = quoted.group(1).replace('\\"', '"').replace("\\n", "\n").strip()
            if cleaned:
                return cleaned
    if text[:1] in "{[" and len(text) < 8:
        return fallback
    return text or fallback


def _refs_block(refs: list[dict[str, Any]] | None) -> str:
    lines: list[str] = []
    for raw in refs or []:
        if not isinstance(raw, dict):
            continue
        role = str(raw.get("role") or "").strip().lower()
        if role not in ("character", "scene", "source", "prop", "costume"):
            continue
        name = str(raw.get("name") or raw.get("id") or role).strip() or role
        note = str(raw.get("note") or "").strip()
        if note:
            lines.append(f"- {role}: {name} — {note}")
        else:
            lines.append(f"- {role}: {name}")
    if not lines:
        return ""
    return (
        "References (mention each by role so the rewrite stays consistent):\n"
        + "\n".join(lines)
    )


def enhance_prompt_text(
    *,
    prompt: str,
    model_id: str = "",
    modality: str = "",
    mode: str = "",
    refs: list[dict[str, Any]] | None = None,
    image_urls: list[str] | None = None,
    max_prompt: int | None = None,
) -> dict[str, Any]:
    original = (prompt or "").strip()
    if not original:
        return {
            "ok": False,
            "prompt": "",
            "original": "",
            "error": "Enter a prompt to enhance.",
        }
    entry = resolve_model(model_id, mode=mode or None, modality=modality or None)
    label = (entry.label if entry else "") or model_id or "default model"
    extra = _refs_block(refs)
    wan_note = ""
    ep = ((entry.endpoint if entry else "") or "").lower()
    if "wan-3.0" in ep and "reference" in ep:
        wan_note = (
            "Wan 3.0 prefers clear positional refs in the rewritten prompt "
            "(Image 1 = character, Image 2 = scene, Video 1 = motion).\n\n"
        )
    if "fibo-edit-1.5" in ep:
        wan_note += (
            "Fibo Edit 1.5: label attached stills as <image_1> (source to edit), "
            "<image_2> <image_3> <image_4> for extra references (furniture, "
            "costume, object, style). Keep those tags in the rewrite.\n\n"
        )
    cap = 0
    try:
        cap = int(max_prompt or 0)
    except (TypeError, ValueError):
        cap = 0
    if cap > 0:
        wan_note += (
            f"HARD CAP: the rewritten prompt MUST be ≤ {cap} characters. "
            "Short Image N map (Image 1 = character, Image 2 = scene, "
            "costume ref = Image N) plus one line per shot. "
            "Do not dump costume seams, fabric, or unused stats.\n\n"
        )
    images = [p for p in (image_urls or []) if str(p).strip()]
    readable = [p for p in images if still_data_url(p)]
    vision_note = (
        f"Source stills attached ({len(readable)}). Briefly note what is visible, "
        "then rewrite the user prompt for this edit model on that same frame.\n\n"
        if readable
        else ""
    )
    user = (
        f"Mode: {mode or 'image'}\n"
        f"Modality: {modality or 't2i'}\n"
        f"Model: {label}\n\n"
        + vision_note
        + wan_note
        + (f"{extra}\n\n" if extra else "")
        + f"User prompt:\n{original}"
    )
    vision_used = False
    try:
        if readable:
            try:
                raw = chat_json_vision(
                    system=SYSTEM,
                    user_text=user,
                    image_paths=readable,
                    temperature=0.35,
                    max_tokens=2200,
                )
                vision_used = True
            except Exception:
                import logging

                logging.getLogger(__name__).exception(
                    "Enhance vision failed; falling back to text-only"
                )
                raw = chat_json(
                    system=SYSTEM, user=user, temperature=0.35, max_tokens=2200
                )
                vision_used = False
        else:
            raw = chat_json(system=SYSTEM, user=user, temperature=0.35, max_tokens=2200)
    except XAIConfigError as exc:
        return {"ok": False, "prompt": original, "original": original, "error": str(exc), "vision": False}
    except Exception as exc:
        return {
            "ok": False,
            "prompt": original,
            "original": original,
            "error": f"Enhance failed: {exc}",
            "vision": False,
        }
    rewritten = _parse_prompt(raw, "")
    if not rewritten:
        return {
            "ok": False,
            "prompt": original,
            "original": original,
            "error": "Enhance returned an empty or incomplete reply. Try again.",
            "vision": vision_used,
        }
    from app.sheet import SCENE_PHOTOREAL_LOCK, ensure_scene_photoreal

    sceneish = (
        "photoreal photograph, real materials and daylight/practicals" in original.lower()
        or "keep photoreal photograph lock" in original.lower()
        or "location still" in original.lower()
        or "location-sheet" in original.lower()
        or "production location sheet" in original.lower()
    )
    if sceneish:
        rewritten = ensure_scene_photoreal(rewritten, True)
        if SCENE_PHOTOREAL_LOCK.lower() not in rewritten.lower():
            rewritten = f"{rewritten.rstrip()} {SCENE_PHOTOREAL_LOCK}"
    return {
        "ok": True,
        "prompt": rewritten,
        "original": original,
        "error": None,
        "vision": vision_used,
    }
