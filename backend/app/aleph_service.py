"""
Aleph 2.0 keyframe video edit via Runware (Frame mode).

Does not use fal. Requires a separate Runware API key.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal

from app.errors import friendly_error
from app.history import append_history
from app.library import UPLOADS_DIR, _item, ensure_library_dirs, is_allowed_path
from app.media import extract_frame_at, is_video_path
from app.video_prep import prepare_aleph_source
from app.naming import job_media_dir, make_output_stem, timestamp_now, unique_path
from app.pricing import format_cost_label, format_render_metrics, probe_video_duration
from app.runware_client import (
    ALEPH_COST_PER_SECOND,
    ALEPH_MAX_DURATION_S,
    ALEPH_MAX_KEYFRAMES,
    ALEPH_MAX_PROMPT_CHARS,
    ALEPH_MIN_DURATION_S,
    ALEPH_MODEL_ID,
    RunwareClientError,
    RunwareConfigError,
    download_url,
    estimate_aleph_cost_usd,
    format_aleph_cost,
    has_runware_key,
    run_aleph_video_edit,
    upload_media,
)

ProgressCallback = Callable[[str], None]

FRAME_MODEL_ID = "runware:aleph@2.0"
KeyframePin = Literal["first", "last", "timestamp"]


@dataclass
class AlephKeyframe:
    """One guidance still pinned to the source timeline."""

    image_path: str
    pin: KeyframePin = "first"
    timestamp_s: float | None = None

    def resolved_pin(self) -> KeyframePin:
        pin = self.pin if self.pin in ("first", "last", "timestamp") else "first"
        if pin == "last":
            return "last"
        try:
            ts = float(self.timestamp_s) if self.timestamp_s is not None else 0.0
        except (TypeError, ValueError):
            ts = 0.0
        if pin == "timestamp" or ts > 0.005:
            return "timestamp"
        return "first"

    def to_api_item(self, image_url: str) -> dict[str, Any]:
        pin = self.resolved_pin()
        if pin == "last":
            return {"image": image_url, "frame": "last"}
        if pin == "timestamp":
            try:
                ts = float(self.timestamp_s) if self.timestamp_s is not None else 0.0
            except (TypeError, ValueError):
                ts = 0.0
            ts = max(0.0, round(ts, 2))
            return {"image": image_url, "timestamp": ts}
        return {"image": image_url, "frame": "first"}

    def position_label(self) -> str:
        pin = self.resolved_pin()
        if pin == "last":
            return "last"
        if pin == "timestamp":
            try:
                ts = float(self.timestamp_s or 0.0)
            except (TypeError, ValueError):
                ts = 0.0
            return f"t={max(0.0, round(ts, 2)):.2f}s"
        return "first"


@dataclass
class AlephResult:
    ok: bool
    path: str | None = None
    status: str = ""
    cost_label: str = ""
    metrics_line: str = ""
    notes: list[str] = field(default_factory=list)
    timestamp: str = ""
    model: str = "Aleph 2.0 (Runware)"
    model_key: str = FRAME_MODEL_ID
    job_kind: str = "aleph_keyframe"
    render_seconds: float | None = None


def frame_models_for_ui() -> list[dict[str, Any]]:
    return [
        {
            "id": FRAME_MODEL_ID,
            "label": "Aleph 2.0 (Runware)",
            "mode": "frame",
            "modality": "frame",
            "endpoint": ALEPH_MODEL_ID,
            "notes": (
                "Scrub the source clip, pin up to 5 frames, and describe the edit. "
                f"Source must be {ALEPH_MIN_DURATION_S:.0f}–{ALEPH_MAX_DURATION_S:.0f}s. "
                "Output length follows the source. Requires a Runware key."
            ),
            "cost_estimate_usd": ALEPH_COST_PER_SECOND,
            "cost": format_aleph_cost(8.0),
            "backend": "runware",
            "requires_runware": True,
            "duration_min": ALEPH_MIN_DURATION_S,
            "duration_max": ALEPH_MAX_DURATION_S,
            "duration_enum": [],
            "default_duration": "",
            "supports_duration": False,
            "required_slots": ["source_video"],
        }
    ]


def estimate_frame_label(duration: float | str | None = None) -> str:
    secs = _parse_duration_s(duration)
    return format_aleph_cost(secs)


def _parse_duration_s(raw: float | str | None) -> float | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip().lower().rstrip("s")
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def keyframes_from_payload(raw: list[Any] | None) -> list[AlephKeyframe]:
    out: list[AlephKeyframe] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        path = str(item.get("image_path") or item.get("path") or "").strip()
        if not path:
            continue
        pin_raw = str(item.get("pin") or "timestamp").strip().lower()
        pin: KeyframePin
        if pin_raw in ("first", "last", "timestamp"):
            pin = pin_raw  # type: ignore[assignment]
        else:
            pin = "timestamp"
        ts_raw = item.get("timestamp_s", item.get("timestamp"))
        try:
            ts = float(ts_raw) if ts_raw is not None else None
        except (TypeError, ValueError):
            ts = None
        out.append(AlephKeyframe(image_path=path, pin=pin, timestamp_s=ts))
        if len(out) >= ALEPH_MAX_KEYFRAMES:
            break
    return out


def extract_pin_still(video_path: str, seconds: float) -> dict[str, Any]:
    """Extract a still at ``seconds`` into Library uploads/frames."""
    src = Path(video_path)
    if not src.is_file() or not is_video_path(src):
        raise FileNotFoundError("Source video not found.")
    if not is_allowed_path(src):
        raise PermissionError("Video is outside the Library.")
    ensure_library_dirs()
    dest_dir = UPLOADS_DIR / "frames"
    dest_dir.mkdir(parents=True, exist_ok=True)
    t = max(0.0, round(float(seconds), 2))
    tag = f"{t:.2f}".replace(".", "p")
    dest = dest_dir / f"{src.stem}_t{tag}.png"
    if dest.exists():
        dest = dest_dir / f"{src.stem}_t{tag}_{timestamp_now()}.png"
    written = extract_frame_at(src, t, output_path=dest)
    row = _item(source="uploads", path=written, root=UPLOADS_DIR)
    if row is None:
        raise RuntimeError("Extracted frame could not be indexed.")
    row["timestamp_s"] = t
    return row


def run_aleph_keyframe_edit(
    *,
    video_path: str | None,
    prompt: str | None,
    keyframes: list[AlephKeyframe] | None = None,
    output_dir: str | Path,
    on_progress: ProgressCallback | None = None,
) -> AlephResult:
    """Source video + pinned stills → Aleph propagates the edit (2–30s, ≤5 pins)."""

    def progress(msg: str) -> None:
        if on_progress:
            on_progress(msg)

    path = Path(video_path) if video_path else None
    if not path or not path.is_file():
        return AlephResult(ok=False, status="Attach a Source video for Frame edit.")
    if not is_video_path(path):
        return AlephResult(ok=False, status="Source must be a video clip, not a still.")

    prep = prepare_aleph_source(str(path), output_dir=output_dir)
    if not prep.ok or not prep.path:
        return AlephResult(ok=False, status=prep.status or "Could not prepare this clip for Aleph.")
    path = Path(prep.path)

    text = (prompt or "").strip()
    if not text:
        return AlephResult(
            ok=False,
            status=(
                "Enter a short prompt: what to change on the pinned frames "
                '(e.g. "Remove the person in the mirror; change nothing else").'
            ),
        )
    if len(text) > ALEPH_MAX_PROMPT_CHARS:
        text = text[: ALEPH_MAX_PROMPT_CHARS - 1].rstrip() + "…"

    dur = prep.duration_s if prep.duration_s is not None else probe_video_duration(path)
    if dur is not None:
        if dur + 0.05 < ALEPH_MIN_DURATION_S:
            return AlephResult(
                ok=False,
                status=(
                    f"Aleph needs about {ALEPH_MIN_DURATION_S:.0f}–{ALEPH_MAX_DURATION_S:.0f}s "
                    f"(yours is {dur:.1f}s). Use a longer clip."
                ),
                cost_label=format_aleph_cost(dur),
            )
        if dur > ALEPH_MAX_DURATION_S + 0.25:
            return AlephResult(
                ok=False,
                status=(
                    f"Aleph max is {ALEPH_MAX_DURATION_S:.0f}s after prep (yours is {dur:.1f}s). "
                    "Export a 2–30s 1080p proxy and retry."
                ),
                cost_label=format_aleph_cost(ALEPH_MAX_DURATION_S),
            )

    try:
        size_mb = path.stat().st_size / (1024 * 1024)
    except OSError:
        size_mb = 0.0
    if size_mb > 200:
        return AlephResult(
            ok=False,
            status=(
                f"Source is {size_mb:.0f} MB — too large. Export a shorter 1080p "
                "proxy (2–30s) and retry."
            ),
            cost_label=format_aleph_cost(dur),
        )

    kfs = list(keyframes or [])[:ALEPH_MAX_KEYFRAMES]
    if not kfs:
        return AlephResult(
            ok=False,
            status="Pin at least one frame (scrub the clip, then Pin current frame).",
            cost_label=format_aleph_cost(dur),
        )
    for kf in kfs:
        if not Path(kf.image_path).is_file():
            return AlephResult(
                ok=False,
                status=f"Pinned still missing: {kf.image_path}",
                cost_label=format_aleph_cost(dur),
            )
        try:
            kf.pin = kf.resolved_pin()  # type: ignore[misc]
        except Exception:
            pass

    if not has_runware_key():
        return AlephResult(
            ok=False,
            status=(
                "Runware / Aleph API key is not set. Open Settings and paste your "
                "Runware key from https://my.runware.ai/ (optional second provider)."
            ),
            cost_label=format_aleph_cost(dur),
        )

    est = estimate_aleph_cost_usd(dur)
    est_lbl = format_cost_label(est, estimate=True)
    progress(format_aleph_cost(dur))
    if dur is not None:
        progress(f"Source ≈ {dur:.1f}s · {size_mb:.0f} MB · {len(kfs)} pin(s)")
    pos_preview = ", ".join(kf.position_label() for kf in kfs)
    progress(f"Pin positions → {pos_preview}")

    t0 = time.perf_counter()
    try:
        video_url = upload_media(path, on_progress=progress)
        frame_api: list[dict[str, Any]] = []
        for i, kf in enumerate(kfs):
            progress(f"Uploading pin {i + 1}/{len(kfs)}…")
            img_url = upload_media(kf.image_path, on_progress=progress)
            item = kf.to_api_item(img_url)
            frame_api.append(item)
            if "timestamp" in item:
                progress(f"  frameImages[{i}] timestamp={float(item['timestamp']):.2f}s")
            else:
                progress(f"  frameImages[{i}] frame={item.get('frame', '?')}")

        sent = []
        for item in frame_api:
            if "timestamp" in item:
                sent.append(f"t={float(item['timestamp']):.2f}s")
            else:
                sent.append(f"frame={item.get('frame')}")
        progress(f"Aleph frameImages sent: [{', '.join(sent)}]")

        out_url = run_aleph_video_edit(
            video_url=video_url,
            prompt=text,
            frame_images=frame_api or None,
            on_progress=progress,
        )
    except RunwareConfigError as exc:
        return AlephResult(ok=False, status=str(exc), cost_label=est_lbl)
    except RunwareClientError as exc:
        return AlephResult(
            ok=False,
            status=friendly_error(exc, context="Aleph 2.0", media_kind="video"),
            cost_label=est_lbl,
        )
    except Exception as exc:
        return AlephResult(
            ok=False,
            status=friendly_error(exc, context="Aleph 2.0", media_kind="video"),
            cost_label=est_lbl,
        )

    render_s = time.perf_counter() - t0
    metrics = format_render_metrics(render_s, est, cost_is_estimate=True)
    cost_lbl = format_cost_label(est, estimate=True)

    stamp = timestamp_now()
    media_dir = job_media_dir(output_dir, stamp=stamp)
    stem = make_output_stem(text or "aleph", "aleph-2", stamp=stamp, kind="aleph-keyframe")
    dest = unique_path(media_dir, stem, ".mp4")

    try:
        download_url(out_url, dest, on_progress=progress)
    except RunwareClientError as exc:
        return AlephResult(
            ok=False,
            status=str(exc),
            cost_label=cost_lbl,
            metrics_line=metrics,
            timestamp=stamp,
            render_seconds=render_s,
        )

    resolved = str(dest.resolve())
    status = f"Aleph 2.0 OK. Saved {Path(resolved).name}. {metrics}."

    try:
        append_history(
            job_kind="aleph_keyframe",
            model="Aleph 2.0 (Runware)",
            prompt=text,
            files=[resolved],
            cost_estimate=cost_lbl,
            notes=[f"keyframes={len(kfs)}", f"source={path.name}"],
            output_dir=output_dir,
            timestamp=stamp,
            scenario="aleph_keyframe",
        )
    except Exception:
        pass

    return AlephResult(
        ok=True,
        path=resolved,
        status=status,
        cost_label=cost_lbl,
        metrics_line=metrics,
        notes=[f"{len(kfs)} pin(s)"],
        timestamp=stamp,
        render_seconds=render_s,
    )
