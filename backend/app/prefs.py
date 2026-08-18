"""User preferences (retention, etc.) — stored in app-data, not the repo."""

from __future__ import annotations

import json
from typing import Any

from app.secrets_store import app_data_dir

PREFS_NAME = "preferences.json"
DEFAULT_RETENTION_DAYS = 90


def prefs_path():
    return app_data_dir() / PREFS_NAME


def load_prefs() -> dict[str, Any]:
    path = prefs_path()
    if not path.is_file():
        return {"retention_days": DEFAULT_RETENTION_DAYS}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return {"retention_days": DEFAULT_RETENTION_DAYS}
    if not isinstance(raw, dict):
        return {"retention_days": DEFAULT_RETENTION_DAYS}
    days = raw.get("retention_days", DEFAULT_RETENTION_DAYS)
    try:
        days_i = int(days)
    except (TypeError, ValueError):
        days_i = DEFAULT_RETENTION_DAYS
    return {"retention_days": max(0, days_i)}


def save_prefs(*, retention_days: int | None = None) -> dict[str, Any]:
    current = load_prefs()
    if retention_days is not None:
        current["retention_days"] = max(0, int(retention_days))
    folder = app_data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    prefs_path().write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")
    return current


def retention_days() -> int:
    return int(load_prefs().get("retention_days") or 0)
