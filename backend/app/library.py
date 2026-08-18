"""Library index: Resolve handoff (read-only), uploads, generated outputs."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote

from app.config import OUTPUT_DIR, PROJECT_ROOT

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus"}
RAW_EXTS = {
    ".arw",
    ".cr2",
    ".cr3",
    ".nef",
    ".nrw",
    ".dng",
    ".raf",
    ".orf",
    ".rw2",
    ".pef",
    ".srw",
    ".raw",
    ".rwl",
    ".3fr",
    ".erf",
    ".kdc",
    ".mos",
    ".mef",
    ".mrw",
    ".sr2",
    ".x3f",
}

UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
LIBRARY_DIR = PROJECT_ROOT / "data" / "library"
THUMBS_DIR = LIBRARY_DIR / "thumbs"
GENERATED_INDEX = LIBRARY_DIR / "generated.json"
FLAGS_PATH = LIBRARY_DIR / "flags.json"

SKIP_DIR_NAMES = {"_smoke", "__pycache__", "thumbs", "_aleph_proxies"}

# External stills/clips named in handoff JSON but living outside the inbox.
_RESOLVE_EXT: dict[str, Path] = {}


def ensure_library_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)


def resolve_handoff_dir() -> tuple[Path | None, str | None]:
    """
    Resolve → Studio inbox (read-only). Never write into V1.

    Priority:
      RESOLVE_INBOX / RESOLVE_HANDOFF
      AI_MEDIA_STUDIO_ROOT or AI_MEDIA_STUDIO_V1_ROOT / data/resolve_handoff
      sibling ../ai-media-studio/data/resolve_handoff
    """
    candidates: list[Path] = []
    for key in ("RESOLVE_INBOX", "RESOLVE_HANDOFF"):
        raw = (os.environ.get(key) or "").strip()
        if raw:
            candidates.append(Path(raw).expanduser())
    for key in ("AI_MEDIA_STUDIO_ROOT", "AI_MEDIA_STUDIO_V1_ROOT"):
        raw = (os.environ.get(key) or "").strip()
        if raw:
            root = Path(raw).expanduser()
            candidates.append(root / "data" / "resolve_handoff")
            if root.name == "resolve_handoff":
                candidates.append(root)
    candidates.append(
        PROJECT_ROOT.parent / "ai-media-studio" / "data" / "resolve_handoff"
    )
    for path in candidates:
        try:
            if path.is_dir():
                return path.resolve(), None
        except OSError:
            continue
    return None, (
        "No Resolve inbox found. Set RESOLVE_INBOX or AI_MEDIA_STUDIO_ROOT, "
        "or keep V1 at ../ai-media-studio (data/resolve_handoff)."
    )


def kind_for(path: Path) -> str | None:
    ext = path.suffix.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    if ext in AUDIO_EXTS:
        return "audio"
    return None


def is_raw_ext(path: str | Path) -> bool:
    return Path(path).suffix.lower() in RAW_EXTS


def apply_exif_orientation(path: Path) -> None:
    """Bake EXIF orientation into pixels so thumbs and generate stay upright."""
    if kind_for(path) != "image":
        return
    try:
        from PIL import Image, ImageOps
    except Exception:
        return
    try:
        with Image.open(path) as src:
            orient = 1
            try:
                orient = int(src.getexif().get(0x0112, 1) or 1)
            except Exception:
                orient = 1
            if orient in (0, 1):
                return
            oriented = ImageOps.exif_transpose(src)
            if oriented is None:
                return
            fmt = (src.format or path.suffix.lstrip(".") or "JPEG").upper()
            if fmt == "JPG":
                fmt = "JPEG"
            exif = oriented.getexif()
            if 0x0112 in exif:
                del exif[0x0112]
            save_kw: dict[str, Any] = {}
            if fmt == "JPEG":
                save_kw["quality"] = 95
                save_kw["subsampling"] = 0
            if exif:
                try:
                    save_kw["exif"] = exif.tobytes()
                except Exception:
                    pass
            out = oriented.copy()
        out.save(path, format=fmt, **save_kw)
        out.close()
    except Exception:
        return


def _safe_rel(root: Path, path: Path) -> str | None:
    try:
        rel = path.resolve().relative_to(root.resolve())
    except (OSError, ValueError):
        return None
    text = rel.as_posix()
    if text.startswith("..") or Path(text).is_absolute():
        return None
    return text


def _ext_token(path: Path) -> str:
    digest = hashlib.sha1(str(path.resolve()).encode("utf-8", "replace")).hexdigest()[:16]
    return f"ext/{digest}{path.suffix.lower()}"


def _refresh_resolve_ext() -> None:
    _RESOLVE_EXT.clear()
    inbox, _ = resolve_handoff_dir()
    if inbox is None:
        return
    jsons = [inbox / "latest.json", *inbox.glob("handoff_*.json")]
    for js in jsons:
        if not js.is_file():
            continue
        try:
            data = json.loads(js.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict):
            continue
        for key in ("still_path", "video_path"):
            raw = data.get(key)
            if not raw:
                continue
            p = Path(str(raw))
            try:
                if not p.is_file():
                    continue
                if _safe_rel(inbox, p):
                    continue
                _RESOLVE_EXT[_ext_token(p)] = p.resolve()
            except OSError:
                continue


def resolve_library_file(source: str, rel: str) -> Path:
    raw = (rel or "").replace("\\", "/").lstrip("/")
    if raw.startswith("ext/"):
        if raw not in _RESOLVE_EXT:
            _refresh_resolve_ext()
        hit = _RESOLVE_EXT.get(raw)
        if hit is None or not hit.is_file():
            raise FileNotFoundError(f"File not found: {rel}")
        return hit
    root = _root_for(source)
    if root is None:
        raise FileNotFoundError(f"Unknown or missing library source: {source}")
    if not raw or ".." in Path(raw).parts:
        raise FileNotFoundError("Invalid library path.")
    path = (root / raw).resolve()
    if not _safe_rel(root, path) or not path.is_file():
        raise FileNotFoundError(f"File not found: {rel}")
    return path


def _root_for(source: str) -> Path | None:
    src = (source or "").strip().lower()
    if src == "uploads":
        ensure_library_dirs()
        return UPLOADS_DIR.resolve()
    if src == "generated":
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        return OUTPUT_DIR.resolve()
    if src == "resolve":
        handoff, _ = resolve_handoff_dir()
        return handoff
    if src == "assets":
        from app.assets import ASSETS_DIR, ensure_assets_dir

        ensure_assets_dir()
        return ASSETS_DIR.resolve()
    return None


def allowed_roots() -> list[Path]:
    roots: list[Path] = []
    for src in ("uploads", "generated", "resolve", "assets"):
        root = _root_for(src)
        if root is not None:
            roots.append(root)
    return roots


def is_allowed_path(path: str | Path) -> bool:
    try:
        resolved = Path(path).resolve()
    except OSError:
        return False
    if not resolved.is_file() and not resolved.is_dir():
        return False
    for root in allowed_roots():
        try:
            resolved.relative_to(root)
            return True
        except ValueError:
            continue
    _refresh_resolve_ext()
    return any(resolved == p for p in _RESOLVE_EXT.values())


def _item(
    *,
    source: str,
    path: Path,
    root: Path,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    kind = kind_for(path)
    if kind is None:
        return None
    rel = _safe_rel(root, path)
    if not rel:
        return None
    try:
        stat = path.stat()
        mtime = stat.st_mtime
        size = stat.st_size
    except OSError:
        return None
    q = f"source={quote(source)}&rel={quote(rel)}"
    row: dict[str, Any] = {
        "id": f"{source}:{rel}",
        "name": path.name,
        "source": source,
        "kind": kind,
        "path": str(path),
        "rel": rel,
        "url": f"/library/file?{q}",
        "thumb_url": f"/library/thumb?{q}" if kind in ("image", "video") else None,
        "mtime": mtime,
        "size": size,
    }
    if extra:
        row.update(extra)
    return row


def _item_with_rel(*, source: str, path: Path, rel: str) -> dict[str, Any] | None:
    kind = kind_for(path)
    if kind is None:
        return None
    try:
        stat = path.stat()
    except OSError:
        return None
    q = f"source={quote(source)}&rel={quote(rel)}"
    return {
        "id": f"{source}:{rel}",
        "name": path.name,
        "source": source,
        "kind": kind,
        "path": str(path),
        "rel": rel,
        "url": f"/library/file?{q}",
        "thumb_url": f"/library/thumb?{q}" if kind in ("image", "video") else None,
        "mtime": stat.st_mtime,
        "size": stat.st_size,
    }


def _iter_media(root: Path) -> Iterable[Path]:
    if not root.is_dir():
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES and not d.startswith(".")]
        for name in filenames:
            if name.startswith(".") or name in {".gitkeep", "history.json"}:
                continue
            if name.endswith(".json") and name.startswith("job_"):
                continue
            yield Path(dirpath) / name


def _load_generated_meta() -> dict[str, dict[str, Any]]:
    if not GENERATED_INDEX.is_file():
        return {}
    try:
        raw = json.loads(GENERATED_INDEX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(raw, list):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in raw:
        if isinstance(row, dict) and row.get("path"):
            out[str(row["path"])] = row
    return out


def record_generated(
    paths: list[str],
    *,
    cost: str = "",
    duration_sec: float | None = None,
    model: str = "",
) -> None:
    ensure_library_dirs()
    existing = list(_load_generated_meta().values())
    now = datetime.now(timezone.utc).isoformat()
    by_path = {str(r.get("path")): r for r in existing}
    for raw in paths:
        p = Path(raw)
        if not p.is_file():
            continue
        by_path[str(p.resolve())] = {
            "path": str(p.resolve()),
            "cost": cost,
            "duration_sec": duration_sec,
            "model": model,
            "created": now,
        }
    rows = list(by_path.values())
    rows.sort(key=lambda r: str(r.get("created") or ""), reverse=True)
    GENERATED_INDEX.write_text(
        json.dumps(rows[:400], indent=2) + "\n",
        encoding="utf-8",
    )


def list_source(source: str, media_type: str | None = None) -> dict[str, Any]:
    src = (source or "").strip().lower()
    want = (media_type or "").strip().lower() or None
    if want == "all":
        want = None
    note: str | None = None
    root: Path | None
    if src == "resolve":
        root, note = resolve_handoff_dir()
        _refresh_resolve_ext()
    else:
        root = _root_for(src)
        if root is None:
            return {"source": src, "note": f"Unknown source: {src}", "items": []}
    items: list[dict[str, Any]] = []
    if root is None:
        return {"source": src, "note": note, "items": []}
    meta = _load_generated_meta() if src == "generated" else {}
    for path in _iter_media(root):
        extra = meta.get(str(path.resolve()))
        row = _item(source=src, path=path, root=root, extra=extra)
        if row is None:
            continue
        if want and row["kind"] != want:
            continue
        items.append(row)
    if src == "resolve":
        seen = {str(Path(i["path"]).resolve()) for i in items}
        for token, path in _RESOLVE_EXT.items():
            if str(path) in seen:
                continue
            row = _item_with_rel(source="resolve", path=path, rel=token)
            if row is None:
                continue
            if want and row["kind"] != want:
                continue
            items.append(row)
    flags = load_flags()
    hidden = flags["hidden"]
    pinned = flags["pinned"]
    visible: list[dict[str, Any]] = []
    for row in items:
        iid = str(row.get("id") or "")
        if iid in hidden:
            continue
        row["pinned"] = iid in pinned
        visible.append(row)
    visible.sort(key=lambda r: float(r.get("mtime") or 0), reverse=True)
    return {"source": src, "note": note, "items": visible}


def list_library(media_type: str | None = None) -> dict[str, Any]:
    return {
        "type": media_type or "all",
        "resolve": list_source("resolve", media_type),
        "uploads": list_source("uploads", media_type),
        "generated": list_source("generated", media_type),
    }


def import_upload(src: Path, *, dest_name: str | None = None) -> dict[str, Any]:
    ensure_library_dirs()
    if not src.is_file():
        raise FileNotFoundError(f"Not a file: {src}")
    if is_raw_ext(src):
        raise ValueError("Unsupported format")
    kind = kind_for(src)
    if kind is None:
        raise ValueError("Unsupported format")
    name = dest_name or src.name
    safe = Path(name).name
    dest = UPLOADS_DIR / safe
    if dest.exists():
        stem, suffix = dest.stem, dest.suffix
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = UPLOADS_DIR / f"{stem}_{stamp}{suffix}"
    shutil.copy2(src, dest)
    apply_exif_orientation(dest)
    row = _item(source="uploads", path=dest, root=UPLOADS_DIR)
    if row is None:
        raise RuntimeError("Imported file could not be indexed.")
    return row


def write_upload(filename: str, data: bytes) -> dict[str, Any]:
    ensure_library_dirs()
    safe = Path(filename).name or "upload.bin"
    if is_raw_ext(safe) or kind_for(Path(safe)) is None:
        raise ValueError("Unsupported format")
    dest = UPLOADS_DIR / safe
    if dest.exists():
        stem, suffix = dest.stem, dest.suffix
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = UPLOADS_DIR / f"{stem}_{stamp}{suffix}"
    dest.write_bytes(data)
    apply_exif_orientation(dest)
    row = _item(source="uploads", path=dest, root=UPLOADS_DIR)
    if row is None:
        raise RuntimeError("Imported file could not be indexed.")
    return row


def thumb_path(source: str, rel: str) -> Path:
    src = resolve_library_file(source, rel)
    kind = kind_for(src)
    if kind not in ("image", "video"):
        raise FileNotFoundError("Thumbs are only generated for images and video.")
    ensure_library_dirs()
    key = f"{source}_{rel}".replace("/", "_").replace("\\", "_")
    cache = THUMBS_DIR / f"{key}.jpg"
    try:
        if cache.is_file() and cache.stat().st_mtime >= src.stat().st_mtime:
            return cache
    except OSError:
        pass
    cache.parent.mkdir(parents=True, exist_ok=True)
    if kind == "video":
        _video_thumb(src, cache)
        return cache
    from PIL import Image, ImageOps

    with Image.open(src) as im:
        try:
            im = ImageOps.exif_transpose(im) or im
        except Exception:
            pass
        im = im.convert("RGB")
        im.thumbnail((320, 320))
        im.save(cache, format="JPEG", quality=82, optimize=True)
    return cache


def _video_thumb(src: Path, dest: Path) -> None:
    import cv2

    cap = cv2.VideoCapture(str(src))
    try:
        ok, frame = cap.read()
        if not ok or frame is None:
            raise FileNotFoundError(f"Could not read video frame: {src.name}")
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        from PIL import Image

        im = Image.fromarray(frame)
        im.thumbnail((320, 320))
        im.save(dest, format="JPEG", quality=82, optimize=True)
    finally:
        cap.release()


def inbox_status() -> dict[str, Any]:
    inbox, note = resolve_handoff_dir()
    listed = list_source("resolve")
    stills = sum(1 for i in listed["items"] if i["kind"] == "image")
    videos = sum(1 for i in listed["items"] if i["kind"] == "video")
    return {
        "inbox": str(inbox) if inbox else None,
        "note": note,
        "stills": stills,
        "videos": videos,
        "items": len(listed["items"]),
    }


def reveal_in_folder(path: str | Path) -> None:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(str(p))
    if not is_allowed_path(p if p.is_file() else p):
        # allow the parent of an allowed file
        if not (p.is_file() and is_allowed_path(p)):
            raise PermissionError("Path is outside the library roots.")
    target = str(p.resolve())
    if sys.platform.startswith("win"):
        subprocess.Popen(["explorer", f"/select,{target}"])
        return
    if sys.platform == "darwin":
        subprocess.Popen(["open", "-R", target])
        return
    folder = str(p.parent if p.is_file() else p)
    subprocess.Popen(["xdg-open", folder])


def item_id_for(source: str, rel: str) -> str:
    return f"{source}:{rel}"


def parse_item_id(item_id: str) -> tuple[str, str]:
    raw = (item_id or "").strip()
    if ":" not in raw:
        raise ValueError("Invalid library id.")
    source, rel = raw.split(":", 1)
    src = source.strip().lower()
    if src not in ("resolve", "uploads", "generated"):
        raise ValueError("Invalid library source.")
    if not rel.strip():
        raise ValueError("Invalid library path.")
    return src, rel.strip()


def load_flags() -> dict[str, set[str]]:
    if not FLAGS_PATH.is_file():
        return {"pinned": set(), "hidden": set()}
    try:
        raw = json.loads(FLAGS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"pinned": set(), "hidden": set()}
    if not isinstance(raw, dict):
        return {"pinned": set(), "hidden": set()}

    def _set(key: str) -> set[str]:
        vals = raw.get(key) or []
        if not isinstance(vals, list):
            return set()
        return {str(v) for v in vals if str(v).strip()}

    return {"pinned": _set("pinned"), "hidden": _set("hidden")}


def save_flags(*, pinned: set[str] | None = None, hidden: set[str] | None = None) -> dict[str, set[str]]:
    current = load_flags()
    if pinned is not None:
        current["pinned"] = set(pinned)
    if hidden is not None:
        current["hidden"] = set(hidden)
    ensure_library_dirs()
    FLAGS_PATH.write_text(
        json.dumps(
            {
                "pinned": sorted(current["pinned"]),
                "hidden": sorted(current["hidden"]),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return current


def _remove_generated_meta(path: Path) -> None:
    try:
        key = str(path.resolve())
    except OSError:
        key = str(path)
    rows = [r for r in _load_generated_meta().values() if str(r.get("path")) != key]
    try:
        GENERATED_INDEX.write_text(json.dumps(rows[:400], indent=2) + "\n", encoding="utf-8")
    except OSError:
        pass


def delete_library_item(item_id: str, *, delete_file: bool = False) -> dict[str, Any]:
    source, rel = parse_item_id(item_id)
    flags = load_flags()
    flags["hidden"].add(item_id)
    flags["pinned"].discard(item_id)
    deleted_file = False
    if source == "resolve":
        save_flags(pinned=flags["pinned"], hidden=flags["hidden"])
        return {
            "ok": True,
            "id": item_id,
            "deleted_file": False,
            "index_only": True,
        }
    path: Path | None = None
    try:
        path = resolve_library_file(source, rel)
    except FileNotFoundError:
        path = None
    if delete_file and path is not None and path.is_file():
        try:
            path.unlink()
            deleted_file = True
            flags["hidden"].discard(item_id)
        except OSError as exc:
            save_flags(pinned=flags["pinned"], hidden=flags["hidden"])
            raise OSError(f"Could not delete file: {exc}") from exc
        if source == "generated":
            _remove_generated_meta(path)
    save_flags(pinned=flags["pinned"], hidden=flags["hidden"])
    return {
        "ok": True,
        "id": item_id,
        "deleted_file": deleted_file,
        "index_only": not deleted_file,
    }


def set_pinned(item_id: str, pinned: bool) -> dict[str, Any]:
    source, rel = parse_item_id(item_id)
    try:
        resolve_library_file(source, rel)
    except FileNotFoundError:
        # Resolve ext tokens and hidden-but-present ids still pin
        if source != "resolve":
            raise
    flags = load_flags()
    if pinned:
        flags["pinned"].add(item_id)
        flags["hidden"].discard(item_id)
    else:
        flags["pinned"].discard(item_id)
    save_flags(pinned=flags["pinned"], hidden=flags["hidden"])
    return {"ok": True, "id": item_id, "pinned": bool(pinned)}


def purge_expired(*, now: float | None = None) -> dict[str, Any]:
    """Delete unpinned Uploads + Generated older than retention_days. Never Resolve."""
    from app.prefs import retention_days

    days = retention_days()
    if days <= 0:
        return {"ok": True, "purged": 0, "retention_days": 0, "skipped": "off"}
    import time as _time

    cutoff = (now if now is not None else _time.time()) - days * 86400
    pinned = load_flags()["pinned"]
    removed = 0
    for src in ("uploads", "generated"):
        listed = list_source(src)
        for row in listed.get("items") or []:
            iid = str(row.get("id") or "")
            if not iid or iid in pinned or row.get("pinned"):
                continue
            try:
                mtime = float(row.get("mtime") or 0)
            except (TypeError, ValueError):
                continue
            if mtime >= cutoff:
                continue
            path = Path(str(row.get("path") or ""))
            if not path.is_file():
                continue
            try:
                path.unlink()
                removed += 1
                if src == "generated":
                    _remove_generated_meta(path)
            except OSError:
                continue
    return {"ok": True, "purged": removed, "retention_days": days}
