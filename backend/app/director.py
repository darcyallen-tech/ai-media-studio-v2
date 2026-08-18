"""Lite Director: video camera-language block for Prompt."""

from __future__ import annotations

from typing import Any

DIRECTOR_MODALITIES = ("t2v", "i2v", "r2v", "bridge", "extend")

MOVES = [
    "Static",
    "Push in",
    "Pull out",
    "Orbit",
    "Crane up",
    "Crane down",
    "Pan L",
    "Pan R",
    "Tilt",
    "Handheld",
]

SPEEDS = ["Slow", "Medium", "Fast"]
EASES = ["Linear", "Ease in", "Ease out", "Ease in-out"]


def director_allowed(mode: str | None, modality: str | None) -> bool:
    return (mode or "").strip().lower() == "video" and (
        (modality or "").strip().lower() in DIRECTOR_MODALITIES
    )


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


def list_director_fields() -> dict[str, Any]:
    return {
        "modalities": list(DIRECTOR_MODALITIES),
        "fields": [
            _field("move", "Move", choices=MOVES, value="Push in"),
            _field("speed", "Speed", choices=SPEEDS, value="Slow"),
            _field("ease", "Ease", choices=EASES, value="Ease in-out"),
            _field(
                "framing",
                "Framing notes",
                kind="textarea",
                value="",
                placeholder="e.g. start medium, end close on the sofa; keep horizon level",
            ),
        ],
    }


def apply_director(fields: dict[str, Any] | None) -> str:
    vals = {str(k): ("" if v is None else str(v)).strip() for k, v in (fields or {}).items()}
    move = vals.get("move") or "Push in"
    if move not in MOVES:
        move = "Push in"
    speed = vals.get("speed") or "Medium"
    if speed not in SPEEDS:
        speed = "Medium"
    ease = vals.get("ease") or "Ease in-out"
    if ease not in EASES:
        ease = "Ease in-out"
    framing = vals.get("framing") or ""

    lines = ["Camera (Director):"]
    if move == "Static":
        lines.append("Move: Static — locked tripod, no camera travel.")
    else:
        lines.append(f"Move: {move}.")
        lines.append(f"Speed: {speed}.")
        lines.append(f"Ease: {ease}.")
    if framing:
        lines.append(f"Framing: {framing}")
    if move == "Static":
        lines.append("Hold framing; no drift or handheld shake.")
    else:
        lines.append("Keep motion continuous and natural; no hard cuts.")
    return "\n".join(lines)
