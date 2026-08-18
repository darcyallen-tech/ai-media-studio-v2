"""Library index: Resolve handoff (read-only), uploads, generated outputs."""

from __future__ import annotations

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

UPLOADS_DIR = PROJECT_ROOT / "data" / "uploads"
LIBRARY_DIR = PROJECT_ROOT / "data" / "library"
THUMBS_DIR = LIBRARY_DIR / "thumbs"
GENERATED_INDEX = LIBRARY_DIR / "generated.json"

SKIP_DIR_NAMES = {"_smoke", "__pycache__", "thumbs"}


def ensure_library_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)


def resolve_handoff_dir() -> tuple[Path | None, str | None]:
    """V1 Resolve inbox — read-only. Never write into V1."""
    env = (
        os.environ.get("AI_MEDIA_STUDIO_V1_ROOT")
        or os.environ.get("AI_MEDIA_STUDIO_ROOT")
        or ""
    ).strip()
    candidates: list[Path] = []
    if env:
        root = Path(env)
        candidates.append(root / "data" / "resolve_handoff")
        if root.name == "resolve_handoff":
            candidates.append(root)
    sibling = PROJECT_ROOT.parent / "ai-media-studio" / "data" / "resolve_handoff"
    candidates.append(sibling)
    for path in candidates:
        try:
            if path.is_dir():
                return path.resolve(), None
        except OSError:
            continue
    return None, (
        "No Resolve handoff folder found. V1 writes stills/clips to "
        "ai-media-studio/data/resolve_handoff/. Send from Resolve is Phase 4."
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


def _safe_rel(root: Path, path: Path) -> str | None:
    try:
        rel = path.resolve().relative_to(root.resolve())
    except (OSError, ValueError):
        return None
    text = rel.as_posix()
    if text.startswith("..") or Path(text).is_absolute():
        return None
    return text


def resolve_library_file(source: str, rel: str) -> Path:
    root = _root_for(source)
    if root is None:
        raise FileNotFoundError(f"Unknown or missing library source: {source}")
    raw = (rel or "").replace("\\", "/").lstrip("/")
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
    return None


def allowed_roots() -> list[Path]:
    roots: list[Path] = []
    for src in ("uploads", "generated", "resolve"):
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
    return False


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
        "thumb_url": f"/library/thumb?{q}" if kind == "image" else None,
        "mtime": mtime,
        "size": size,
    }
    if extra:
        row.update(extra)
    return row


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
    items.sort(key=lambda r: float(r.get("mtime") or 0), reverse=True)
    return {"source": src, "note": note, "items": items}


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
    kind = kind_for(src)
    if kind is None:
        raise ValueError(f"Unsupported media type: {src.suffix}")
    name = dest_name or src.name
    safe = Path(name).name
    dest = UPLOADS_DIR / safe
    if dest.exists():
        stem, suffix = dest.stem, dest.suffix
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = UPLOADS_DIR / f"{stem}_{stamp}{suffix}"
    shutil.copy2(src, dest)
    row = _item(source="uploads", path=dest, root=UPLOADS_DIR)
    if row is None:
        raise RuntimeError("Imported file could not be indexed.")
    return row


def write_upload(filename: str, data: bytes) -> dict[str, Any]:
    ensure_library_dirs()
    safe = Path(filename).name or "upload.bin"
    dest = UPLOADS_DIR / safe
    if dest.exists():
        stem, suffix = dest.stem, dest.suffix
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = UPLOADS_DIR / f"{stem}_{stamp}{suffix}"
    dest.write_bytes(data)
    if kind_for(dest) is None:
        dest.unlink(missing_ok=True)
        raise ValueError(f"Unsupported media type: {dest.suffix}")
    row = _item(source="uploads", path=dest, root=UPLOADS_DIR)
    if row is None:
        raise RuntimeError("Imported file could not be indexed.")
    return row


def thumb_path(source: str, rel: str) -> Path:
    src = resolve_library_file(source, rel)
    kind = kind_for(src)
    if kind != "image":
        raise FileNotFoundError("Thumbs are only generated for images.")
    ensure_library_dirs()
    key = f"{source}_{rel}".replace("/", "_").replace("\\", "_")
    cache = THUMBS_DIR / f"{key}.jpg"
    try:
        if cache.is_file() and cache.stat().st_mtime >= src.stat().st_mtime:
            return cache
    except OSError:
        pass
    from PIL import Image

    with Image.open(src) as im:
        im = im.convert("RGB")
        im.thumbnail((320, 320))
        cache.parent.mkdir(parents=True, exist_ok=True)
        im.save(cache, format="JPEG", quality=82, optimize=True)
    return cache


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
