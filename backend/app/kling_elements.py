"""Kling 3.0 / O3 Elements + multi_prompt payload helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

UploadFn = Callable[[Path], str]
ProgressFn = Callable[[str], None]

DEFAULT_MAX_ELEMENTS = 3
DEFAULT_MAX_MULTI_PROMPT = 6


def spec_supports_elements(spec: Any) -> bool:
    return bool(getattr(spec, "supports_elements", False))


def spec_max_elements(spec: Any) -> int:
    n = int(getattr(spec, "max_elements", 0) or 0)
    return n if n > 0 else 0


def spec_element_allows_video(spec: Any) -> bool:
    return bool(getattr(spec, "element_allows_video", False))


def spec_supports_multi_prompt(spec: Any) -> bool:
    return bool(getattr(spec, "supports_multi_prompt", False))


def spec_max_multi_prompt(spec: Any) -> int:
    n = int(getattr(spec, "max_multi_prompt", 0) or 0)
    return n if n > 0 else DEFAULT_MAX_MULTI_PROMPT


def _is_url(raw: str) -> bool:
    s = (raw or "").strip().lower()
    return s.startswith("http://") or s.startswith("https://")


def _file_ok(raw: str | None) -> bool:
    p = (raw or "").strip()
    return bool(p) and Path(p).is_file()


def validate_element_rows(
    raw: Any,
    *,
    allows_video: bool = True,
    max_n: int = DEFAULT_MAX_ELEMENTS,
) -> list[str]:
    errors: list[str] = []
    rows = list(raw or []) if isinstance(raw, list) else []
    if max_n > 0 and len(rows) > max_n:
        errors.append(f"This model allows at most {max_n} Elements (got {len(rows)}).")
    for i, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            errors.append(f"Element {i} is invalid.")
            continue
        frontal = (row.get("frontal") or row.get("frontal_image_url") or "").strip()
        video = (row.get("video") or row.get("video_url") or "").strip()
        has_front = _file_ok(frontal) or _is_url(frontal)
        has_vid = _file_ok(video) or _is_url(video)
        if has_vid and not allows_video and not has_front:
            errors.append(f"Element {i} needs a frontal still (this model has no motion-clip Elements).")
            continue
        if not has_front and not (allows_video and has_vid):
            errors.append(f"Element {i} needs a frontal still.")
    return errors


def materialize_elements(
    raw: Any,
    *,
    allows_video: bool,
    max_n: int,
    upload: UploadFn,
    progress: ProgressFn | None = None,
) -> list[dict[str, Any]]:
    """Turn tray rows (local paths or URLs) into Fal ``elements[]``."""

    def log(msg: str) -> None:
        if progress:
            progress(msg)

    def put(src: str) -> str:
        s = (src or "").strip()
        if _is_url(s):
            return s
        p = Path(s)
        if not p.is_file():
            raise FileNotFoundError(s)
        return upload(p)

    out: list[dict[str, Any]] = []
    rows = list(raw or []) if isinstance(raw, list) else []
    cap = max_n if max_n > 0 else DEFAULT_MAX_ELEMENTS
    for i, row in enumerate(rows[:cap], 1):
        if not isinstance(row, dict):
            continue
        video = (row.get("video") or row.get("video_url") or "").strip()
        frontal = (row.get("frontal") or row.get("frontal_image_url") or "").strip()
        refs = row.get("refs") or row.get("reference_image_urls") or []
        if isinstance(refs, str):
            refs = [refs]
        has_front = _file_ok(frontal) or _is_url(frontal)
        has_vid = _file_ok(video) or _is_url(video)
        if allows_video and has_vid and not has_front:
            log(f"Uploading Element {i} motion clip")
            out.append({"video_url": put(video)})
            continue
        if not has_front:
            continue
        log(f"Uploading Element {i} frontal still")
        item: dict[str, Any] = {"frontal_image_url": put(frontal)}
        extra: list[str] = []
        for ref in refs:
            r = str(ref or "").strip()
            if not r or not (_file_ok(r) or _is_url(r)):
                continue
            extra.append(put(r))
        if extra:
            item["reference_image_urls"] = extra
        out.append(item)
    return out


def clean_multi_prompt(
    raw: Any,
    *,
    max_shots: int = DEFAULT_MAX_MULTI_PROMPT,
    max_seconds: int = 15,
) -> tuple[list[dict[str, str]], int, list[str]]:
    """Return Fal multi_prompt rows, total duration, notes."""
    notes: list[str] = []
    rows = list(raw or []) if isinstance(raw, list) else []
    cap = max_shots if max_shots > 0 else DEFAULT_MAX_MULTI_PROMPT
    if len(rows) > cap:
        notes.append(f"multi_prompt truncated to {cap} shots.")
        rows = rows[:cap]
    out: list[dict[str, str]] = []
    total = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        prompt = str(row.get("prompt") or "").strip()
        if not prompt:
            continue
        dur_raw = str(row.get("duration") or "5").strip().lower().rstrip("s")
        try:
            n = int(round(float(dur_raw)))
        except (TypeError, ValueError):
            n = 5
        n = max(1, min(int(max_seconds or 15), n))
        if total + n > int(max_seconds or 15):
            n = int(max_seconds or 15) - total
            if n <= 0:
                notes.append("Shot durations exceed model max — extra shots dropped.")
                break
            notes.append(f"Last shot clamped so total stays ≤ {max_seconds}s.")
        total += n
        out.append({"prompt": prompt, "duration": str(n)})
    return out, total, notes


def apply_kling_extras(
    args: dict[str, Any],
    params: dict[str, Any],
    *,
    spec: Any,
) -> tuple[dict[str, Any], list[str]]:
    """Attach already-materialized elements + multi_prompt onto a Fal args dict."""
    notes: list[str] = []
    other = params.get("other") if isinstance(params.get("other"), dict) else {}

    els = params.get("elements")
    if els is None:
        els = other.get("elements")
    if els and spec_supports_elements(spec):
        ready: list[dict[str, Any]] = []
        for row in els if isinstance(els, list) else []:
            if not isinstance(row, dict):
                continue
            if row.get("frontal_image_url") or row.get("video_url"):
                ready.append(row)
        if ready:
            args["elements"] = ready[: spec_max_elements(spec) or DEFAULT_MAX_ELEMENTS]
            notes.append(f"Kling Elements × {len(args['elements'])}.")

    mp_raw = params.get("multi_prompt")
    if mp_raw is None:
        mp_raw = other.get("multi_prompt")
    if mp_raw and spec_supports_multi_prompt(spec):
        max_s = int(getattr(spec, "max_duration_seconds", None) or getattr(spec, "duration_max", None) or 15)
        cleaned, total, mp_notes = clean_multi_prompt(
            mp_raw,
            max_shots=spec_max_multi_prompt(spec),
            max_seconds=max_s,
        )
        notes.extend(mp_notes)
        if cleaned:
            args["multi_prompt"] = cleaned
            shot_type = (
                params.get("shot_type")
                or other.get("shot_type")
                or "customize"
            )
            st = str(shot_type).strip().lower()
            args["shot_type"] = "intelligent" if st == "intelligent" else "customize"
            args.pop("prompt", None)
            dur_param = getattr(spec, "duration_param", None) or "duration"
            if dur_param:
                args[dur_param] = str(total)
            notes.append(
                f"Kling multi_prompt × {len(cleaned)} ({total}s, {args['shot_type']})."
            )
    return args, notes
