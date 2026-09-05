"""Last canvas graph — paths and asset ids, not media binaries."""

from __future__ import annotations

import json
from typing import Any

from app.secrets_store import app_data_dir

CANVAS_NAME = "canvas.json"
MAX_BYTES = 2_000_000


def canvas_path():
    return app_data_dir() / CANVAS_NAME


def load_canvas() -> dict[str, Any] | None:
    path = canvas_path()
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return None
    return raw if isinstance(raw, dict) else None


def save_canvas(data: dict[str, Any]) -> dict[str, Any]:
    folder = app_data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False)
    encoded = text.encode("utf-8")
    if len(encoded) > MAX_BYTES:
        raise ValueError("Canvas snapshot is too large to save.")
    canvas_path().write_text(text + "\n", encoding="utf-8")
    return data


def clear_canvas() -> None:
    path = canvas_path()
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
