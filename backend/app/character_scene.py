"""Read-only Character / Scene lists from the V1 store.

V2 never writes V1 data. Paths come from sibling ../ai-media-studio or
AI_MEDIA_STUDIO_ROOT / AI_MEDIA_STUDIO_V1_ROOT.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Literal

from app.config import PROJECT_ROOT

Kind = Literal["character", "scene"]

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def v1_root() -> Path | None:
    for key in ("AI_MEDIA_STUDIO_ROOT", "AI_MEDIA_STUDIO_V1_ROOT"):
        raw = (os.environ.get(key) or "").strip()
        if not raw:
            continue
        path = Path(raw).expanduser()
        try:
            if path.is_dir():
                return path.resolve()
        except OSError:
            continue
    sibling = PROJECT_ROOT.parent / "ai-media-studio"
    try:
        if sibling.is_dir():
            return sibling.resolve()
    except OSError:
        pass
    return None


def v1_data_dir() -> Path | None:
    root = v1_root()
    if root is None:
        return None
    data = root / "data"
    try:
        if data.is_dir():
            return data.resolve()
    except OSError:
        return None
    return None


def _first_existing(*candidates: str | None) -> str:
    for raw in candidates:
        text = (raw or "").strip()
        if not text:
            continue
        try:
            path = Path(text)
            if path.is_file():
                return str(path.resolve())
        except OSError:
            continue
    return ""


def _primary_character_still(item: dict[str, Any]) -> str:
    identity = item.get("identity") if isinstance(item.get("identity"), dict) else {}
    sheet = str(item.get("sheet_path") or "").strip()
    front = ""
    if isinstance(identity, dict):
        front = str(identity.get("front") or "").strip()
    still = str(item.get("still_path") or "").strip()
    extras: list[str] = []
    raw_paths = item.get("still_paths")
    if isinstance(raw_paths, list):
        extras = [str(p).strip() for p in raw_paths if str(p).strip()]
    ident_rest: list[str] = []
    if isinstance(identity, dict):
        for key in (
            "side",
            "closeup",
            "back",
            "threequarter_front",
            "threequarter_back",
            "top",
        ):
            val = str(identity.get(key) or "").strip()
            if val:
                ident_rest.append(val)
    # Prefer a real file: sheet (when present), then front, then any still.
    return _first_existing(sheet, front, still, *extras, *ident_rest)


def _primary_scene_still(item: dict[str, Any]) -> str:
    return _first_existing(
        str(item.get("sheet_path") or ""),
        str(item.get("still_path") or ""),
        str(item.get("angle_b_path") or ""),
        str(item.get("angle_c_path") or ""),
    )


def _label_for(item: dict[str, Any], names: dict[str, str]) -> str:
    name = str(item.get("name") or "").strip() or "Untitled"
    notes = str(item.get("notes") or "").strip()
    parent_id = str(item.get("parent_id") or "").strip()
    parent = names.get(parent_id, "")
    if parent:
        lower = name.lower()
        if lower.startswith(parent.lower()):
            return name
        return f"{parent} / {name}"
    if notes and notes.lower() not in name.lower() and len(notes) < 48:
        return f"{name} ({notes})" if name != notes else name
    return name


def _load_json_list(path: Path, key: str) -> list[dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    raw = data.get(key) if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, dict)]


def _row(
    *,
    kind: Kind,
    item: dict[str, Any],
    still_path: str,
    names: dict[str, str],
) -> dict[str, Any] | None:
    cid = str(item.get("id") or "").strip()
    name = str(item.get("name") or "").strip()
    if not cid and not name:
        return None
    if not cid:
        cid = name
    label = _label_for(item, names)
    has_still = bool(still_path)
    return {
        "id": cid,
        "name": name or label,
        "label": label,
        "notes": str(item.get("notes") or "").strip(),
        "still_path": still_path or None,
        "has_still": has_still,
        "parent_id": str(item.get("parent_id") or "").strip() or None,
        "url": f"/{kind}s/{cid}/still" if has_still else None,
        "kind": kind,
    }


def list_characters() -> list[dict[str, Any]]:
    data = v1_data_dir()
    if data is None:
        return []
    items = _load_json_list(data / "characters.json", "characters")
    names = {
        str(it.get("id") or "").strip(): str(it.get("name") or "").strip()
        for it in items
        if str(it.get("id") or "").strip()
    }
    out: list[dict[str, Any]] = []
    for item in items:
        row = _row(
            kind="character",
            item=item,
            still_path=_primary_character_still(item),
            names=names,
        )
        if row:
            out.append(row)
    return out


def list_scenes() -> list[dict[str, Any]]:
    data = v1_data_dir()
    if data is None:
        return []
    items = _load_json_list(data / "scenes.json", "scenes")
    names = {
        str(it.get("id") or "").strip(): str(it.get("name") or "").strip()
        for it in items
        if str(it.get("id") or "").strip()
    }
    out: list[dict[str, Any]] = []
    for item in items:
        row = _row(
            kind="scene",
            item=item,
            still_path=_primary_scene_still(item),
            names=names,
        )
        if row:
            out.append(row)
    return out


def list_kind(kind: Kind) -> list[dict[str, Any]]:
    return list_characters() if kind == "character" else list_scenes()


def find_entry(kind: Kind, id_or_name: str | None) -> dict[str, Any] | None:
    key = (id_or_name or "").strip()
    if not key:
        return None
    want = key.lower()
    for row in list_kind(kind):
        if row["id"] == key or str(row.get("name") or "").lower() == want:
            return row
        if str(row.get("label") or "").lower() == want:
            return row
    return None


def still_path_for(kind: Kind, id_or_name: str | None) -> str | None:
    row = find_entry(kind, id_or_name)
    if not row:
        return None
    path = str(row.get("still_path") or "").strip()
    return path or None


def stills_for_ids(kind: Kind, ids: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in ids or []:
        path = still_path_for(kind, raw)
        if not path:
            continue
        try:
            key = str(Path(path).resolve())
        except OSError:
            key = path
        if key in seen:
            continue
        seen.add(key)
        out.append(path)
    return out


def resolve_still_file(kind: Kind, id_or_name: str) -> Path | None:
    """Absolute still path if it lives under the V1 data dir."""
    data = v1_data_dir()
    path = still_path_for(kind, id_or_name)
    if data is None or not path:
        return None
    try:
        resolved = Path(path).resolve()
    except OSError:
        return None
    if not resolved.is_file():
        return None
    if resolved.suffix.lower() not in _IMAGE_EXTS:
        return None
    try:
        resolved.relative_to(data)
    except ValueError:
        return None
    return resolved
