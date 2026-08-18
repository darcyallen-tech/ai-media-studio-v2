"""Prompt Builder: scenario catalogs + apply-to-prompt text."""

from __future__ import annotations

from typing import Any

from app.scenarios import (
    BLANK_CANVAS_KEY,
    app_scenario_items,
    build_scenario_prompt,
    build_video_ref_prompt,
    get_scenario,
    simple_control_schema,
)
from app.scene_builder import (
    CAMERA_FEEL,
    DECOR_AMOUNT,
    DEFAULTS,
    FURNITURE_DENSITY,
    PLANTS,
    ROOM_TYPES,
    STYLES_ALL,
)

EXTRA_IMAGE_SCENARIOS: list[tuple[str, str, str]] = [
    (
        "mirror_remove",
        "Mirror remove",
        "Remove mirrors and their reflections; keep the room otherwise identical.",
    ),
    (
        "object_remove",
        "Object remove",
        "Remove a named object; keep architecture, lighting, and everything else.",
    ),
]


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


def list_builder_scenarios(mode: str | None, modality: str | None) -> dict[str, Any]:
    mode_l = (mode or "image").strip().lower()
    mod = (modality or "").strip().lower()
    if mode_l == "audio":
        if mod == "sfx":
            rows = [
                {
                    "key": "audio_sfx",
                    "label": "SFX",
                    "description": "Short sound effect.",
                    "fields": _sfx_fields(),
                }
            ]
            return {"mode": mode_l, "modality": mod, "default_id": "audio_sfx", "scenarios": rows}
        if mod == "voice":
            rows = [
                {
                    "key": "audio_voice",
                    "label": "Voice",
                    "description": "Spoken line / VO.",
                    "fields": _voice_fields(),
                }
            ]
            return {"mode": mode_l, "modality": mod, "default_id": "audio_voice", "scenarios": rows}
        rows = [
            {
                "key": "audio_music",
                "label": "Music",
                "description": "Style and arrangement stay out of the lyrics field.",
                "fields": _music_fields(),
            }
        ]
        return {"mode": mode_l, "modality": mod or "music", "default_id": "audio_music", "scenarios": rows}

    # Image, video, frame
    rows: list[dict[str, Any]] = []
    for key, label in app_scenario_items():
        spec = get_scenario(key)
        rows.append(
            {
                "key": key,
                "label": label,
                "description": (spec.description if spec else "") or "",
                "fields": _image_fields(key),
            }
        )
    for key, label, desc in EXTRA_IMAGE_SCENARIOS:
        rows.append({"key": key, "label": label, "description": desc, "fields": _image_fields(key)})
    if mode_l in ("video", "frame"):
        for row in rows:
            if row["key"] != BLANK_CANVAS_KEY:
                row["fields"] = list(row["fields"]) + [
                    _field(
                        "camera_note",
                        "Camera / motion (optional)",
                        kind="text",
                        value="",
                        placeholder="e.g. locked tripod, slow push-in",
                    )
                ]
    default_id = "furniture_popin"
    if not any(r["key"] == default_id for r in rows):
        default_id = rows[0]["key"] if rows else BLANK_CANVAS_KEY
    return {"mode": mode_l, "modality": mod, "default_id": default_id, "scenarios": rows}


def _image_fields(key: str) -> list[dict[str, Any]]:
    if key == BLANK_CANVAS_KEY:
        return [
            _field(
                "note",
                "Custom prompt",
                kind="textarea",
                value="",
                placeholder="Write the prompt yourself…",
            )
        ]
    if key in ("furniture_popin", "furniture_swap"):
        return [
            _field("room_type", "Room", choices=list(ROOM_TYPES), value=DEFAULTS["room_type"]),
            _field("style", "Style", choices=list(STYLES_ALL), value=DEFAULTS["style"]),
            _field(
                "furniture_density",
                "Furniture",
                choices=[c for c in FURNITURE_DENSITY if c],
                value=DEFAULTS["furniture_density"],
            ),
            _field("decor_amount", "Decor", choices=list(DECOR_AMOUNT), value=DEFAULTS["decor_amount"]),
            _field("plants", "Plants", choices=list(PLANTS), value=DEFAULTS["plants"]),
            _field(
                "camera_feel",
                "Camera",
                choices=[c for c in CAMERA_FEEL if c],
                value=DEFAULTS["camera_feel"],
            ),
        ]
    if key == "mirror_remove":
        return [
            _field(
                "note",
                "Which mirrors",
                kind="text",
                value="",
                placeholder="e.g. the tall mirror on the left wall",
            )
        ]
    if key == "object_remove":
        return [
            _field(
                "note",
                "What to remove",
                kind="text",
                value="",
                placeholder="e.g. the trash can and orange cone",
            )
        ]
    schema = simple_control_schema(key)
    fields: list[dict[str, Any]] = []
    if schema.get("opt_a_choices") and schema["opt_a_choices"] != ["—"]:
        fields.append(
            _field(
                "opt_a",
                str(schema.get("opt_a_label") or "Option A"),
                choices=list(schema["opt_a_choices"]),
                value=str(schema.get("opt_a_value") or ""),
            )
        )
    if schema.get("opt_b_choices") and schema["opt_b_choices"] != ["—"]:
        fields.append(
            _field(
                "opt_b",
                str(schema.get("opt_b_label") or "Option B"),
                choices=list(schema["opt_b_choices"]),
                value=str(schema.get("opt_b_value") or ""),
            )
        )
    if schema.get("show_opt_c"):
        fields.append(
            _field(
                "opt_c",
                str(schema.get("opt_c_label") or "Option C"),
                choices=list(schema.get("opt_c_choices") or []),
                value=str(schema.get("opt_c_value") or ""),
            )
        )
    if schema.get("show_opt_d"):
        fields.append(
            _field(
                "opt_d",
                str(schema.get("opt_d_label") or "Option D"),
                choices=list(schema.get("opt_d_choices") or []),
                value=str(schema.get("opt_d_value") or ""),
            )
        )
    if schema.get("show_note"):
        fields.append(
            _field(
                "note",
                str(schema.get("note_label") or "Notes"),
                kind="text",
                value="",
                placeholder=str(schema.get("note_placeholder") or ""),
            )
        )
    return fields


def _music_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "style",
            "Style",
            kind="text",
            value="",
            placeholder="e.g. warm acoustic folk, intimate, fingerpicked guitar",
        ),
        _field(
            "arrangement",
            "Arrangement",
            kind="text",
            value="",
            placeholder="e.g. intro → verse → chorus, sparse then fuller",
        ),
        _field(
            "mood",
            "Mood / tempo",
            kind="text",
            value="",
            placeholder="e.g. hopeful, mid-tempo, 90 BPM",
        ),
        _field("instrumental", "Instrumental (no vocals)", kind="check", value="true"),
        _field(
            "lyrics",
            "Lyrics (optional)",
            kind="textarea",
            value="",
            placeholder="Only the words to sing — not style notes",
        ),
    ]


def _sfx_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "sfx_type",
            "Type",
            choices=["Whoosh", "Impact", "Ambience", "Foley", "UI / click", "Custom"],
            value="Impact",
        ),
        _field("length", "Length", choices=["Very short", "Short", "Medium"], value="Short"),
        _field("tone", "Tone", choices=["Clean", "Gritty", "Cinematic", "Cartoon"], value="Clean"),
        _field("note", "Notes", kind="text", value="", placeholder="e.g. wooden door close, close mic"),
    ]


def _voice_fields() -> list[dict[str, Any]]:
    return [
        _field("tone", "Tone", choices=["Warm", "Neutral", "Authoritative", "Casual"], value="Warm"),
        _field("pace", "Pace", choices=["Slow", "Natural", "Brisk"], value="Natural"),
        _field(
            "script",
            "Script",
            kind="textarea",
            value="",
            placeholder="Words to speak…",
        ),
    ]


def apply_builder(
    scenario_key: str,
    fields: dict[str, Any] | None,
    *,
    mode: str = "image",
    modality: str = "",
) -> str:
    vals = {str(k): ("" if v is None else str(v)) for k, v in (fields or {}).items()}
    mode_l = (mode or "image").strip().lower()
    key = (scenario_key or "").strip()

    if key == "audio_music":
        return _apply_music(vals)
    if key == "audio_sfx":
        return _apply_sfx(vals)
    if key == "audio_voice":
        return _apply_voice(vals)
    if key == "mirror_remove":
        target = vals.get("note") or "mirrors and their reflections"
        text = (
            f"Remove {target} from this frame. Fill the wall/space naturally. "
            "Keep architecture, lighting, camera, and everything else identical."
        )
        return _maybe_video(text, mode_l, vals)
    if key == "object_remove":
        target = vals.get("note") or "the named object"
        text = (
            f"Remove {target}. Reconstruct what should be behind it. "
            "Change nothing else — same camera, lighting, and materials."
        )
        return _maybe_video(text, mode_l, vals)

    text = build_scenario_prompt(
        key,
        room_type=vals.get("room_type"),
        style=vals.get("style"),
        furniture_density=vals.get("furniture_density"),
        decor_amount=vals.get("decor_amount"),
        plants=vals.get("plants"),
        camera_feel=vals.get("camera_feel"),
        opt_a=vals.get("opt_a"),
        opt_b=vals.get("opt_b"),
        opt_c=vals.get("opt_c"),
        opt_d=vals.get("opt_d"),
        note=vals.get("note"),
    )
    return _maybe_video(text, mode_l, vals)


def _maybe_video(text: str, mode: str, vals: dict[str, str]) -> str:
    if mode not in ("video", "frame"):
        return (text or "").strip()
    cam = (vals.get("camera_note") or "").strip()
    extra = cam or "Keep camera motion continuous and natural; no hard cuts."
    body = (text or "").strip()
    if not body:
        return extra
    return f"{body}\n\nCamera / motion: {extra}"


def _apply_music(vals: dict[str, str]) -> str:
    style = (vals.get("style") or "").strip()
    arrangement = (vals.get("arrangement") or "").strip()
    mood = (vals.get("mood") or "").strip()
    instrumental = (vals.get("instrumental") or "").strip().lower() in ("true", "1", "yes", "on")
    lyrics = (vals.get("lyrics") or "").strip()
    parts: list[str] = []
    if style:
        parts.append(f"Style: {style}")
    if arrangement:
        parts.append(f"Arrangement: {arrangement}")
    if mood:
        parts.append(f"Mood / tempo: {mood}")
    if instrumental:
        parts.append("Instrumental only — no vocals, no lyrics.")
    style_block = "\n".join(parts).strip()
    if instrumental or not lyrics:
        return style_block or "Instrumental piece."
    # Lyrics stay a separate block — never mixed into style lines
    if style_block:
        return f"{style_block}\n\nLyrics:\n{lyrics}"
    return f"Lyrics:\n{lyrics}"


def _apply_sfx(vals: dict[str, str]) -> str:
    bits = [
        vals.get("sfx_type") or "SFX",
        (vals.get("length") or "").strip(),
        (vals.get("tone") or "").strip(),
    ]
    head = ", ".join(b for b in bits if b)
    note = (vals.get("note") or "").strip()
    if note:
        return f"{head}. {note}"
    return head


def _apply_voice(vals: dict[str, str]) -> str:
    tone = (vals.get("tone") or "Natural").strip()
    pace = (vals.get("pace") or "Natural").strip()
    script = (vals.get("script") or "").strip()
    lead = f"Tone: {tone}. Pace: {pace}."
    if script:
        return f"{lead}\n\n{script}"
    return lead
