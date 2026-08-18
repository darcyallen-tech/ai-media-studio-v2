"""
CreateState — single source of truth for mode → modality → model → slots → payload.

Phase 1: internal. Existing Studio / Creative Vision UI builds this and calls
``create.generate``. Phase 2 can swap the shell without rewriting endpoints.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

CreateMode = Literal["image", "video"]

ImageModality = Literal["t2i", "i2i", "r2i", "region"]
VideoModality = Literal["t2v", "i2v", "r2v", "v2v", "bridge", "extend"]
CreateModality = ImageModality | VideoModality

CreateSurface = Literal["studio", "vision"]

IMAGE_MODALITIES: tuple[str, ...] = ("t2i", "i2i", "r2i", "region")
VIDEO_MODALITIES: tuple[str, ...] = (
    "t2v",
    "i2v",
    "r2v",
    "v2v",
    "bridge",
    "extend",
)

# Creative Vision long names ↔ short catalog modalities
_VISION_TO_SHORT: dict[str, str] = {
    "text_to_image": "t2i",
    "image_to_image": "i2i",
    "reference_to_image": "r2i",
    "text_to_video": "t2v",
    "image_to_video": "i2v",
    "reference_to_video": "r2v",
    "video_to_video": "v2v",
    "bridge": "bridge",
    "extend": "extend",
}

_SHORT_TO_VISION: dict[str, str] = {v: k for k, v in _VISION_TO_SHORT.items()}

SLOT_NAMES: tuple[str, ...] = (
    "start_still",
    "end_still",
    "source_video",
    "ref_images",
    "ref_videos",
    "ref_audios",
    "character_ids",
    "scene_ids",
    "mask",
)


def normalize_mode(raw: str | None) -> CreateMode:
    m = (raw or "").strip().lower()
    return "video" if m == "video" else "image"


def normalize_modality(raw: str | None) -> str:
    """Accept short keys or Creative Vision long names."""
    m = (raw or "").strip().lower()
    if m in _VISION_TO_SHORT:
        return _VISION_TO_SHORT[m]
    if m in IMAGE_MODALITIES or m in VIDEO_MODALITIES:
        return m
    if m in ("standard", "full", "edit"):
        return "i2i"
    if m in ("camera_lock", "v2v_edit"):
        return "v2v"
    if m in ("first_last", "first-last", "flf", "connect"):
        return "bridge"
    return m


def modality_from_vision_mode(mode: str | None) -> str:
    return normalize_modality(mode)


def vision_mode_from_modality(modality: str | None) -> str:
    m = normalize_modality(modality)
    return _SHORT_TO_VISION.get(m, m)


def mode_for_modality(modality: str | None) -> CreateMode:
    m = normalize_modality(modality)
    return "image" if m in IMAGE_MODALITIES else "video"


def is_image_modality(modality: str | None) -> bool:
    return normalize_modality(modality) in IMAGE_MODALITIES


@dataclass
class CreateSlots:
    """Media / identity inputs for a generate."""

    start_still: str | None = None
    end_still: str | None = None
    source_video: str | None = None
    ref_images: list[str] = field(default_factory=list)
    ref_videos: list[str] = field(default_factory=list)
    ref_audios: list[str] = field(default_factory=list)
    character_ids: list[str] = field(default_factory=list)
    scene_ids: list[str] = field(default_factory=list)
    mask: str | None = None

    def existing_files(self, name: str) -> list[str]:
        """Return existing local paths for a slot name."""
        if name in ("ref_images", "ref_videos", "ref_audios"):
            out: list[str] = []
            for p in getattr(self, name) or []:
                if p and Path(p).is_file():
                    out.append(p)
            return out
        if name in ("character_ids", "scene_ids"):
            return [str(x) for x in (getattr(self, name) or []) if x]
        val = getattr(self, name, None)
        if val and Path(str(val)).is_file():
            return [str(val)]
        return []

    def filled(self, name: str) -> bool:
        if name in ("character_ids", "scene_ids"):
            return bool(getattr(self, name, None))
        return bool(self.existing_files(name))


@dataclass
class CreateParams:
    """Generation knobs (duration, aspect, …)."""

    duration: str | None = None
    aspect: str | None = None
    resolution: str | None = None
    strength: float | None = None
    audio_on: bool | None = None
    negative_prompt: str | None = None
    num_images: int | None = None
    draft: bool = False
    # Studio helpers already serialize a params dict — pass through unchanged
    parameters_json: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class CreateState:
    """
    Unified generate request.

    ``model_id`` may be a catalog id, a registry key, or a UI label —
    ``resolve_model`` accepts all three.
    """

    mode: CreateMode
    modality: str
    model_id: str
    slots: CreateSlots = field(default_factory=CreateSlots)
    params: CreateParams = field(default_factory=CreateParams)
    prompt: str = ""
    enhance_direction: str | None = None
    surface: CreateSurface = "studio"
    scenario: str | None = None
    output_dir: str | Path | None = None

    def __post_init__(self) -> None:
        self.mode = normalize_mode(self.mode)
        self.modality = normalize_modality(self.modality)
        if self.modality in IMAGE_MODALITIES:
            self.mode = "image"
        elif self.modality in VIDEO_MODALITIES:
            self.mode = "video"
        self.model_id = (self.model_id or "").strip()
        self.prompt = self.prompt or ""
        if self.enhance_direction is not None:
            self.enhance_direction = str(self.enhance_direction)
        if self.surface not in ("studio", "vision"):
            self.surface = "studio"
