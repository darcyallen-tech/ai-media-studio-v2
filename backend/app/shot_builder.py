"""Noob-friendly Shot Prompt Builder — writes action + optional camera."""

from __future__ import annotations

from typing import Any

BEATS = [
    "Establish",
    "Entrance",
    "Dialogue",
    "Action",
    "Reaction",
    "Hold",
]

EMOTIONS = [
    "Calm",
    "Tense",
    "Joyful",
    "Somber",
    "Urgent",
    "Mysterious",
]

CAMERA_PRESETS: dict[str, tuple[str, str, str]] = {
    "Static hold": ("Static", "Medium", "Linear"),
    "Push in": ("Push in", "Slow", "Ease in-out"),
    "Pull back": ("Pull out", "Slow", "Ease in-out"),
    "Orbit": ("Orbit", "Medium", "Ease in-out"),
    "Crane reveal": ("Crane up", "Slow", "Ease in-out"),
    "Handheld energy": ("Handheld", "Medium", "Linear"),
}

BEAT_HELPERS: dict[str, str] = {
    "Establish": "wide look at the space so we know where we are",
    "Entrance": "the subject enters and claims the room",
    "Dialogue": "they talk; stay on faces",
    "Action": "the main move happens",
    "Reaction": "hold on the reaction",
    "Hold": "linger and let the last beat land",
}


def _field(
    fid: str,
    label: str,
    *,
    kind: str = "select",
    choices: list[str] | None = None,
    value: str = "",
    placeholder: str = "",
) -> dict[str, Any]:
    return {
        "id": fid,
        "label": label,
        "type": kind,
        "choices": list(choices or []),
        "value": value,
        "placeholder": placeholder,
    }


def _split_names(raw: str) -> list[str]:
    parts: list[str] = []
    for chunk in (raw or "").replace(",", "|").split("|"):
        name = chunk.strip()
        if not name or name.lower() in ("nobody / empty", "nobody", "none", "—"):
            continue
        if name not in parts:
            parts.append(name)
    return parts


def _join_names(names: list[str]) -> str:
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return f"{', '.join(names[:-1])}, and {names[-1]}"


def list_shot_builder_fields(who_choices: list[str] | None = None) -> dict[str, Any]:
    people = list(who_choices or [])
    return {
        "ok": True,
        "fields": [
            _field("beat", "Beat type", choices=BEATS, value="Establish"),
            _field("who", "Who", kind="chips", choices=people, value=""),
            _field("where", "Where", kind="chips", choices=[], value=""),
            _field("where_to", "Into (optional)", kind="chips", choices=[], value=""),
            _field("props", "With prop", kind="chips", choices=[], value=""),
            _field("emotion", "Emotion", choices=EMOTIONS, value="Calm"),
            _field(
                "camera",
                "Camera preset",
                choices=list(CAMERA_PRESETS.keys()),
                value="Push in",
            ),
            _field(
                "action_line",
                "Action (1 line, optional)",
                kind="text",
                value="",
                placeholder="Leave blank to use the beat helper",
            ),
        ],
    }


def apply_shot_builder(fields: dict[str, Any] | None) -> dict[str, str]:
    vals = {str(k): ("" if v is None else str(v)).strip() for k, v in (fields or {}).items()}
    beat = vals.get("beat") or "Establish"
    if beat not in BEATS:
        beat = "Establish"
    people = _split_names(vals.get("who") or "")
    props = _split_names(vals.get("props") or "")
    where = (vals.get("where") or "").strip()
    where_to = (vals.get("where_to") or "").strip()
    if where_to and where_to == where:
        where_to = ""
    emotion = vals.get("emotion") or "Calm"
    custom = vals.get("action_line") or ""
    who_s = _join_names(people)
    prop_s = _join_names(props)
    body = _compose_body(beat, custom, who_s, prop_s, where, where_to)
    action = f"[{beat} · {emotion}] {body}".strip()
    if not action.endswith("."):
        action += "."

    preset = vals.get("camera") or "Push in"
    move, speed, ease = CAMERA_PRESETS.get(preset, ("Push in", "Slow", "Ease in-out"))
    return {
        "action": action,
        "move": move,
        "speed": speed,
        "ease": ease,
        "framing": "",
        "preset": preset,
    }


def _compose_body(
    beat: str,
    custom: str,
    who: str,
    prop: str,
    where: str,
    where_to: str,
) -> str:
    if custom:
        body = custom.rstrip(".")
        low = body.lower()
        if who and who.lower() not in low:
            body = f"{who} {body}"
        if prop and prop.lower() not in low:
            body = f"{body} with {prop}"
        if where and where_to:
            if where.lower() not in low and where_to.lower() not in low:
                body = f"{body} from {where} into {where_to}"
        elif where and where.lower() not in low:
            body = f"{body} in {where}"
        return body

    helper = BEAT_HELPERS.get(beat, "the beat happens")
    if beat == "Action" and who and prop:
        body = f"{who} picks up {prop}"
        if where and where_to:
            body += f" in {where}, then moves into {where_to}"
        elif where:
            body += f" in {where}"
        return body
    if beat == "Entrance":
        if who and where_to:
            body = f"{who} enters {where_to}"
            if where:
                body += f" from {where}"
            return body
        if who and where:
            return f"{who} enters {where}"
        if who:
            return f"{who} {helper}"
        return helper
    if beat == "Establish":
        if where and where_to:
            return f"wide look from {where} into {where_to} so we know both spaces"
        if where:
            return f"wide look at {where} so we know where we are"
        return helper
    if who and where and where_to:
        return f"{who} {helper} — from {where} into {where_to}"
    if who and where:
        return f"{who} {helper} in {where}"
    if who:
        return f"{who} {helper}"
    if where and where_to:
        return f"{helper} from {where} into {where_to}"
    if where:
        return f"{helper} in {where}"
    return helper
