"""Storyboard assemble helpers — compose a sequence prompt + list R2V models.

Primary generate path: MiniMax H3 Omni Reference (R2V, up to 9 stills).
"""

from __future__ import annotations

from typing import Any

from app.create_catalog import default_model_for, list_models_for_ui

# Documented primary for Phase 16
PRIMARY_STORYBOARD_HINT = "minimax h3"
PRIMARY_STORYBOARD_LABEL = "MiniMax H3 Omni Reference (R2V)"


def list_storyboard_models() -> dict[str, Any]:
    rows = list_models_for_ui("video", "r2v")
    default = default_model_for("video", "r2v")
    return {
        "mode": "storyboard",
        "modality": "r2v",
        "primary": PRIMARY_STORYBOARD_LABEL,
        "primary_hint": PRIMARY_STORYBOARD_HINT,
        "default_id": default.id if default else (rows[0].id if rows else None),
        "models": rows,
        "notes": (
            "Primary path: MiniMax H3 Omni Reference-to-Video. "
            "Hub stills + Shot start frames are sent as refs (max per model). "
            "Too many refs returns a clear error — nothing is silently dropped."
        ),
    }


def compose_storyboard_prompt(
    *,
    title: str = "",
    notes: str = "",
    assets: list[dict[str, Any]] | None = None,
    shots: list[dict[str, Any]] | None = None,
) -> str:
    parts: list[str] = []
    title_s = (title or "").strip()
    notes_s = (notes or "").strip()
    if title_s:
        parts.append(f"Sequence: {title_s}.")
    if notes_s:
        parts.append(notes_s)

    cast: list[str] = []
    for row in assets or []:
        role = str(row.get("role") or "asset").strip()
        label = str(row.get("label") or row.get("name") or "").strip()
        if not label:
            continue
        cast.append(f"{role}: {label}")
    if cast:
        parts.append("Cast / locations: " + "; ".join(cast) + ".")

    ordered = sorted(
        list(shots or []),
        key=lambda s: int(s.get("order") or 0),
    )
    for row in ordered:
        n = int(row.get("order") or 0) or 1
        label = str(row.get("label") or f"Shot {n}").strip()
        action = str(row.get("action") or "").strip()
        move = str(row.get("move") or "").strip()
        speed = str(row.get("speed") or "").strip()
        ease = str(row.get("ease") or "").strip()
        framing = str(row.get("framing") or "").strip()
        duration = str(row.get("duration") or "").strip()
        lines = [f"Shot {n} ({label}):"]
        if action:
            lines.append(action)
        cam: list[str] = []
        if move:
            cam.append(move)
        if move and move != "Static" and speed:
            cam.append(speed)
        if move and move != "Static" and ease:
            cam.append(ease)
        if framing:
            cam.append(framing)
        if cam:
            lines.append("Camera: " + ", ".join(cam) + ".")
        if duration:
            lines.append(f"Hold about {duration}.")
        parts.append(" ".join(lines))

    if not ordered:
        parts.append("Single continuous shot.")
    else:
        parts.append(
            "Play the shots in order as one continuous sequence. "
            "Keep character and location identity locked to the reference stills."
        )
    return "\n\n".join(p for p in parts if p).strip()


def suggested_duration_s(shots: list[dict[str, Any]] | None, *, lo: float = 5, hi: float = 15) -> str:
    total = 0.0
    for row in shots or []:
        raw = str(row.get("duration") or "").strip().lower().rstrip("s")
        if not raw:
            continue
        try:
            total += float(raw)
        except ValueError:
            continue
    if total <= 0:
        return str(int(lo))
    clamped = max(lo, min(hi, round(total)))
    return str(int(clamped))
