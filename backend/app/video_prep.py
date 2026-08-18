"""
Local Aleph input prep: downscale to 1080p-class, trim to 2–30s, re-encode if huge.

Does not modify the original. Writes a temp proxy under outputs/_aleph_proxies.
"""

from __future__ import annotations

import hashlib
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import OUTPUT_DIR, ensure_output_dir
from app.media import is_video_path
from app.runware_client import ALEPH_MAX_DURATION_S, ALEPH_MIN_DURATION_S

# Same 1080p-class box as V1 Frame Editor
_MAX_LONG = 1920
_MAX_SHORT = 1080
_MAX_UPLOAD_MB = 95.0
PROXY_DIRNAME = "_aleph_proxies"


@dataclass
class PrepResult:
    ok: bool
    path: str | None = None
    status: str = ""
    used_proxy: bool = False
    duration_s: float | None = None
    width: int = 0
    height: int = 0
    notes: list[str] | None = None


def _even(n: int) -> int:
    n = max(2, int(n))
    return n - (n % 2)


def fit_1080p_dims(width: int, height: int) -> tuple[int, int] | None:
    w, h = int(width), int(height)
    if w <= 0 or h <= 0:
        return None
    if h >= w:
        box_w, box_h = _MAX_SHORT, _MAX_LONG
    else:
        box_w, box_h = _MAX_LONG, _MAX_SHORT
    if w <= box_w and h <= box_h and max(w, h) <= _MAX_LONG:
        return None
    scale = min(box_w / w, box_h / h, 1.0)
    if scale >= 0.999:
        return None
    tw, th = _even(round(w * scale)), _even(round(h * scale))
    if tw < 2 or th < 2 or (tw >= w and th >= h):
        return None
    return tw, th


def probe_clip(path: Path) -> dict[str, Any]:
    import cv2

    meta: dict[str, Any] = {
        "width": 0,
        "height": 0,
        "fps": 0.0,
        "duration": None,
        "size_mb": 0.0,
    }
    try:
        meta["size_mb"] = path.stat().st_size / (1024 * 1024)
    except OSError:
        pass
    cap = cv2.VideoCapture(str(path))
    try:
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frames = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0)
        meta["width"] = w
        meta["height"] = h
        meta["fps"] = fps
        if fps > 0 and frames > 0:
            meta["duration"] = round(frames / fps, 3)
    finally:
        cap.release()
    return meta


def _proxy_dir(output_dir: str | Path | None) -> Path:
    root = ensure_output_dir(Path(output_dir) if output_dir else OUTPUT_DIR)
    dest = root / PROXY_DIRNAME
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def _proxy_path(src: Path, output_dir: str | Path | None, tag: str) -> Path:
    try:
        st = src.stat()
        raw = f"{src.resolve()}|{st.st_size}|{int(st.st_mtime)}|{tag}"
    except OSError:
        raw = f"{src}|{tag}"
    fp = hashlib.sha1(raw.encode("utf-8", errors="replace")).hexdigest()[:16]
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in src.stem)[:48]
    return _proxy_dir(output_dir) / f"{safe}_{fp}.mp4"


def _find_ffmpeg() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    for cand in (
        Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
        Path(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"),
    ):
        if cand.is_file():
            return str(cand)
    return None


def _ffmpeg_prep(
    src: Path,
    dest: Path,
    *,
    tw: int,
    th: int,
    max_s: float,
    scale: bool,
    trim: bool,
) -> bool:
    exe = _find_ffmpeg()
    if not exe:
        return False
    args = [exe, "-y", "-hide_banner", "-loglevel", "error"]
    if trim:
        args += ["-t", f"{max_s:.2f}"]
    args += ["-i", str(src)]
    vf: list[str] = []
    if scale:
        vf.append(f"scale={tw}:{th}:flags=lanczos")
    if vf:
        args += ["-vf", ",".join(vf)]
    args += [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.TimeoutExpired):
        return False
    return proc.returncode == 0 and dest.is_file() and dest.stat().st_size > 10_000


def _opencv_prep(
    src: Path,
    dest: Path,
    *,
    tw: int,
    th: int,
    max_s: float,
    scale: bool,
    trim: bool,
) -> bool:
    import cv2

    cap = cv2.VideoCapture(str(src))
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 24.0)
        if fps <= 1:
            fps = 24.0
        ow = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or tw)
        oh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or th)
        out_w, out_h = (tw, th) if scale else (_even(ow), _even(oh))
        max_frames = int(max_s * fps) + 1 if trim else 10_000_000
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(dest), fourcc, fps, (out_w, out_h))
        if not writer.isOpened():
            return False
        n = 0
        try:
            while n < max_frames:
                ok, frame = cap.read()
                if not ok or frame is None:
                    break
                if scale and (frame.shape[1] != out_w or frame.shape[0] != out_h):
                    frame = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA)
                writer.write(frame)
                n += 1
        finally:
            writer.release()
        return n > 0 and dest.is_file() and dest.stat().st_size > 10_000
    finally:
        cap.release()


def prepare_aleph_source(
    video_path: str | None,
    *,
    output_dir: str | Path | None = None,
) -> PrepResult:
    """
    Return a path Aleph can ingest. Original is never overwritten.

    Auto-trims to 30s, downscales above 1080p-class, re-encodes huge files.
    Fails clearly if the clip is shorter than 2s or still unusable after prep.
    """
    if not video_path:
        return PrepResult(ok=False, status="Attach a Source video for Frame edit.")
    src = Path(video_path)
    if not src.is_file() or not is_video_path(src):
        return PrepResult(ok=False, status="Source must be a video clip, not a still.")

    meta = probe_clip(src)
    dur = meta.get("duration")
    w, h = int(meta.get("width") or 0), int(meta.get("height") or 0)
    size_mb = float(meta.get("size_mb") or 0.0)
    notes: list[str] = []

    if dur is not None and dur + 0.05 < ALEPH_MIN_DURATION_S:
        return PrepResult(
            ok=False,
            status=(
                f"Aleph needs about {ALEPH_MIN_DURATION_S:.0f}–{ALEPH_MAX_DURATION_S:.0f}s "
                f"(yours is {dur:.1f}s). Use a longer clip."
            ),
            duration_s=dur,
            width=w,
            height=h,
        )

    need_trim = bool(dur is not None and dur > ALEPH_MAX_DURATION_S + 0.25)
    fitted = fit_1080p_dims(w, h) if w and h else None
    need_scale = fitted is not None
    tw, th = fitted if fitted else (w or 1280, h or 720)
    need_reencode = size_mb > _MAX_UPLOAD_MB

    if not need_trim and not need_scale and not need_reencode:
        return PrepResult(
            ok=True,
            path=str(src.resolve()),
            status="Clip already within Aleph limits.",
            used_proxy=False,
            duration_s=dur,
            width=w,
            height=h,
        )

    if need_trim:
        notes.append(f"trim to {ALEPH_MAX_DURATION_S:.0f}s")
    if need_scale:
        notes.append(f"downscale {w}×{h} → {tw}×{th}")
    if need_reencode:
        notes.append(f"re-encode {size_mb:.0f} MB")

    tag = f"{tw}x{th}_{int(ALEPH_MAX_DURATION_S) if need_trim else 'full'}"
    dest = _proxy_path(src, output_dir, tag)
    if dest.is_file() and dest.stat().st_size > 10_000:
        return PrepResult(
            ok=True,
            path=str(dest.resolve()),
            status=f"Using prepared Aleph proxy ({', '.join(notes)}).",
            used_proxy=True,
            duration_s=min(dur, ALEPH_MAX_DURATION_S) if dur else None,
            width=tw if need_scale else w,
            height=th if need_scale else h,
            notes=notes,
        )

    wrote = _ffmpeg_prep(
        src,
        dest,
        tw=tw,
        th=th,
        max_s=ALEPH_MAX_DURATION_S,
        scale=need_scale,
        trim=need_trim,
    )
    if not wrote:
        wrote = _opencv_prep(
            src,
            dest,
            tw=tw,
            th=th,
            max_s=ALEPH_MAX_DURATION_S,
            scale=need_scale,
            trim=need_trim,
        )
    if not wrote:
        try:
            if dest.is_file():
                dest.unlink()
        except OSError:
            pass
        return PrepResult(
            ok=False,
            status=(
                "Could not prepare this clip for Aleph "
                f"({', '.join(notes) or 'oversize'}). "
                f"Export a {ALEPH_MIN_DURATION_S:.0f}–{ALEPH_MAX_DURATION_S:.0f}s "
                "1080p proxy and retry."
            ),
            duration_s=dur,
            width=w,
            height=h,
            notes=notes,
        )

    check = probe_clip(dest)
    cd = check.get("duration")
    if cd is not None and cd + 0.05 < ALEPH_MIN_DURATION_S:
        return PrepResult(
            ok=False,
            status=(
                f"Prepared clip is only {cd:.1f}s — Aleph needs at least "
                f"{ALEPH_MIN_DURATION_S:.0f}s."
            ),
            duration_s=cd,
            width=int(check.get("width") or 0),
            height=int(check.get("height") or 0),
        )
    if check["size_mb"] > 200:
        return PrepResult(
            ok=False,
            status=(
                f"Prepared clip is still {check['size_mb']:.0f} MB — too large for Aleph. "
                "Export a shorter 1080p proxy (2–30s) and retry."
            ),
            duration_s=cd,
            width=int(check.get("width") or 0),
            height=int(check.get("height") or 0),
        )

    return PrepResult(
        ok=True,
        path=str(dest.resolve()),
        status=f"Prepared clip for Aleph ({', '.join(notes)}).",
        used_proxy=True,
        duration_s=cd if cd is not None else (min(dur, ALEPH_MAX_DURATION_S) if dur else None),
        width=int(check.get("width") or tw),
        height=int(check.get("height") or th),
        notes=notes,
    )
