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


def list_shot_builder_fields(who_choices: list[str] | None = None) -> dict[str, Any]:
    people = list(who_choices or [])
    if "Nobody / empty" not in people:
        people = ["Nobody / empty", *people]
    return {
        "ok": True,
        "fields": [
            _field("beat", "Beat type", choices=BEATS, value="Establish"),
            _field("who", "Who", choices=people, value=people[0] if people else "Nobody / empty"),
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
    who = vals.get("who") or ""
    if who in ("Nobody / empty", "Nobody"):
        who = ""
    emotion = vals.get("emotion") or "Calm"
    helper = BEAT_HELPERS.get(beat, "")
    custom = vals.get("action_line") or ""
    body = custom or helper
    head = f"[{beat} · {emotion}]"
    if who:
        action = f"{head} {who} — {body}."
    else:
        action = f"{head} {body}."

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
