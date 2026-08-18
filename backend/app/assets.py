"""V2-owned Character / Scene / Prop store. Never writes V1 data."""

from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from app.config import PROJECT_ROOT

Kind = Literal["character", "scene", "prop"]
KINDS: tuple[Kind, ...] = ("character", "scene", "prop")

ASSETS_DIR = PROJECT_ROOT / "data" / "assets"
ASSETS_INDEX = ASSETS_DIR / "assets.json"
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
_MAX_STILLS = {"character": 3, "scene": 1, "prop": 1}

SHEET_MODELS = ("flux", "seedream", "nano")


def ensure_assets_dir() -> Path:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    for kind in KINDS:
        (ASSETS_DIR / f"{kind}s").mkdir(parents=True, exist_ok=True)
    if not ASSETS_INDEX.is_file():
        ASSETS_INDEX.write_text(
            json.dumps({"assets": []}, indent=2) + "\n",
            encoding="utf-8",
        )
    return ASSETS_DIR


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_index(rows: list[dict[str, Any]]) -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_INDEX.write_text(
        json.dumps({"assets": rows}, indent=2) + "\n",
        encoding="utf-8",
    )


def _load_index() -> list[dict[str, Any]]:
    ensure_assets_dir()
    try:
        data = json.loads(ASSETS_INDEX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    raw = data.get("assets") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return []
    return [row for row in raw if isinstance(row, dict)]


def _normalize_kind(raw: str | None) -> Kind | None:
    k = (raw or "").strip().lower()
    if k in KINDS:
        return k  # type: ignore[return-value]
    if k in ("chars", "characters"):
        return "character"
    if k in ("locations", "scenes"):
        return "scene"
    if k in ("props", "objects"):
        return "prop"
    return None


def _still_list(row: dict[str, Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for key in ("sheet_path",):
        p = str(row.get(key) or "").strip()
        if p and p.lower() not in seen:
            seen.add(p.lower())
            out.append(p)
    raw = row.get("still_paths")
    extras = raw if isinstance(raw, list) else []
    single = str(row.get("still_path") or "").strip()
    if single:
        extras = [single, *extras]
    for item in extras:
        p = str(item or "").strip()
        if not p:
            continue
        key = p.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return [p for p in out if Path(p).is_file()]


def primary_still_path(row: dict[str, Any]) -> str:
    paths = _still_list(row)
    return paths[0] if paths else ""


def _folder(kind: Kind, asset_id: str) -> Path:
    return ASSETS_DIR / f"{kind}s" / asset_id


def _copy_still(kind: Kind, asset_id: str, src: Path, index: int) -> Path:
    dest_dir = _folder(kind, asset_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    suffix = src.suffix.lower() if src.suffix.lower() in _IMAGE_EXTS else ".png"
    dest = dest_dir / f"{index:02d}{suffix}"
    if dest.exists():
        dest = dest_dir / f"{index:02d}_{uuid.uuid4().hex[:6]}{suffix}"
    shutil.copy2(src, dest)
    return dest.resolve()


def _write_still_bytes(
    kind: Kind, asset_id: str, name: str, data: bytes, index: int
) -> Path:
    dest_dir = _folder(kind, asset_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(name).suffix.lower()
    if suffix not in _IMAGE_EXTS:
        suffix = ".png"
    dest = dest_dir / f"{index:02d}{suffix}"
    dest.write_bytes(data)
    return dest.resolve()


def _new_id(kind: Kind) -> str:
    prefix = "char" if kind == "character" else kind
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _to_public(row: dict[str, Any]) -> dict[str, Any]:
    kind = str(row.get("kind") or "character")
    aid = str(row.get("id") or "")
    stills = _still_list(row)
    primary = stills[0] if stills else ""
    url = f"/assets/{aid}/still" if primary else None
    return {
        "id": aid,
        "name": str(row.get("name") or "").strip() or "Untitled",
        "label": str(row.get("name") or "").strip() or "Untitled",
        "notes": str(row.get("notes") or "").strip(),
        "kind": kind,
        "still_path": primary or None,
        "still_paths": stills,
        "sheet_path": str(row.get("sheet_path") or "").strip() or None,
        "has_still": bool(primary),
        "url": url,
        "thumb_url": url,
        "owned": True,
        "created": row.get("created"),
        "model": str(row.get("model") or ""),
    }


def list_assets(kind: str | None = None) -> list[dict[str, Any]]:
    want = _normalize_kind(kind) if kind else None
    rows = _load_index()
    out: list[dict[str, Any]] = []
    for row in rows:
        k = _normalize_kind(str(row.get("kind") or ""))
        if k is None:
            continue
        if want and k != want:
            continue
        out.append(_to_public(row))
    out.sort(key=lambda r: str(r.get("created") or ""), reverse=True)
    return out


def get_asset(asset_id: str | None) -> dict[str, Any] | None:
    key = (asset_id or "").strip()
    if not key:
        return None
    want = key.lower()
    for row in _load_index():
        if str(row.get("id") or "").lower() == want:
            return row
        if str(row.get("name") or "").strip().lower() == want:
            return row
    return None


def find_asset(kind: Kind, id_or_name: str | None) -> dict[str, Any] | None:
    key = (id_or_name or "").strip()
    if not key:
        return None
    want = key.lower()
    for row in _load_index():
        if _normalize_kind(str(row.get("kind") or "")) != kind:
            continue
        if str(row.get("id") or "").lower() == want:
            return row
        if str(row.get("name") or "").strip().lower() == want:
            return row
    return None


def asset_to_library_item(row: dict[str, Any]) -> dict[str, Any] | None:
    pub = _to_public(row) if "still_paths" not in row or "owned" not in row else row
    if "still_path" not in pub:
        pub = _to_public(row)
    path = str(pub.get("still_path") or "").strip()
    if not path:
        return None
    return {
        "id": f"assets:{pub['id']}",
        "name": pub.get("label") or pub.get("name") or pub["id"],
        "source": "assets",
        "kind": "image",
        "path": path,
        "rel": pub["id"],
        "url": pub.get("url") or "",
        "thumb_url": pub.get("thumb_url") or pub.get("url"),
        "role": pub.get("kind"),
    }


def create_asset(
    *,
    kind: str,
    name: str,
    notes: str = "",
    still_paths: list[str] | None = None,
    files: list[tuple[str, bytes]] | None = None,
    sheet_path: str = "",
    model: str = "",
) -> dict[str, Any]:
    parsed = _normalize_kind(kind)
    if parsed is None:
        raise ValueError("kind must be character, scene, or prop")
    label = (name or "").strip()
    if not label:
        raise ValueError("Name is required.")
    aid = _new_id(parsed)
    cap = _MAX_STILLS[parsed]
    saved: list[str] = []
    idx = 1
    for raw in still_paths or []:
        if idx > cap:
            break
        src = Path(raw)
        if not src.is_file() or src.suffix.lower() not in _IMAGE_EXTS:
            continue
        dest = _copy_still(parsed, aid, src, idx)
        saved.append(str(dest))
        idx += 1
    for fname, data in files or []:
        if idx > cap:
            break
        if not data:
            continue
        dest = _write_still_bytes(parsed, aid, fname or "still.png", data, idx)
        saved.append(str(dest))
        idx += 1
    sheet = ""
    if sheet_path and Path(sheet_path).is_file():
        dest = _copy_still(parsed, aid, Path(sheet_path), 0)
        sheet = str(dest)
        if sheet not in saved:
            saved.insert(0, sheet)
    row = {
        "id": aid,
        "kind": parsed,
        "name": label,
        "notes": (notes or "").strip(),
        "still_paths": saved,
        "sheet_path": sheet,
        "model": (model or "").strip(),
        "created": _now(),
        "updated": _now(),
    }
    rows = _load_index()
    rows.append(row)
    _write_index(rows)
    return _to_public(row)


def delete_asset(asset_id: str) -> bool:
    key = (asset_id or "").strip()
    if not key:
        return False
    rows = _load_index()
    keep: list[dict[str, Any]] = []
    found: dict[str, Any] | None = None
    for row in rows:
        if str(row.get("id") or "") == key:
            found = row
            continue
        keep.append(row)
    if found is None:
        return False
    _write_index(keep)
    kind = _normalize_kind(str(found.get("kind") or ""))
    if kind:
        folder = _folder(kind, key)
        if folder.is_dir():
            shutil.rmtree(folder, ignore_errors=True)
    return True


def resolve_asset_still(asset_id: str) -> Path | None:
    row = get_asset(asset_id)
    if not row:
        return None
    path = primary_still_path(row)
    if not path:
        return None
    try:
        resolved = Path(path).resolve()
    except OSError:
        return None
    if not resolved.is_file() or resolved.suffix.lower() not in _IMAGE_EXTS:
        return None
    try:
        resolved.relative_to(ASSETS_DIR.resolve())
    except ValueError:
        return None
    return resolved


def default_sheet_prompt(kind: Kind, name: str, notes: str = "") -> str:
    extra = (notes or "").strip()
    if kind == "character":
        core = (
            f"Character reference still of {name}. Single person, full-body front view, "
            "even studio lighting, plain grey background, photoreal, no text, no collage."
        )
    elif kind == "scene":
        core = (
            f"Establishing still of {name}. Empty location, cinematic lighting, "
            "no prominent people, photoreal, no text."
        )
    else:
        core = (
            f"Product still of {name} on a clean surface, even lighting, "
            "plain background, photoreal, no text."
        )
    return f"{core} {extra}".strip()


def generate_asset(
    *,
    kind: str,
    name: str,
    notes: str = "",
    prompt: str = "",
    model_id: str = "",
    source_still: str = "",
) -> dict[str, Any]:
    parsed = _normalize_kind(kind)
    if parsed is None:
        raise ValueError("kind must be character, scene, or prop")
    label = (name or "").strip()
    if not label:
        raise ValueError("Name is required.")
    from app.create import generate
    from app.create_catalog import default_model_for
    from app.create_state import CreateParams, CreateSlots, CreateState

    text = (prompt or "").strip() or default_sheet_prompt(parsed, label, notes)
    src = (source_still or "").strip()
    modality = "i2i" if src and Path(src).is_file() else "t2i"
    mid = (model_id or "").strip()
    if not mid:
        entry = default_model_for("image", modality)
        mid = entry.id if entry else ""
    if not mid:
        raise ValueError("No image model available for a simple sheet.")
    state = CreateState(
        mode="image",
        modality=modality,
        model_id=mid,
        prompt=text,
        slots=CreateSlots(start_still=src if modality == "i2i" else None),
        params=CreateParams(),
        surface="studio",
    )
    result = generate(state)
    if not result.ok:
        raise RuntimeError(
            (result.status or "")
            or (result.errors[0] if result.errors else "Generate failed.")
        )
    paths = list(result.image_paths or []) + list(result.paths or [])
    still = ""
    for p in paths:
        if p and Path(p).is_file() and Path(p).suffix.lower() in _IMAGE_EXTS:
            still = p
            break
    if not still:
        raise RuntimeError("Generate returned no still.")
    return create_asset(
        kind=parsed,
        name=label,
        notes=notes,
        still_paths=[still],
        sheet_path=still,
        model=result.model_key or result.model or mid,
    )


def sheet_model_ok(model_id: str, label: str = "") -> bool:
    blob = f"{model_id} {label}".lower()
    return any(tok in blob for tok in SHEET_MODELS)
