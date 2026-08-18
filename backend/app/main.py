"""
FastAPI entry for AI Media Studio V2.

MVP: catalog + generate ported from V1 (no Flet UI).
"""

from __future__ import annotations

import os
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
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
)
from app.config import APP_TITLE, OUTPUT_DIR, ensure_output_dir  # noqa: E402
from app.create import CreateResult, estimate_create_cost, generate  # noqa: E402
from app.create_catalog import list_models_for_ui  # noqa: E402
from app.create_state import CreateParams, CreateSlots, CreateState  # noqa: E402
from app.secrets_store import apply_secrets_to_env  # noqa: E402

apply_secrets_to_env()
ensure_output_dir(OUTPUT_DIR)

app = FastAPI(title=APP_TITLE, version="2.0.0-scaffold")
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


class CreateStateIn(BaseModel):
    """JSON body for POST /generate — maps 1:1 onto V1 CreateState."""

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
                    "backend": "audio",
                    "source_key": spec.key,
                }
            )
    return rows


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "app": APP_TITLE,
        "version": "2.0.0-scaffold",
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
        return {"mode": "audio", "modality": modality, "models": models}
    if want_mode and want_mode not in ("image", "video"):
        raise HTTPException(
            status_code=400,
            detail="mode must be image, video, or audio",
        )
    entries = list_models_for_ui(want_mode, modality)
    return {
        "mode": want_mode,
        "modality": modality,
        "models": [_jsonable(e) for e in entries],
    }


@app.post("/generate")
def generate_endpoint(body: CreateStateIn) -> dict[str, Any]:
    """
    Run V1 ``generate(CreateState)`` and return paths + cost.

    Audio mode is catalog-only in this scaffold (next phase).
    """
    if (body.mode or "").strip().lower() == "audio":
        raise HTTPException(
            status_code=400,
            detail="Audio generate is not wired in the V2 scaffold yet.",
        )
    state = _state_from_body(body)
    result: CreateResult = generate(state)
    return {
        "ok": result.ok,
        "status": result.status,
        "errors": list(result.errors),
        "paths": list(result.paths),
        "image_paths": list(result.image_paths),
        "video_path": result.video_path,
        "job_kind": result.job_kind,
        "model": result.model,
        "model_key": result.model_key,
        "endpoint": result.endpoint,
        "cost": result.cost_estimate or result.cost_label,
        "cost_estimate": result.cost_estimate,
        "cost_label": result.cost_label,
        "notes": list(result.notes),
        "metrics_line": result.metrics_line,
        "is_draft": result.is_draft,
        "draft_cache_url": result.draft_cache_url,
        "render_seconds": result.render_seconds,
        "timestamp": result.timestamp,
        "estimate": estimate_create_cost(state),
    }
