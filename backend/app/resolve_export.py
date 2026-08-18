"""
Send a still or clip to DaVinci Resolve Studio (same muscle as V1).

Tier A: import into Media Pool bin AI Media Studio / <date>,
optional place on the current timeline, optional marker.

Soft-fail: if Resolve is closed or scripting is off, reveal the file
in Explorer and return a clear error. Never crash.
"""

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any


@dataclass
class ResolveSendResult:
    ok: bool
    message: str
    bin_name: str | None = None
    clips: int = 0
    placed_on_timeline: bool = False
    marker_added: bool = False
    fallback_folder: bool = False
    notes: list[str] = field(default_factory=list)


def _ensure_resolve_module_path() -> None:
    candidates: list[Path] = []
    env_api = os.environ.get("RESOLVE_SCRIPT_API") or os.environ.get(
        "RESOLVE_SCRIPT_API_PATH"
    )
    if env_api:
        candidates.append(Path(env_api) / "Modules")
    if sys.platform.startswith("win"):
        program_data = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
        candidates.append(
            Path(program_data)
            / "Blackmagic Design"
            / "DaVinci Resolve"
            / "Support"
            / "Developer"
            / "Scripting"
            / "Modules"
        )
        for base in (
            r"C:\Program Files\Blackmagic Design\DaVinci Resolve",
            r"C:\Program Files\Blackmagic Design\DaVinci Resolve Studio",
        ):
            candidates.append(Path(base) / "Developer" / "Scripting" / "Modules")
        lib = os.environ.get("RESOLVE_SCRIPT_LIB")
        if not lib:
            for dll in (
                r"C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript.dll",
                r"C:\Program Files\Blackmagic Design\DaVinci Resolve Studio\fusionscript.dll",
            ):
                if Path(dll).is_file():
                    os.environ.setdefault("RESOLVE_SCRIPT_LIB", dll)
                    break
    elif sys.platform == "darwin":
        candidates.append(
            Path(
                "/Library/Application Support/Blackmagic Design/DaVinci Resolve/"
                "Developer/Scripting/Modules"
            )
        )
    else:
        candidates.append(Path("/opt/resolve/Developer/Scripting/Modules"))

    for mod in candidates:
        if mod.is_dir():
            s = str(mod.resolve())
            if s not in sys.path:
                sys.path.insert(0, s)


def _connect_resolve() -> tuple[Any | None, str | None]:
    _ensure_resolve_module_path()
    try:
        import DaVinciResolveScript as dvr  # type: ignore
    except ImportError as exc:
        return None, (
            "DaVinciResolveScript not found. Install Resolve Studio, enable "
            "External scripting = Local, and ensure Scripting Modules are on the path. "
            f"({exc})"
        )
    except Exception as exc:
        return None, f"Failed to load DaVinciResolveScript: {exc}"

    try:
        resolve = dvr.scriptapp("Resolve")
    except Exception as exc:
        return None, (
            f"Could not connect to Resolve ({exc}). "
            "Is DaVinci Resolve Studio open with a project loaded? "
            "Preferences → System → General → External scripting must be Local."
        )
    if resolve is None:
        return None, (
            "Resolve is not running or scripting is disabled. "
            "Open Resolve Studio, load a project, set External scripting = Local, then try again."
        )
    return resolve, None


def _safe_bin_segment(name: str, *, max_len: int = 64) -> str:
    raw = (name or "").strip()
    if not raw:
        return date.today().isoformat()
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", raw)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    if not cleaned:
        cleaned = date.today().isoformat()
    return cleaned[:max_len]


def _find_or_create_bin(media_pool: Any, parent_folder: Any, bin_name: str) -> Any:
    try:
        subs = parent_folder.GetSubFolderList() or []
    except Exception:
        subs = []
    for sub in subs:
        try:
            name = sub.GetName()
        except Exception:
            name = None
        if name == bin_name:
            return sub
    create = getattr(media_pool, "AddSubFolder", None)
    if callable(create):
        try:
            folder = create(parent_folder, bin_name)
            if folder:
                return folder
        except Exception:
            pass
    return parent_folder


def _find_or_create_nested(media_pool: Any, root_folder: Any, segments: list[str]) -> Any:
    folder = root_folder
    for seg in segments:
        if seg:
            folder = _find_or_create_bin(media_pool, folder, seg)
    return folder


def _timeline_fps(timeline: Any) -> float:
    try:
        fps = float(timeline.GetSetting("timelineFrameRate"))
        if fps > 1.0:
            return fps
    except Exception:
        pass
    return 24.0


def _timecode_to_frame(tc: str | None, fps: float) -> int | None:
    if not tc:
        return None
    s = str(tc).strip().replace(";", ":")
    parts = s.split(":")
    if len(parts) != 4:
        return None
    try:
        h, m, sec, fr = (int(p) for p in parts)
    except ValueError:
        return None
    return int(round((h * 3600 + m * 60 + sec) * float(fps) + fr))


def _playhead_frame(timeline: Any) -> int | None:
    fps = _timeline_fps(timeline)
    try:
        fr = _timecode_to_frame(timeline.GetCurrentTimecode(), fps)
        if fr is not None:
            return max(0, fr)
    except Exception:
        pass
    return None


def _first_clip(clips: Any) -> Any | None:
    if clips is None:
        return None
    if isinstance(clips, (list, tuple)):
        return clips[0] if clips else None
    return clips


def _append_at_playhead(
    media_pool: Any, timeline: Any, clip: Any, *, track_index: int
) -> bool:
    record = _playhead_frame(timeline)
    try:
        info: dict[str, Any] = {
            "mediaPoolItem": clip,
            "trackIndex": max(1, int(track_index)),
            "mediaType": 1,
        }
        if record is not None:
            info["recordFrame"] = int(record)
        if media_pool.AppendToTimeline([info]):
            return True
    except Exception:
        pass
    try:
        return bool(media_pool.AppendToTimeline([clip]))
    except Exception:
        return False


def _add_markers(
    timeline: Any | None,
    clip: Any | None,
    *,
    note: str,
    record_frame: int | None,
) -> bool:
    added = False
    if timeline is not None:
        try:
            fr = record_frame if record_frame is not None else _playhead_frame(timeline)
            if timeline.AddMarker(int(fr or 0), "Blue", "AI Media Studio", note, 1, ""):
                added = True
        except Exception:
            pass
    if clip is not None:
        try:
            if clip.AddMarker(0, "Blue", "AI Media Studio", note, 1, ""):
                added = True
        except Exception:
            pass
    return added


def send_file_to_resolve(
    path: str | Path | None,
    *,
    job_name: str | None = None,
    model: str | None = None,
    cost: str | None = None,
    place_on_timeline: bool = True,
    add_marker: bool = True,
    video_track: int = 2,
) -> ResolveSendResult:
    if not path or not str(path).strip():
        return ResolveSendResult(ok=False, message="No file path to send.")
    file_path = Path(path).expanduser()
    try:
        file_path = file_path.resolve()
    except OSError as exc:
        return ResolveSendResult(ok=False, message=f"Invalid path: {exc}")
    if not file_path.is_file():
        return ResolveSendResult(ok=False, message=f"File not found: {file_path}")

    abs_path = str(file_path)
    resolve, err = _connect_resolve()
    if err or resolve is None:
        return ResolveSendResult(
            ok=False,
            message=err or "Could not connect to Resolve.",
            fallback_folder=True,
        )

    notes: list[str] = []
    try:
        pm = resolve.GetProjectManager()
        project = pm.GetCurrentProject() if pm else None
        if project is None:
            return ResolveSendResult(
                ok=False,
                message="No project is open in Resolve. Open or create a project, then try again.",
                fallback_folder=True,
            )
        media_pool = project.GetMediaPool()
        root = media_pool.GetRootFolder() if media_pool else None
        if media_pool is None or root is None:
            return ResolveSendResult(
                ok=False,
                message="Could not access the Media Pool.",
                fallback_folder=True,
            )

        leaf = _safe_bin_segment(job_name or date.today().isoformat())
        segments = ["AI Media Studio", leaf]
        display_bin = " / ".join(segments)
        folder = _find_or_create_nested(media_pool, root, segments)
        try:
            media_pool.SetCurrentFolder(folder)
        except Exception:
            pass

        try:
            clips = media_pool.ImportMedia([abs_path])
        except Exception as exc:
            return ResolveSendResult(
                ok=False,
                message=f"Import failed ({exc}).",
                bin_name=display_bin,
                fallback_folder=True,
            )
        if not clips:
            return ResolveSendResult(
                ok=False,
                message=f"Import returned no clips for {file_path.name}.",
                bin_name=display_bin,
                fallback_folder=True,
            )

        n = len(clips) if isinstance(clips, (list, tuple)) else 1
        clip = _first_clip(clips)
        placed = False
        marker_ok = False
        record_fr: int | None = None
        timeline = None
        try:
            timeline = project.GetCurrentTimeline()
        except Exception:
            timeline = None

        if place_on_timeline and timeline is not None and clip is not None:
            record_fr = _playhead_frame(timeline)
            placed = _append_at_playhead(
                media_pool, timeline, clip, track_index=max(1, int(video_track))
            )
            notes.append("timeline V" + str(max(1, int(video_track))) if placed else "timeline place skipped")
        elif place_on_timeline and timeline is None:
            notes.append("no active timeline — Media Pool only")

        if add_marker:
            bits = [b for b in (model, cost, "From AI Media Studio V2") if b]
            note = " · ".join(bits)[:240]
            marker_ok = _add_markers(
                timeline, clip, note=note, record_frame=record_fr
            )
            if marker_ok:
                notes.append(f"marker: {note}")

        msg = f"Sent “{file_path.name}” to Resolve Media Pool → {display_bin}"
        if notes:
            msg += " · " + "; ".join(notes[:4])
        return ResolveSendResult(
            ok=True,
            message=msg,
            bin_name=display_bin,
            clips=int(n),
            placed_on_timeline=placed,
            marker_added=marker_ok,
            notes=notes,
        )
    except Exception as exc:
        return ResolveSendResult(
            ok=False,
            message=(
                f"Resolve scripting error: {exc}. "
                "Confirm Studio is open, a project is loaded, and External scripting = Local."
            ),
            fallback_folder=True,
        )
