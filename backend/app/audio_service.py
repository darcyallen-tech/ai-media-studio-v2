"""Run Audio-tab utilities (music / SFX / voiceover) via fal."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from app.audio_registry import (
    MUSIC_MODELS,
    SFX_MODELS,
    VOICEOVER_MODELS,
    AudioSpec,
    build_music_args,
    build_sfx_args,
    build_voiceover_args,
    estimate_audio_cost,
    find_audio,
    format_audio_cost,
)
from app.errors import friendly_error
from app.fal.client import FalClientError, download_url, subscribe
from app.naming import job_media_dir, make_output_stem, timestamp_now, unique_path
from app.pricing import (
    extract_cost_usd_from_response,
    format_cost_label,
    format_render_metrics,
)

ProgressCallback = Callable[[str], None]

_REGISTRIES: dict[str, dict[str, AudioSpec]] = {
    "music": MUSIC_MODELS,
    "sfx": SFX_MODELS,
    "voice": VOICEOVER_MODELS,
    "voiceover": VOICEOVER_MODELS,
}


@dataclass
class AudioResult:
    ok: bool
    path: str | None = None
    status: str = ""
    metrics_line: str = ""
    cost_label: str = ""
    notes: list[str] = field(default_factory=list)
    render_seconds: float | None = None
    model: str = ""
    model_key: str = ""
    endpoint: str = ""
    job_kind: str = "audio"


def normalize_audio_modality(raw: str | None) -> str:
    m = (raw or "").strip().lower()
    if m in ("voice", "tts", "voiceover"):
        return "voiceover"
    if m in ("music", "sfx"):
        return m
    return m or "music"


def ui_audio_registries(modality: str | None) -> dict[str, dict[str, AudioSpec]]:
    want = normalize_audio_modality(modality) if modality else None
    if want == "voiceover":
        return {"voiceover": VOICEOVER_MODELS}
    if want == "music":
        return {"music": MUSIC_MODELS}
    if want == "sfx":
        return {"sfx": SFX_MODELS}
    return {
        "music": MUSIC_MODELS,
        "sfx": SFX_MODELS,
        "voiceover": VOICEOVER_MODELS,
    }


def resolve_audio_spec(model_id: str | None, modality: str | None) -> AudioSpec | None:
    raw = (model_id or "").strip()
    if raw.startswith("audio:"):
        raw = raw[6:].strip()
    want = normalize_audio_modality(modality) if modality else None
    registries = ui_audio_registries(want)
    if want and want in _REGISTRIES:
        hit = find_audio(raw, _REGISTRIES[want])
        if hit:
            return hit
    for registry in registries.values():
        hit = find_audio(raw, registry)
        if hit:
            return hit
    return None


def parse_duration_s(raw: Any) -> float | None:
    if raw is None or raw == "":
        return None
    text = str(raw).strip().lower().rstrip("s").strip()
    if not text or text in ("auto", "default"):
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def duration_tokens(spec: AudioSpec) -> tuple[list[str], str]:
    if not spec.supports_duration:
        return [], ""
    lo = float(spec.duration_min_s or 0)
    hi = float(spec.duration_max_s or 0)
    default = float(spec.duration_default_s or lo or 5)
    ladder = (
        0.5,
        1,
        2,
        3,
        5,
        8,
        10,
        15,
        20,
        22,
        30,
        45,
        60,
        90,
        120,
        180,
        240,
        300,
        420,
        600,
    )
    toks: list[str] = []
    for val in ladder:
        if val + 0.01 < lo or val - 0.01 > hi:
            continue
        toks.append(_dur_token(val))
    def_tok = _dur_token(default)
    if def_tok not in toks:
        toks.append(def_tok)
        toks.sort(key=lambda t: float(t))
    return toks, def_tok


def _dur_token(val: float) -> str:
    if abs(val - round(val)) < 0.01:
        return str(int(round(val)))
    return f"{val:.1f}".rstrip("0").rstrip(".")


def _url_from_fileish(item: Any) -> str | None:
    if isinstance(item, str) and item.strip():
        return item.strip()
    if isinstance(item, dict):
        url = item.get("url") or item.get("file_url") or item.get("audio_url")
        if url:
            return str(url)
    return None


def extract_audio_url(result: dict[str, Any]) -> str | None:
    if not isinstance(result, dict):
        return None
    audio = result.get("audio") or result.get("audio_url") or result.get("output")
    if isinstance(audio, list) and audio:
        for item in audio:
            u = _url_from_fileish(item)
            if u:
                return u
    u = _url_from_fileish(audio)
    if u:
        lower = u.lower()
        if not any(lower.endswith(ext) for ext in (".mp4", ".mov", ".webm", ".mkv")):
            return u
    for key in ("audios", "files", "outputs", "audio_files"):
        items = result.get(key)
        if isinstance(items, list) and items:
            for item in items:
                u2 = _url_from_fileish(item)
                if u2:
                    low = u2.lower()
                    if any(
                        low.endswith(ext)
                        for ext in (".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus")
                    ):
                        return u2
            u3 = _url_from_fileish(items[0])
            if u3 and not any(
                u3.lower().endswith(ext) for ext in (".mp4", ".mov", ".webm", ".mkv")
            ):
                return u3
    url = result.get("url")
    if isinstance(url, str) and url.strip():
        lower = url.lower()
        if any(lower.endswith(ext) for ext in (".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac")):
            return url.strip()
        if "audio" in lower or "sound" in lower or "music" in lower:
            return url.strip()
    return None


def _extension_from_url(url: str, default: str = ".mp3") -> str:
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix in {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus"}:
        return suffix
    return default


def _run_audio(
    *,
    spec: AudioSpec,
    arguments: dict[str, Any],
    output_dir: str | Path,
    prompt_for_name: str,
    kind: str,
    est_cost: float,
    on_progress: ProgressCallback | None = None,
) -> AudioResult:
    def progress(msg: str) -> None:
        if on_progress:
            on_progress(msg)

    est = format_cost_label(est_cost, estimate=True)
    progress(f"{spec.label} · {est}")
    t0 = time.perf_counter()
    try:
        result = subscribe(spec.endpoint, arguments, on_progress=progress)
    except FalClientError as exc:
        render_s = time.perf_counter() - t0
        return AudioResult(
            ok=False,
            status=str(exc),
            metrics_line=format_render_metrics(render_s, None, cost_is_estimate=True),
            cost_label=est,
            render_seconds=render_s,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )
    except Exception as exc:
        render_s = time.perf_counter() - t0
        return AudioResult(
            ok=False,
            status=friendly_error(exc, context=spec.label),
            metrics_line=format_render_metrics(render_s, None, cost_is_estimate=True),
            cost_label=est,
            render_seconds=render_s,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )
    render_s = time.perf_counter() - t0
    exact = extract_cost_usd_from_response(result)
    cost_usd = exact if exact is not None else est_cost
    is_est = exact is None
    metrics = format_render_metrics(render_s, cost_usd, cost_is_estimate=is_est)
    cost_lbl = format_cost_label(cost_usd, estimate=is_est)
    out_url = extract_audio_url(result)
    if not out_url:
        return AudioResult(
            ok=False,
            status=f"{spec.label}: fal returned no audio.",
            metrics_line=metrics,
            cost_label=cost_lbl,
            render_seconds=render_s,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )

    stamp = timestamp_now()
    media_dir = job_media_dir(output_dir, stamp=stamp)
    stem = make_output_stem(prompt_for_name, spec.key, stamp=stamp, kind=kind)
    dest = unique_path(media_dir, stem, _extension_from_url(out_url))
    try:
        download_url(out_url, dest, on_progress=progress)
    except FalClientError as exc:
        return AudioResult(
            ok=False,
            status=str(exc),
            metrics_line=metrics,
            cost_label=cost_lbl,
            render_seconds=render_s,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )
    resolved = str(dest.resolve())
    return AudioResult(
        ok=True,
        path=resolved,
        status=f"{spec.label} OK. Saved {Path(resolved).name}. {metrics}.",
        metrics_line=metrics,
        cost_label=cost_lbl,
        notes=[spec.notes] if spec.notes else [],
        render_seconds=render_s,
        model=spec.label,
        model_key=spec.key,
        endpoint=spec.endpoint,
        job_kind=kind,
    )


def generate_audio(
    *,
    modality: str,
    model_id: str,
    prompt: str,
    duration: str | None = None,
    extra: dict[str, Any] | None = None,
    output_dir: str | Path,
) -> AudioResult:
    spec = resolve_audio_spec(model_id, modality)
    if spec is None:
        return AudioResult(ok=False, status=f"Unknown audio model: {model_id or '(none)'}.")
    text = (prompt or "").strip()
    if not text:
        return AudioResult(ok=False, status="Enter a prompt.")
    extra = extra or {}
    dur = parse_duration_s(duration)
    if dur is None:
        dur = spec.duration_default_s
    kind = spec.category if spec.category in ("music", "sfx", "voiceover") else "audio"

    if spec.category == "music":
        if len(text) < 3:
            return AudioResult(ok=False, status="Prompt is too short.")
        instrumental = extra.get("instrumental")
        if instrumental is None:
            instrumental = True
        use_dur = dur if spec.supports_duration else spec.fixed_duration_s
        args = build_music_args(
            spec,
            text,
            duration_s=use_dur if spec.supports_duration else None,
            instrumental=bool(instrumental),
        )
        est = estimate_audio_cost(
            spec,
            duration_s=use_dur if spec.supports_duration else (spec.fixed_duration_s or 30.0),
        )
        return _run_audio(
            spec=spec,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name=text,
            kind="music",
            est_cost=est,
        )

    if spec.category == "sfx":
        args = build_sfx_args(spec, text, duration_s=dur)
        est = estimate_audio_cost(spec, duration_s=dur)
        return _run_audio(
            spec=spec,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name=text,
            kind="sfx",
            est_cost=est,
        )

    if spec.category == "voiceover":
        if len(text) < 2:
            return AudioResult(ok=False, status="Script is too short.")
        voice = str(extra.get("voice") or spec.default_voice or "").strip() or None
        args = build_voiceover_args(spec, text, voice=voice)
        est = estimate_audio_cost(spec, text=text)
        return _run_audio(
            spec=spec,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name=text[:80],
            kind="voiceover",
            est_cost=est,
        )

    return AudioResult(ok=False, status=f"{spec.label} is not wired in Phase 7.")


def estimate_audio_label(
    model_id: str,
    modality: str | None,
    *,
    duration: str | None = None,
    prompt: str | None = None,
) -> str:
    spec = resolve_audio_spec(model_id, modality)
    if spec is None:
        return ""
    from app.audio_registry import is_flat_per_track, is_per_char

    dur = parse_duration_s(duration)
    if is_flat_per_track(spec) or is_per_char(spec):
        return format_audio_cost(spec, duration_s=None, text=prompt)
    if dur is None:
        dur = spec.duration_default_s if spec.supports_duration else spec.fixed_duration_s
    return format_audio_cost(spec, duration_s=dur, text=prompt)
