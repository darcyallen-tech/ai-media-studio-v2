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
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Load repo-root .env (never commit real keys)
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_REPO_ROOT / ".env")

from app.audio_registry import (  # noqa: E402
    AMBIENCE_MODELS,
    MUSIC_MODELS,
    SFX_MODELS,
    VIDEO_SFX_MODELS,
    VOICE_CLONE_MODELS,
    VOICEOVER_MODELS,
    format_audio_cost,
)
from app.config import APP_TITLE, OUTPUT_DIR, ensure_output_dir  # noqa: E402
from app.create import CreateResult, estimate_create_cost, generate  # noqa: E402
from app.create_catalog import default_model_for, list_models_for_ui  # noqa: E402
from app.create_state import CreateParams, CreateSlots, CreateState  # noqa: E402
from app.library import (  # noqa: E402
    ensure_library_dirs,
    import_upload,
    inbox_status,
    is_allowed_path,
    kind_for,
    list_library,
    list_source,
    record_generated,
    resolve_library_file,
    reveal_in_folder,
    thumb_path,
    write_upload,
)
from app.resolve_export import send_file_to_resolve  # noqa: E402
from app.secrets_store import apply_secrets_to_env  # noqa: E402

apply_secrets_to_env()
ensure_output_dir(OUTPUT_DIR)
ensure_library_dirs()

APP_VERSION = "2.0.0-phase5"

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

_AUDIO_REGISTRIES = {
    "music": MUSIC_MODELS,
    "sfx": SFX_MODELS,
    "ambience": AMBIENCE_MODELS,
    "video_sfx": VIDEO_SFX_MODELS,
    "voiceover": VOICEOVER_MODELS,
    "voice_clone": VOICE_CLONE_MODELS,
}

_AUDIO_NOOP = "Audio generate is not wired yet (Phase 7)."


class SlotsIn(BaseModel):
    start_still: str | None = None
    end_still: str | None = None
    source_video: str | None = None
    ref_images: list[str] = Field(default_factory=list)
    ref_videos: list[str] = Field(default_factory=list)
    ref_audios: list[str] = Field(default_factory=list)
    character_ids: list[str] = Field(default_factory=list)
    scene_ids: list[str] = Field(default_factory=list)
    mask: str | None = None


class ParamsIn(BaseModel):
    duration: str | None = None
    aspect: str | None = None
    resolution: str | None = None
    strength: float | None = None
    audio_on: bool | None = None
    negative_prompt: str | None = None
    num_images: int | None = None
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
        draft=bool(raw.draft),
        parameters_json=raw.parameters_json,
        extra=dict(raw.extra or {}),
    )


def _state_from_body(body: CreateStateIn) -> CreateState:
    out_dir: str | Path | None = body.output_dir or OUTPUT_DIR
    return CreateState(
        mode=body.mode,  # type: ignore[arg-type]
        modality=body.modality,
        model_id=body.model_id,
        slots=_slots_from_body(body.slots),
        params=_params_from_body(body.params),
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
    want = (modality or "").strip().lower() or None
    rows: list[dict[str, Any]] = []
    registries = (
        {want: _AUDIO_REGISTRIES[want]}
        if want and want in _AUDIO_REGISTRIES
        else _AUDIO_REGISTRIES
    )
    for category, registry in registries.items():
        for spec in registry.values():
            rows.append(
                {
                    "id": f"audio:{spec.key}",
                    "label": spec.label,
                    "mode": "audio",
                    "modality": spec.category or category,
                    "endpoint": spec.endpoint,
                    "notes": spec.notes,
                    "cost_estimate_usd": spec.cost_estimate_usd,
                    "cost": format_audio_cost(spec),
                    "backend": "audio",
                    "source_key": spec.key,
                }
            )
    return rows


def _audio_estimate(model_id: str, modality: str | None) -> str:
    raw = (model_id or "").strip()
    if raw.startswith("audio:"):
        raw = raw[6:]
    for spec in _audio_models(modality):
        if spec["id"] == f"audio:{raw}" or spec["source_key"] == raw or spec["label"] == raw:
            return str(spec.get("cost") or f"Est. cost: ${spec['cost_estimate_usd']}")
    return "Est. cost: —"


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
            "runware": bool(
                os.environ.get("RUNWARE_API_KEY") or os.environ.get("RUNWARE_KEY")
            ),
        },
    }


@app.get("/models")
def list_models_endpoint(
    mode: str | None = Query(default=None, description="image | video | audio"),
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
    if want_mode and want_mode not in ("image", "video"):
        raise HTTPException(
            status_code=400,
            detail="mode must be image, video, or audio",
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
) -> dict[str, Any]:
    """Cost-only estimate from catalog helpers (query form)."""
    body = CreateStateIn(
        mode=mode,
        modality=modality,
        model_id=model_id,
        params=ParamsIn(
            duration=duration,
            aspect=aspect,
            resolution=resolution,
            audio_on=generate_audio,
        ),
    )
    return _estimate_payload(body)


@app.post("/estimate")
def estimate_post(body: CreateStateIn) -> dict[str, Any]:
    """Cost-only estimate — same CreateState body as POST /generate."""
    return _estimate_payload(body)


def _estimate_payload(body: CreateStateIn) -> dict[str, Any]:
    if (body.mode or "").strip().lower() == "audio":
        cost = _audio_estimate(body.model_id, body.modality)
        return {"ok": True, "cost": cost, "result_paths": [], "duration_sec": 0, "error": None}
    state = _state_from_body(body)
    cost = estimate_create_cost(state)
    return {"ok": True, "cost": cost, "result_paths": [], "duration_sec": 0, "error": None}


@app.post("/generate")
def generate_endpoint(body: CreateStateIn) -> dict[str, Any]:
    """
    Run V1 ``generate(CreateState)`` and return result_paths + cost + duration.
    """
    if (body.mode or "").strip().lower() == "audio":
        return _payload(
            ok=False,
            result_paths=[],
            cost=_audio_estimate(body.model_id, body.modality),
            duration_sec=0,
            error=_AUDIO_NOOP,
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
        },
    )


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
