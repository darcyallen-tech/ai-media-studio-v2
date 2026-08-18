"""Noob-friendly Shot Prompt Builder — writes action + optional camera."""

from __future__ import annotations

import re
from typing import Any

_INTO_TAIL = re.compile(r"\s+(into|to|toward)\s*$", re.I)

BEATS = [
    "Establish",
    "Entrance",
    "Exit",
    "Dialogue",
    "Action",
    "Reaction",
    "Insert / Detail",
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
    "Dolly zoom": ("Dolly zoom", "Slow", "Ease in-out"),
    "Roll": ("Roll", "Medium", "Linear"),
}

LENS_NOTES: dict[str, str] = {
    "Wide (~24–35)": "Lens: wide (~24–35mm)",
    "Normal (~50)": "Lens: normal (~50mm)",
    "Tight (~85)": "Lens: tight (~85mm)",
    "Extreme tight": "Lens: extreme tight",
    "Default": "",
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
            _field("where_from", "From (optional)", kind="chips", choices=[], value=""),
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


def _parse_dialogue(raw: str) -> list[tuple[str, str]]:
    """'Evil Man=YOU WILL PAY|Alice=' → attributed lines (empty line = present only)."""
    out: list[tuple[str, str]] = []
    for chunk in (raw or "").split("|"):
        if "=" not in chunk:
            continue
        name, line = chunk.split("=", 1)
        name = name.strip()
        if not name:
            continue
        out.append((name, line.strip()))
    return out


def apply_shot_builder(fields: dict[str, Any] | None) -> dict[str, str]:
    vals = {str(k): ("" if v is None else str(v)).strip() for k, v in (fields or {}).items()}
    beat = vals.get("beat") or "Establish"
    if beat not in BEATS:
        beat = "Establish"
    people = _split_names(vals.get("who") or "")
    props = _split_names(vals.get("props") or "")
    where = (vals.get("where") or "").strip()
    where_from = (vals.get("where_from") or "").strip()
    if where_from and where and where_from.lower() == where.lower():
        where_from = ""
    prep = "to" if beat == "Exit" else "into"
    emotion = vals.get("emotion") or "Calm"
    if emotion == "Custom":
        emotion = (vals.get("emotion_custom") or "Neutral").strip() or "Neutral"
    custom = vals.get("action_line") or ""
    preset_action = (vals.get("action_preset") or "").strip()
    sequence = _split_names(vals.get("sequence") or "")
    dialogue = _parse_dialogue(vals.get("dialogue") or "")
    speaker = (vals.get("speaker") or "").strip()
    speech = (vals.get("speech") or "").strip()
    react_to = (vals.get("react_to") or "").strip()
    who_s = _join_names(people)
    prop_s = _join_names(props)
    body = _compose_body(
        beat,
        custom,
        who_s,
        prop_s,
        where,
        where_from,
        people=people,
        preset_action=preset_action,
        sequence=sequence,
        dialogue=dialogue,
        react_to=react_to,
        speaker=speaker,
        speech=speech,
        prep=prep,
    )
    if beat in ("Action", "Entrance", "Reaction"):
        extra = _speech_clause(speaker, speech, dialogue)
        if extra:
            body = f"{body.rstrip('.')}. {extra}"
    action = f"[{beat} · {emotion}] {body}".strip()
    if not action.endswith("."):
        action += "."

    camera = (vals.get("camera") or "").strip()
    if camera and camera in CAMERA_PRESETS:
        move, speed, ease = CAMERA_PRESETS[camera]
    else:
        move, speed, ease = "Push in", "Slow", "Ease in-out"
    frame_bits: list[str] = []
    lens = LENS_NOTES.get((vals.get("lens") or "").strip(), "")
    if lens:
        frame_bits.append(lens)
    degrees = (vals.get("degrees") or "").strip()
    if degrees:
        rot = (vals.get("rotation") or "clockwise").strip() or "clockwise"
        frame_bits.append(f"{degrees}° {rot}")
    extra = (vals.get("framing") or "").strip()
    if extra:
        frame_bits.append(extra)
    framing = ". ".join(frame_bits)
    return {
        "action": action,
        "move": move,
        "speed": speed,
        "ease": ease,
        "framing": framing,
        "preset": camera,
    }


def _direction(where: str, where_from: str, *, prep: str = "into") -> str:
    """'from X into/to Where' when From is set; otherwise just Where."""
    dest = (where or "").strip()
    origin = (where_from or "").strip()
    if origin and dest and origin.lower() == dest.lower():
        origin = ""
    if origin and dest:
        return f"from {origin} {prep} {dest}"
    return dest


def _place(verb: str, where: str, where_from: str, *, prep: str = "into") -> str:
    """Attach location without doubling prepositions (no 'walks into in X')."""
    v = (verb or "").strip()
    dest = (where or "").strip()
    origin = (where_from or "").strip()
    if origin and dest and origin.lower() == dest.lower():
        origin = ""
    if not v:
        return _place_only(dest, origin, prep=prep)
    low = f" {v.lower()} "
    if dest and dest.lower() in v.lower() and (
        not origin or origin.lower() in v.lower()
    ):
        return v
    if origin and dest:
        core = _INTO_TAIL.sub("", v).rstrip()
        return f"{core} from {origin} {prep} {dest}"
    if not dest:
        return v
    if any(f" {p} " in low or low.strip().endswith(p) for p in _PLACE_VERBS):
        # "Alice walks into" + bar → "Alice walks into Classy bar"
        if any(v.lower().endswith(p) or v.lower() == p for p in _PLACE_VERBS):
            return f"{v} {dest}"
        return v
    return f"{v} in {dest}"


def _third_person(verb: str) -> str:
    v = (verb or "").strip().lower()
    if not v:
        return v
    if v.endswith("y") and len(v) > 1 and v[-2] not in "aeiou":
        return f"{v[:-1]}ies"
    if v.endswith(("s", "x", "z", "ch", "sh")):
        return f"{v}es"
    return f"{v}s"


def _place_only(where: str, where_from: str, *, prep: str = "into") -> str:
    directed = _direction(where, where_from, prep=prep)
    if not directed:
        return ""
    if where_from and where and where_from.lower() != where.lower():
        return directed
    return f"in {where}"


def _compose_dialogue(
    present: list[str],
    dialogue: list[tuple[str, str]],
    where: str,
    where_from: str = "",
) -> str:
    spoken = [(n, line) for n, line in dialogue if (line or "").strip()]
    parts: list[str] = []
    for name, line in spoken:
        quote = line.strip().strip('"')
        if quote:
            parts.append(f'{name}: "{quote}"')
    silent = [n for n in present if n not in {s[0] for s in spoken}]
    if silent:
        extra = _join_names(silent)
        verb = "is" if len(silent) == 1 else "are"
        parts.append(f"{extra} {verb} in frame.")
    directed = _direction(where, where_from, prep="to")
    if directed:
        parts.append(f"Location: {directed}.")
    return " ".join(parts).strip() or "They talk."


def _speech_clause(
    speaker: str,
    speech: str,
    dialogue: list[tuple[str, str]],
) -> str:
    line = (speech or "").strip().strip('"')
    if speaker and line:
        return f'{speaker}: "{line}"'
    bits: list[str] = []
    for name, raw in dialogue:
        quote = (raw or "").strip().strip('"')
        if quote:
            bits.append(f'{name}: "{quote}"')
    return " ".join(bits)


def _compose_body(
    beat: str,
    custom: str,
    who: str,
    prop: str,
    where: str,
    where_from: str,
    *,
    people: list[str] | None = None,
    preset_action: str = "",
    sequence: list[str] | None = None,
    dialogue: list[tuple[str, str]] | None = None,
    react_to: str = "",
    speaker: str = "",
    speech: str = "",
    prep: str = "into",
) -> str:
    lines = dialogue or []
    if beat == "Dialogue":
        return _compose_dialogue(people or [], lines, where, where_from)

    if beat == "Establish":
        directed = _direction(where, where_from, prep="into")
        if where_from and where and directed.startswith("from "):
            return f"Wide look {directed} so we know both spaces"
        if where:
            return f"Wide look at {where} so we know where we are"
        if who:
            return f"Wide look establishing {who}"
        return "Wide look at the space so we know where we are"

    if beat == "Entrance":
        directed = _direction(where, where_from, prep="into")
        subject = who or "Someone"
        if directed:
            return f"{subject} enters {directed}"
        if who:
            return f"{who} enters the frame"
        return "Someone enters the frame"

    if beat == "Exit":
        directed = _direction(where, where_from, prep="to")
        subject = who or "Someone"
        if directed:
            return f"{subject} exits {directed}"
        if who:
            return f"{who} exits the frame"
        return "Someone exits the frame"

    if beat == "Reaction":
        target = react_to or prop
        if who and target:
            core = f"{who} reacts to {target}"
        elif who:
            core = f"{who} reacts"
        else:
            core = "A reaction beat"
        return _place(core, where, where_from, prep=prep) if (where or where_from) else core

    if beat in ("Insert / Detail", "Insert", "Detail"):
        focus = prop or react_to
        directed = _direction(where, where_from, prep="to")
        if focus and where_from and where and directed.startswith("from "):
            return f"Insert detail on {focus} {directed}"
        if focus and where:
            return f"Insert detail on {focus} in {where}"
        if focus:
            return f"Insert detail on {focus}"
        return "Insert detail"

    if beat == "Hold":
        if who:
            return f"Hold on {who}"
        if where:
            return f"Hold on {where}"
        return "Hold on the frame"

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
        return _place(core, where, where_from, prep=prep)

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
            directed = _direction(where, where_from, prep="into")
            if who and directed:
                return f"{who} enters {directed}"
            if who and where:
                return f"{who} enters {where}"
            verb = f"{who} {helper}".strip() if who else helper
        elif beat == "Establish":
            directed = _direction(where, where_from, prep="into")
            if where_from and where and directed.startswith("from "):
                return f"wide look {directed} so we know both spaces"
            if where:
                return f"wide look at {where} so we know where we are"
            return helper
        else:
            verb = f"{who} {helper}".strip() if who else helper

    if prop and prop.lower() not in verb.lower():
        if "pick" not in verb.lower() and "throw" not in verb.lower():
            verb = f"{verb} with {prop}"
    return _place(verb, where, where_from, prep=prep)
