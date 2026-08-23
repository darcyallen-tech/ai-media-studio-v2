"""V2-owned Character / Scene / Prop / Costume store. Never writes V1 data."""

from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from app.config import PROJECT_ROOT

Kind = Literal["character", "scene", "prop", "costume"]
KINDS: tuple[Kind, ...] = ("character", "scene", "prop", "costume")

ASSETS_DIR = PROJECT_ROOT / "data" / "assets"
ASSETS_INDEX = ASSETS_DIR / "assets.json"
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
_MAX_STILLS = {"character": 8, "scene": 3, "prop": 1, "costume": 8}
IDENTITY_SLOTS: tuple[str, ...] = (
    "front",
    "side",
    "closeup",
    "back",
    "threequarter_front",
    "threequarter_back",
    "top",
    "sheet",
)

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
    if k in ("costume", "costumes", "outfit", "outfits"):
        return "costume"
    return None


def _still_list(row: dict[str, Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def add(raw: str | None) -> None:
        p = str(raw or "").strip()
        if not p:
            return
        key = p.lower()
        if key in seen:
            return
        seen.add(key)
        out.append(p)

    ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    for slot in IDENTITY_SLOTS:
        add(str(ident.get(slot) or ""))
    add(str(row.get("sheet_path") or ""))
    add(str(row.get("still_path") or ""))
    raw = row.get("still_paths")
    extras = raw if isinstance(raw, list) else []
    for item in extras:
        add(str(item or ""))
    return [p for p in out if Path(p).is_file()]


def primary_still_path(row: dict[str, Any]) -> str:
    ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    slot = _primary_slot_name(row)
    for key in (slot, "front"):
        p = str(ident.get(key) or "").strip()
        if p and Path(p).is_file():
            return p
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


def _primary_slot_name(row: dict[str, Any]) -> str:
    raw = str(row.get("primary_slot") or "front").strip().lower()
    return raw if raw in IDENTITY_SLOTS else "front"


def _parent_name(parent_id: str) -> str:
    if not parent_id:
        return ""
    for row in _load_index():
        if str(row.get("id") or "") == parent_id:
            return str(row.get("name") or "").strip()
    return ""


def _to_public(row: dict[str, Any]) -> dict[str, Any]:
    kind = str(row.get("kind") or "character")
    aid = str(row.get("id") or "")
    stills = _still_list(row)
    ident_raw = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    identity: dict[str, str] = {}
    identity_urls: dict[str, str] = {}
    for slot in IDENTITY_SLOTS:
        p = str(ident_raw.get(slot) or "").strip()
        if p and Path(p).is_file():
            identity[slot] = p
            identity_urls[slot] = f"/assets/{aid}/still?slot={slot}"
    primary_slot = _primary_slot_name(row)
    primary = identity.get(primary_slot) or identity.get("front") or (stills[0] if stills else "")
    url = f"/assets/{aid}/still" if primary else None
    parent_id = str(row.get("parent_id") or "").strip() or None
    name = str(row.get("name") or "").strip() or "Untitled"
    parent = _parent_name(parent_id) if parent_id else ""
    is_costume = kind == "costume"
    is_variant = kind == "character" and bool(parent_id)
    label = f"{parent} / {name}" if parent and is_variant else name
    thumb = identity_urls.get(primary_slot) or identity_urls.get("front") or url
    return {
        "id": aid,
        "name": name,
        "label": label,
        "notes": str(row.get("notes") or "").strip(),
        "kind": kind,
        "still_path": primary or None,
        "still_paths": stills,
        "sheet_path": str(row.get("sheet_path") or identity.get("front") or "").strip() or None,
        "has_still": bool(primary),
        "url": url,
        "thumb_url": thumb,
        "owned": True,
        "created": row.get("created"),
        "updated": row.get("updated"),
        "model": str(row.get("model") or ""),
        "parent_id": parent_id,
        "is_costume": is_costume,
        "is_variant": is_variant,
        "primary_slot": primary_slot,
        "identity": identity,
        "identity_urls": identity_urls,
        "fields": row.get("fields") if isinstance(row.get("fields"), dict) else {},
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
    return _group_character_variants(out)


def _group_character_variants(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep dress variants immediately under their parent character."""
    kids: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        if str(row.get("kind") or "") != "character":
            continue
        parent = str(row.get("parent_id") or "").strip()
        if parent:
            kids.setdefault(parent, []).append(row)
    if not kids:
        return rows
    grouped: list[dict[str, Any]] = []
    for row in rows:
        if str(row.get("kind") or "") == "character" and str(row.get("parent_id") or "").strip():
            continue
        grouped.append(row)
        if str(row.get("kind") or "") == "character":
            grouped.extend(kids.pop(str(row.get("id") or ""), []))
    for leftover in kids.values():
        grouped.extend(leftover)
    return grouped


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
    parent_id: str = "",
    fields: dict[str, Any] | None = None,
    identity: dict[str, str] | None = None,
) -> dict[str, Any]:
    parsed = _normalize_kind(kind)
    if parsed is None:
        raise ValueError("kind must be character, scene, prop, or costume")
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
    ident: dict[str, str] = {}
    if identity:
        for slot, raw in identity.items():
            p = str(raw or "").strip()
            if p and Path(p).is_file():
                ident[str(slot)] = p
    if saved and "front" not in ident:
        ident["front"] = saved[0]
    parent = (parent_id or "").strip()
    if parent:
        prow = get_asset(parent)
        if not prow:
            raise ValueError("Parent character not found.")
        if _normalize_kind(str(prow.get("kind") or "")) != "character":
            raise ValueError("Dress variants must attach to a Character.")
    row = {
        "id": aid,
        "kind": parsed,
        "name": label,
        "notes": (notes or "").strip(),
        "still_paths": saved,
        "sheet_path": sheet or ident.get("front", ""),
        "model": (model or "").strip(),
        "created": _now(),
        "updated": _now(),
        "parent_id": parent or None,
        "primary_slot": "front",
        "fields": dict(fields or {}),
        "identity": ident,
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
    children = [r for r in keep if str(r.get("parent_id") or "") == key]
    keep = [r for r in keep if str(r.get("parent_id") or "") != key]
    _write_index(keep)
    kind = _normalize_kind(str(found.get("kind") or ""))
    if kind:
        folder = _folder(kind, key)
        if folder.is_dir():
            shutil.rmtree(folder, ignore_errors=True)
    for child in children:
        cid = str(child.get("id") or "")
        ck = _normalize_kind(str(child.get("kind") or ""))
        if cid and ck:
            folder = _folder(ck, cid)
            if folder.is_dir():
                shutil.rmtree(folder, ignore_errors=True)
    return True


def _apply_sheet_or_primary(
    found: dict[str, Any],
    ident: dict[str, Any],
    stills: list[str],
    key: str,
    dest: Path,
) -> None:
    """Store a still. Sheet slot is saved but does not steal primary until Confirm."""
    if key == "sheet":
        found["sheet_path"] = str(dest)
        if _primary_slot_name(found) == "sheet":
            found["still_path"] = str(dest)
        else:
            primary = _primary_slot_name(found)
            found["still_path"] = (
                ident.get(primary) or ident.get("front") or (stills[0] if stills else str(dest))
            )
        return
    primary = _primary_slot_name(found)
    found["still_path"] = ident.get(primary) or ident.get("front") or (stills[0] if stills else "")
    if primary == key or (primary == "front" and key == "front" and not ident.get("sheet")):
        found["sheet_path"] = str(ident.get(primary) or dest)


def attach_identity_still(
    asset_id: str,
    slot: str,
    src: str,
    *,
    model: str = "",
) -> dict[str, Any]:
    key = (slot or "").strip().lower()
    if key not in IDENTITY_SLOTS:
        raise ValueError(f"Unknown identity slot: {slot}")
    src_path = Path(src)
    if not src_path.is_file():
        raise ValueError("Still file not found.")
    rows = _load_index()
    found: dict[str, Any] | None = None
    for row in rows:
        if str(row.get("id") or "") == asset_id:
            found = row
            break
    if found is None:
        raise ValueError("Asset not found.")
    kind = _normalize_kind(str(found.get("kind") or ""))
    if kind is None:
        raise ValueError("Invalid asset kind.")
    dest = _copy_still(kind, asset_id, src_path, IDENTITY_SLOTS.index(key) + 1)
    ident = found.get("identity") if isinstance(found.get("identity"), dict) else {}
    ident[key] = str(dest)
    found["identity"] = ident
    stills = _still_list(found)
    found["still_paths"] = stills
    _apply_sheet_or_primary(found, ident, stills, key, dest)
    if model:
        found["model"] = model
    found["updated"] = _now()
    _write_index(rows)
    return _to_public(found)


def attach_identity_bytes(
    asset_id: str,
    slot: str,
    filename: str,
    data: bytes,
    *,
    model: str = "",
) -> dict[str, Any]:
    key = (slot or "").strip().lower()
    if key not in IDENTITY_SLOTS:
        raise ValueError(f"Unknown identity slot: {slot}")
    if not data:
        raise ValueError("Empty upload.")
    rows = _load_index()
    found: dict[str, Any] | None = None
    for row in rows:
        if str(row.get("id") or "") == asset_id:
            found = row
            break
    if found is None:
        raise ValueError("Asset not found.")
    kind = _normalize_kind(str(found.get("kind") or ""))
    if kind is None:
        raise ValueError("Invalid asset kind.")
    dest = _write_still_bytes(kind, asset_id, filename or f"{key}.png", data, IDENTITY_SLOTS.index(key) + 1)
    ident = found.get("identity") if isinstance(found.get("identity"), dict) else {}
    ident[key] = str(dest)
    found["identity"] = ident
    stills = _still_list(found)
    found["still_paths"] = stills
    _apply_sheet_or_primary(found, ident, stills, key, dest)
    if model:
        found["model"] = model
    found["updated"] = _now()
    _write_index(rows)
    return _to_public(found)


def update_asset(
    asset_id: str,
    *,
    name: str | None = None,
    notes: str | None = None,
    fields: dict[str, Any] | None = None,
    primary_slot: str | None = None,
) -> dict[str, Any]:
    key = (asset_id or "").strip()
    rows = _load_index()
    found: dict[str, Any] | None = None
    for row in rows:
        if str(row.get("id") or "") == key:
            found = row
            break
    if found is None:
        raise ValueError("Asset not found.")
    if name is not None:
        label = name.strip()
        if not label:
            raise ValueError("Name is required.")
        found["name"] = label
    if notes is not None:
        found["notes"] = notes.strip()
    if fields is not None:
        cur = found.get("fields") if isinstance(found.get("fields"), dict) else {}
        merged = dict(cur)
        merged.update({str(k): v for k, v in fields.items()})
        found["fields"] = merged
    if primary_slot is not None:
        slot = primary_slot.strip().lower()
        if slot not in IDENTITY_SLOTS:
            raise ValueError(f"Unknown identity slot: {primary_slot}")
        ident = found.get("identity") if isinstance(found.get("identity"), dict) else {}
        if not ident.get(slot):
            raise ValueError(f"No still on {slot} to set as primary.")
        found["primary_slot"] = slot
        found["still_path"] = ident[slot]
        found["sheet_path"] = ident[slot]
    found["updated"] = _now()
    _write_index(rows)
    return _to_public(found)


def save_sheet(
    asset_id: str,
    *,
    name: str = "",
    notes: str = "",
    fields: dict[str, Any] | None = None,
    require_front: bool = True,
) -> dict[str, Any]:
    row = get_asset(asset_id)
    if not row:
        raise ValueError("Asset not found.")
    ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    front = str(ident.get("front") or "").strip()
    sheet = str(ident.get("sheet") or row.get("sheet_path") or "").strip()
    if require_front and not (
        (front and Path(front).is_file()) or (sheet and Path(sheet).is_file())
    ):
        raise ValueError("Front still or sheet is required to save.")
    return update_asset(
        asset_id,
        name=name or None,
        notes=notes if notes is not None else None,
        fields=fields,
    )


def public_asset(asset_id: str) -> dict[str, Any] | None:
    row = get_asset(asset_id)
    if not row:
        return None
    return _to_public(row)


def resolve_asset_still(asset_id: str, slot: str | None = None) -> Path | None:
    row = get_asset(asset_id)
    if not row:
        return None
    ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    want = (slot or "").strip().lower()
    if not want:
        want = _primary_slot_name(row)
    if want and want in ident:
        path = str(ident.get(want) or "").strip()
    else:
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
    elif kind == "costume":
        core = (
            f"Costume / wardrobe plate of {name} on a faceless mannequin, "
            "full garment visible, studio lighting, no face, no identity, photoreal, no text."
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
        raise ValueError("kind must be character, scene, prop, or costume")
    label = (name or "").strip()
    if not label:
        raise ValueError("Name is required.")
    from app.config import OUTPUT_DIR
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
        output_dir=OUTPUT_DIR,
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
