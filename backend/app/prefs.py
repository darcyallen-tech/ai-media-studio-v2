"""User preferences (retention, theme) — stored in app-data, not the repo."""

from __future__ import annotations

import json
from typing import Any

from app.secrets_store import app_data_dir

PREFS_NAME = "preferences.json"
DEFAULT_RETENTION_DAYS = 90
DEFAULT_THEME = "day"
VALID_THEMES = frozenset({"day", "night"})
DEFAULT_GRID_SNAP = "fine"
VALID_SNAPS = frozenset({"off", "fine", "medium", "coarse"})
DEFAULT_EDGE_STYLE = "curved"
VALID_EDGES = frozenset({"curved", "straight"})


def prefs_path():
    return app_data_dir() / PREFS_NAME


def _theme(raw: Any) -> str:
    value = str(raw or "").strip().lower()
    return value if value in VALID_THEMES else DEFAULT_THEME


def _snap(raw: Any) -> str:
    value = str(raw or "").strip().lower()
    return value if value in VALID_SNAPS else DEFAULT_GRID_SNAP


def _edge(raw: Any) -> str:
    value = str(raw or "").strip().lower()
    return value if value in VALID_EDGES else DEFAULT_EDGE_STYLE


def _defaults() -> dict[str, Any]:
    return {
        "retention_days": DEFAULT_RETENTION_DAYS,
        "theme": DEFAULT_THEME,
        "grid_snap": DEFAULT_GRID_SNAP,
        "edge_style": DEFAULT_EDGE_STYLE,
    }


def load_prefs() -> dict[str, Any]:
    path = prefs_path()
    if not path.is_file():
        return _defaults()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return _defaults()
    if not isinstance(raw, dict):
        return _defaults()
    days = raw.get("retention_days", DEFAULT_RETENTION_DAYS)
    try:
        days_i = int(days)
    except (TypeError, ValueError):
        days_i = DEFAULT_RETENTION_DAYS
    return {
        "retention_days": max(0, days_i),
        "theme": _theme(raw.get("theme")),
        "grid_snap": _snap(raw.get("grid_snap")),
        "edge_style": _edge(raw.get("edge_style")),
    }


def save_prefs(
    *,
    retention_days: int | None = None,
    theme: str | None = None,
    grid_snap: str | None = None,
    edge_style: str | None = None,
) -> dict[str, Any]:
    current = load_prefs()
    if retention_days is not None:
        current["retention_days"] = max(0, int(retention_days))
    if theme is not None:
        current["theme"] = _theme(theme)
    if grid_snap is not None:
        current["grid_snap"] = _snap(grid_snap)
    if edge_style is not None:
        current["edge_style"] = _edge(edge_style)
    folder = app_data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    prefs_path().write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")
    return current


def retention_days() -> int:
    return int(load_prefs().get("retention_days") or 0)
