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
    "Confident",
    "Fearful",
    "Angry",
    "Playful",
    "Determined",
    "Exhausted",
    "Romantic",
    "Neutral",
    "Custom",
]

ACTION_PRESETS = [
    "walks into",
    "enters",
    "exits",
    "turns to",
    "picks up",
    "throws",
    "sits",
    "stands",
    "runs",
    "fights",
    "flies",
    "lands",
    "looks at",
    "reacts",
    "freezes",
    "custom",
]

# Location already implied by the verb — do not add another "in"
_PLACE_VERBS = ("walks into", "enters", "exits")

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
            _field("emotion", "Emotion / mood", choices=EMOTIONS, value="Calm"),
            _field(
                "emotion_custom",
                "Custom mood",
                kind="text",
                value="",
                placeholder="Used when Emotion is Custom",
            ),
            _field("action_preset", "Action", choices=ACTION_PRESETS, value="walks into"),
            _field(
                "sequence",
                "Sequence (optional)",
                kind="text",
                value="",
                placeholder="crouch|jump|fly",
            ),
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
    if emotion == "Custom":
        emotion = (vals.get("emotion_custom") or "Neutral").strip() or "Neutral"
    custom = vals.get("action_line") or ""
    preset_action = (vals.get("action_preset") or "").strip()
    sequence = _split_names(vals.get("sequence") or "")
    who_s = _join_names(people)
    prop_s = _join_names(props)
    body = _compose_body(
        beat,
        custom,
        who_s,
        prop_s,
        where,
        where_to,
        preset_action=preset_action,
        sequence=sequence,
    )
    action = f"[{beat} · {emotion}] {body}".strip()
    if not action.endswith("."):
        action += "."

    camera = (vals.get("camera") or "").strip()
    if camera and camera in CAMERA_PRESETS:
        move, speed, ease = CAMERA_PRESETS[camera]
    else:
        move, speed, ease = "Push in", "Slow", "Ease in-out"
    framing = (vals.get("framing") or "").strip()
    return {
        "action": action,
        "move": move,
        "speed": speed,
        "ease": ease,
        "framing": framing,
        "preset": camera,
    }


def _place(verb: str, where: str, where_to: str) -> str:
    """Attach location without doubling prepositions (no 'walks into in X')."""
    v = (verb or "").strip()
    if not v:
        return _place_only(where, where_to)
    low = f" {v.lower()} "
    if where and where.lower() in v.lower() and (
        not where_to or where_to.lower() in v.lower()
    ):
        return v
    if where and where_to:
        return f"{v} from {where} into {where_to}"
    if not where:
        return v
    if any(f" {p} " in low or low.strip().endswith(p) for p in _PLACE_VERBS):
        # "Alice walks into" + bar → "Alice walks into Classy bar"
        if any(v.lower().endswith(p) or v.lower() == p for p in _PLACE_VERBS):
            return f"{v} {where}"
        return v
    return f"{v} in {where}"


def _third_person(verb: str) -> str:
    v = (verb or "").strip().lower()
    if not v:
        return v
    if v.endswith("y") and len(v) > 1 and v[-2] not in "aeiou":
        return f"{v[:-1]}ies"
    if v.endswith(("s", "x", "z", "ch", "sh")):
        return f"{v}es"
    return f"{v}s"


def _place_only(where: str, where_to: str) -> str:
    if where and where_to:
        return f"from {where} into {where_to}"
    if where:
        return f"in {where}"
    return ""


def _compose_body(
    beat: str,
    custom: str,
    who: str,
    prop: str,
    where: str,
    where_to: str,
    *,
    preset_action: str = "",
    sequence: list[str] | None = None,
) -> str:
    steps = [_third_person(s) for s in (sequence or []) if s]
    if steps:
        seq = steps[0]
        if len(steps) == 2:
            seq = f"{steps[0]}, then {steps[1]}"
        elif len(steps) >= 3:
            seq = f"{steps[0]}, then {steps[1]}, then {steps[2]}"
        core = f"{who} {seq}".strip() if who else seq
        if prop and prop.lower() not in core.lower():
            core = f"{core} with {prop}"
        placed = _place(core, where, where_to)
        return placed

    verb = ""
    if custom:
        verb = custom.rstrip(".")
    elif preset_action and preset_action.lower() != "custom":
        verb = preset_action
        if verb == "picks up" and prop:
            verb = f"picks up {prop}"
            prop = ""
        elif verb == "throws" and prop:
            verb = f"throws {prop}"
            prop = ""
        elif verb == "turns to" and prop:
            verb = f"turns to {prop}"
            prop = ""
        elif verb == "looks at" and prop:
            verb = f"looks at {prop}"
            prop = ""
        if who:
            verb = f"{who} {verb}"
    else:
        helper = BEAT_HELPERS.get(beat, "the beat happens")
        if beat == "Action" and who and prop:
            verb = f"{who} picks up {prop}"
            prop = ""
        elif beat == "Entrance":
            if who and where_to:
                extra = f" from {where}" if where else ""
                return f"{who} enters {where_to}{extra}"
            if who and where:
                return f"{who} enters {where}"
            verb = f"{who} {helper}".strip() if who else helper
        elif beat == "Establish":
            if where and where_to:
                return f"wide look from {where} into {where_to} so we know both spaces"
            if where:
                return f"wide look at {where} so we know where we are"
            return helper
        else:
            verb = f"{who} {helper}".strip() if who else helper

    if prop and prop.lower() not in verb.lower():
        if "pick" not in verb.lower() and "throw" not in verb.lower():
            verb = f"{verb} with {prop}"
    return _place(verb, where, where_to)
