"""
FastAPI entry for AI Media Studio V2.

Phase 1: Prompt → Generate → Result (catalog + generate ported from V1).
"""

from __future__ import annotations

import os
import time
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Load repo-root .env (never commit real keys)
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_REPO_ROOT / ".env")

from app.audio_registry import default_voices_for_model  # noqa: E402
from app.audio_service import (  # noqa: E402
    duration_tokens,
    estimate_audio_label,
    generate_audio,
    resolve_audio_spec,
    ui_audio_registries,
)
from app.tools_service import (  # noqa: E402
    estimate_tool_label,
    generate_tool,
    list_tools,
    resolve_tool,
)
from app.config import APP_TITLE, OUTPUT_DIR, ensure_output_dir  # noqa: E402
from app.character_scene import (  # noqa: E402
    list_characters,
    list_props,
    list_scenes,
    resolve_still_file,
    v1_root,
)
from app.assets import (  # noqa: E402
    attach_identity_bytes,
    attach_identity_still,
    create_asset,
    delete_asset,
    ensure_assets_dir,
    generate_asset,
    get_asset,
    list_assets,
    public_asset,
    resolve_asset_still,
    save_sheet,
    sheet_model_ok,
    update_asset,
)
from app.sheet import (  # noqa: E402
    builder_fields,
    compose_angle_prompt,
    estimate_sheet_cost,
    generate_angle,
    short_generate_error,
)
from app.aleph_service import (  # noqa: E402
    estimate_frame_label,
    extract_pin_still,
    frame_models_for_ui,
    keyframes_from_payload,
    run_aleph_keyframe_edit,
    save_pin_from_data_url,
    apply_pin_still,
)
from app.video_prep import prepare_aleph_source  # noqa: E402
from app.create import CreateResult, estimate_create_cost, generate  # noqa: E402
from app.enhance import enhance_prompt_text  # noqa: E402
from app.create_catalog import default_model_for, list_models_for_ui, resolve_model  # noqa: E402
from app.create_state import CreateParams, CreateSlots, CreateState  # noqa: E402
from app.runware_client import has_runware_key  # noqa: E402
from app.library import (  # noqa: E402
    delete_library_item,
    ensure_library_dirs,
    import_upload,
    inbox_status,
    is_allowed_path,
    kind_for,
    list_library,
    list_source,
    purge_expired,
    record_generated,
    resolve_handoff_dir,
    resolve_library_file,
    reveal_in_folder,
    set_pinned,
    thumb_path,
    write_upload,
)
from app.prefs import load_prefs, save_prefs  # noqa: E402
from app.prompt_builder import apply_builder, list_builder_scenarios  # noqa: E402
from app.director import apply_director, list_director_fields  # noqa: E402
from app.storyboard import list_storyboard_models  # noqa: E402
from app.shot_builder import apply_shot_builder, list_shot_builder_fields  # noqa: E402
from app.resolve_export import send_file_to_resolve  # noqa: E402
from app.billing import (  # noqa: E402
    dashboard_urls,
    fetch_fal_balance,
    fetch_runware_balance,
    fetch_xai_balance,
)
from app.secrets_store import (  # noqa: E402
    apply_secrets_to_env,
    effective_fal_key,
    effective_runware_key,
    effective_xai_key,
    mask_key,
    save_secrets,
)
from app.spend_ledger import export_csv, log_spend, spend_summary  # noqa: E402

apply_secrets_to_env()
ensure_output_dir(OUTPUT_DIR)
ensure_library_dirs()
ensure_assets_dir()
try:
    purge_expired()
except Exception:
    pass

APP_VERSION = "2.0.0-phase18"

app = FastAPI(title=APP_TITLE, version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RefRoleIn(BaseModel):
    path: str
    role: str
    id: str | None = None
    name: str | None = None
    note: str | None = None


class KeyframeIn(BaseModel):
    image_path: str
    pin: str = "timestamp"
    timestamp_s: float | None = None


class SlotsIn(BaseModel):
    start_still: str | None = None
    end_still: str | None = None
    source_video: str | None = None
    ref_images: list[str] = Field(default_factory=list)
    ref_videos: list[str] = Field(default_factory=list)
    ref_audios: list[str] = Field(default_factory=list)
    character_ids: list[str] = Field(default_factory=list)
    scene_ids: list[str] = Field(default_factory=list)
    ref_roles: list[RefRoleIn] = Field(default_factory=list)
    keyframes: list[KeyframeIn] = Field(default_factory=list)
    mask: str | None = None


class ExtractFrameIn(BaseModel):
    video_path: str
    seconds: float = 0.0


class FramePinIn(BaseModel):
    image: str
    timestamp_s: float = 0.0
    source_path: str | None = None


class FrameApplyIn(BaseModel):
    image_path: str
    timestamp_s: float = 0.0
    source_path: str | None = None
    pin_id: str | None = None


class PrepareAlephIn(BaseModel):
    video_path: str


class ParamsIn(BaseModel):
    duration: str | None = None
    aspect: str | None = None
    resolution: str | None = None
    strength: float | None = None
    audio_on: bool | None = None
    negative_prompt: str | None = None
    num_images: int | None = None
    seed: int | None = None
    draft: bool = False
    parameters_json: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class RevealIn(BaseModel):
    path: str


class ResolveSendIn(BaseModel):
    path: str
    type: str | None = None
    job_name: str | None = None
    model: str | None = None
    cost: str | None = None


class ToolRunIn(BaseModel):
    category: str
    model_id: str
    source_path: str
    kind: str = "image"
    factor: str | None = None
    strength: float | None = None
    prompt: str | None = None
    duration_s: float | None = None


class SettingsKeysIn(BaseModel):
    fal_key: str | None = None
    xai_api_key: str | None = None
    runware_key: str | None = None
    clear_fal: bool = False
    clear_xai: bool = False
    clear_runware: bool = False


class SettingsOpenIn(BaseModel):
    which: str


class SettingsPrefsIn(BaseModel):
    retention_days: int | None = None
    theme: str | None = None
    grid_snap: str | None = None
    edge_style: str | None = None


class BuilderApplyIn(BaseModel):
    scenario_key: str
    fields: dict[str, Any] = Field(default_factory=dict)
    mode: str = "image"
    modality: str = ""


class DirectorApplyIn(BaseModel):
    fields: dict[str, Any] = Field(default_factory=dict)


class LibraryPinIn(BaseModel):
    pinned: bool = True
    id: str | None = None


class EnhanceIn(BaseModel):
    prompt: str
    model_id: str = ""
    modality: str = "t2i"
    mode: str = "image"
    refs: list[RefRoleIn] = Field(default_factory=list)
    image_urls: list[str] = Field(default_factory=list)


class CreateStateIn(BaseModel):
    """JSON body for POST /generate and POST /estimate — maps onto V1 CreateState."""

    mode: str = "image"
    modality: str = "t2i"
    model_id: str = ""
    slots: SlotsIn = Field(default_factory=SlotsIn)
    params: ParamsIn = Field(default_factory=ParamsIn)
    prompt: str = ""
    enhance_direction: str | None = None
    surface: str = "studio"
    scenario: str | None = None
    output_dir: str | None = None


def _slots_from_body(raw: SlotsIn) -> CreateSlots:
    return CreateSlots(
        start_still=raw.start_still,
        end_still=raw.end_still,
        source_video=raw.source_video,
        ref_images=list(raw.ref_images or []),
        ref_videos=list(raw.ref_videos or []),
        ref_audios=list(raw.ref_audios or []),
        character_ids=list(raw.character_ids or []),
        scene_ids=list(raw.scene_ids or []),
        mask=raw.mask,
    )


def _params_from_body(raw: ParamsIn) -> CreateParams:
    return CreateParams(
        duration=raw.duration,
        aspect=raw.aspect,
        resolution=raw.resolution,
        strength=raw.strength,
        audio_on=raw.audio_on,
        negative_prompt=raw.negative_prompt,
        num_images=raw.num_images,
        seed=raw.seed,
        draft=bool(raw.draft),
        parameters_json=raw.parameters_json,
        extra=dict(raw.extra or {}),
    )


def _state_from_body(body: CreateStateIn) -> CreateState:
    out_dir: str | Path | None = body.output_dir or OUTPUT_DIR
    params = _params_from_body(body.params)
    roles = [
        r.model_dump()
        for r in (body.slots.ref_roles or [])
        if (r.path or "").strip() and (r.role or "").strip()
    ]
    if roles:
        params.extra.setdefault("ref_roles", roles)
    return CreateState(
        mode=body.mode,  # type: ignore[arg-type]
        modality=body.modality,
        model_id=body.model_id,
        slots=_slots_from_body(body.slots),
        params=params,
        prompt=body.prompt,
        enhance_direction=body.enhance_direction,
        surface=body.surface,  # type: ignore[arg-type]
        scenario=body.scenario,
        output_dir=out_dir,
    )


def _jsonable(value: Any) -> Any:
    if is_dataclass(value) and not isinstance(value, type):
        return {k: _jsonable(v) for k, v in asdict(value).items()}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def _public_paths(paths: list[str]) -> list[str]:
    """Turn local output paths into /outputs/... URLs the web UI can load."""
    root = OUTPUT_DIR.resolve()
    out: list[str] = []
    for raw in paths:
        if not raw:
            continue
        text = str(raw).strip()
        if text.startswith("/outputs/") or text.startswith("http://") or text.startswith("https://"):
            out.append(text)
            continue
        try:
            rel = Path(text).resolve().relative_to(root)
        except (OSError, ValueError):
            continue
        out.append("/outputs/" + rel.as_posix())
    return out


def _collect_result_paths(result: CreateResult) -> list[str]:
    seen: list[str] = []
    for raw in list(result.paths) + list(result.image_paths) + (
        [result.video_path] if result.video_path else []
    ):
        if raw and raw not in seen:
            seen.append(raw)
    return _public_paths(seen)


def _error_message(result: CreateResult) -> str | None:
    if result.ok:
        return None
    if result.errors:
        return str(result.errors[0])
    return (result.status or "Generate failed.").strip() or "Generate failed."


def _audio_models(modality: str | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for category, registry in ui_audio_registries(modality).items():
        for spec in registry.values():
            toks, default_dur = duration_tokens(spec)
            voices = default_voices_for_model(spec) if spec.supports_voice else []
            rows.append(
                {
                    "id": f"audio:{spec.key}",
                    "label": spec.label,
                    "mode": "audio",
                    "modality": spec.category or category,
                    "endpoint": spec.endpoint,
                    "notes": spec.notes,
                    "cost_estimate_usd": spec.cost_estimate_usd,
                    "pricing_mode": spec.resolved_pricing_mode(),
                    "cost": estimate_audio_label(spec.key, spec.category),
                    "backend": "audio",
                    "source_key": spec.key,
                    "supports_duration": spec.supports_duration,
                    "duration_min": spec.duration_min_s if spec.supports_duration else None,
                    "duration_max": spec.duration_max_s if spec.supports_duration else None,
                    "duration_enum": toks,
                    "default_duration": default_dur,
                    "supports_voice": spec.supports_voice,
                    "default_voice": spec.default_voice or None,
                    "voices": voices,
                }
            )
    return rows


def _audio_estimate(
    model_id: str,
    modality: str | None,
    *,
    duration: str | None = None,
    prompt: str | None = None,
) -> str:
    return estimate_audio_label(model_id, modality, duration=duration, prompt=prompt)


def _log_job_spend(
    *,
    ok: bool,
    cost: str,
    model_id: str | None = None,
    job_kind: str | None = None,
) -> None:
    if not ok:
        return
    try:
        log_spend(cost=cost, model_id=model_id, job_kind=job_kind)
    except Exception:
        pass


def _payload(
    *,
    ok: bool,
    result_paths: list[str],
    cost: str,
    duration_sec: float,
    error: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "ok": ok,
        "result_paths": result_paths,
        "cost": cost,
        "duration_sec": round(float(duration_sec), 3),
        "error": error,
    }
    if extra:
        body.update(extra)
    return body


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "app": APP_TITLE,
        "version": APP_VERSION,
        "output_dir": str(OUTPUT_DIR),
        "keys": {
            "fal": bool(os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")),
            "xai": bool(os.environ.get("XAI_API_KEY") or os.environ.get("XAI_KEY")),
            "runware": has_runware_key(),
        },
        "v1_root": str(v1_root()) if v1_root() else None,
    }


@app.get("/models")
def list_models_endpoint(
    mode: str | None = Query(default=None, description="image | video | frame | audio"),
    modality: str | None = Query(
        default=None,
        description="e.g. t2i, i2v, music — depends on mode",
    ),
) -> dict[str, Any]:
    want_mode = (mode or "").strip().lower() or None
    if want_mode == "audio":
        models = _audio_models(modality)
        default_id = models[0]["id"] if models else None
        return {
            "mode": "audio",
            "modality": modality,
            "default_id": default_id,
            "models": models,
        }
    if want_mode == "frame":
        models = frame_models_for_ui()
        default_id = models[0]["id"] if models else None
        return {
            "mode": "frame",
            "modality": "frame",
            "default_id": default_id,
            "models": models,
        }
    if want_mode == "storyboard":
        pack = list_storyboard_models()
        return {
            "mode": "storyboard",
            "modality": "r2v",
            "default_id": pack.get("default_id"),
            "primary": pack.get("primary"),
            "notes": pack.get("notes"),
            "models": [_jsonable(e) for e in pack.get("models") or []],
        }
    if want_mode and want_mode not in ("image", "video"):
        raise HTTPException(
            status_code=400,
            detail="mode must be image, video, frame, storyboard, or audio",
        )
    entries = list_models_for_ui(want_mode, modality)
    default = default_model_for(want_mode, modality)
    return {
        "mode": want_mode,
        "modality": modality,
        "default_id": default.id if default else (entries[0].id if entries else None),
        "models": [_jsonable(e) for e in entries],
    }


@app.get("/estimate")
def estimate_get(
    mode: str = Query(default="image"),
    modality: str = Query(default="t2i"),
    model_id: str = Query(default=""),
    duration: str | None = Query(default=None),
    aspect: str | None = Query(default=None),
    resolution: str | None = Query(default=None),
    generate_audio: bool | None = Query(default=None),
    prompt: str | None = Query(default=None),
    factor: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    num_images: int | None = Query(default=None),
    draft: bool | None = Query(default=None),
) -> dict[str, Any]:
    """Cost-only estimate from catalog helpers (query form)."""
    extra: dict[str, Any] = {}
    if factor:
        extra["factor"] = factor
    if kind:
        extra["kind"] = kind
    body = CreateStateIn(
        mode=mode,
        modality=modality,
        model_id=model_id,
        prompt=prompt or "",
        params=ParamsIn(
            duration=duration,
            aspect=aspect,
            resolution=resolution,
            audio_on=generate_audio,
            num_images=num_images,
            draft=bool(draft),
            extra=extra,
        ),
    )
    return _estimate_payload(body)


class DraftEnhanceIn(BaseModel):
    draft_cache_url: str
    duration: str | None = None
    model_id: str | None = None


@app.post("/draft-enhance")
def draft_enhance_endpoint(body: DraftEnhanceIn) -> dict[str, Any]:
    """FLUX 3 draft-enhance: full-quality clip from a stored draft_cache_url."""
    from app.flux3_draft import run_draft_enhance

    t0 = time.perf_counter()
    enhanced = run_draft_enhance(
        draft_cache_url=body.draft_cache_url,
        output_dir=OUTPUT_DIR,
        prompt_hint="flux3-enhance",
        model_key=body.model_id or "flux 3 enhance",
    )
    elapsed = time.perf_counter() - t0
    local_paths = [enhanced.path] if enhanced.path else []
    cost = enhanced.cost_estimate or enhanced.metrics_line or ""
    if enhanced.ok and local_paths:
        record_generated(
            local_paths,
            cost=cost,
            duration_sec=elapsed,
            model=body.model_id or "flux 3 enhance",
        )
        _log_job_spend(
            ok=True,
            cost=cost,
            model_id=body.model_id or "flux 3 enhance",
            job_kind="video",
        )
    return _payload(
        ok=enhanced.ok,
        result_paths=_public_paths(local_paths),
        cost=cost,
        duration_sec=elapsed,
        error=None if enhanced.ok else (enhanced.status or "Draft enhance failed."),
        extra={
            "status": enhanced.status,
            "local_paths": local_paths,
            "job_kind": "video",
            "notes": list(enhanced.notes or []),
            "metrics_line": enhanced.metrics_line,
            "is_draft": False,
            "draft_cache_url": None,
        },
    )


@app.post("/enhance")
def enhance_endpoint(body: EnhanceIn) -> dict[str, Any]:
    """Rewrite a prompt with xAI. Does not generate media."""
    return enhance_prompt_text(
        prompt=body.prompt,
        model_id=body.model_id,
        modality=body.modality,
        mode=body.mode,
        refs=[r.model_dump() for r in (body.refs or [])],
        image_urls=list(body.image_urls or []),
    )


@app.post("/estimate")
def estimate_post(body: CreateStateIn) -> dict[str, Any]:
    """Cost-only estimate — same CreateState body as POST /generate."""
    return _estimate_payload(body)


def _unknown_model_payload(model_id: str) -> dict[str, Any]:
    mid = (model_id or "").strip() or "(none)"
    return {
        "ok": False,
        "cost": None,
        "result_paths": [],
        "duration_sec": 0,
        "error": f"Unknown model_id: {mid}",
    }


def _estimate_payload(body: CreateStateIn) -> dict[str, Any]:
    mode = (body.mode or "").strip().lower()
    mid = (body.model_id or "").strip()
    extra = body.params.extra if isinstance(body.params.extra, dict) else {}

    if mode == "tool":
        cat = (body.modality or extra.get("category") or "").strip().lower()
        kind = str(extra.get("kind") or "video").strip().lower()
        if not mid or resolve_tool(mid, cat, kind) is None:
            return _unknown_model_payload(mid)
        from app.pricing import parse_duration_seconds

        dur = parse_duration_seconds(body.params.duration)
        cost = estimate_tool_label(
            category=cat,
            model_id=mid,
            kind=kind,
            factor=str(extra.get("factor") or body.params.resolution or "") or None,
            duration_s=dur,
        )
        return {"ok": True, "cost": cost, "result_paths": [], "duration_sec": 0, "error": None}

    if mode == "audio":
        if not mid or resolve_audio_spec(mid, body.modality) is None:
            return _unknown_model_payload(mid)
        cost = _audio_estimate(
            body.model_id,
            body.modality,
            duration=body.params.duration,
            prompt=body.prompt,
        )
        return {"ok": True, "cost": cost, "result_paths": [], "duration_sec": 0, "error": None}
    if mode == "frame":
        cost = estimate_frame_label(body.params.duration)
        return {"ok": True, "cost": cost, "result_paths": [], "duration_sec": 0, "error": None}
    if not mid or resolve_model(mid, mode=mode or None, modality=body.modality or None) is None:
        return _unknown_model_payload(mid)
    state = _state_from_body(body)
    cost = estimate_create_cost(state)
    return {"ok": True, "cost": cost, "result_paths": [], "duration_sec": 0, "error": None}


@app.post("/generate")
def generate_endpoint(body: CreateStateIn) -> dict[str, Any]:
    """
    Run V1 ``generate(CreateState)`` and return result_paths + cost + duration.
    """
    mode = (body.mode or "").strip().lower()
    if mode == "frame":
        t0 = time.perf_counter()
        pins = keyframes_from_payload(
            [k.model_dump() for k in (body.slots.keyframes or [])]
        )
        extra_pins = (body.params.extra or {}).get("keyframes")
        if extra_pins and not pins:
            pins = keyframes_from_payload(extra_pins if isinstance(extra_pins, list) else [])
        aleph = run_aleph_keyframe_edit(
            video_path=body.slots.source_video,
            prompt=body.prompt,
            keyframes=pins,
            output_dir=body.output_dir or OUTPUT_DIR,
        )
        elapsed = time.perf_counter() - t0
        duration = aleph.render_seconds if aleph.render_seconds is not None else elapsed
        cost = aleph.cost_label or aleph.metrics_line or estimate_frame_label(
            body.params.duration
        )
        local_paths = [aleph.path] if aleph.path else []
        if aleph.ok and local_paths:
            record_generated(
                local_paths,
                cost=cost,
                duration_sec=duration,
                model=aleph.model or aleph.model_key,
            )
            _log_job_spend(
                ok=True,
                cost=cost,
                model_id=aleph.model_key or body.model_id or "runware:aleph@2.0",
                job_kind=aleph.job_kind,
            )
        return _payload(
            ok=aleph.ok,
            result_paths=_public_paths(local_paths),
            cost=cost,
            duration_sec=duration,
            error=None if aleph.ok else (aleph.status or "Frame generate failed."),
            extra={
                "status": aleph.status,
                "errors": [] if aleph.ok else [aleph.status],
                "local_paths": local_paths,
                "video_path": aleph.path,
                "job_kind": aleph.job_kind,
                "model": aleph.model,
                "model_key": aleph.model_key,
                "notes": list(aleph.notes),
                "metrics_line": aleph.metrics_line,
            },
        )
    if mode == "audio":
        t0 = time.perf_counter()
        audio = generate_audio(
            modality=body.modality,
            model_id=body.model_id,
            prompt=body.prompt,
            duration=body.params.duration,
            extra=dict(body.params.extra or {}),
            output_dir=body.output_dir or OUTPUT_DIR,
        )
        elapsed = time.perf_counter() - t0
        duration = audio.render_seconds if audio.render_seconds is not None else elapsed
        cost = audio.cost_label or audio.metrics_line or _audio_estimate(
            body.model_id,
            body.modality,
            duration=body.params.duration,
            prompt=body.prompt,
        )
        local_paths = [audio.path] if audio.path else []
        if audio.ok and local_paths:
            record_generated(
                local_paths,
                cost=cost,
                duration_sec=duration,
                model=audio.model or audio.model_key,
            )
            _log_job_spend(
                ok=True,
                cost=cost,
                model_id=audio.model_key or body.model_id,
                job_kind=audio.job_kind,
            )
        return _payload(
            ok=audio.ok,
            result_paths=_public_paths(local_paths),
            cost=cost,
            duration_sec=duration,
            error=None if audio.ok else (audio.status or "Audio generate failed."),
            extra={
                "status": audio.status,
                "errors": [] if audio.ok else [audio.status],
                "local_paths": local_paths,
                "job_kind": audio.job_kind,
                "model": audio.model,
                "model_key": audio.model_key,
                "endpoint": audio.endpoint,
                "notes": list(audio.notes),
                "metrics_line": audio.metrics_line,
            },
        )
    state = _state_from_body(body)
    t0 = time.perf_counter()
    result: CreateResult = generate(state)
    elapsed = time.perf_counter() - t0
    duration = result.render_seconds if result.render_seconds is not None else elapsed
    cost = result.cost_estimate or result.cost_label or result.metrics_line or ""
    local_paths: list[str] = []
    for raw in list(result.paths) + list(result.image_paths) + (
        [result.video_path] if result.video_path else []
    ):
        if raw and raw not in local_paths:
            local_paths.append(raw)
    if result.ok:
        record_generated(
            local_paths,
            cost=cost,
            duration_sec=duration,
            model=result.model or result.model_key,
        )
        _log_job_spend(
            ok=True,
            cost=cost,
            model_id=result.model_key or result.model or body.model_id,
            job_kind=result.job_kind,
        )
    return _payload(
        ok=result.ok,
        result_paths=_collect_result_paths(result),
        cost=cost,
        duration_sec=duration,
        error=_error_message(result),
        extra={
            "status": result.status,
            "errors": list(result.errors),
            "image_paths": list(result.image_paths),
            "video_path": result.video_path,
            "local_paths": local_paths,
            "job_kind": result.job_kind,
            "model": result.model,
            "model_key": result.model_key,
            "endpoint": result.endpoint,
            "notes": list(result.notes),
            "metrics_line": result.metrics_line,
            "estimate": estimate_create_cost(state) if not result.ok else cost,
            "is_draft": bool(result.is_draft),
            "draft_cache_url": result.draft_cache_url,
        },
    )


@app.post("/prepare-aleph")
def prepare_aleph_endpoint(body: PrepareAlephIn) -> dict[str, Any]:
    """Downscale / trim / re-encode a Library video so Aleph will accept it."""
    src = Path(body.video_path)
    if not src.is_file():
        raise HTTPException(status_code=404, detail="Source video not found.")
    if not is_allowed_path(src):
        raise HTTPException(status_code=400, detail="Video is outside the Library.")
    prep = prepare_aleph_source(str(src), output_dir=OUTPUT_DIR)
    if not prep.ok or not prep.path:
        return {
            "ok": False,
            "error": prep.status or "Could not prepare this clip for Aleph.",
            "status": prep.status,
        }
    return {
        "ok": True,
        "path": prep.path,
        "used_proxy": prep.used_proxy,
        "status": prep.status,
        "duration_s": prep.duration_s,
        "width": prep.width,
        "height": prep.height,
        "notes": list(prep.notes or []),
    }


def _pin_payload(row: dict[str, Any], seconds: float) -> dict[str, Any]:
    t = float(row.get("timestamp_s") if row.get("timestamp_s") is not None else seconds)
    return {
        "ok": True,
        "pin": {
            "t": t,
            "path": row.get("path"),
            "thumb_url": row.get("thumb_url") or row.get("url"),
            "url": row.get("url"),
            "name": row.get("name"),
            "id": row.get("id"),
            "source": row.get("source") or "uploads",
            "kind": row.get("kind") or "image",
        },
        "error": None,
    }


@app.post("/frame/pin")
def frame_pin_endpoint(body: FramePinIn) -> dict[str, Any]:
    """Save a canvas-captured still as a Frame pin. Always JSON."""
    try:
        row = save_pin_from_data_url(
            body.image,
            body.timestamp_s,
            source_path=body.source_path,
        )
        return _pin_payload(row, body.timestamp_s)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception("Frame pin save failed")
        return {
            "ok": False,
            "pin": None,
            "error": str(exc) or "Could not save this pin.",
        }


@app.post("/frame/apply")
def frame_apply_endpoint(body: FrameApplyIn) -> dict[str, Any]:
    """Copy an I2I / Library still onto a pin. Always JSON."""
    pin_id = (body.pin_id or "").strip()
    if not pin_id:
        return {"ok": False, "pin": None, "error": "Pin id is missing."}
    try:
        row = apply_pin_still(
            body.image_path,
            body.timestamp_s,
            source_path=body.source_path,
        )
        payload = _pin_payload(row, body.timestamp_s)
        payload["pin"]["id"] = pin_id
        return payload
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception("Frame apply-to-pin failed")
        return {
            "ok": False,
            "pin": None,
            "error": str(exc) or "Could not apply this still to the pin.",
        }


@app.post("/extract-frame")
def extract_frame_endpoint(body: ExtractFrameIn) -> dict[str, Any]:
    """Pin still: extract a frame at ``seconds`` from a Library video. Always JSON."""
    try:
        row = extract_pin_still(body.video_path, body.seconds)
        return _pin_payload(row, body.seconds)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception("extract-frame failed")
        return {
            "ok": False,
            "pin": None,
            "error": str(exc) or "Could not extract this frame.",
        }


@app.get("/tools")
def tools_list(
    category: str = Query(..., description="upscale | denoise | restore | deblur | interpolate"),
    kind: str = Query(default="image", description="image | video"),
) -> dict[str, Any]:
    cat = (category or "").strip().lower()
    if cat not in ("upscale", "denoise", "restore", "deblur", "interpolate"):
        raise HTTPException(status_code=400, detail="Unknown tool category.")
    media = (kind or "image").strip().lower()
    if media not in ("image", "video"):
        raise HTTPException(status_code=400, detail="kind must be image or video")
    rows = list_tools(cat, media)
    return {
        "ok": True,
        "category": cat,
        "kind": media,
        "default_id": rows[0]["id"] if rows else None,
        "models": rows,
    }


@app.post("/tools")
def tools_run(body: ToolRunIn) -> dict[str, Any]:
    t0 = time.perf_counter()
    result = generate_tool(
        category=body.category,
        model_id=body.model_id,
        source_path=body.source_path,
        kind=body.kind,
        factor=body.factor,
        strength=body.strength,
        prompt=body.prompt,
        duration_s=body.duration_s,
        output_dir=OUTPUT_DIR,
    )
    elapsed = time.perf_counter() - t0
    duration = result.render_seconds if result.render_seconds is not None else elapsed
    cost = result.cost_label or estimate_tool_label(
        category=body.category,
        model_id=body.model_id,
        kind=body.kind,
        factor=body.factor,
        duration_s=body.duration_s,
    )
    local_paths = [result.path] if result.path else []
    if result.ok and local_paths:
        record_generated(
            local_paths,
            cost=cost,
            duration_sec=duration,
            model=result.model or result.model_key,
        )
        _log_job_spend(
            ok=True,
            cost=cost,
            model_id=result.model_key or result.model or body.model_id,
            job_kind=result.job_kind,
        )
    return _payload(
        ok=result.ok,
        result_paths=_public_paths(local_paths),
        cost=cost,
        duration_sec=duration,
        error=None if result.ok else (result.status or "Tool failed."),
        extra={
            "status": result.status,
            "local_paths": local_paths,
            "job_kind": result.job_kind,
            "model": result.model,
            "model_key": result.model_key,
            "endpoint": result.endpoint,
            "notes": list(result.notes),
            "metrics_line": result.metrics_line,
        },
    )


@app.get("/settings")
def settings_get() -> dict[str, Any]:
    inbox, inbox_note = resolve_handoff_dir()
    outbox = os.environ.get("RESOLVE_OUTBOX") or os.environ.get("RESOLVE_EXPORT")
    outbox_path = Path(outbox).expanduser() if outbox else OUTPUT_DIR
    return {
        "ok": True,
        "keys": {
            "fal": {
                "set": bool(effective_fal_key()),
                "mask": mask_key(effective_fal_key()),
            },
            "xai": {
                "set": bool(effective_xai_key()),
                "mask": mask_key(effective_xai_key()),
            },
            "runware": {
                "set": bool(effective_runware_key()),
                "mask": mask_key(effective_runware_key()),
            },
        },
        "dashboards": dashboard_urls(),
        "paths": {
            "outputs": str(OUTPUT_DIR),
            "resolve_inbox": str(inbox) if inbox else None,
            "resolve_inbox_note": inbox_note,
            "resolve_outbox": str(outbox_path),
        },
        "preferences": load_prefs(),
    }


@app.post("/settings/keys")
def settings_keys(body: SettingsKeysIn) -> dict[str, Any]:
    save_secrets(
        fal_key=body.fal_key,
        xai_api_key=body.xai_api_key,
        runware_key=body.runware_key,
        clear_fal=body.clear_fal,
        clear_xai=body.clear_xai,
        clear_runware=body.clear_runware,
    )
    apply_secrets_to_env()
    return settings_get()


@app.get("/settings/balances")
def settings_balances() -> dict[str, Any]:
    fal = fetch_fal_balance()
    xai = fetch_xai_balance()
    runware = fetch_runware_balance()
    return {
        "ok": True,
        "fal": {
            "ok": fal.ok,
            "label": fal.label,
            "amount": fal.amount,
            "detail": fal.detail,
            "billing_url": fal.billing_url,
        },
        "xai": {
            "ok": xai.ok,
            "label": xai.label,
            "amount": xai.amount,
            "detail": xai.detail,
            "billing_url": xai.billing_url,
        },
        "runware": {
            "ok": runware.ok,
            "label": runware.label,
            "amount": runware.amount,
            "detail": runware.detail,
            "billing_url": runware.billing_url,
        },
    }


@app.get("/settings/spend")
def settings_spend(
    granularity: str = Query(default="month"),
    year: int | None = Query(default=None),
) -> dict[str, Any]:
    _ = granularity
    return spend_summary(year=year)


@app.get("/settings/spend/export.csv")
def settings_spend_csv(year: int = Query(...)) -> Response:
    name, text = export_csv(year=year)
    return Response(
        content=text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@app.post("/settings/open")
def settings_open(body: SettingsOpenIn) -> dict[str, Any]:
    which = (body.which or "").strip().lower()
    inbox, _ = resolve_handoff_dir()
    outbox = os.environ.get("RESOLVE_OUTBOX") or os.environ.get("RESOLVE_EXPORT")
    mapping = {
        "outputs": OUTPUT_DIR,
        "resolve_inbox": inbox,
        "resolve_outbox": Path(outbox).expanduser() if outbox else OUTPUT_DIR,
    }
    path = mapping.get(which)
    if path is None:
        raise HTTPException(status_code=400, detail="Unknown path.")
    try:
        Path(path).mkdir(parents=True, exist_ok=True)
        reveal_in_folder(str(path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "path": str(path)}


@app.get("/characters")
def characters_get() -> dict[str, Any]:
    rows = list_characters()
    return {
        "ok": True,
        "source": "v2+v1" if v1_root() else "v2",
        "items": rows,
    }


@app.get("/scenes")
def scenes_get() -> dict[str, Any]:
    rows = list_scenes()
    return {
        "ok": True,
        "source": "v2+v1" if v1_root() else "v2",
        "items": rows,
    }


@app.get("/props")
def props_get() -> dict[str, Any]:
    return {"ok": True, "source": "v2", "items": list_props()}


@app.get("/costumes")
def costumes_get() -> dict[str, Any]:
    return {"ok": True, "source": "v2", "items": list_assets("costume")}


@app.get("/characters/{char_id}/still")
def character_still(char_id: str) -> FileResponse:
    path = resolve_still_file("character", char_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Character still not found.")
    return FileResponse(path, filename=path.name)


@app.get("/scenes/{scene_id}/still")
def scene_still(scene_id: str) -> FileResponse:
    path = resolve_still_file("scene", scene_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Scene still not found.")
    return FileResponse(path, filename=path.name)


class AssetCreateIn(BaseModel):
    kind: str
    name: str
    notes: str = ""
    still_paths: list[str] = Field(default_factory=list)


class AssetGenerateIn(BaseModel):
    kind: str
    name: str
    notes: str = ""
    prompt: str = ""
    model_id: str = ""
    source_still: str = ""


class AssetSheetCreateIn(BaseModel):
    kind: str = "character"
    name: str
    notes: str = ""
    parent_id: str = ""
    fields: dict[str, Any] = Field(default_factory=dict)


class AssetSheetAngleIn(BaseModel):
    asset_id: str
    slot: str = "front"
    model_id: str = ""
    extra: str = ""
    costume_ref: str = ""
    wardrobe: str = ""
    prompt: str = ""
    source_still: str = ""
    resolution: str = ""
    aspect: str = ""
    extra_refs: list[str] = Field(default_factory=list)


class AssetSaveIn(BaseModel):
    asset_id: str
    name: str = ""
    notes: str = ""
    fields: dict[str, Any] = Field(default_factory=dict)
    require_front: bool = True


class AssetPatchIn(BaseModel):
    name: str | None = None
    notes: str | None = None
    fields: dict[str, Any] | None = None
    primary_slot: str | None = None


class AssetSlotPathIn(BaseModel):
    slot: str = "front"
    path: str = ""


class AssetDressIn(BaseModel):
    character_id: str
    costume_id: str
    name: str = ""
    notes: str = ""


class AssetSheetEstimateIn(BaseModel):
    kind: str = "character"
    t2i_model_id: str = ""
    r2i_model_id: str = ""
    slots: list[str] = Field(default_factory=list)
    t2i_resolution: str = ""
    r2i_resolution: str = ""
    t2i_resolution: str = ""
    r2i_resolution: str = ""


class AssetSheetPromptIn(BaseModel):
    kind: str = "character"
    slot: str = "front"
    name: str = ""
    fields: dict[str, Any] = Field(default_factory=dict)
    is_costume: bool = False
    wardrobe: str = ""
    extra: str = ""


@app.get("/assets/builder/{kind}")
def assets_builder_fields(kind: str) -> dict[str, Any]:
    return builder_fields(kind)


@app.post("/assets/sheet/create")
def assets_sheet_create(body: AssetSheetCreateIn) -> dict[str, Any]:
    try:
        row = create_asset(
            kind=body.kind,
            name=body.name,
            notes=body.notes,
            parent_id=body.parent_id,
            fields=dict(body.fields or {}),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/sheet/angle")
def assets_sheet_angle(body: AssetSheetAngleIn) -> dict[str, Any]:
    try:
        row = generate_angle(
            asset_id=body.asset_id,
            slot=body.slot,
            model_id=body.model_id,
            extra=body.extra,
            costume_ref=body.costume_ref,
            wardrobe=body.wardrobe,
            prompt=body.prompt,
            source_still=body.source_still,
            resolution=body.resolution,
            aspect=body.aspect,
            extra_refs=list(body.extra_refs or []),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=short_generate_error(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=short_generate_error(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=short_generate_error(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/sheet/estimate")
def assets_sheet_estimate(body: AssetSheetEstimateIn) -> dict[str, Any]:
    return estimate_sheet_cost(
        kind=body.kind,
        t2i_model_id=body.t2i_model_id,
        r2i_model_id=body.r2i_model_id,
        slots=list(body.slots or []),
        t2i_resolution=body.t2i_resolution,
        r2i_resolution=body.r2i_resolution,
    )


@app.post("/assets/sheet/prompt")
def assets_sheet_prompt(body: AssetSheetPromptIn) -> dict[str, Any]:
    text = compose_angle_prompt(
        kind=body.kind,
        slot=body.slot,
        fields=dict(body.fields or {}),
        name=body.name,
        is_costume=body.is_costume,
        wardrobe=body.wardrobe,
        extra=body.extra,
    )
    return {"ok": True, "prompt": text}


@app.post("/assets/sheet/save")
def assets_sheet_save(body: AssetSaveIn) -> dict[str, Any]:
    try:
        row = save_sheet(
            body.asset_id,
            name=body.name,
            notes=body.notes,
            fields=dict(body.fields or {}),
            require_front=body.require_front,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/dress")
def assets_dress(body: AssetDressIn) -> dict[str, Any]:
    char = public_asset(body.character_id)
    costume = public_asset(body.costume_id)
    if not char or char.get("kind") != "character":
        raise HTTPException(status_code=400, detail="Pick a saved Character.")
    ident = char.get("identity") if isinstance(char.get("identity"), dict) else {}
    if not ident.get("front") and not ident.get("sheet"):
        raise HTTPException(
            status_code=400, detail="Character needs a Front still or sheet."
        )
    if not costume or costume.get("kind") != "costume":
        raise HTTPException(status_code=400, detail="Pick a saved Costume.")
    cfields = costume.get("fields") if isinstance(costume.get("fields"), dict) else {}
    pfields = char.get("fields") if isinstance(char.get("fields"), dict) else {}
    outfit = str(cfields.get("wardrobe") or "").strip()
    label = (body.name or "").strip() or (
        f"{char.get('name') or 'Character'} / {costume.get('name') or 'Costume'}"
    )
    try:
        row = create_asset(
            kind="character",
            name=label,
            notes=body.notes or str(costume.get("notes") or ""),
            parent_id=str(char["id"]),
            fields={
                **{str(k): str(v) for k, v in pfields.items() if v is not None},
                "wardrobe": outfit,
                "costume_id": str(costume["id"]),
                "costume_name": str(costume.get("name") or ""),
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row, "character": char, "costume": costume}


@app.get("/assets/{asset_id}")
def assets_one(asset_id: str) -> dict[str, Any]:
    row = public_asset(asset_id)
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return {"ok": True, "item": row}


@app.patch("/assets/{asset_id}")
def assets_patch(asset_id: str, body: AssetPatchIn) -> dict[str, Any]:
    try:
        row = update_asset(
            asset_id,
            name=body.name,
            notes=body.notes,
            fields=body.fields,
            primary_slot=body.primary_slot,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/{asset_id}/slot")
async def assets_slot_upload(
    asset_id: str,
    slot: str = Form(default="front"),
    files: list[UploadFile] | None = File(default=None),
) -> dict[str, Any]:
    upload = (files or [None])[0]
    if upload is None:
        raise HTTPException(status_code=400, detail="Upload an image.")
    data = await upload.read()
    try:
        row = attach_identity_bytes(
            asset_id, slot, upload.filename or f"{slot}.png", data
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/{asset_id}/slot/path")
def assets_slot_path(asset_id: str, body: AssetSlotPathIn) -> dict[str, Any]:
    try:
        row = attach_identity_still(asset_id, body.slot, body.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/{asset_id}/primary")
def assets_primary(asset_id: str, body: AssetPatchIn) -> dict[str, Any]:
    slot = (body.primary_slot or "").strip()
    if not slot:
        raise HTTPException(status_code=400, detail="primary_slot is required.")
    try:
        row = update_asset(asset_id, primary_slot=slot)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.get("/assets")
def assets_get(kind: str | None = Query(default=None)) -> dict[str, Any]:
    want = (kind or "").strip().lower() or None
    if want in ("all",):
        want = None
    if want and want not in ("character", "scene", "prop", "costume"):
        raise HTTPException(
            status_code=400, detail="kind must be character, scene, prop, or costume"
        )
    return {"ok": True, "items": list_assets(want)}


@app.post("/assets")
async def assets_create(
    kind: str = Form(...),
    name: str = Form(...),
    notes: str = Form(default=""),
    files: list[UploadFile] | None = File(default=None),
) -> dict[str, Any]:
    """Create a V2 Character / Scene / Prop from uploaded stills."""
    uploads: list[tuple[str, bytes]] = []
    for upload in files or []:
        data = await upload.read()
        uploads.append((upload.filename or "still.png", data))
    try:
        row = create_asset(
            kind=kind,
            name=name,
            notes=notes or "",
            files=uploads,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/json")
def assets_create_json(body: AssetCreateIn) -> dict[str, Any]:
    try:
        row = create_asset(
            kind=body.kind,
            name=body.name,
            notes=body.notes,
            still_paths=list(body.still_paths or []),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.post("/assets/generate")
def assets_generate(body: AssetGenerateIn) -> dict[str, Any]:
    """T2I / I2I a simple still, then save as a V2 asset. Flux / Seedream / Nano."""
    mid = (body.model_id or "").strip()
    if mid and not sheet_model_ok(mid):
        raise HTTPException(
            status_code=400,
            detail="Pick Flux, Seedream, or Nano for a simple sheet.",
        )
    try:
        row = generate_asset(
            kind=body.kind,
            name=body.name,
            notes=body.notes,
            prompt=body.prompt,
            model_id=mid,
            source_still=body.source_still,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "item": row}


@app.delete("/assets/{asset_id}")
def assets_delete(asset_id: str) -> dict[str, Any]:
    if not delete_asset(asset_id):
        raise HTTPException(status_code=404, detail="Asset not found.")
    return {"ok": True, "id": asset_id}


@app.get("/assets/{asset_id}/still")
def assets_still(
    asset_id: str,
    slot: str | None = Query(default=None),
) -> FileResponse:
    path = resolve_asset_still(asset_id, slot)
    if path is None:
        row = get_asset(asset_id)
        kind = str((row or {}).get("kind") or "character")
        if kind in ("character", "scene", "prop"):
            path = resolve_still_file(kind, asset_id)  # type: ignore[arg-type]
    if path is None:
        raise HTTPException(status_code=404, detail="Asset still not found.")
    return FileResponse(path, filename=path.name)


@app.get("/library")
def library_get(
    source: str | None = Query(default=None, description="resolve | uploads | generated"),
    type: str | None = Query(default=None, description="image | video | audio | all"),
) -> dict[str, Any]:
    want = (type or "").strip().lower() or None
    src = (source or "").strip().lower() or None
    if src:
        if src not in ("resolve", "uploads", "generated"):
            raise HTTPException(status_code=400, detail="source must be resolve, uploads, or generated")
        return list_source(src, want)
    return list_library(want)


@app.get("/library/file")
def library_file(
    source: str = Query(...),
    rel: str = Query(...),
) -> FileResponse:
    try:
        path = resolve_library_file(source, rel)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path, filename=path.name)


@app.get("/library/thumb")
def library_thumb(
    source: str = Query(...),
    rel: str = Query(...),
) -> FileResponse:
    try:
        path = thumb_path(source, rel)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path, media_type="image/jpeg")


@app.post("/library/import")
async def library_import(
    files: list[UploadFile] | None = File(default=None),
    path: str | None = Form(default=None),
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    errors: list[str] = []
    if path and path.strip():
        try:
            items.append(import_upload(Path(path.strip())))
        except (OSError, ValueError, RuntimeError) as exc:
            errors.append(str(exc))
    for upload in files or []:
        name = upload.filename or "upload.bin"
        try:
            data = await upload.read()
            items.append(write_upload(name, data))
        except (OSError, ValueError, RuntimeError) as exc:
            errors.append(f"{name}: {exc}")
    if not items and not errors:
        raise HTTPException(status_code=400, detail="Provide files or a local path.")
    return {"ok": bool(items), "items": items, "errors": errors}


@app.post("/library/reveal")
def library_reveal(body: RevealIn) -> dict[str, Any]:
    raw = (body.path or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="path is required")
    if not is_allowed_path(raw):
        raise HTTPException(status_code=403, detail="Path is outside library roots.")
    try:
        reveal_in_folder(raw)
    except (OSError, PermissionError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.delete("/library/{item_id:path}")
def library_delete(
    item_id: str,
    delete_file: bool = Query(default=False),
) -> dict[str, Any]:
    """Remove from Library index. Uploads/Generated may also delete the file."""
    try:
        return delete_library_item(item_id, delete_file=bool(delete_file))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/library/{item_id:path}/pin")
def library_pin(item_id: str, body: LibraryPinIn | None = None) -> dict[str, Any]:
    want = True if body is None else bool(body.pinned)
    try:
        return set_pinned(item_id, want)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/settings/preferences")
def settings_prefs(body: SettingsPrefsIn) -> dict[str, Any]:
    prefs = save_prefs(
        retention_days=body.retention_days,
        theme=body.theme,
        grid_snap=body.grid_snap,
        edge_style=body.edge_style,
    )
    purged = {"purged": 0}
    try:
        purged = purge_expired()
    except Exception:
        pass
    return {"ok": True, "preferences": prefs, "purge": purged}


@app.get("/builder/scenarios")
def builder_scenarios(
    mode: str = Query(default="image"),
    modality: str = Query(default=""),
) -> dict[str, Any]:
    return {"ok": True, **list_builder_scenarios(mode, modality)}


@app.post("/builder/apply")
def builder_apply(body: BuilderApplyIn) -> dict[str, Any]:
    text = apply_builder(
        body.scenario_key,
        body.fields,
        mode=body.mode,
        modality=body.modality,
    )
    return {"ok": True, "prompt": text}


@app.get("/director/fields")
def director_fields() -> dict[str, Any]:
    return {"ok": True, **list_director_fields()}


@app.post("/director/apply")
def director_apply(body: DirectorApplyIn) -> dict[str, Any]:
    return {"ok": True, "prompt": apply_director(body.fields)}


class ShotBuilderApplyIn(BaseModel):
    fields: dict[str, Any] = Field(default_factory=dict)
    who_choices: list[str] = Field(default_factory=list)


@app.get("/shot-builder/fields")
def shot_builder_fields(
    who: str = Query(default=""),
) -> dict[str, Any]:
    choices = [p.strip() for p in who.split("|") if p.strip()]
    return list_shot_builder_fields(choices)


@app.post("/shot-builder/apply")
def shot_builder_apply(body: ShotBuilderApplyIn) -> dict[str, Any]:
    return {"ok": True, **apply_shot_builder(body.fields)}


@app.get("/resolve/status")
def resolve_status() -> dict[str, Any]:
    return {"ok": True, **inbox_status()}


@app.post("/resolve/send")
def resolve_send(body: ResolveSendIn) -> dict[str, Any]:
    raw = (body.path or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="path is required")
    if not is_allowed_path(raw):
        raise HTTPException(status_code=403, detail="Path is outside library roots.")
    kind = (body.type or "").strip().lower() or kind_for(Path(raw))
    if kind not in ("image", "video", "audio"):
        raise HTTPException(status_code=400, detail="type must be image, video, or audio")
    result = send_file_to_resolve(
        raw,
        job_name=body.job_name,
        model=body.model,
        cost=body.cost,
    )
    if result.fallback_folder and not result.ok:
        try:
            reveal_in_folder(raw)
            result.message = (result.message or "") + " File revealed in Explorer."
        except Exception:
            pass
    return {
        "ok": result.ok,
        "message": result.message,
        "bin_name": result.bin_name,
        "clips": result.clips,
        "placed_on_timeline": result.placed_on_timeline,
        "marker_added": result.marker_added,
        "fallback_folder": result.fallback_folder,
        "notes": result.notes,
        "type": kind,
    }


app.mount(
    "/outputs",
    StaticFiles(directory=str(OUTPUT_DIR), check_dir=False),
    name="outputs",
)
