"""Prompt enhance — xAI rewrite, model-aware, policy-light (no lectures)."""

from __future__ import annotations

import json
import re
from typing import Any

from app.create_catalog import resolve_model
from app.xai_client import XAIConfigError, chat_json

SYSTEM = """You rewrite image/video generation prompts.

Rules:
- Preserve the user's creative intent, mood, camera, composition, and details.
- Adapt wording to the named model and modality (still, clip, music, SFX, or spoken voice).
- Replace likely-flagged trademark, franchise, celebrity, or brand names with
  short descriptive visual equivalents (look, costume, setting) — never the name.
- Do not add lectures, warnings, disclaimers, or meta commentary.
- Do not invent a new concept. Do not refuse. Just rewrite.
- If character / scene / source references are listed, mention them by role
  (character, scene, source) so the rewrite stays consistent with those
  identities and locations. Do not drop them.
- Return JSON only: {"prompt": "<rewritten prompt>"}.
"""


def _parse_prompt(raw: str, fallback: str) -> str:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            out = str(data.get("prompt") or data.get("optimized_prompt") or "").strip()
            if out:
                return out
    except json.JSONDecodeError:
        pass
    return text or fallback


def _refs_block(refs: list[dict[str, Any]] | None) -> str:
    lines: list[str] = []
    for raw in refs or []:
        if not isinstance(raw, dict):
            continue
        role = str(raw.get("role") or "").strip().lower()
        if role not in ("character", "scene", "source"):
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
    user = (
        f"Mode: {mode or 'image'}\n"
        f"Modality: {modality or 't2i'}\n"
        f"Model: {label}\n\n"
        + (f"{extra}\n\n" if extra else "")
        + f"User prompt:\n{original}"
    )
    try:
        raw = chat_json(system=SYSTEM, user=user, temperature=0.35, max_tokens=1200)
    except XAIConfigError as exc:
        return {"ok": False, "prompt": original, "original": original, "error": str(exc)}
    except Exception as exc:
        return {
            "ok": False,
            "prompt": original,
            "original": original,
            "error": f"Enhance failed: {exc}",
        }
    rewritten = _parse_prompt(raw, original)
    return {"ok": True, "prompt": rewritten, "original": original, "error": None}
