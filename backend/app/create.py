"""
Create router — one generate(CreateState) path for Studio + Creative Vision.

Dispatches to the same fal helpers as today (services.generate / run_vision).
No user-facing behavior change: same results, same costs.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from app.create_catalog import (
    ModelEntry,
    all_models,
    default_model_for,
    get_model,
    is_first_last_capable,
    list_models,
    list_models_for_ui,
    list_slots,
    resolve_model,
)
from app.create_state import (
    IMAGE_MODALITIES,
    CreateParams,
    CreateSlots,
    CreateState,
    is_image_modality,
    modality_from_vision_mode,
    vision_mode_from_modality,
)

ProgressCallback = Callable[[str], None]


@dataclass
class CreateResult:
    """Unified result — duck-types both GenerateResult and VisionResult."""

    ok: bool
    status: str = ""
    errors: list[str] = field(default_factory=list)
    image_paths: list[str] = field(default_factory=list)
    video_path: str | None = None
    paths: list[str] = field(default_factory=list)
    model: str = ""
    model_key: str = ""
    endpoint: str = ""
    job_kind: str = ""
    cost_estimate: str = ""
    cost_label: str = ""
    notes: list[str] = field(default_factory=list)
    metrics_line: str = ""
    is_draft: bool = False
    draft_cache_url: str | None = None
    render_seconds: float | None = None
    timestamp: str = ""

    @property
    def path(self) -> str | None:
        if self.video_path:
            return self.video_path
        if self.paths:
            return self.paths[-1]
        if self.image_paths:
            return self.image_paths[-1]
        return None

    @property
    def primary_image(self) -> str | None:
        return self.image_paths[-1] if self.image_paths else None


def _from_generate(r: Any) -> CreateResult:
    images = list(getattr(r, "image_paths", None) or [])
    video = getattr(r, "video_path", None)
    paths = list(images)
    if video and video not in paths:
        paths.append(video)
    return CreateResult(
        ok=bool(getattr(r, "ok", False)),
        status=getattr(r, "status", "") or "",
        image_paths=images,
        video_path=video,
        paths=paths,
        model=getattr(r, "model", "") or "",
        model_key=getattr(r, "model", "") or "",
        job_kind=getattr(r, "job_kind", "") or "",
        cost_estimate=getattr(r, "cost_estimate", "") or "",
        cost_label=getattr(r, "cost_estimate", "") or "",
        notes=list(getattr(r, "notes", None) or []),
        metrics_line=getattr(r, "metrics_line", "") or "",
        is_draft=bool(getattr(r, "is_draft", False)),
        draft_cache_url=getattr(r, "draft_cache_url", None),
        render_seconds=getattr(r, "render_seconds", None),
    )


def _from_vision(r: Any, *, still: bool) -> CreateResult:
    paths = list(getattr(r, "paths", None) or [])
    primary = getattr(r, "path", None)
    if primary and primary not in paths:
        paths.append(primary)
    if still:
        images = paths
        video = None
        kind = "image"
    else:
        images = []
        video = primary or (paths[-1] if paths else None)
        kind = "video"
    cost = getattr(r, "cost_label", "") or ""
    return CreateResult(
        ok=bool(getattr(r, "ok", False)),
        status=getattr(r, "status", "") or "",
        image_paths=images,
        video_path=video,
        paths=paths,
        model=getattr(r, "model_key", "") or "",
        model_key=getattr(r, "model_key", "") or "",
        endpoint=getattr(r, "endpoint", "") or "",
        job_kind=kind,
        cost_estimate=cost,
        cost_label=cost,
        notes=list(getattr(r, "notes", None) or []),
        metrics_line=getattr(r, "metrics_line", "") or cost,
        is_draft=bool(getattr(r, "is_draft", False)),
        draft_cache_url=getattr(r, "draft_cache_url", None),
        timestamp=getattr(r, "timestamp", "") or "",
    )


def _fail(msg: str, errors: list[str] | None = None, *, model: str = "") -> CreateResult:
    errs = list(errors or [msg])
    return CreateResult(ok=False, status=msg, errors=errs, model=model, model_key=model)


def _file_ok(path: str | None) -> bool:
    return bool(path and Path(path).is_file())


def validate(state: CreateState) -> list[str]:
    """Return human-readable errors; empty list means the state can generate."""
    errors: list[str] = []
    if not isinstance(state, CreateState):
        return ["Internal: generate() expected a CreateState."]
    modality = state.modality
    entry = resolve_model(
        state.model_id,
        mode=state.mode,
        modality=modality,
        surface=state.surface,
    )
    if entry is None:
        errors.append(f"Unknown model: {state.model_id or '(none)'}.")
        return errors
    if modality and modality not in entry.modalities:
        errors.append(
            f"{entry.label} does not support {modality} "
            f"(supports {', '.join(entry.modalities)})."
        )

    slots = state.slots or CreateSlots()
    prompt = (state.prompt or "").strip()
    # Match today's helpers: I2V may run without a prompt; everything else needs one
    if not prompt and modality != "i2v":
        errors.append("Enter a prompt.")

    def _need(slot: str, msg: str) -> None:
        if not slots.filled(slot):
            errors.append(msg)

    if modality == "i2i":
        _need("start_still", "Image→Image needs a source still.")
    elif modality == "region":
        _need("start_still", "Region mode needs a source still.")
    elif modality == "r2i":
        if not slots.filled("ref_images") and not slots.filled("start_still"):
            errors.append(
                "R2I needs Character / Scene / Prop refs "
                "(or an optional edit plate as source)."
            )
    elif modality == "i2v":
        if entry.requires_end_frame or "bridge" in entry.modalities:
            _need("start_still", f"{entry.label} needs a start still (first→last).")
            _need("end_still", f"{entry.label} needs start + end stills (first→last).")
        elif entry.omni:
            if (
                not slots.filled("start_still")
                and not slots.filled("ref_images")
                and not slots.filled("source_video")
                and not slots.filled("ref_videos")
            ):
                errors.append(
                    "Omni reference needs a still and/or motion clip."
                )
        else:
            if not slots.filled("start_still") and not slots.filled("ref_images"):
                errors.append("I2V needs a start / source frame.")
    elif modality == "r2v":
        if (
            not slots.filled("ref_images")
            and not slots.filled("start_still")
            and not slots.filled("source_video")
            and not slots.filled("ref_videos")
        ):
            errors.append(
                "R2V needs at least one reference still or motion clip."
            )
    elif modality == "v2v":
        _need("source_video", "V2V needs a source clip.")
    elif modality == "bridge":
        _need("start_still", "Bridge needs a start still.")
        _need("end_still", "Bridge needs an end still (first→last).")
    elif modality == "extend":
        _need("source_video", "Extend needs a source video clip.")

    dur = (state.params.duration if state.params else None) or ""
    dur_n = None
    if dur:
        raw = str(dur).strip().lower().rstrip("s").strip()
        if raw and raw != "auto":
            try:
                dur_n = int(round(float(raw)))
            except (TypeError, ValueError):
                dur_n = None
    if dur_n is not None:
        if entry.duration_min is not None and dur_n < entry.duration_min:
            errors.append(
                f"{entry.label} duration must be ≥ {entry.duration_min}s "
                f"(got {dur_n}s)."
            )
        if entry.duration_max is not None and dur_n > entry.duration_max:
            errors.append(
                f"{entry.label} duration must be ≤ {entry.duration_max}s "
                f"(got {dur_n}s)."
            )
        if entry.duration_enum:
            allowed_nums = set()
            for tok in entry.duration_enum:
                t = str(tok).strip().lower().rstrip("s")
                if t == "auto":
                    continue
                try:
                    allowed_nums.add(int(round(float(t))))
                except (TypeError, ValueError):
                    pass
            if allowed_nums and dur_n not in allowed_nums:
                errors.append(
                    f"{entry.label} duration {dur_n}s is not in the allowed set."
                )
    return errors


def _studio_parameters_json(state: CreateState) -> str:
    extra: dict[str, Any] = {}
    raw = (state.params.parameters_json or "").strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                extra.update(parsed)
        except json.JSONDecodeError:
            pass
    extra.update(state.params.extra or {})
    p = state.params
    if p.duration is not None and "duration" not in extra:
        extra["duration"] = p.duration
    if p.aspect and "aspect_ratio" not in extra:
        extra["aspect_ratio"] = p.aspect
    if p.resolution and "resolution" not in extra:
        extra["resolution"] = p.resolution
    if p.strength is not None and "strength" not in extra:
        extra["strength"] = p.strength
    if p.audio_on is not None:
        extra.setdefault("generate_audio", p.audio_on)
    if p.num_images is not None:
        extra.setdefault("num_images", p.num_images)
    if p.draft:
        extra["draft"] = True
        extra["draft_first"] = True
    if state.slots.end_still and _file_ok(state.slots.end_still):
        extra.setdefault("end_image_path", state.slots.end_still)
    return json.dumps(extra)


def _use_vision(state: CreateState, entry: ModelEntry) -> bool:
    if state.surface == "vision":
        return True
    if entry.backend == "vision":
        return True
    if state.modality in ("t2i", "t2v", "bridge", "extend"):
        return True
    return False


def _dispatch_studio(
    state: CreateState,
    entry: ModelEntry,
    on_progress: ProgressCallback | None,
) -> CreateResult:
    from app.services import generate as studio_generate

    slots = state.slots
    image_file = slots.start_still if _file_ok(slots.start_still) else None
    video_file = slots.source_video if _file_ok(slots.source_video) else None
    extras = slots.existing_files("ref_images")
    if image_file:
        extras = [p for p in extras if Path(p).resolve() != Path(image_file).resolve()]
    result = studio_generate(
        prompt=state.prompt,
        model_choice=entry.source_key or entry.label or state.model_id,
        image_file=image_file,
        video_file=video_file,
        output_dir=state.output_dir,
        parameters_json=_studio_parameters_json(state),
        on_progress=on_progress,
        scenario=state.scenario,
        extra_image_files=extras or None,
    )
    return _from_generate(result)


def _dispatch_vision(
    state: CreateState,
    entry: ModelEntry,
    on_progress: ProgressCallback | None,
) -> CreateResult:
    from app.vision_registry import is_still_mode
    from app.vision_service import run_vision

    slots = state.slots
    p = state.params
    modality = state.modality
    vmode = entry.vision_mode or vision_mode_from_modality(modality)
    still = is_still_mode(vmode) or modality in IMAGE_MODALITIES

    start = slots.start_still if _file_ok(slots.start_still) else None
    end = slots.end_still if _file_ok(slots.end_still) else None
    src_vid = slots.source_video if _file_ok(slots.source_video) else None
    refs = slots.existing_files("ref_images")
    ref_vids = slots.existing_files("ref_videos")
    ref_auds = slots.existing_files("ref_audios")

    image_path = None
    first_frame = None
    last_frame = None
    source_video = None
    if modality == "bridge":
        first_frame = start
        last_frame = end
    elif modality == "extend" or modality == "v2v":
        source_video = src_vid
    elif modality in ("i2i", "r2i", "i2v", "r2v", "region"):
        image_path = start
        if modality == "i2v":
            last_frame = end
    elif modality == "t2i":
        pass
    elif modality == "t2v":
        pass

    want_refs = modality in (
        "i2i",
        "r2i",
        "i2v",
        "r2v",
        "t2v",
        "t2i",
    ) or entry.omni

    result = run_vision(
        mode=vmode,  # type: ignore[arg-type]
        prompt=state.prompt,
        model_label=entry.source_key or entry.label or state.model_id,
        image_path=image_path,
        first_frame_path=first_frame,
        last_frame_path=last_frame,
        ref_paths=(refs or None) if want_refs else None,
        ref_video_paths=(ref_vids or None) if (entry.omni and not still) else None,
        ref_audio_paths=(ref_auds or None) if (entry.omni and not still) else None,
        source_video_path=source_video,
        duration=None if still else p.duration,
        aspect_ratio=p.aspect,
        resolution=p.resolution,
        negative_prompt=p.negative_prompt,
        generate_audio=None if still else p.audio_on,
        strength=p.strength,
        num_images=p.num_images if modality == "t2i" else None,
        draft=bool(p.draft) and not still,
        output_dir=state.output_dir or Path("."),
        on_progress=on_progress,
    )
    return _from_vision(result, still=still)


def generate(
    state: CreateState,
    *,
    on_progress: ProgressCallback | None = None,
) -> CreateResult:
    """
    Single generate path: validate → dispatch to today's fal/Runware helpers.

    Studio I2I / R2I / Region / I2V / R2V / V2V → ``services.generate``.
    Studio T2I / T2V and all Creative Vision modes → ``run_vision``.
    """
    errors = validate(state)
    if errors:
        return _fail(errors[0], errors, model=state.model_id)
    entry = resolve_model(
        state.model_id,
        mode=state.mode,
        modality=state.modality,
        surface=state.surface,
    )
    if entry is None:
        return _fail(f"Unknown model: {state.model_id}", model=state.model_id)
    if _use_vision(state, entry):
        return _dispatch_vision(state, entry, on_progress)
    return _dispatch_studio(state, entry, on_progress)


def estimate_create_cost(state: CreateState) -> str:
    """Est. cost label for the current CreateState (existing helpers)."""
    entry = resolve_model(
        state.model_id,
        mode=state.mode,
        modality=state.modality,
        surface=state.surface,
    )
    if entry is None:
        return "Est. cost: —"
    p = state.params or CreateParams()
    if entry.cost_fn == "vision" or entry.backend == "vision":
        from app.vision_registry import find_vision_model, format_vision_cost

        spec = find_vision_model(
            entry.source_key or entry.label,
            entry.vision_mode or None,  # type: ignore[arg-type]
        )
        if spec is not None:
            return format_vision_cost(
                spec,
                duration_token=p.duration,
                resolution=p.resolution,
                aspect_ratio=p.aspect,
                generate_audio=p.audio_on,
                num_images=p.num_images,
            )
    from app.pricing import live_estimate_cost

    return live_estimate_cost(
        model_choice=entry.label or state.model_id,
        image_file=state.slots.start_still if state.slots else None,
        video_file=state.slots.source_video if state.slots else None,
        parameters_json={
            "duration": p.duration,
            "aspect_ratio": p.aspect,
            "resolution": p.resolution,
            "generate_audio": p.audio_on,
            "num_images": p.num_images,
        },
    )


__all__ = [
    "CreateParams",
    "CreateResult",
    "CreateSlots",
    "CreateState",
    "ModelEntry",
    "all_models",
    "default_model_for",
    "estimate_create_cost",
    "generate",
    "get_model",
    "is_first_last_capable",
    "list_models",
    "list_models_for_ui",
    "list_slots",
    "modality_from_vision_mode",
    "resolve_model",
    "validate",
]
