"""Result-tool generate: upscale / denoise / restore / deblur / interpolate."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.errors import friendly_error
from app.fal.client import (
    FalClientError,
    download_url,
    extract_image_urls,
    extract_video_url,
    subscribe,
    upload_file,
)
from app.naming import job_media_dir, make_output_stem, timestamp_now, unique_path
from app.pricing import (
    extract_cost_usd_from_response,
    format_cost_label,
    format_render_metrics,
)
from app.tools_registry import (
    IMAGE_DEBLUR_MODELS,
    INTERPOLATE_FACTOR_CHOICES,
    RESTORE_IMAGE_NO_REF,
    RESTORE_VIDEO_MODELS,
    UPSCALERS,
    VIDEO_DEBLUR_MODELS,
    VIDEO_DENOISE_MODELS,
    VIDEO_INTERPOLATE_MODELS,
    VIDEO_UPSCALERS,
    ToolSpec,
    build_codeformer_args,
    build_nafnet_deblur_args,
    build_upscale_args,
    build_video_denoise_args,
    build_video_interpolate_args,
    build_video_upscale_args,
    estimate_video_denoise_cost,
    estimate_video_interpolate_cost,
    estimate_video_upscale_cost,
    find_tool,
    format_tool_cost,
    format_video_denoise_cost,
    format_video_interpolate_cost,
    format_video_upscale_cost,
    parse_interpolate_factor,
    restore_prompt,
)


@dataclass
class ToolResult:
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
    job_kind: str = "tool"


def _registries(category: str, kind: str) -> dict[str, ToolSpec]:
    cat = (category or "").strip().lower()
    media = (kind or "").strip().lower()
    if cat == "upscale":
        src = UPSCALERS if media != "video" else VIDEO_UPSCALERS
        return {
            k: v for k, v in src.items()
            if not v.hidden and k != "topaz video"
        }
    def _vis(reg: dict) -> dict:
        return {k: v for k, v in reg.items() if not getattr(v, "hidden", False)}

    if cat == "denoise":
        return _vis(VIDEO_DENOISE_MODELS)
    if cat == "restore":
        src = RESTORE_IMAGE_NO_REF if media != "video" else RESTORE_VIDEO_MODELS
        return _vis(src)
    if cat == "deblur":
        src = IMAGE_DEBLUR_MODELS if media != "video" else VIDEO_DEBLUR_MODELS
        return _vis(src)
    if cat == "interpolate":
        return _vis(VIDEO_INTERPOLATE_MODELS)
    return {}


def list_tools(category: str, kind: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    media = (kind or "image").strip().lower()
    for spec in _registries(category, media).values():
        factor_choices: list[str] = []
        default_factor = ""
        supports_factor = False
        if category == "upscale":
            supports_factor = True
            if media == "video":
                factor_choices = ["720p", "1080p", "1440p", "2160p", "2×"]
                default_factor = "1080p"
            else:
                factor_choices = ["2", "3", "4"]
                default_factor = "2"
        elif category == "interpolate":
            supports_factor = True
            factor_choices = list(INTERPOLATE_FACTOR_CHOICES)
            default_factor = INTERPOLATE_FACTOR_CHOICES[0]
        elif category in ("denoise", "deblur") and media == "video":
            supports_factor = True
            factor_choices = ["1", "2"]
            default_factor = "1"
        cost = format_tool_cost(spec, mode=media)
        if category == "upscale" and media == "video":
            cost = format_video_upscale_cost(spec, target_label="1080p", duration_s=5.0)
        elif category == "denoise" and media == "video":
            cost = format_video_denoise_cost(spec, duration_s=5.0, upscale_factor=1.0)
        elif category == "interpolate":
            cost = format_video_interpolate_cost(spec, factor_label=default_factor, duration_s=5.0)
        rows.append(
            {
                "id": f"tool:{spec.key}",
                "key": spec.key,
                "label": spec.label,
                "category": spec.category,
                "notes": spec.notes,
                "cost": cost,
                "cost_estimate_usd": spec.cost_estimate_usd,
                "endpoint": spec.endpoint,
                "kind": media,
                "supports_factor": supports_factor,
                "factor_choices": factor_choices,
                "default_factor": default_factor,
                "supports_strength": spec.key == "codeformer",
                "default_strength": 0.7 if spec.key == "codeformer" else None,
            }
        )
    return rows


def resolve_tool(model_id: str | None, category: str, kind: str) -> ToolSpec | None:
    raw = (model_id or "").strip()
    if raw.startswith("tool:"):
        raw = raw[5:]
    return find_tool(raw, _registries(category, kind))


def _extract_image(result: dict[str, Any]) -> str | None:
    urls = extract_image_urls(result)
    if urls:
        return urls[0]
    img = result.get("image")
    if isinstance(img, dict) and img.get("url"):
        return str(img["url"])
    if isinstance(img, str) and img.strip():
        return img.strip()
    return None


def _run_image(
    *,
    spec: ToolSpec,
    image_path: str,
    arguments: dict[str, Any],
    output_dir: str | Path,
    prompt_for_name: str,
    kind: str,
    est_usd: float,
    est_label: str,
) -> ToolResult:
    path = Path(image_path)
    if not path.is_file():
        return ToolResult(ok=False, status="Tool needs an image.")
    try:
        url = upload_file(path)
    except (FalClientError, Exception) as exc:
        return ToolResult(ok=False, status=friendly_error(exc, context=spec.label), cost_label=est_label)
    args = dict(arguments)
    if "image_url" in args and not str(args.get("image_url") or "").startswith("http"):
        args["image_url"] = url
    if "image_urls" in args:
        args["image_urls"] = [url]
    if "image_url" not in args and "image_urls" not in args:
        args["image_url"] = url
    t0 = time.perf_counter()
    try:
        result = subscribe(spec.endpoint, args)
    except FalClientError as exc:
        return ToolResult(
            ok=False,
            status=str(exc),
            cost_label=est_label,
            render_seconds=time.perf_counter() - t0,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )
    render_s = time.perf_counter() - t0
    exact = extract_cost_usd_from_response(result)
    cost_usd = exact if exact is not None else est_usd
    cost_lbl = format_cost_label(cost_usd, estimate=exact is None)
    metrics = format_render_metrics(render_s, cost_usd, cost_is_estimate=exact is None)
    out_url = _extract_image(result)
    if not out_url:
        return ToolResult(
            ok=False,
            status=f"{spec.label}: fal returned no image.",
            cost_label=cost_lbl,
            metrics_line=metrics,
            render_seconds=render_s,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )
    dest = unique_path(
        job_media_dir(output_dir, stamp=timestamp_now()),
        make_output_stem(prompt_for_name, spec.key, stamp=timestamp_now(), kind=kind),
        ".png",
    )
    try:
        download_url(out_url, dest)
    except FalClientError as exc:
        return ToolResult(ok=False, status=str(exc), cost_label=cost_lbl, model=spec.label)
    return ToolResult(
        ok=True,
        path=str(dest.resolve()),
        status=f"{spec.label} OK. {metrics}.",
        metrics_line=metrics,
        cost_label=cost_lbl,
        notes=[spec.notes] if spec.notes else [],
        render_seconds=render_s,
        model=spec.label,
        model_key=spec.key,
        endpoint=spec.endpoint,
        job_kind=kind,
    )


def _run_video(
    *,
    spec: ToolSpec,
    video_path: str,
    arguments: dict[str, Any],
    output_dir: str | Path,
    prompt_for_name: str,
    kind: str,
    est_usd: float,
    est_label: str,
) -> ToolResult:
    path = Path(video_path)
    if not path.is_file():
        return ToolResult(ok=False, status="Tool needs a video.")
    try:
        url = upload_file(path)
    except (FalClientError, Exception) as exc:
        return ToolResult(ok=False, status=friendly_error(exc, context=spec.label), cost_label=est_label)
    args = dict(arguments)
    if "video_url" not in args:
        args["video_url"] = url
    elif not str(args.get("video_url") or "").startswith("http"):
        args["video_url"] = url
    t0 = time.perf_counter()
    try:
        result = subscribe(spec.endpoint, args)
    except FalClientError as exc:
        return ToolResult(
            ok=False,
            status=str(exc),
            cost_label=est_label,
            render_seconds=time.perf_counter() - t0,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )
    render_s = time.perf_counter() - t0
    exact = extract_cost_usd_from_response(result)
    cost_usd = exact if exact is not None else est_usd
    cost_lbl = format_cost_label(cost_usd, estimate=exact is None)
    metrics = format_render_metrics(render_s, cost_usd, cost_is_estimate=exact is None)
    out_url = extract_video_url(result)
    if not out_url:
        return ToolResult(
            ok=False,
            status=f"{spec.label}: fal returned no video.",
            cost_label=cost_lbl,
            metrics_line=metrics,
            render_seconds=render_s,
            model=spec.label,
            model_key=spec.key,
            endpoint=spec.endpoint,
            job_kind=kind,
        )
    dest = unique_path(
        job_media_dir(output_dir, stamp=timestamp_now()),
        make_output_stem(prompt_for_name, spec.key, stamp=timestamp_now(), kind=kind),
        ".mp4",
    )
    try:
        download_url(out_url, dest)
    except FalClientError as exc:
        return ToolResult(ok=False, status=str(exc), cost_label=cost_lbl, model=spec.label)
    return ToolResult(
        ok=True,
        path=str(dest.resolve()),
        status=f"{spec.label} OK. {metrics}.",
        metrics_line=metrics,
        cost_label=cost_lbl,
        notes=[spec.notes] if spec.notes else [],
        render_seconds=render_s,
        model=spec.label,
        model_key=spec.key,
        endpoint=spec.endpoint,
        job_kind=kind,
    )


def generate_tool(
    *,
    category: str,
    model_id: str,
    source_path: str,
    kind: str,
    factor: str | None = None,
    strength: float | None = None,
    prompt: str | None = None,
    duration_s: float | None = None,
    output_dir: str | Path,
) -> ToolResult:
    media = (kind or "").strip().lower()
    if media not in ("image", "video"):
        p = Path(source_path)
        media = "video" if p.suffix.lower() in {".mp4", ".mov", ".webm", ".m4v"} else "image"
    spec = resolve_tool(model_id, category, media)
    if spec is None:
        return ToolResult(ok=False, status=f"Unknown {category} model.")
    dur = float(duration_s or 5.0)
    cat = (category or "").strip().lower()

    if cat == "upscale" and media == "image":
        try:
            scale = float(factor or 2)
        except (TypeError, ValueError):
            scale = 2.0
        args = build_upscale_args(spec, "pending", upscale_factor=scale)
        return _run_image(
            spec=spec,
            image_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name=f"upscale-x{scale}",
            kind="upscale",
            est_usd=spec.cost_estimate_usd,
            est_label=format_tool_cost(spec, mode="image"),
        )

    if cat == "upscale" and media == "video":
        target = factor or "1080p"
        try:
            scale = float(target)
            target_label = None
            upscale_factor = scale
        except (TypeError, ValueError):
            target_label = target
            upscale_factor = None
        args = build_video_upscale_args(
            spec, "pending", target_label=target_label, upscale_factor=upscale_factor
        )
        est = estimate_video_upscale_cost(spec, target_label=target_label or "1080p", duration_s=dur)
        return _run_video(
            spec=spec,
            video_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name=f"vupscale-{target}",
            kind="upscale",
            est_usd=est,
            est_label=format_video_upscale_cost(
                spec, target_label=target_label or "1080p", duration_s=dur
            ),
        )

    if cat == "denoise":
        try:
            scale = float(factor or 1)
        except (TypeError, ValueError):
            scale = 1.0
        args = build_video_denoise_args(spec, "pending", upscale_factor=scale)
        est = estimate_video_denoise_cost(spec, duration_s=dur, upscale_factor=scale)
        return _run_video(
            spec=spec,
            video_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name="denoise",
            kind="denoise",
            est_usd=est,
            est_label=format_video_denoise_cost(spec, duration_s=dur, upscale_factor=scale),
        )

    if cat == "deblur" and media == "image":
        args = build_nafnet_deblur_args("pending") if "nafnet" in spec.endpoint else {
            **spec.extra_defaults,
            "image_url": "pending",
        }
        return _run_image(
            spec=spec,
            image_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name="deblur",
            kind="deblur",
            est_usd=spec.cost_estimate_usd,
            est_label=format_tool_cost(spec, mode="image"),
        )

    if cat == "deblur" and media == "video":
        try:
            scale = float(factor or 1)
        except (TypeError, ValueError):
            scale = 1.0
        args = build_video_denoise_args(spec, "pending", upscale_factor=scale)
        est = estimate_video_denoise_cost(spec, duration_s=dur, upscale_factor=scale)
        return _run_video(
            spec=spec,
            video_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name="deblur",
            kind="deblur",
            est_usd=est,
            est_label=format_video_denoise_cost(spec, duration_s=dur, upscale_factor=scale),
        )

    if cat == "restore" and media == "image":
        if spec.key == "codeformer":
            fid = 0.7 if strength is None else float(strength)
            args = build_codeformer_args("pending", fidelity=fid, upscale_factor=1.0)
        elif "nafnet" in spec.endpoint:
            args = build_nafnet_deblur_args("pending")
        else:
            args = dict(spec.extra_defaults)
            args["prompt"] = restore_prompt(prompt)
            args["image_url"] = "pending"
        return _run_image(
            spec=spec,
            image_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name="restore",
            kind="restore",
            est_usd=spec.cost_estimate_usd,
            est_label=format_tool_cost(spec, mode="image"),
        )

    if cat == "restore" and media == "video":
        args = dict(spec.extra_defaults)
        args["prompt"] = restore_prompt(prompt)
        args["video_url"] = "pending"
        return _run_video(
            spec=spec,
            video_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name="restore",
            kind="restore",
            est_usd=spec.cost_estimate_usd,
            est_label=format_tool_cost(spec, mode="video", duration_s=dur),
        )

    if cat == "interpolate":
        label = factor or INTERPOLATE_FACTOR_CHOICES[0]
        n = parse_interpolate_factor(label)
        args = build_video_interpolate_args(spec, "pending", factor_label=label, num_frames=n)
        est = estimate_video_interpolate_cost(spec, factor_label=label, duration_s=dur)
        return _run_video(
            spec=spec,
            video_path=source_path,
            arguments=args,
            output_dir=output_dir,
            prompt_for_name=f"interp-{label}",
            kind="interpolate",
            est_usd=est,
            est_label=format_video_interpolate_cost(spec, factor_label=label, duration_s=dur),
        )

    return ToolResult(ok=False, status=f"{spec.label} is not wired for {cat}/{media}.")


def estimate_tool_label(
    *,
    category: str,
    model_id: str,
    kind: str,
    factor: str | None = None,
    duration_s: float | None = None,
) -> str:
    spec = resolve_tool(model_id, category, kind)
    if spec is None:
        return "Est. cost: —"
    dur = float(duration_s or 5.0)
    if category == "upscale" and kind == "video":
        return format_video_upscale_cost(spec, target_label=factor or "1080p", duration_s=dur)
    if category == "denoise":
        try:
            scale = float(factor or 1)
        except (TypeError, ValueError):
            scale = 1.0
        return format_video_denoise_cost(spec, duration_s=dur, upscale_factor=scale)
    if category == "interpolate":
        return format_video_interpolate_cost(
            spec, factor_label=factor or INTERPOLATE_FACTOR_CHOICES[0], duration_s=dur
        )
    return format_tool_cost(spec, mode=kind, duration_s=dur)
