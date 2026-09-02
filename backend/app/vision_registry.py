"""
Creative Vision model registry — T2I, I2I, T2V, I2V, bridge.

Cinematic invention only (not listing camera-lock staging). Costs are
intentionally conservative ballparks — show them before generate.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

VisionMode = Literal[
    "text_to_image",
    "image_to_image",
    "reference_to_image",  # R2I — build still from identity/style/prop refs
    "text_to_video",
    "image_to_video",
    "reference_to_video",  # R2V — multi identity / omni refs (not start-frame lock)
    "video_to_video",  # V2V — source clip + prompt (align with Studio)
    "bridge",
    "extend",
]

# UI pill rows (aligned with Studio naming: T2I/I2I/R2I · I2V/T2V/R2V/V2V)
VISION_IMAGE_PILLS: tuple[tuple[str, str], ...] = (
    ("text_to_image", "Text→Image"),
    ("image_to_image", "Image→Image"),
    ("reference_to_image", "R2I"),
)
VISION_VIDEO_PILLS: tuple[tuple[str, str], ...] = (
    ("text_to_video", "Text→Video"),
    ("image_to_video", "Image→Video"),
    ("reference_to_video", "R2V"),
    ("video_to_video", "V2V"),
    ("bridge", "Bridge/Connect"),
    ("extend", "Extend Video"),
)


@dataclass(frozen=True)
class VisionModelSpec:
    key: str
    label: str
    mode: VisionMode
    endpoint: str
    # Flat estimate for default duration (shown when no length yet)
    cost_estimate_usd: float
    notes: str = ""
    cost_per_second: float | None = None
    # e.g. {"720p": 0.17, "1080p": 0.29} — overrides flat cost_per_second by res
    cost_per_second_by_resolution: dict[str, float] = field(default_factory=dict)
    # FLUX 3 draft workflow
    draft_endpoint: str | None = None
    enhance_endpoint: str | None = None
    cost_per_second_draft: float | None = None
    # Duration API shape
    duration_param: str = "duration"
    duration_choices: tuple[str, ...] = ("4s", "6s", "8s")
    default_duration: str = "8s"
    # Aspect
    aspect_choices: tuple[str, ...] = ("16:9", "9:16")
    default_aspect: str = "16:9"
    resolution_choices: tuple[str, ...] = ("720p", "1080p")
    default_resolution: str = "720p"
    supports_audio: bool = True
    supports_negative: bool = True
    # Reference stills: T2V reference pack size, or I2I max *extra* refs (0 = primary only)
    max_refs: int = 0
    # Bridge: first + last frame field names
    first_frame_field: str = "first_frame_url"
    last_frame_field: str = "last_frame_url"
    # I2V start frame / I2I source field
    image_field: str = "image_url"
    # Extend / V2V-style: source clip field
    video_field: str = "video_url"
    # I2V optional end frame (e.g. Hailuo / MiniMax H3) — hide UI when False
    supports_end_frame: bool = False
    # Dedicated first→last endpoints require both frames
    requires_end_frame: bool = False
    # Omni reference-to-video (MiniMax H3): images + videos + audio
    omni_reference: bool = False
    max_ref_videos: int = 0
    max_ref_audios: int = 0
    max_total_refs: int = 0  # 0 = no combined cap; H3 = 12
    # Duration sent as integer seconds (H3) vs string enums
    duration_as_int: bool = False
    # Native stereo always on output — hide generate_audio; show note in UI
    native_stereo_audio: bool = False
    # Prompt citation: "plain" → Image 1 / Video 1; "at" → @Image1
    prompt_citation_style: str = ""
    # Image→Image: key into fal IMAGE_EDIT_MODELS for build_edit_arguments
    edit_model_key: str = ""
    # Show strength slider when True (passed if API accepts)
    supports_strength: bool = False
    # Max images per single fal call (T2I multi-variant). UI may request more
    # and vision_service will run sequential calls when needed.
    max_num_images: int = 1
    # Never send aspect_ratio (e.g. FLUX 3 I2V — frame follows the still)
    omit_aspect_ratio: bool = False
    extra_defaults: dict[str, Any] = field(default_factory=dict)
    # Keep callable via resolve; omit from default dropdowns
    hidden: bool = False
    supports_elements: bool = False
    max_elements: int = 0
    element_allows_video: bool = False
    supports_multi_prompt: bool = False
    max_multi_prompt: int = 0
    # Optional mask_url on the fal edit schema (typically single-ref only).
    supports_mask: bool = False
    supports_region_boxes: bool = False


# UI sentinel when aspect follows the still (disabled control)
ASPECT_FOLLOWS_STILL = "Follows still"


# UI batch cap for still multi-variant generate (Phase 2)
VISION_BATCH_MAX = 4


# Friendly aspect labels for Flux / Seedream image_size enums
T2I_ASPECT_CHOICES: tuple[str, ...] = (
    "16:9 landscape",
    "9:16 portrait",
    "4:3 landscape",
    "3:4 portrait",
    "1:1 square",
    "1:1 square HD",
)

# Nano Banana family uses colon aspect ratios (+ resolution on 2/Pro)
T2I_NANO_ASPECT_CHOICES: tuple[str, ...] = (
    "auto",
    "21:9",
    "16:9",
    "3:2",
    "4:3",
    "5:4",
    "1:1",
    "4:5",
    "3:4",
    "2:3",
    "9:16",
)

T2I_NANO2_RES_CHOICES: tuple[str, ...] = ("0.5K", "1K", "2K", "4K")
T2I_NANO_PRO_RES_CHOICES: tuple[str, ...] = ("1K", "2K", "4K")

# Seedream: image_size presets (+ auto 2K/4K where supported)
T2I_SEEDREAM_ASPECT_CHOICES: tuple[str, ...] = (
    "16:9 landscape",
    "9:16 portrait",
    "4:3 landscape",
    "3:4 portrait",
    "1:1 square",
    "1:1 square HD",
    "Auto 2K",
    "Auto 4K",
)

_T2I_ASPECT_TO_IMAGE_SIZE: dict[str, str] = {
    "16:9 landscape": "landscape_16_9",
    "9:16 portrait": "portrait_16_9",
    "4:3 landscape": "landscape_4_3",
    "3:4 portrait": "portrait_4_3",
    "1:1 square": "square",
    "1:1 square hd": "square_hd",
    "landscape_16_9": "landscape_16_9",
    "portrait_16_9": "portrait_16_9",
    "landscape_4_3": "landscape_4_3",
    "portrait_4_3": "portrait_4_3",
    "square": "square",
    "square_hd": "square_hd",
    "auto 2k": "auto_2K",
    "auto 4k": "auto_4K",
    "auto 1k": "auto_1K",
    "auto_2k": "auto_2K",
    "auto_4k": "auto_4K",
    "auto_1k": "auto_1K",
}


_QWEN_2K_SIZE: dict[str, dict[str, int]] = {
    "landscape_16_9": {"width": 2048, "height": 1152},
    "portrait_16_9": {"width": 1152, "height": 2048},
    "landscape_4_3": {"width": 2048, "height": 1536},
    "portrait_4_3": {"width": 1536, "height": 2048},
    "square_hd": {"width": 2048, "height": 2048},
    "square": {"width": 2048, "height": 2048},
}


def qwen_t2i_image_size(size_enum: str, resolution: str | None) -> str | dict[str, int]:
    """1K uses Flux-style enums; 2K uses explicit 2048-capped dimensions."""
    if (resolution or "").strip().lower() in ("2k", "2048"):
        return _QWEN_2K_SIZE.get(size_enum, {"width": 2048, "height": 1152})
    return size_enum


_VIDEO_SIZE_TOKENS: frozenset[str] = frozenset(
    {"360p", "480p", "540p", "720p", "1080p", "1440p", "2160p"}
)
_QUALITY_SIZE_TOKENS: frozenset[str] = frozenset({"0.5k", "1k", "2k", "4k"})

# Image-edit ladders (never inherit VisionModelSpec video 720p/1080p defaults)
FLUX_EDIT_RESOLUTIONS: tuple[str, ...] = ("auto",)
SEEDREAM_EDIT_RESOLUTIONS: tuple[str, ...] = (
    "auto_2K",
    "auto_4K",
    "square_hd",
    "landscape_16_9",
    "portrait_16_9",
)
NANO_PRO_EDIT_RESOLUTIONS: tuple[str, ...] = ("1K", "2K")


def map_t2i_image_size(aspect_label: str | None) -> str:
    """Map UI aspect label → fal image_size enum (Flux / Seedream)."""
    raw = (aspect_label or "").strip().lower()
    if not raw:
        return "landscape_16_9"
    compact = raw.replace(" ", "")
    # Video / quality tokens are not image_size enums — never 720p → landscape_16_9.
    if compact in _VIDEO_SIZE_TOKENS or compact in _QUALITY_SIZE_TOKENS:
        return ""
    if raw in ("match source", "match", "auto", "default"):
        return ""
    if raw in _T2I_ASPECT_TO_IMAGE_SIZE:
        return _T2I_ASPECT_TO_IMAGE_SIZE[raw]
    # Bare ratios (Scenes / simple pickers) + HD square
    bare = raw.replace(" ", "")
    if "hd" in raw and ("1:1" in bare or "square" in raw):
        return "square_hd"
    bare_map = {
        "16:9": "landscape_16_9",
        "9:16": "portrait_16_9",
        "4:3": "landscape_4_3",
        "3:4": "portrait_4_3",
        "1:1": "square",
        "3:2": "landscape_16_9",
        "2:3": "portrait_16_9",
        "21:9": "landscape_16_9",
        "9:21": "portrait_16_9",
    }
    if bare in bare_map:
        return bare_map[bare]
    # Substring fallback (e.g. "Horizontal · 16:9")
    for tok, size in (
        ("9:16", "portrait_16_9"),
        ("16:9", "landscape_16_9"),
        ("3:4", "portrait_4_3"),
        ("4:3", "landscape_4_3"),
        ("1:1", "square"),
    ):
        if tok in bare:
            if tok == "1:1" and "hd" in raw:
                return "square_hd"
            return size
    return "landscape_16_9"


def map_t2i_aspect_colon(aspect_label: str | None) -> str:
    """Map UI aspect label → '16:9' style string for Nano Banana / Recraft / Ultra."""
    raw = (aspect_label or "").strip().lower()
    if not raw or raw in ("auto", "default"):
        return "auto" if raw == "auto" else "16:9"
    compact = raw.replace(" ", "").replace("_", "").replace("-", "").replace(":", "")
    if compact in ("portrait169", "portrait916"):
        return "9:16"
    if compact in ("landscape169",):
        return "16:9"
    bare = raw.replace(" ", "")
    # Prefer longer tokens first so 9:16 wins over 16:9 substring false positives
    for tok in (
        "21:9",
        "9:21",
        "9:16",
        "16:9",
        "3:4",
        "4:3",
        "2:3",
        "3:2",
        "4:5",
        "5:4",
        "1:1",
    ):
        if tok in bare:
            return "9:16" if tok == "9:21" else tok
    size = map_t2i_image_size(aspect_label)
    return {
        "landscape_16_9": "16:9",
        "portrait_16_9": "9:16",
        "landscape_4_3": "4:3",
        "portrait_4_3": "3:4",
        "square": "1:1",
        "square_hd": "1:1",
    }.get(size, "16:9")


def clamp_nano_aspect(aspect_label: str | None) -> str:
    """Exact Nano Banana aspect_ratio enum — never '9:16 portrait'."""
    allowed = {a.lower(): a for a in T2I_NANO_ASPECT_CHOICES}
    raw = (aspect_label or "").strip()
    compact = raw.lower().replace(" ", "")
    # Video / quality tokens are not aspects — caller picks 9:16 vs 16:9.
    if compact in _VIDEO_SIZE_TOKENS or compact in _QUALITY_SIZE_TOKENS:
        return ""
    if raw.lower() in allowed:
        return allowed[raw.lower()]
    colon = map_t2i_aspect_colon(raw)
    if colon.lower() in allowed:
        return allowed[colon.lower()]
    return "9:16"


# ---------------------------------------------------------------------------
# Text → Image (pure T2I — no source still required)
# ---------------------------------------------------------------------------

T2I_MODELS: dict[str, VisionModelSpec] = {
    "flux 2 pro t2i": VisionModelSpec(
        key="flux 2 pro t2i",
        label="Flux 2 Pro (T2I)",
        mode="text_to_image",
        endpoint="fal-ai/flux-2-pro",
        cost_estimate_usd=0.04,
        notes=(
            "Default. Studio-grade Flux 2 Pro text→image. Nail an end/start still "
            "cheaply before expensive Veo bridge. ~$0.03–0.05 / image."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_ASPECT_CHOICES,
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "4"},
    ),
    "flux 2 t2i": VisionModelSpec(
        key="flux 2 t2i",
        label="Flux 2 (T2I · cheaper)",
        mode="text_to_image",
        endpoint="fal-ai/flux-2",
        cost_estimate_usd=0.02,
        notes="Flux 2 [dev] text→image — faster/cheaper iteration. ~$0.012/MP.",
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_ASPECT_CHOICES,
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "output_format": "jpeg"},
    ),
    "flux 2 flex t2i": VisionModelSpec(
        key="flux 2 flex t2i",
        label="Flux 2 Flex (T2I)",
        mode="text_to_image",
        endpoint="fal-ai/flux-2-flex",
        cost_estimate_usd=0.05,
        notes="Flux 2 Flex — more control / quality tradeoff. ~$0.05/MP.",
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_ASPECT_CHOICES,
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "output_format": "jpeg"},
    ),
    "flux 1.1 pro ultra t2i": VisionModelSpec(
        key="flux 1.1 pro ultra t2i",
        label="Flux 1.1 Pro Ultra (T2I)",
        mode="text_to_image",
        endpoint="fal-ai/flux-pro/v1.1-ultra",
        cost_estimate_usd=0.06,
        notes="Flux 1.1 Pro Ultra — high-res photoreal stills (up to ~2K).",
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_ASPECT_CHOICES,
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "2"},
        hidden=True,
    ),
    "recraft v4 t2i": VisionModelSpec(
        key="recraft v4 t2i",
        label="Recraft V4 (T2I)",
        mode="text_to_image",
        endpoint="fal-ai/recraft/v4/text-to-image",
        cost_estimate_usd=0.04,
        notes=(
            "Recraft V4 text→image — design/illustration, type, brand stills. "
            "~$0.04/image. Replaces V3 in the default list."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=("16:9 landscape", "9:16 portrait", "1:1 square", "4:3 landscape"),
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=1,
        extra_defaults={"enable_safety_checker": True},
    ),
    "recraft v3 t2i": VisionModelSpec(
        key="recraft v3 t2i",
        label="Recraft V3 (T2I · archive)",
        mode="text_to_image",
        endpoint="fal-ai/recraft/v3/text-to-image",
        cost_estimate_usd=0.04,
        notes="Recraft V3 text→image — archived; V4 is the default Recraft.",
        duration_choices=(),
        default_duration="",
        aspect_choices=("16:9 landscape", "9:16 portrait", "1:1 square", "4:3 landscape"),
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=1,
        extra_defaults={},
        hidden=True,
    ),
    "qwen image 3 t2i": VisionModelSpec(
        key="qwen image 3 t2i",
        label="Qwen Image 3 (T2I)",
        mode="text_to_image",
        endpoint="alibaba/qwen-image-3/text-to-image",
        cost_estimate_usd=0.04,
        notes=(
            "Qwen Image 3 — faces, type, signage, multilingual text. "
            "Up to 2K. Est. $0.04 @1K · $0.075 @2K."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_ASPECT_CHOICES,
        default_aspect="16:9 landscape",
        resolution_choices=("1K", "2K"),
        default_resolution="1K",
        supports_audio=False,
        supports_negative=True,
        max_num_images=4,
        extra_defaults={
            "num_images": 1,
            "output_format": "png",
            "enable_prompt_expansion": True,
            "enable_safety_checker": True,
        },
    ),
    # --- Nano Banana family ---
    "nano banana t2i": VisionModelSpec(
        key="nano banana t2i",
        label="Nano Banana (T2I · archive)",
        mode="text_to_image",
        endpoint="fal-ai/nano-banana",
        cost_estimate_usd=0.04,
        notes="Original Nano Banana T2I — archived; prefer Nano Banana 2 / Pro.",
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_NANO_ASPECT_CHOICES,
        default_aspect="16:9",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "4"},
        hidden=True,
    ),
    "nano banana 2 t2i": VisionModelSpec(
        key="nano banana 2 t2i",
        label="Nano Banana 2 (T2I · fast)",
        mode="text_to_image",
        endpoint="fal-ai/nano-banana-2",
        cost_estimate_usd=0.06,
        notes=(
            "Nano Banana 2 — faster T2I with resolution control (0.5K–4K). "
            "Good for quick end-frame exploration before video."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_NANO_ASPECT_CHOICES,
        default_aspect="16:9",
        resolution_choices=T2I_NANO2_RES_CHOICES,
        default_resolution="1K",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "4"},
    ),
    "nano banana pro t2i": VisionModelSpec(
        key="nano banana pro t2i",
        label="Nano Banana Pro (T2I)",
        mode="text_to_image",
        endpoint="fal-ai/nano-banana-pro",
        cost_estimate_usd=0.12,
        notes=(
            "Nano Banana Pro — higher adherence T2I; resolution 1K/2K/4K. "
            "Pricier stills; great when prompt fidelity matters."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_NANO_ASPECT_CHOICES,
        default_aspect="16:9",
        resolution_choices=T2I_NANO_PRO_RES_CHOICES,
        default_resolution="1K",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "4"},
    ),
    # --- Seedream family ---
    "seedream 4.5 t2i": VisionModelSpec(
        key="seedream 4.5 t2i",
        label="Seedream 4.5 (T2I)",
        mode="text_to_image",
        endpoint="fal-ai/bytedance/seedream/v4.5/text-to-image",
        cost_estimate_usd=0.05,
        notes="ByteDance Seedream 4.5 text→image — strong detail / listing-friendly stills.",
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_SEEDREAM_ASPECT_CHOICES,
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "enable_safety_checker": True},
        hidden=True,
    ),
    "seedream 5 lite t2i": VisionModelSpec(
        key="seedream 5 lite t2i",
        label="Seedream 5.0 Lite (T2I · cheaper)",
        mode="text_to_image",
        endpoint="fal-ai/bytedance/seedream/v5/lite/text-to-image",
        cost_estimate_usd=0.03,
        notes="Seedream 5 Lite — cheaper/faster Seedream 5 T2I for iteration.",
        duration_choices=(),
        default_duration="",
        aspect_choices=T2I_SEEDREAM_ASPECT_CHOICES,
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={"num_images": 1, "enable_safety_checker": True},
    ),
    "seedream 5 pro t2i": VisionModelSpec(
        key="seedream 5 pro t2i",
        label="Seedream 5.0 Pro (T2I)",
        mode="text_to_image",
        endpoint="bytedance/seedream/v5/pro/text-to-image",
        cost_estimate_usd=0.07,
        notes=(
            "Seedream 5 Pro text→image — highest Seedream T2I quality on fal "
            "(stable pro T2I endpoint)."
        ),
        duration_choices=(),
        default_duration="",
        # Pro image_size: no auto_4K; keep Auto 2K + presets
        aspect_choices=(
            "16:9 landscape",
            "9:16 portrait",
            "4:3 landscape",
            "3:4 portrait",
            "1:1 square",
            "1:1 square HD",
            "Auto 2K",
        ),
        default_aspect="16:9 landscape",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={
            "num_images": 1,
            "enable_safety_checker": True,
            "output_format": "jpeg",
        },
    ),
    "grok imagine 2.0 t2i": VisionModelSpec(
        key="grok imagine 2.0 t2i",
        label="Grok Imagine Image 2.0 (T2I)",
        mode="text_to_image",
        endpoint="xai/grok-imagine-image/v2.0/text-to-image",
        cost_estimate_usd=0.06,
        notes=(
            "xAI Grok Imagine Image 2.0 T2I. Quality low/medium · 1k/2k. "
            "Est. $0.04 low 1K · $0.06 medium 1K or low 2K · $0.08 medium 2K."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=(
            "16:9",
            "9:16",
            "4:3",
            "3:2",
            "1:1",
            "2:3",
            "3:4",
            "2:1",
            "1:2",
        ),
        default_aspect="16:9",
        resolution_choices=("1k", "2k"),
        default_resolution="1k",
        supports_audio=False,
        supports_negative=False,
        max_num_images=4,
        extra_defaults={
            "num_images": 1,
            "output_format": "jpeg",
            "quality": "medium",
        },
    ),
    "fibo gen 1.5 t2i": VisionModelSpec(
        key="fibo gen 1.5 t2i",
        label="Fibo Gen 1.5 (T2I)",
        mode="text_to_image",
        endpoint="bria/fibo-gen-1.5/text-to-image",
        cost_estimate_usd=0.04,
        notes=(
            "Bria Fibo Gen 1.5 — high-fidelity T2I, typography, structured/"
            "controllable prompts, licensed data. ~$0.04/image. Commercial OK."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=(
            "1:1",
            "16:9",
            "9:16",
            "4:3",
            "3:4",
            "3:2",
            "2:3",
            "4:5",
            "5:4",
        ),
        default_aspect="1:1",
        resolution_choices=("1MP", "4MP"),
        default_resolution="1MP",
        supports_audio=False,
        supports_negative=False,
        max_num_images=1,
        extra_defaults={"style_preset": "No Style"},
    ),
    "muse image t2i": VisionModelSpec(
        key="muse image t2i",
        label="Muse Image (T2I)",
        mode="text_to_image",
        endpoint="meta/muse-image/text-to-image",
        cost_estimate_usd=0.01,
        notes=(
            "Meta Muse Image T2I — instruction-following and typography. "
            "~$0.01/image. Aspects 21:9–9:21. Up to 10 images per call."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=(
            "21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21",
        ),
        default_aspect="16:9",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_num_images=10,
        extra_defaults={"num_images": 1, "output_format": "jpeg"},
    ),
}

# ---------------------------------------------------------------------------
# Image → Image (creative still edit — Aleph plate / source still)
# Endpoints mirror Studio image-edit models via edit_model_key.
# ---------------------------------------------------------------------------

I2I_ASPECT_CHOICES: tuple[str, ...] = (
    "Match source",
    "16:9 landscape",
    "9:16 portrait",
    "4:3 landscape",
    "3:4 portrait",
    "1:1 square",
    "1:1 square HD",
)

# I2I multi-ref: max_refs = max *extra* reference stills (primary is separate).
# Total stills = IMAGE_EDIT_MODELS.max_ref_images; extras = that minus 1.

I2I_MODELS: dict[str, VisionModelSpec] = {
    "flux 2 pro i2i": VisionModelSpec(
        key="flux 2 pro i2i",
        label="Flux 2 Pro (edit)",
        mode="image_to_image",
        endpoint="fal-ai/flux-2-pro/edit",
        cost_estimate_usd=0.03,
        notes=(
            "Default. Creative edit via Flux 2 Pro. Multi-ref: up to 9 refs "
            "(identity / material / furniture). ~$0.03/image."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=I2I_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=8,
        image_field="image_urls",
        edit_model_key="flux 2 pro",
        supports_strength=True,
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "4"},
    ),
    "flux 2 max i2i": VisionModelSpec(
        key="flux 2 max i2i",
        label="Flux 2 Max (edit)",
        mode="image_to_image",
        endpoint="fal-ai/flux-2-max/edit",
        cost_estimate_usd=0.07,
        notes=(
            "Highest quality Flux edit. Multi-ref up to 8 refs. "
            "~$0.07 first MP."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=I2I_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=7,
        image_field="image_urls",
        edit_model_key="flux 2 max",
        supports_strength=True,
        extra_defaults={"num_images": 1, "output_format": "jpeg"},
    ),
    "flux 2 flex i2i": VisionModelSpec(
        key="flux 2 flex i2i",
        label="Flux 2 Flex (edit)",
        mode="image_to_image",
        endpoint="fal-ai/flux-2-flex/edit",
        cost_estimate_usd=0.04,
        notes="Flux 2 Flex edit. Multi-ref up to 10 refs. ~$0.04/image.",
        duration_choices=(),
        default_duration="",
        aspect_choices=I2I_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=9,
        image_field="image_urls",
        edit_model_key="flux 2 flex",
        supports_strength=True,
        extra_defaults={"num_images": 1, "output_format": "jpeg"},
    ),
    "flux kontext pro i2i": VisionModelSpec(
        key="flux kontext pro i2i",
        label="Flux Kontext Pro (edit)",
        mode="image_to_image",
        endpoint="fal-ai/flux-pro/kontext",
        cost_estimate_usd=0.04,
        notes=(
            "Flux Kontext Pro — single-image only (extra refs hidden). "
            "Strong subject/context preservation."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=("Match source", "16:9", "9:16", "4:3", "3:4", "1:1", "3:2", "2:3"),
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=0,
        image_field="image_url",
        edit_model_key="flux kontext pro",
        supports_strength=True,
        extra_defaults={},
    ),
    "nano banana pro i2i": VisionModelSpec(
        key="nano banana pro i2i",
        label="Nano Banana Pro (edit)",
        mode="image_to_image",
        endpoint="fal-ai/nano-banana-pro/edit",
        cost_estimate_usd=0.15,
        notes=(
            "Nano Banana Pro edit — multi-ref up to 14 refs. "
            "Excellent prompt adherence. 1K/2K/4K."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=("Match source",) + T2I_NANO_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=T2I_NANO_PRO_RES_CHOICES,
        default_resolution="1K",
        supports_audio=False,
        supports_negative=False,
        max_refs=13,
        image_field="image_urls",
        edit_model_key="nano banana pro",
        supports_strength=False,
        extra_defaults={"num_images": 1},
    ),
    "nano banana 2 i2i": VisionModelSpec(
        key="nano banana 2 i2i",
        label="Nano Banana 2 (edit · fast)",
        mode="image_to_image",
        endpoint="fal-ai/nano-banana-2/edit",
        cost_estimate_usd=0.08,
        notes="Nano Banana 2 edit — multi-ref (primary + up to 3). Faster/cheaper. 0.5K–4K.",
        duration_choices=(),
        default_duration="",
        aspect_choices=("Match source",) + T2I_NANO_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=T2I_NANO2_RES_CHOICES,
        default_resolution="1K",
        supports_audio=False,
        supports_negative=False,
        max_refs=3,
        image_field="image_urls",
        edit_model_key="nano banana 2",
        supports_strength=False,
        extra_defaults={"num_images": 1},
    ),
    "nano banana i2i": VisionModelSpec(
        key="nano banana i2i",
        label="Nano Banana (edit · archive)",
        mode="image_to_image",
        endpoint="fal-ai/nano-banana/edit",
        cost_estimate_usd=0.04,
        notes="Original Nano Banana edit — archived; prefer Nano Banana 2 / Pro.",
        duration_choices=(),
        default_duration="",
        aspect_choices=("Match source",) + T2I_NANO_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=("1K",),
        default_resolution="1K",
        supports_audio=False,
        supports_negative=False,
        max_refs=3,
        image_field="image_urls",
        edit_model_key="nano banana",
        supports_strength=False,
        extra_defaults={"num_images": 1},
        hidden=True,
    ),
    "qwen image 3 i2i": VisionModelSpec(
        key="qwen image 3 i2i",
        label="Qwen Image 3 (edit)",
        mode="image_to_image",
        endpoint="alibaba/qwen-image-3/edit",
        cost_estimate_usd=0.04,
        notes=(
            "Qwen Image 3 edit — 1–3 refs. Strong faces, type, and signage. "
            "Est. $0.04 @1K · $0.075 @2K."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=I2I_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=("1K", "2K"),
        default_resolution="1K",
        supports_audio=False,
        supports_negative=True,
        max_refs=2,
        image_field="image_urls",
        edit_model_key="qwen image 3",
        supports_strength=False,
        extra_defaults={
            "num_images": 1,
            "output_format": "png",
            "enable_prompt_expansion": True,
            "enable_safety_checker": True,
        },
    ),
    "seedream 5 pro i2i": VisionModelSpec(
        key="seedream 5 pro i2i",
        label="Seedream 5.0 Pro (edit)",
        mode="image_to_image",
        endpoint="bytedance/seedream/v5/pro/edit",
        cost_estimate_usd=0.07,
        notes=(
            "Seedream 5 Pro edit — multi-ref (primary + up to 3). "
            "Grounded still edits; listing-friendly detail."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=I2I_ASPECT_CHOICES + ("Auto 2K", "Auto 4K"),
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=3,
        image_field="image_urls",
        edit_model_key="seedream 5 pro",
        supports_strength=False,
        supports_region_boxes=True,
        extra_defaults={"num_images": 1, "enable_safety_checker": True},
    ),
    "fibo edit 1.5 i2i": VisionModelSpec(
        key="fibo edit 1.5 i2i",
        label="Fibo Edit 1.5",
        mode="image_to_image",
        endpoint="bria/fibo-edit-1.5/edit",
        cost_estimate_usd=0.04,
        notes=(
            "Bria Fibo Edit 1.5 — multi-ref (source + up to 3 refs). "
            "Cite <image_1> (source) and <image_2>… in the instruction. "
            "Try-on / object combo / bg swap; furniture pop-in is a test case. "
            "~$0.04/image. Licensed, commercial OK. Strong for staging / furniture pop-in. "
            "Flux 2 Pro and Nano Banana Pro remain available."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=(
            "Match source",
            "1:1",
            "16:9",
            "9:16",
            "4:3",
            "3:4",
            "3:2",
            "2:3",
            "4:5",
            "5:4",
        ),
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=3,
        image_field="image_urls",
        edit_model_key="fibo edit 1.5",
        supports_strength=False,
        supports_mask=True,
        extra_defaults={},
    ),
    "muse image edit i2i": VisionModelSpec(
        key="muse image edit i2i",
        label="Muse Image Edit",
        mode="image_to_image",
        endpoint="meta/muse-image/edit",
        cost_estimate_usd=0.01,
        notes=(
            "Meta Muse Image edit — precise “change only what I asked.” "
            "1–10 stills (I2I / R2I). No mask. ~$0.01/image."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=(
            "Match source",
            "21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21",
        ),
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=9,
        image_field="image_urls",
        edit_model_key="muse image edit",
        supports_strength=False,
        supports_mask=False,
        extra_defaults={"num_images": 1, "output_format": "jpeg"},
    ),
    "fibo edit i2i": VisionModelSpec(
        key="fibo edit i2i",
        label="Fibo Edit (v1)",
        mode="image_to_image",
        endpoint="bria/fibo-edit/edit",
        cost_estimate_usd=0.04,
        notes=(
            "Bria Fibo Edit v1 — single-image local edits, optional mask. "
            "~$0.04/image. Prefer Fibo Edit 1.5 for multi-ref. "
            "Licensed data, commercial OK."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=("Match source",),
        default_aspect="Match source",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=True,
        max_refs=0,
        image_field="image_url",
        edit_model_key="fibo edit",
        supports_strength=False,
        supports_mask=True,
        extra_defaults={"steps_num": 30},
        hidden=True,
    ),
}

# ---------------------------------------------------------------------------
# Text → Video
# ---------------------------------------------------------------------------

T2V_MODELS: dict[str, VisionModelSpec] = {
    "veo 3.1": VisionModelSpec(
        key="veo 3.1",
        label="Veo 3.1",
        mode="text_to_video",
        endpoint="fal-ai/veo3.1",
        # fal billing: $0.40/s (user invoice)
        cost_estimate_usd=3.20,  # 8s × $0.40
        cost_per_second=0.40,
        notes="Highest quality T2V. ~$0.40/s on fal. 4/6/8s · 16:9 or 9:16 · optional audio.",
        default_duration="8s",
        extra_defaults={"generate_audio": True, "auto_fix": True, "safety_tolerance": "4"},
    ),
    "veo 3.1 fast": VisionModelSpec(
        key="veo 3.1 fast",
        label="Veo 3.1 Fast",
        mode="text_to_video",
        endpoint="fal-ai/veo3.1/fast",
        # fal billing: $0.15/s (fast family)
        cost_estimate_usd=0.90,  # 6s × $0.15
        cost_per_second=0.15,
        notes="Faster/cheaper Veo 3.1. ~$0.15/s on fal. Good default for exploration.",
        default_duration="6s",
        extra_defaults={"generate_audio": True, "auto_fix": True, "safety_tolerance": "4"},
    ),
    "luma ray 2": VisionModelSpec(
        key="luma ray 2",
        label="Luma Ray 2",
        mode="text_to_video",
        endpoint="fal-ai/luma-dream-machine/ray-2",
        cost_estimate_usd=0.35,
        cost_per_second=0.06,
        notes="Strong cinematic T2V alternative. Duration/aspect per Luma API.",
        duration_choices=("5s", "9s"),
        default_duration="5s",
        aspect_choices=("16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"),
        supports_audio=False,
        supports_negative=False,
        resolution_choices=("540p", "720p", "1080p"),
        default_resolution="720p",
        extra_defaults={"loop": False},
        hidden=True,
    ),
    "minimax h3 t2v": VisionModelSpec(
        key="minimax h3 t2v",
        label="MiniMax H3 · Text→Video",
        mode="text_to_video",
        endpoint="minimax/h3/text-to-video",
        cost_estimate_usd=1.30,  # 5s × $0.26
        cost_per_second=0.26,
        notes=(
            "MiniMax H3 (Hailuo-03) T2V — 5–15s · 2K · native stereo audio. "
            "Est. ~$0.26/s @2K. Prefer Omni when you have stills/motion/audio refs."
        ),
        duration_choices=tuple(str(i) for i in range(5, 16)),
        default_duration="5",
        aspect_choices=("21:9", "16:9", "4:3", "1:1", "3:4", "9:16"),
        default_aspect="16:9",
        resolution_choices=("2K",),
        default_resolution="2K",
        supports_audio=False,  # native stereo always; no toggle
        supports_negative=False,
        duration_as_int=True,
        native_stereo_audio=True,
    ),
    "minimax h3 max t2v": VisionModelSpec(
        key="minimax h3 max t2v",
        label="MiniMax H3 Max · Text→Video",
        mode="text_to_video",
        endpoint="minimax/h3-max/text-to-video",
        cost_estimate_usd=0.20,  # 5s × $0.04 @768P promo
        cost_per_second=0.04,
        cost_per_second_by_resolution={"480p": 0.025, "768p": 0.04},
        notes=(
            "MiniMax H3 Max T2V — 5–15s · 480P/768P. Beside H3 (does not replace it). "
            "Launch promo $0.025/s @480P · $0.04/s @768P until 1 Sep 2026; "
            "catalog after that $0.05/s · $0.08/s. prompt_expansion_mode default balanced."
        ),
        duration_choices=tuple(str(i) for i in range(5, 16)),
        default_duration="5",
        aspect_choices=("21:9", "16:9", "4:3", "1:1", "3:4", "9:16"),
        default_aspect="16:9",
        resolution_choices=("480P", "768P"),
        default_resolution="768P",
        supports_audio=False,
        supports_negative=False,
        duration_as_int=True,
        extra_defaults={
            "prompt_expansion_mode": "balanced",
            "enable_safety_checker": True,
        },
    ),
    "gemini omni 1.1 t2v": VisionModelSpec(
        key="gemini omni 1.1 t2v",
        label="Gemini Omni Flash 1.1 · Text→Video",
        mode="text_to_video",
        endpoint="google/gemini-omni-flash/v1.1/text-to-video",
        cost_estimate_usd=0.80,  # 8s × $0.10 @720p
        cost_per_second=0.10,
        cost_per_second_by_resolution={
            "360p": 0.03, "720p": 0.10, "1080p": 0.15, "4k": 0.30,
        },
        notes=(
            "Gemini Omni Flash 1.1 T2V — 3–10s (default 8) · 16:9/9:16. "
            "Est. $0.03/s @360p · $0.10/s @720p · $0.15/s @1080p · $0.30/s @4k."
        ),
        duration_choices=tuple(str(i) for i in range(3, 11)),
        default_duration="8",
        aspect_choices=("16:9", "9:16"),
        default_aspect="16:9",
        resolution_choices=("360p", "720p", "1080p", "4k"),
        default_resolution="720p",
        supports_audio=False,
        supports_negative=False,
        duration_as_int=True,
    ),
    "luma ray 3.2": VisionModelSpec(
        key="luma ray 3.2",
        label="Luma Ray 3.2",
        mode="text_to_video",
        endpoint="luma/agent/ray/v3.2/text-to-video",
        cost_estimate_usd=0.50,  # 5s @540p
        cost_per_second=0.10,
        cost_per_second_by_resolution={"540p": 0.10, "720p": 0.20, "1080p": 0.40},
        notes=(
            "Luma Ray 3.2 T2V — 5s or 10s · 540p/720p/1080p. "
            "Est. $0.50 / $1 / $2 for 5s at 540/720/1080; 10s doubles. Replaces Ray 2 in the list."
        ),
        duration_choices=("5s", "10s"),
        default_duration="5s",
        aspect_choices=("3:4", "4:3", "1:1", "9:16", "16:9", "21:9"),
        default_aspect="16:9",
        resolution_choices=("540p", "720p", "1080p"),
        default_resolution="540p",
        supports_audio=False,
        supports_negative=False,
    ),
    "grok imagine 1.5 t2v": VisionModelSpec(
        key="grok imagine 1.5 t2v",
        label="Grok Imagine 1.5 · Text→Video",
        mode="text_to_video",
        endpoint="xai/grok-imagine-video/v1.5/text-to-video",
        cost_estimate_usd=0.84,  # 6s × $0.14 @720p
        cost_per_second=0.14,
        notes=(
            "xAI Grok Imagine Video 1.5 T2V — strong motion quality + native audio. "
            "1–15s · 480p/720p/1080p. Est. $0.08/s @480p, $0.14/s @720p, $0.25/s @1080p."
        ),
        duration_choices=tuple(str(i) for i in range(1, 16)),
        default_duration="6",
        aspect_choices=("16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"),
        default_aspect="16:9",
        resolution_choices=("480p", "720p", "1080p"),
        default_resolution="720p",
        supports_audio=False,  # native audio always
        supports_negative=False,
        duration_as_int=True,
        native_stereo_audio=True,
    ),
    "flux 3 t2v": VisionModelSpec(
        key="flux 3 t2v",
        label="FLUX 3 · Text→Video",
        mode="text_to_video",
        endpoint="blackforestlabs/flux-3/text-to-video",
        cost_estimate_usd=1.36,  # 8s × $0.17 @720p
        cost_per_second=0.17,
        cost_per_second_by_resolution={"720p": 0.17, "1080p": 0.29},
        draft_endpoint="blackforestlabs/flux-3/text-to-video/draft",
        enhance_endpoint="blackforestlabs/flux-3/draft-enhance",
        cost_per_second_draft=0.06,
        notes=(
            "FLUX 3 (BFL on fal) T2V — full quality with optional native audio. "
            "5–20s or auto · 720p/1080p. Draft first → Enhance to full. "
            "Est. ~$0.17/s @720p · ~$0.29/s @1080p · draft ~$0.06/s."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(5, 21)),
        default_duration="8",
        aspect_choices=(
            "auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16",
        ),
        default_aspect="auto",
        resolution_choices=("720p", "1080p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        duration_as_int=True,
        extra_defaults={"generate_audio": True, "safety_tolerance": 2},
    ),
    "seedance 2.5 t2v": VisionModelSpec(
        key="seedance 2.5 t2v",
        label="Seedance 2.5 · Text→Video",
        mode="text_to_video",
        endpoint="bytedance/seedance-2.5/text-to-video",
        # 5s @720p 16:9 ≈ $2.31 (token formula); UI scales by duration
        cost_estimate_usd=2.31,
        cost_per_second=0.473,  # approx 16:9 720p; estimate_vision_cost uses tokens
        cost_per_second_by_resolution={"480p": 0.2205, "720p": 0.473},
        notes=(
            "ByteDance Seedance 2.5 T2V — up to 30s single-pass with native audio. "
            "480p/720p · duration auto or 4–30s · aspect auto|ratios. "
            "Token billing ~$0.0214/1k tokens (≈$0.47/s @720p 16:9). "
            "Partner photoreal-face filter may reject some people prompts."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(4, 31)),
        default_duration="5",
        aspect_choices=(
            "auto",
            "21:9",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="auto",
        resolution_choices=("480p", "720p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        duration_as_int=False,
        extra_defaults={"generate_audio": True},
    ),
    "wan 3.0 t2v": VisionModelSpec(
        key="wan 3.0 t2v",
        label="Wan 3.0 · Text→Video",
        mode="text_to_video",
        endpoint="alibaba/wan-3.0/text-to-video",
        cost_estimate_usd=1.00,  # 5s × $0.20 @1080p
        cost_per_second=0.20,
        cost_per_second_by_resolution={"480p": 0.05, "720p": 0.10, "1080p": 0.20},
        notes=(
            "Alibaba Wan 3.0 T2V — up to 30s @ 1080p with native audio. "
            "Duration 2–30s or auto · 480p/720p/1080p (default 1080p) · "
            "aspect adaptive|16:9|4:3|1:1|3:4|9:16. "
            "Est. $0.05/s @480p · $0.10/s @720p · $0.20/s @1080p. Commercial OK on fal."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(2, 31)),
        default_duration="5",
        aspect_choices=(
            "adaptive",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="adaptive",
        resolution_choices=("480p", "720p", "1080p"),
        default_resolution="1080p",
        supports_audio=True,
        supports_negative=False,
        duration_as_int=True,
        extra_defaults={"audio": True, "enable_prompt_expansion": True},
    ),
    "ltx 2.5 pro t2v": VisionModelSpec(
        key="ltx 2.5 pro t2v",
        label="LTX 2.5 Pro · Text→Video",
        mode="text_to_video",
        endpoint="lightricks/ltx-2.5/text-to-video/pro",
        cost_estimate_usd=1.36,
        cost_per_second=0.17,
        cost_per_second_by_resolution={"720p": 0.12, "1080p": 0.17},
        notes=(
            "Lightricks LTX 2.5 Pro T2V — quality pass with native audio. "
            "6/8/10s or auto · 720p/1080p. Est. ~$0.12/s @720p · ~$0.17/s @1080p."
        ),
        duration_choices=("auto", "6", "8", "10"),
        default_duration="6",
        aspect_choices=("16:9", "9:16"),
        default_aspect="16:9",
        resolution_choices=("720p", "1080p"),
        default_resolution="1080p",
        supports_audio=True,
        supports_negative=False,
        extra_defaults={"generate_audio": True},
    ),
    "kling v3 pro t2v": VisionModelSpec(
        key="kling v3 pro t2v",
        label="Kling 3.0 Pro · Text→Video",
        mode="text_to_video",
        endpoint="fal-ai/kling-video/v3/pro/text-to-video",
        cost_estimate_usd=0.84,  # 5s × $0.168 audio on
        cost_per_second=0.168,
        notes=(
            "Kling 3.0 Pro T2V — cinematic 3–15s · 16:9/9:16/1:1 · native audio. "
            "Est. $0.112/s audio off · $0.168/s audio on."
        ),
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="5",
        aspect_choices=("16:9", "9:16", "1:1"),
        default_aspect="16:9",
        resolution_choices=(),
        supports_audio=True,
        supports_multi_prompt=True,
        max_multi_prompt=6,
        extra_defaults={"generate_audio": True},
    ),
    "kling v3 standard t2v": VisionModelSpec(
        key="kling v3 standard t2v",
        label="Kling 3.0 Standard · Text→Video",
        mode="text_to_video",
        endpoint="fal-ai/kling-video/v3/standard/text-to-video",
        cost_estimate_usd=0.63,  # 5s × $0.126 audio on
        cost_per_second=0.126,
        notes=(
            "Kling 3.0 Standard T2V — 3–15s · native audio. "
            "Est. $0.084/s audio off · $0.126/s audio on (not Pro)."
        ),
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="5",
        aspect_choices=("16:9", "9:16", "1:1"),
        default_aspect="16:9",
        resolution_choices=(),
        supports_audio=True,
        supports_multi_prompt=True,
        max_multi_prompt=6,
        extra_defaults={"generate_audio": True},
    ),
    "kling o3 pro t2v": VisionModelSpec(
        key="kling o3 pro t2v",
        label="Kling O3 Pro · Text→Video",
        mode="text_to_video",
        endpoint="fal-ai/kling-video/o3/pro/text-to-video",
        cost_estimate_usd=0.84,
        cost_per_second=0.168,
        notes="Kling O3 Pro T2V — 3–15s · native audio. Est. ~$0.168/s with audio.",
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="5",
        aspect_choices=("16:9", "9:16", "1:1"),
        default_aspect="16:9",
        resolution_choices=(),
        supports_audio=True,
        extra_defaults={"generate_audio": True},
    ),
    "kling o3 standard t2v": VisionModelSpec(
        key="kling o3 standard t2v",
        label="Kling O3 Standard · Text→Video",
        mode="text_to_video",
        endpoint="fal-ai/kling-video/o3/standard/text-to-video",
        cost_estimate_usd=0.56,
        cost_per_second=0.112,
        notes="Kling O3 Standard T2V — 3–15s · native audio. Est. ~$0.112/s.",
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="5",
        aspect_choices=("16:9", "9:16", "1:1"),
        default_aspect="16:9",
        resolution_choices=(),
        supports_audio=True,
        extra_defaults={"generate_audio": True},
    ),
    "ltx 2.5 fast t2v": VisionModelSpec(
        key="ltx 2.5 fast t2v",
        label="LTX 2.5 Fast · Text→Video",
        mode="text_to_video",
        endpoint="lightricks/ltx-2.5/text-to-video/fast",
        cost_estimate_usd=0.78,
        cost_per_second=0.13,
        cost_per_second_by_resolution={
            "720p": 0.09,
            "1080p": 0.13,
            "1440p": 0.19,
            "2160p": 0.30,
        },
        notes=(
            "Lightricks LTX 2.5 Fast T2V — iteration + 4K. "
            "6–20s or auto. Est. $0.09/s @720p · $0.13/s @1080p · $0.19/s @1440p · $0.30/s @4K."
        ),
        duration_choices=("auto", "6", "8", "10", "12", "14", "16", "18", "20"),
        default_duration="6",
        aspect_choices=("16:9", "9:16"),
        default_aspect="16:9",
        resolution_choices=("720p", "1080p", "1440p", "2160p"),
        default_resolution="1080p",
        supports_audio=True,
        supports_negative=False,
        extra_defaults={"generate_audio": True},
    ),
    "mirage avatar x t2v": VisionModelSpec(
        key="mirage avatar x t2v",
        label="Mirage Avatar X · Text→Video",
        mode="text_to_video",
        endpoint="mirage-api/avatar-x/text-to-video",
        cost_estimate_usd=1.20,
        cost_per_second=0.30,
        notes=(
            "Mirage Avatar X talking-head from a script (prompt = spoken script, 50–1500 chars). "
            "Stock avatar Jasmine. Est. ~$0.30/s. Duration follows script; cap 60s for estimates."
        ),
        duration_choices=("5", "10", "15", "20", "30", "45", "60"),
        default_duration="15",
        aspect_choices=(),
        default_aspect="",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        extra_defaults={"avatar": "Jasmine"},
    ),
}

# ---------------------------------------------------------------------------
# Image → Video
# ---------------------------------------------------------------------------

I2V_MODELS: dict[str, VisionModelSpec] = {
    "veo 3.1 fast i2v": VisionModelSpec(
        key="veo 3.1 fast i2v",
        label="Veo 3.1 Fast · Image→Video",
        mode="image_to_video",
        endpoint="fal-ai/veo3.1/fast/image-to-video",
        # fal billing: $0.15/s
        cost_estimate_usd=0.90,  # 6s × $0.15
        cost_per_second=0.15,
        notes="Faster still → move. ~$0.15/s on fal. Recommended default for I2V experiments.",
        default_duration="6s",
        aspect_choices=("auto", "16:9", "9:16"),
        default_aspect="auto",
        extra_defaults={"generate_audio": True, "auto_fix": False, "safety_tolerance": "4"},
    ),
    "veo 3.1 i2v": VisionModelSpec(
        key="veo 3.1 i2v",
        label="Veo 3.1 · Image→Video",
        mode="image_to_video",
        endpoint="fal-ai/veo3.1/image-to-video",
        # fal billing: $0.40/s (user invoice)
        cost_estimate_usd=3.20,  # 8s × $0.40
        cost_per_second=0.40,
        notes="Still → cinematic move. ~$0.40/s on fal. Keep architecture in the prompt.",
        aspect_choices=("auto", "16:9", "9:16"),
        default_aspect="auto",
        extra_defaults={"generate_audio": True, "auto_fix": False, "safety_tolerance": "4"},
    ),
    "kling o3 standard i2v": VisionModelSpec(
        key="kling o3 standard i2v",
        label="Kling O3 Standard · Image→Video",
        mode="image_to_video",
        endpoint="fal-ai/kling-video/o3/standard/image-to-video",
        cost_estimate_usd=0.56,  # 5s × ~$0.112
        cost_per_second=0.112,
        notes=(
            "Kling O3 Standard I2V — start still; optional end_image_url for first→last. "
            "Duration 3–15s. Optional generate_audio."
        ),
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="5",
        aspect_choices=("16:9", "9:16", "1:1"),
        supports_audio=True,
        supports_end_frame=True,
        resolution_choices=(),
        extra_defaults={"generate_audio": True},
    ),
    "kling o3 pro i2v": VisionModelSpec(
        key="kling o3 pro i2v",
        label="Kling O3 Pro · Image→Video",
        mode="image_to_video",
        endpoint="fal-ai/kling-video/o3/pro/image-to-video",
        cost_estimate_usd=0.70,  # 5s × $0.14
        cost_per_second=0.14,
        notes=(
            "Kling O3 Pro I2V — start still; optional end_image_url for first→last. "
            "Duration 3–15s (not 5/10-only). Optional generate_audio."
        ),
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="5",
        aspect_choices=("16:9", "9:16", "1:1"),
        supports_audio=True,
        supports_end_frame=True,
        resolution_choices=(),
        extra_defaults={"generate_audio": True},
    ),
    "seedance 2.0 i2v": VisionModelSpec(
        key="seedance 2.0 i2v",
        label="Seedance 2.0 · Image→Video (archive)",
        mode="image_to_video",
        endpoint="bytedance/seedance-2.0/image-to-video",
        cost_estimate_usd=0.30,
        cost_per_second=0.05,
        notes="ByteDance Seedance 2.0 I2V — archived; prefer Seedance 2.5.",
        duration_choices=("5", "8", "10"),
        default_duration="5",
        supports_audio=False,
        resolution_choices=(),
        extra_defaults={},
        hidden=True,
    ),
    "seedance 2.5 i2v": VisionModelSpec(
        key="seedance 2.5 i2v",
        label="Seedance 2.5 · Image→Video",
        mode="image_to_video",
        endpoint="bytedance/seedance-2.5/image-to-video",
        cost_estimate_usd=2.31,
        cost_per_second=0.473,
        cost_per_second_by_resolution={"480p": 0.2205, "720p": 0.473},
        notes=(
            "Seedance 2.5 I2V — animate a still up to 30s with native audio. "
            "Optional end frame. 480p/720p · duration auto|4–30. "
            "Token est. ~$0.0214/1k tokens (image refs not billed). "
            "Partner photoreal-face filter may reject photoreal people stills."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(4, 31)),
        default_duration="5",
        aspect_choices=(
            "auto",
            "21:9",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="auto",
        resolution_choices=("480p", "720p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        supports_end_frame=True,
        duration_as_int=False,
        image_field="image_url",
        extra_defaults={"generate_audio": True},
    ),
    "hailuo 02 i2v": VisionModelSpec(
        key="hailuo 02 i2v",
        label="MiniMax Hailuo 02 · Image→Video (archive)",
        mode="image_to_video",
        endpoint="fal-ai/minimax/hailuo-02/standard/image-to-video",
        cost_estimate_usd=0.28,
        cost_per_second=0.04,
        notes="I2V with optional end frame (also listed under Bridge).",
        duration_choices=("6", "10"),
        default_duration="6",
        supports_audio=False,
        supports_negative=False,
        supports_end_frame=True,
        resolution_choices=("512P", "768P"),
        default_resolution="768P",
        extra_defaults={"prompt_optimizer": True},
        hidden=True,
    ),
    "minimax h3 i2v": VisionModelSpec(
        key="minimax h3 i2v",
        label="MiniMax H3 · Image→Video",
        mode="image_to_video",
        endpoint="minimax/h3/image-to-video",
        cost_estimate_usd=1.30,
        cost_per_second=0.26,
        notes=(
            "H3 I2V — start still as first frame; optional end still for first→last "
            "(day→night / porch→interior). 5–15s · 2K · native stereo. "
            "Est. ~$0.26/s @2K. Aspect follows the start image."
        ),
        duration_choices=tuple(str(i) for i in range(5, 16)),
        default_duration="5",
        aspect_choices=("auto",),
        default_aspect="auto",
        resolution_choices=("2K",),
        default_resolution="2K",
        supports_audio=False,
        supports_negative=False,
        supports_end_frame=True,
        duration_as_int=True,
        native_stereo_audio=True,
    ),
    "minimax h3 max i2v": VisionModelSpec(
        key="minimax h3 max i2v",
        label="MiniMax H3 Max · Image→Video",
        mode="image_to_video",
        endpoint="minimax/h3-max/image-to-video",
        cost_estimate_usd=0.20,
        cost_per_second=0.04,
        cost_per_second_by_resolution={"480p": 0.025, "768p": 0.04},
        notes=(
            "H3 Max I2V — start still as first frame; optional end still (end_image_url). "
            "5–15s · 480P/768P. Aspect follows the start image. "
            "Promo $0.025/s @480P · $0.04/s @768P until 1 Sep 2026; then $0.05 / $0.08."
        ),
        duration_choices=tuple(str(i) for i in range(5, 16)),
        default_duration="5",
        aspect_choices=("auto",),
        default_aspect="auto",
        resolution_choices=("480P", "768P"),
        default_resolution="768P",
        supports_audio=False,
        supports_negative=False,
        supports_end_frame=True,
        duration_as_int=True,
        extra_defaults={
            "prompt_expansion_mode": "balanced",
            "enable_safety_checker": True,
        },
    ),
    "gemini omni 1.1 i2v": VisionModelSpec(
        key="gemini omni 1.1 i2v",
        label="Gemini Omni Flash 1.1 · Image→Video",
        mode="image_to_video",
        endpoint="google/gemini-omni-flash/v1.1/image-to-video",
        cost_estimate_usd=0.80,
        cost_per_second=0.10,
        cost_per_second_by_resolution={
            "360p": 0.03, "720p": 0.10, "1080p": 0.15, "4k": 0.30,
        },
        notes=(
            "Gemini Omni Flash 1.1 I2V — start still required; optional last frame "
            "(end_image_url). 3–10s · 16:9/9:16 · 360p–4k. "
            "Est. $0.03/s @360p · $0.10/s @720p · $0.15/s @1080p · $0.30/s @4k."
        ),
        duration_choices=tuple(str(i) for i in range(3, 11)),
        default_duration="8",
        aspect_choices=("16:9", "9:16"),
        default_aspect="16:9",
        resolution_choices=("360p", "720p", "1080p", "4k"),
        default_resolution="720p",
        supports_audio=False,
        supports_negative=False,
        supports_end_frame=True,
        duration_as_int=True,
        image_field="image_url",
    ),
    "grok imagine 1.5 i2v": VisionModelSpec(
        key="grok imagine 1.5 i2v",
        label="Grok Imagine 1.5 · Image→Video",
        mode="image_to_video",
        endpoint="xai/grok-imagine-video/v1.5/image-to-video",
        cost_estimate_usd=0.85,  # 6s × 0.14 + 0.01
        cost_per_second=0.14,
        notes=(
            "xAI Grok Imagine Video 1.5 I2V — animate a still with strong motion + native audio. "
            "1–15s · 480p/720p/1080p. Est. $0.08/s @480p, $0.14/s @720p, $0.25/s @1080p + $0.01 image."
        ),
        duration_choices=tuple(str(i) for i in range(1, 16)),
        default_duration="6",
        aspect_choices=("auto",),
        default_aspect="auto",
        resolution_choices=("480p", "720p", "1080p"),
        default_resolution="720p",
        supports_audio=False,
        supports_negative=False,
        supports_end_frame=False,
        duration_as_int=True,
        native_stereo_audio=True,
        image_field="image_url",
    ),
    "ltx 2.5 pro i2v": VisionModelSpec(
        key="ltx 2.5 pro i2v",
        label="LTX 2.5 Pro · Image→Video",
        mode="image_to_video",
        endpoint="lightricks/ltx-2.5/image-to-video/pro",
        cost_estimate_usd=1.02,
        cost_per_second=0.17,
        cost_per_second_by_resolution={"720p": 0.12, "1080p": 0.17},
        notes=(
            "Lightricks LTX 2.5 Pro I2V — animate a still with native audio. "
            "6/8/10s or auto · 720p/1080p. Optional last frame. Est. ~$0.17/s @1080p."
        ),
        duration_choices=("auto", "6", "8", "10"),
        default_duration="6",
        aspect_choices=("auto", "16:9", "9:16"),
        default_aspect="auto",
        resolution_choices=("720p", "1080p"),
        default_resolution="1080p",
        supports_audio=True,
        supports_negative=False,
        supports_end_frame=True,
        extra_defaults={"generate_audio": True},
        image_field="image_url",
    ),
    "ltx 2.5 fast i2v": VisionModelSpec(
        key="ltx 2.5 fast i2v",
        label="LTX 2.5 Fast · Image→Video",
        mode="image_to_video",
        endpoint="lightricks/ltx-2.5/image-to-video/fast",
        cost_estimate_usd=0.78,
        cost_per_second=0.13,
        cost_per_second_by_resolution={
            "720p": 0.09,
            "1080p": 0.13,
            "1440p": 0.19,
            "2160p": 0.30,
        },
        notes=(
            "Lightricks LTX 2.5 Fast I2V — 6–20s · up to 4K. Optional last frame. "
            "Est. $0.09–0.30/s by resolution."
        ),
        duration_choices=("auto", "6", "8", "10", "12", "14", "16", "18", "20"),
        default_duration="6",
        aspect_choices=("auto", "16:9", "9:16"),
        default_aspect="auto",
        resolution_choices=("720p", "1080p", "1440p", "2160p"),
        default_resolution="1080p",
        supports_audio=True,
        supports_negative=False,
        supports_end_frame=True,
        extra_defaults={"generate_audio": True},
        image_field="image_url",
    ),
    "flux 3 i2v": VisionModelSpec(
        key="flux 3 i2v",
        label="FLUX 3 · Image→Video",
        mode="image_to_video",
        endpoint="blackforestlabs/flux-3/image-to-video",
        cost_estimate_usd=1.36,  # 8s × $0.17
        cost_per_second=0.17,
        cost_per_second_by_resolution={"720p": 0.17, "1080p": 0.29},
        draft_endpoint="blackforestlabs/flux-3/image-to-video/draft",
        enhance_endpoint="blackforestlabs/flux-3/draft-enhance",
        cost_per_second_draft=0.06,
        notes=(
            "FLUX 3 I2V (BFL on fal) — animate a still with optional native audio. "
            "Aspect follows the still (no aspect_ratio). "
            "Start frame = layout lock; Character = identity ref (freer framing). "
            "5–20s or auto · 720p/1080p. Draft first → Enhance to full. "
            "Est. ~$0.17/s @720p · ~$0.29/s @1080p · draft ~$0.06/s."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(5, 21)),
        default_duration="8",
        aspect_choices=(ASPECT_FOLLOWS_STILL,),
        default_aspect=ASPECT_FOLLOWS_STILL,
        omit_aspect_ratio=True,
        resolution_choices=("720p", "1080p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        supports_end_frame=False,
        duration_as_int=True,
        image_field="image_url",
        extra_defaults={"generate_audio": True, "safety_tolerance": 2},
    ),
    "wan 3.0 i2v": VisionModelSpec(
        key="wan 3.0 i2v",
        label="Wan 3.0 · Image→Video",
        mode="image_to_video",
        endpoint="alibaba/wan-3.0/image-to-video",
        cost_estimate_usd=1.00,
        cost_per_second=0.20,
        cost_per_second_by_resolution={"480p": 0.05, "720p": 0.10, "1080p": 0.20},
        notes=(
            "Wan 3.0 I2V — start still required; optional last frame. "
            "2–30s or auto · 1080p default · native audio. "
            "Est. $0.05/s @480p · $0.10/s @720p · $0.20/s @1080p."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(2, 31)),
        default_duration="5",
        aspect_choices=(
            "adaptive",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="adaptive",
        resolution_choices=("480p", "720p", "1080p"),
        default_resolution="1080p",
        supports_audio=True,
        supports_negative=False,
        supports_end_frame=True,
        duration_as_int=True,
        image_field="start_image_url",
        extra_defaults={"audio": True, "enable_prompt_expansion": True},
    ),
}

# ---------------------------------------------------------------------------
# R2I — Reference → Image (build still from identity/style/prop refs, not plate edit)
# ---------------------------------------------------------------------------

R2I_MODELS: dict[str, VisionModelSpec] = {
    # Multi-ref edit endpoints — tab intent: build still from refs (not plate-edit I2I)
    "flux 2 pro r2i": VisionModelSpec(
        key="flux 2 pro r2i",
        label="Flux 2 Pro · R2I",
        mode="reference_to_image",
        endpoint="fal-ai/flux-2-pro/edit",
        cost_estimate_usd=0.03,
        notes=(
            "Build a still from Character / style / prop refs (multi-ref). "
            "Not plate-edit I2I — freer composition from identity pack. ~$0.03/image. "
            "image_size auto only — 2K is not a Flux-edit field."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=("auto",),
        default_aspect="auto",
        resolution_choices=FLUX_EDIT_RESOLUTIONS,
        default_resolution="auto",
        supports_audio=False,
        supports_negative=False,
        max_refs=9,
        image_field="image_urls",
        edit_model_key="flux 2 pro",
        supports_strength=False,
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "4"},
    ),
    "qwen image 3 r2i": VisionModelSpec(
        key="qwen image 3 r2i",
        label="Qwen Image 3 · R2I",
        mode="reference_to_image",
        endpoint="alibaba/qwen-image-3/edit",
        cost_estimate_usd=0.04,
        notes=(
            "Build a still from 1–3 identity/style/signage refs. "
            "Strong type and faces. Est. $0.04 @1K · $0.075 @2K."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=I2I_ASPECT_CHOICES,
        default_aspect="Match source",
        resolution_choices=("1K", "2K"),
        default_resolution="1K",
        supports_audio=False,
        supports_negative=True,
        max_refs=3,
        image_field="image_urls",
        edit_model_key="qwen image 3",
        extra_defaults={
            "num_images": 1,
            "output_format": "png",
            "enable_prompt_expansion": True,
            "enable_safety_checker": True,
        },
    ),
    "flux 2 max r2i": VisionModelSpec(
        key="flux 2 max r2i",
        label="Flux 2 Max · R2I",
        mode="reference_to_image",
        endpoint="fal-ai/flux-2-max/edit",
        cost_estimate_usd=0.07,
        notes=(
            "Highest-quality multi-ref still from character/style refs. "
            "image_size auto only — 2K is not a Flux-edit field."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=("auto",),
        default_aspect="auto",
        resolution_choices=FLUX_EDIT_RESOLUTIONS,
        default_resolution="auto",
        supports_audio=False,
        max_refs=8,
        image_field="image_urls",
        edit_model_key="flux 2 max",
        extra_defaults={"num_images": 1, "output_format": "jpeg", "safety_tolerance": "4"},
    ),
    "nano banana pro r2i": VisionModelSpec(
        key="nano banana pro r2i",
        label="Nano Banana Pro · R2I",
        mode="reference_to_image",
        endpoint="fal-ai/nano-banana-pro/edit",
        cost_estimate_usd=0.08,
        notes="Creative multi-ref still from identity/style refs. Colon aspect + 1K/2K (edit max 2K).",
        duration_choices=(),
        default_duration="",
        aspect_choices=("Match source",) + T2I_NANO_ASPECT_CHOICES,
        default_aspect="9:16",
        resolution_choices=NANO_PRO_EDIT_RESOLUTIONS,
        default_resolution="2K",
        supports_audio=False,
        max_refs=14,
        image_field="image_urls",
        edit_model_key="nano banana pro",
        extra_defaults={"num_images": 1},
    ),
    "seedream 5 pro r2i": VisionModelSpec(
        key="seedream 5 pro r2i",
        label="Seedream 5 Pro · R2I",
        mode="reference_to_image",
        endpoint="bytedance/seedream/v5/pro/edit",
        cost_estimate_usd=0.07,
        notes=(
            "Grounded multi-ref still from character/style refs. "
            "auto_2K / portrait_16_9 / landscape_16_9 — never 720p."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=I2I_ASPECT_CHOICES + ("Auto 2K", "Auto 4K"),
        default_aspect="Auto 2K",
        resolution_choices=SEEDREAM_EDIT_RESOLUTIONS,
        default_resolution="auto_2K",
        supports_audio=False,
        max_refs=10,
        image_field="image_urls",
        edit_model_key="seedream 5 pro",
        supports_region_boxes=True,
        extra_defaults={"num_images": 1},
    ),
    "muse image edit r2i": VisionModelSpec(
        key="muse image edit r2i",
        label="Muse Image Edit · R2I",
        mode="reference_to_image",
        endpoint="meta/muse-image/edit",
        cost_estimate_usd=0.01,
        notes=(
            "Meta Muse multi-ref stills — precise instruction edits. "
            "Up to 10 images. No mask. ~$0.01/image. "
            "Character Sheet compose can attach all angle stills (max 10)."
        ),
        duration_choices=(),
        default_duration="",
        aspect_choices=(
            "Match source",
            "21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21",
        ),
        default_aspect="Match source",
        supports_audio=False,
        max_refs=10,
        image_field="image_urls",
        edit_model_key="muse image edit",
        supports_mask=False,
        extra_defaults={"num_images": 1, "output_format": "jpeg"},
    ),
}

# ---------------------------------------------------------------------------
# R2V — Reference → Video (multi identity / omni; freer framing)
# ---------------------------------------------------------------------------

R2V_MODELS: dict[str, VisionModelSpec] = {
    "minimax h3 omni": VisionModelSpec(
        key="minimax h3 omni",
        label="MiniMax H3 · Omni reference",
        mode="reference_to_video",
        endpoint="minimax/h3/reference-to-video",
        cost_estimate_usd=1.30,
        cost_per_second=0.26,
        notes=(
            "H3 omni R2V — Character-first multi identity (up to 9 images) + optional "
            "video/audio advanced refs. Cite Image 1 / Video 1 / Audio 1. "
            "Native stereo · 2K · 5–15s. Default R2V model. Also Studio Video → R2V."
        ),
        duration_choices=tuple(str(i) for i in range(5, 16)),
        default_duration="5",
        aspect_choices=(
            "adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16",
        ),
        default_aspect="adaptive",
        resolution_choices=("2K",),
        default_resolution="2K",
        supports_audio=False,
        supports_negative=False,
        max_refs=9,
        max_ref_videos=3,
        max_ref_audios=3,
        max_total_refs=12,
        omni_reference=True,
        duration_as_int=True,
        native_stereo_audio=True,
        prompt_citation_style="plain",
    ),
    "minimax h3 max omni": VisionModelSpec(
        key="minimax h3 max omni",
        label="MiniMax H3 Max · R2V",
        mode="reference_to_video",
        endpoint="minimax/h3-max/reference-to-video",
        cost_estimate_usd=0.40,
        cost_per_second=0.08,
        cost_per_second_by_resolution={"480p": 0.08, "768p": 0.08},
        notes=(
            "H3 Max R2V — cheaper Max stack, multi-ref characters/scenes. "
            "Cite Image 1 / Video 1 / Audio 1. Up to 9 images + 3 videos + 3 audio (≤12). "
            "5–15s · 480P/768P. Est. $0.08/s output; first 4096 ref tokens included, "
            "then $0.02 / 1k tokens. Also Studio Video → R2V."
        ),
        duration_choices=tuple(str(i) for i in range(5, 16)),
        default_duration="5",
        aspect_choices=(
            "adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16",
        ),
        default_aspect="adaptive",
        resolution_choices=("480P", "768P"),
        default_resolution="768P",
        supports_audio=False,
        supports_negative=False,
        max_refs=9,
        max_ref_videos=3,
        max_ref_audios=3,
        max_total_refs=12,
        omni_reference=True,
        duration_as_int=True,
        prompt_citation_style="plain",
        extra_defaults={
            "prompt_expansion_mode": "balanced",
            "enable_safety_checker": True,
        },
    ),
    "gemini omni 1.1 reference": VisionModelSpec(
        key="gemini omni 1.1 reference",
        label="Gemini Omni Flash 1.1 · Reference→Video",
        mode="reference_to_video",
        endpoint="google/gemini-omni-flash/v1.1/reference-to-video",
        cost_estimate_usd=0.80,
        cost_per_second=0.10,
        cost_per_second_by_resolution={
            "360p": 0.03, "720p": 0.10, "1080p": 0.15, "4k": 0.30,
        },
        notes=(
            "Gemini Omni Flash 1.1 R2V — cite <IMAGE_REF_0> / <VIDEO_REF_0> in the prompt. "
            "image_urls plus up to 3 reference videos (each ≤3s). No audio refs on this schema. "
            "Est. $0.03/s @360p · $0.10/s @720p · $0.15/s @1080p · $0.30/s @4k."
        ),
        duration_choices=tuple(str(i) for i in range(3, 11)),
        default_duration="8",
        aspect_choices=("16:9", "9:16"),
        default_aspect="16:9",
        resolution_choices=("360p", "720p", "1080p", "4k"),
        default_resolution="720p",
        supports_audio=False,
        supports_negative=False,
        max_refs=8,
        max_ref_videos=3,
        max_ref_audios=0,
        duration_as_int=True,
        prompt_citation_style="image_ref",
        image_field="image_urls",
    ),
    "mirage avatar x r2v": VisionModelSpec(
        key="mirage avatar x r2v",
        label="Mirage Avatar X · Reference→Video",
        mode="reference_to_video",
        endpoint="mirage-api/avatar-x/reference-to-video",
        cost_estimate_usd=1.20,
        cost_per_second=0.30,
        notes=(
            "Mirage Avatar X identity lock. Needs a voice/audio ref (and optional "
            "talking-head video). Est. $0.30/s. Duration follows audio; cap 60s for estimates."
        ),
        duration_choices=("5", "10", "15", "20", "30", "45", "60"),
        default_duration="15",
        aspect_choices=(),
        default_aspect="",
        resolution_choices=(),
        default_resolution="",
        supports_audio=False,
        supports_negative=False,
        max_refs=1,
        max_ref_videos=1,
        max_ref_audios=1,
        extra_defaults={},
    ),
    "grok imagine 1.5 reference": VisionModelSpec(
        key="grok imagine 1.5 reference",
        label="Grok Imagine 1.5 · Reference pack",
        mode="reference_to_video",
        endpoint="xai/grok-imagine-video/v1.5/reference-to-video",
        cost_estimate_usd=0.66,
        cost_per_second=0.08,
        notes=(
            "Grok Imagine 1.5 R2V — 1–7 reference stills; tag <IMAGE_0>… in the prompt. "
            "Native audio. 1–15s · 480p/720p. Also Studio Video → R2V."
        ),
        duration_choices=tuple(str(i) for i in range(1, 16)),
        default_duration="8",
        aspect_choices=("16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"),
        default_aspect="16:9",
        resolution_choices=("480p", "720p"),
        default_resolution="480p",
        supports_audio=False,
        supports_negative=False,
        max_refs=7,
        duration_as_int=True,
        native_stereo_audio=True,
        prompt_citation_style="angle",
        image_field="reference_image_urls",
    ),
    "veo 3.1 reference": VisionModelSpec(
        key="veo 3.1 reference",
        label="Veo 3.1 Reference pack",
        mode="reference_to_video",
        endpoint="fal-ai/veo3.1/reference-to-video",
        cost_estimate_usd=3.20,
        cost_per_second=0.40,
        notes="R2V guided by 1–N reference stills. ~$0.40/s on fal (standard Veo family).",
        max_refs=8,
        duration_choices=("8s",),
        default_duration="8s",
        extra_defaults={"generate_audio": True, "auto_fix": False, "safety_tolerance": "4"},
    ),
    "seedance 2.0 reference": VisionModelSpec(
        key="seedance 2.0 reference",
        label="Seedance 2.0 · Reference-to-Video",
        mode="reference_to_video",
        endpoint="bytedance/seedance-2.0/reference-to-video",
        cost_estimate_usd=1.50,
        cost_per_second=0.30,
        notes=(
            "Seedance 2.0 R2V — multi reference stills (identity/style). "
            "aspect_ratio: auto | 21:9 | 16:9 | 4:3 | 1:1 | 3:4 | 9:16 (default auto). "
            "Not I2V start-frame lock. Also Studio Video → R2V."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(4, 16)),
        default_duration="5",
        aspect_choices=(
            "auto",
            "21:9",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="auto",
        omit_aspect_ratio=False,
        resolution_choices=("480p", "720p"),  # fal R2V schema (not 1080p)
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,  # never send negative_prompt
        max_refs=9,
        duration_as_int=False,  # API expects string "15" / "auto", not int
        image_field="image_urls",
        extra_defaults={"generate_audio": True},
        hidden=True,
    ),
    "seedance 2.5 reference": VisionModelSpec(
        key="seedance 2.5 reference",
        label="Seedance 2.5 · Reference-to-Video",
        mode="reference_to_video",
        endpoint="bytedance/seedance-2.5/reference-to-video",
        cost_estimate_usd=2.31,
        cost_per_second=0.473,
        cost_per_second_by_resolution={"480p": 0.2205, "720p": 0.473},
        notes=(
            "Seedance 2.5 R2V — up to 50 multimodal refs (images/video/audio), "
            "up to 30s single-pass, native audio. Cite [Image1] / [Video1] / [Audio1]. "
            "Character/Scene sheets bind as real image_urls. "
            "Token est. $0.0214/1k tokens; video refs ×0.6 (image/audio refs free). "
            "Limitation: partner photoreal-face filter. Strengths: long take, high ref count, action."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(4, 31)),
        default_duration="5",
        aspect_choices=(
            "auto",
            "21:9",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="auto",
        omit_aspect_ratio=False,
        resolution_choices=("480p", "720p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        max_refs=30,  # images; total multimodal cap 50 with video/audio
        max_ref_videos=10,
        max_ref_audios=10,
        max_total_refs=50,
        duration_as_int=False,
        image_field="image_urls",
        prompt_citation_style="plain",
        extra_defaults={"generate_audio": True},
    ),
    "wan 3.0 reference": VisionModelSpec(
        key="wan 3.0 reference",
        label="Wan 3.0 · Reference→Video",
        mode="reference_to_video",
        endpoint="alibaba/wan-3.0/reference-to-video",
        cost_estimate_usd=1.00,
        cost_per_second=0.20,
        cost_per_second_by_resolution={"480p": 0.05, "720p": 0.10, "1080p": 0.20},
        notes=(
            "Wan 3.0 R2V — up to 10 images + 5 videos (~15s) + 5 audio (~15s). "
            "Cite Image 1 / Image 2 (character vs scene), Video 1, Audio 1 in the prompt. "
            "2–30s or auto · 1080p default · native audio. "
            "Est. $0.05/s @480p · $0.10/s @720p · $0.20/s @1080p. Also Studio Video → R2V."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(2, 31)),
        default_duration="5",
        aspect_choices=(
            "adaptive",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="adaptive",
        resolution_choices=("480p", "720p", "1080p"),
        default_resolution="1080p",
        supports_audio=True,
        supports_negative=False,
        max_refs=10,
        max_ref_videos=5,
        max_ref_audios=5,
        omni_reference=True,
        duration_as_int=True,
        native_stereo_audio=False,
        prompt_citation_style="plain",
        image_field="reference_image_urls",
        extra_defaults={"audio": True, "enable_prompt_expansion": True},
    ),
    # FLUX 3 listed under R2V as identity-ref emphasis (still single-image API)
    "flux 3 r2v": VisionModelSpec(
        key="flux 3 r2v",
        label="FLUX 3 · Identity ref (R2V)",
        mode="reference_to_video",
        endpoint="blackforestlabs/flux-3/image-to-video",
        cost_estimate_usd=1.36,
        cost_per_second=0.17,
        cost_per_second_by_resolution={"720p": 0.17, "1080p": 0.29},
        draft_endpoint="blackforestlabs/flux-3/image-to-video/draft",
        enhance_endpoint="blackforestlabs/flux-3/draft-enhance",
        cost_per_second_draft=0.06,
        notes=(
            "FLUX 3 with Character as identity ref (freer framing). "
            "Single still only — no multi-char element API. "
            "For multi-pose timed pins use Director · Keyframe Take. "
            "Aspect follows still (no aspect_ratio)."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(5, 21)),
        default_duration="8",
        aspect_choices=(ASPECT_FOLLOWS_STILL,),
        default_aspect=ASPECT_FOLLOWS_STILL,
        omit_aspect_ratio=True,
        resolution_choices=("720p", "1080p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        max_refs=1,
        duration_as_int=True,
        image_field="image_url",
        extra_defaults={"generate_audio": True, "safety_tolerance": 2},
    ),
}

# ---------------------------------------------------------------------------
# V2V — Video → Video (source clip + prompt; align with Studio V2V)
# ---------------------------------------------------------------------------

V2V_MODELS: dict[str, VisionModelSpec] = {
    "flux 3 extend v2v": VisionModelSpec(
        key="flux 3 extend v2v",
        label="FLUX 3 · Extend (V2V)",
        mode="video_to_video",
        endpoint="blackforestlabs/flux-3/extend-video",
        cost_estimate_usd=3.28,  # 8s × $0.41 @720p
        cost_per_second=0.41,
        cost_per_second_by_resolution={"720p": 0.41, "1080p": 0.53},
        draft_endpoint="blackforestlabs/flux-3/extend-video/draft",
        enhance_endpoint="blackforestlabs/flux-3/draft-enhance",
        cost_per_second_draft=0.06,
        notes=(
            "Continue a clip with prompt + optional native audio. "
            "Same family as Extend Video tab; listed here for Studio-aligned V2V. "
            "Est. $0.41/s @720p · $0.53/s @1080p (extend, not I2V)."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(5, 21)),
        default_duration="8",
        resolution_choices=("720p", "1080p"),
        default_resolution="720p",
        supports_audio=True,
        duration_as_int=True,
        video_field="video_url",
        extra_defaults={"generate_audio": True, "safety_tolerance": 2},
    ),
    "gemini omni 1.1 edit": VisionModelSpec(
        key="gemini omni 1.1 edit",
        label="Gemini Omni Flash 1.1 · Edit (V2V)",
        mode="video_to_video",
        endpoint="google/gemini-omni-flash/v1.1/edit",
        cost_estimate_usd=0.80,  # estimate uses ~8s @720p; output follows source
        cost_per_second=0.10,
        cost_per_second_by_resolution={
            "360p": 0.03, "720p": 0.10, "1080p": 0.15, "4k": 0.30,
        },
        notes=(
            "Gemini Omni Flash 1.1 NL video edit — prompt + source clip (video_url). "
            "No first/last frame. No duration/aspect on the API; output follows the source. "
            "Optional resolution 360p/720p/1080p/4k. "
            "Est. $0.03/s @360p · $0.10/s @720p · $0.15/s @1080p · $0.30/s @4k."
        ),
        duration_param="",
        duration_choices=(),
        default_duration="8",
        aspect_choices=(),
        default_aspect="",
        resolution_choices=("360p", "720p", "1080p", "4k"),
        default_resolution="720p",
        supports_audio=False,
        supports_negative=False,
        supports_end_frame=False,
        video_field="video_url",
    ),
    "sync 3 lipsync": VisionModelSpec(
        key="sync 3 lipsync",
        label="sync-3 · Lipsync (V2V)",
        mode="video_to_video",
        endpoint="fal-ai/sync-lipsync/v3",
        cost_estimate_usd=1.33,  # ~10s at $8/min
        cost_per_second=8.0 / 60.0,
        notes=(
            "sync-3 lipsync — source clip + dialogue audio. Est. $8/min. "
            "Prompt is unused; attach an audio ref. Estimate uses source length (max 120s)."
        ),
        duration_choices=("5", "10", "15", "30", "60", "90", "120"),
        default_duration="10",
        aspect_choices=(),
        resolution_choices=(),
        supports_audio=False,
        supports_negative=False,
        max_ref_audios=1,
        video_field="video_url",
        extra_defaults={"sync_mode": "cut_off"},
    ),
}

# ---------------------------------------------------------------------------
# Bridge / connect shots (start + end frame)
# ---------------------------------------------------------------------------

BRIDGE_MODELS: dict[str, VisionModelSpec] = {
    "veo 3.1 fast bridge": VisionModelSpec(
        key="veo 3.1 fast bridge",
        label="Veo 3.1 Fast · First→Last frame",
        mode="bridge",
        endpoint="fal-ai/veo3.1/fast/first-last-frame-to-video",
        # fal billing: $0.15/s
        cost_estimate_usd=0.90,  # 6s × $0.15
        cost_per_second=0.15,
        notes="Faster bridge. ~$0.15/s on fal. Recommended default for connect shots.",
        default_duration="6s",
        aspect_choices=("auto", "16:9", "9:16"),
        default_aspect="auto",
        extra_defaults={"generate_audio": True, "auto_fix": False, "safety_tolerance": "4"},
    ),
    "veo 3.1 bridge": VisionModelSpec(
        key="veo 3.1 bridge",
        label="Veo 3.1 · First→Last frame",
        mode="bridge",
        endpoint="fal-ai/veo3.1/first-last-frame-to-video",
        # fal billing: $0.40/s (user invoice)
        cost_estimate_usd=3.20,  # 8s × $0.40
        cost_per_second=0.40,
        notes=(
            "Bridge two stills into a continuous move (e.g. upstairs → living room). "
            "~$0.40/s on fal. Prompt: path, speed, keep architecture consistent."
        ),
        aspect_choices=("auto", "16:9", "9:16"),
        default_aspect="auto",
        extra_defaults={"generate_audio": True, "auto_fix": False, "safety_tolerance": "4"},
    ),
    "hailuo 02 bridge": VisionModelSpec(
        key="hailuo 02 bridge",
        label="Hailuo 02 · Start+End frame",
        mode="bridge",
        endpoint="fal-ai/minimax/hailuo-02/standard/image-to-video",
        cost_estimate_usd=0.30,
        cost_per_second=0.04,
        notes="Uses image_url + end_image_url. Cheaper bridge alternative.",
        duration_choices=("6", "10"),
        default_duration="6",
        supports_audio=False,
        supports_negative=False,
        first_frame_field="image_url",
        last_frame_field="end_image_url",
        resolution_choices=("512P", "768P"),
        default_resolution="768P",
        extra_defaults={"prompt_optimizer": True},
        hidden=True,
    ),
    # --- First→Last via I2V endpoints (Kling / Seedance / H3) — listed early ---
    "kling o3 pro bridge": VisionModelSpec(
        key="kling o3 pro bridge",
        label="Kling O3 Pro · First→Last",
        mode="bridge",
        endpoint="fal-ai/kling-video/o3/pro/image-to-video",
        cost_estimate_usd=0.42,  # ~3s × $0.14
        cost_per_second=0.14,
        notes=(
            "Kling O3 Pro first→last — image_url + end_image_url. "
            "Duration 3–15s (default 3 for cut bridges). Optional generate_audio."
        ),
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="3",
        aspect_choices=("16:9", "9:16", "1:1"),
        default_aspect="16:9",
        supports_audio=True,
        supports_negative=False,
        first_frame_field="image_url",
        last_frame_field="end_image_url",
        requires_end_frame=True,
        resolution_choices=(),
        extra_defaults={"generate_audio": True},
    ),
    "kling o3 standard bridge": VisionModelSpec(
        key="kling o3 standard bridge",
        label="Kling O3 Standard · First→Last",
        mode="bridge",
        endpoint="fal-ai/kling-video/o3/standard/image-to-video",
        cost_estimate_usd=0.34,  # ~3s × $0.112
        cost_per_second=0.112,
        notes=(
            "Kling O3 Standard first→last — image_url + end_image_url. "
            "Duration 3–15s (shortest bridge ~3s). Optional generate_audio."
        ),
        duration_choices=tuple(str(i) for i in range(3, 16)),
        default_duration="3",
        aspect_choices=("16:9", "9:16", "1:1"),
        default_aspect="16:9",
        supports_audio=True,
        supports_negative=False,
        first_frame_field="image_url",
        last_frame_field="end_image_url",
        requires_end_frame=True,
        resolution_choices=(),
        extra_defaults={"generate_audio": True},
    ),
    "kling o1 bridge": VisionModelSpec(
        key="kling o1 bridge",
        label="Kling O1 · First→Last",
        mode="bridge",
        endpoint="fal-ai/kling-video/o1/standard/image-to-video",
        cost_estimate_usd=0.39,  # ~3s × $0.13
        cost_per_second=0.13,
        notes=(
            "Kling O1 Standard first→last — start_image_url + end_image_url. "
            "Duration 3–10s."
        ),
        duration_choices=tuple(str(i) for i in range(3, 11)),
        default_duration="3",
        aspect_choices=("16:9", "9:16", "1:1"),
        default_aspect="16:9",
        supports_audio=False,
        supports_negative=False,
        first_frame_field="start_image_url",
        last_frame_field="end_image_url",
        requires_end_frame=True,
        resolution_choices=(),
        extra_defaults={},
        hidden=True,
    ),
    "flux 3 bridge": VisionModelSpec(
        key="flux 3 bridge",
        label="FLUX 3 · First→Last frame",
        mode="bridge",
        endpoint="blackforestlabs/flux-3/first-last-frame-to-video",
        cost_estimate_usd=1.36,  # 8s × $0.17
        cost_per_second=0.17,
        cost_per_second_by_resolution={"720p": 0.17, "1080p": 0.29},
        draft_endpoint="blackforestlabs/flux-3/first-last-frame-to-video/draft",
        enhance_endpoint="blackforestlabs/flux-3/draft-enhance",
        cost_per_second_draft=0.06,
        notes=(
            "FLUX 3 first→last (BFL on fal) — bridge two stills (day→night, porch→interior). "
            "Requires start + end. 5–20s · 720p/1080p · optional native audio. "
            "Draft first → Enhance to full. "
            "Est. ~$0.17/s @720p · ~$0.29/s @1080p · draft ~$0.06/s."
        ),
        duration_choices=tuple(str(i) for i in range(5, 21)),
        default_duration="8",
        aspect_choices=(
            "auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16",
        ),
        default_aspect="auto",
        resolution_choices=("720p", "1080p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        first_frame_field="start_image_url",
        last_frame_field="end_image_url",
        requires_end_frame=True,
        duration_as_int=True,
        extra_defaults={"generate_audio": True, "safety_tolerance": 2},
    ),
    "seedance 2.5 bridge": VisionModelSpec(
        key="seedance 2.5 bridge",
        label="Seedance 2.5 · First→Last",
        mode="bridge",
        endpoint="bytedance/seedance-2.5/image-to-video",
        cost_estimate_usd=1.89,  # ~4s @720p token ballpark
        cost_per_second=0.473,
        cost_per_second_by_resolution={"480p": 0.2205, "720p": 0.473},
        notes=(
            "Seedance 2.5 I2V first→last — image_url + end_image_url. "
            "Duration 4–30s · 480p/720p · native audio. "
            "Partner photoreal-face filter may apply."
        ),
        duration_choices=tuple(str(i) for i in range(4, 31)),
        default_duration="4",
        aspect_choices=(
            "auto",
            "21:9",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        ),
        default_aspect="auto",
        resolution_choices=("480p", "720p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        first_frame_field="image_url",
        last_frame_field="end_image_url",
        requires_end_frame=True,
        duration_as_int=False,
        extra_defaults={"generate_audio": True},
    ),
    "seedance 2.0 bridge": VisionModelSpec(
        key="seedance 2.0 bridge",
        label="Seedance 2.0 · First→Last",
        mode="bridge",
        endpoint="bytedance/seedance-2.0/image-to-video",
        cost_estimate_usd=1.20,  # ~4s @720p
        cost_per_second=0.30,
        notes=(
            "Seedance 2.0 I2V first→last — image_url + end_image_url. "
            "Duration 4–15s. Prefer 2.5 when available."
        ),
        duration_choices=tuple(str(i) for i in range(4, 16)),
        default_duration="4",
        aspect_choices=("auto", "16:9", "9:16", "1:1"),
        default_aspect="auto",
        resolution_choices=("480p", "720p", "1080p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        first_frame_field="image_url",
        last_frame_field="end_image_url",
        requires_end_frame=True,
        duration_as_int=False,
        extra_defaults={"generate_audio": True},
        hidden=True,
    ),
    "minimax h3 bridge": VisionModelSpec(
        key="minimax h3 bridge",
        label="H3 · First→Last",
        mode="bridge",
        endpoint="minimax/h3/image-to-video",
        cost_estimate_usd=1.30,  # 5s × $0.26
        cost_per_second=0.26,
        notes=(
            "MiniMax H3 I2V first→last — first frame + end_image_url. "
            "Duration 5–15s · 2K · native stereo on output. Aspect follows start still."
        ),
        duration_choices=tuple(str(i) for i in range(5, 16)),
        default_duration="5",
        aspect_choices=("auto",),
        default_aspect="auto",
        resolution_choices=("2K",),
        default_resolution="2K",
        supports_audio=False,
        supports_negative=False,
        first_frame_field="image_url",
        last_frame_field="end_image_url",
        requires_end_frame=True,
        duration_as_int=True,
        native_stereo_audio=True,
        omit_aspect_ratio=True,
    ),
}

# ---------------------------------------------------------------------------
# Extend video (source clip + prompt)
# ---------------------------------------------------------------------------

EXTEND_MODELS: dict[str, VisionModelSpec] = {
    "flux 3 extend": VisionModelSpec(
        key="flux 3 extend",
        label="FLUX 3 · Extend Video",
        mode="extend",
        endpoint="blackforestlabs/flux-3/extend-video",
        cost_estimate_usd=3.28,  # 8s × $0.41 @720p
        cost_per_second=0.41,
        cost_per_second_by_resolution={"720p": 0.41, "1080p": 0.53},
        draft_endpoint="blackforestlabs/flux-3/extend-video/draft",
        enhance_endpoint="blackforestlabs/flux-3/draft-enhance",
        cost_per_second_draft=0.06,
        notes=(
            "FLUX 3 extend (BFL on fal) — continue an existing clip with a prompt. "
            "Source video under 50 MB / 15s. 5–20s or auto · 720p/1080p · optional audio. "
            "Draft first → Enhance to full. "
            "Est. $0.41/s @720p · $0.53/s @1080p (extend, not I2V) · draft ~$0.06/s."
        ),
        duration_choices=("auto",) + tuple(str(i) for i in range(5, 21)),
        default_duration="8",
        aspect_choices=(
            "auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16",
        ),
        default_aspect="auto",
        resolution_choices=("720p", "1080p"),
        default_resolution="720p",
        supports_audio=True,
        supports_negative=False,
        duration_as_int=True,
        video_field="video_url",
        extra_defaults={"generate_audio": True, "safety_tolerance": 2},
    ),
}


def models_for_mode(mode: VisionMode) -> dict[str, VisionModelSpec]:
    if mode == "text_to_image":
        return T2I_MODELS
    if mode == "image_to_image":
        return I2I_MODELS
    if mode == "reference_to_image":
        return R2I_MODELS
    if mode == "text_to_video":
        return T2V_MODELS
    if mode == "image_to_video":
        return I2V_MODELS
    if mode == "reference_to_video":
        return R2V_MODELS
    if mode == "video_to_video":
        return V2V_MODELS
    if mode == "extend":
        return EXTEND_MODELS
    return BRIDGE_MODELS


def vision_labels(mode: VisionMode) -> list[str]:
    return [s.label for s in models_for_mode(mode).values() if not s.hidden]


def find_vision_model(
    label_or_key: str | None,
    mode: VisionMode | None = None,
) -> VisionModelSpec | None:
    if not label_or_key:
        return None
    raw = label_or_key.strip().lower()
    registries = (
        [models_for_mode(mode)]
        if mode
        else [
            T2I_MODELS,
            I2I_MODELS,
            R2I_MODELS,
            T2V_MODELS,
            I2V_MODELS,
            R2V_MODELS,
            V2V_MODELS,
            BRIDGE_MODELS,
            EXTEND_MODELS,
        ]
    )
    for reg in registries:
        if raw in reg:
            return reg[raw]
        for spec in reg.values():
            if spec.label.lower() == raw or spec.key == raw:
                return spec
    return None


def default_vision_model(mode: VisionMode) -> VisionModelSpec:
    reg = models_for_mode(mode)
    # Prefer practical defaults per mode
    for key in (
        "flux 2 pro t2i",
        "flux 2 pro i2i",
        "flux 2 pro r2i",
        "veo 3.1 fast",
        "veo 3.1 fast i2v",
        "flux 3 i2v",
        "minimax h3 omni",
        "flux 3 extend v2v",
        "veo 3.1 fast bridge",
        "flux 3 extend",
    ):
        if key in reg:
            return reg[key]
    return next(iter(reg.values()))


def is_still_mode(mode: VisionMode | str | None) -> bool:
    """True for pure still modes (T2I / I2I / R2I) — no video duration / audio."""
    return mode in ("text_to_image", "image_to_image", "reference_to_image")


def is_r2v_mode(mode: VisionMode | str | None) -> bool:
    return mode == "reference_to_video"


def is_r2i_mode(mode: VisionMode | str | None) -> bool:
    return mode == "reference_to_image"


def vision_duration_eff(
    spec: VisionModelSpec,
    duration_token: str | None,
) -> tuple[float, str]:
    """Clamp requested duration to this model's enum / max before pricing."""
    from app.pricing import clamp_estimate_duration

    return clamp_estimate_duration(
        duration_token,
        duration_enum=spec.duration_choices,
        default=spec.default_duration,
    )


def duration_seconds(token: str | None) -> float:
    """
    Parse UI duration tokens to seconds.

    Accepts ``\"8s\"``, ``\"8\"``, ``\"10\"``, etc. Defaults to 8s when missing/invalid.
    """
    if not token:
        return 8.0
    t = str(token).strip().lower()
    # FLUX 3 / Seedance-style "auto" — use a mid ballpark for cost UI
    if t in ("auto", "default"):
        return 8.0
    # Keep only leading number (handles "8s", "8 sec", "10")
    num = ""
    for ch in t:
        if ch.isdigit() or ch == ".":
            num += ch
        elif num:
            break
    try:
        secs = float(num) if num else 8.0
    except (TypeError, ValueError):
        secs = 8.0
    return max(0.5, secs)


# fal Seedance 2.5 supported frame sizes (authoritative for token cost)
_SEEDANCE_25_FRAMES: dict[tuple[str, str], tuple[int, int]] = {
    ("480p", "21:9"): (992, 432),
    ("480p", "16:9"): (864, 496),
    ("480p", "4:3"): (752, 560),
    ("480p", "1:1"): (640, 640),
    ("480p", "3:4"): (560, 752),
    ("480p", "9:16"): (496, 864),
    ("720p", "21:9"): (1470, 630),
    ("720p", "16:9"): (1280, 720),
    ("720p", "4:3"): (1112, 834),
    ("720p", "1:1"): (960, 960),
    ("720p", "3:4"): (834, 1112),
    ("720p", "9:16"): (720, 1280),
}
SEEDANCE_25_TOKEN_USD_PER_1K = 0.0214
SEEDANCE_25_VIDEO_REF_MULTIPLIER = 0.6


def is_seedance_25_endpoint(endpoint: str | None) -> bool:
    ep = (endpoint or "").strip().lower()
    return "seedance-2.5" in ep or "seedance/2.5" in ep


def is_seedance_25_spec(spec: VisionModelSpec | None) -> bool:
    if spec is None:
        return False
    if is_seedance_25_endpoint(spec.endpoint):
        return True
    return "2.5" in (spec.key or "").lower() and "seedance" in (spec.key or "").lower()


def estimate_seedance_25_cost(
    *,
    duration_s: float,
    resolution: str | None = "720p",
    aspect_ratio: str | None = "16:9",
    has_video_refs: bool = False,
    input_video_duration_s: float = 0.0,
) -> float:
    """
    Seedance 2.5 fal token formula (authoritative).

    tokens = (height * width * (input_video_duration + output_duration) * 24) / 1024
    cost = tokens / 1000 * $0.0214  (same rate at 480p and 720p)
    If any video references: cost × 0.6 (input + output seconds both count).
    Image and audio references are not billed.
    """
    res = (resolution or "720p").strip().lower()
    if res not in ("480p", "720p"):
        res = "720p"
    ar = (aspect_ratio or "16:9").strip().lower()
    if ar in ("auto", "default", "", "—", "none", "follows still"):
        ar = "16:9"
    wh = _SEEDANCE_25_FRAMES.get((res, ar)) or _SEEDANCE_25_FRAMES[(res, "16:9")]
    w, h = wh
    out_dur = max(0.5, float(duration_s or 5.0))
    in_dur = 0.0
    if has_video_refs:
        in_dur = max(0.0, float(input_video_duration_s or 0.0))
    tokens = (h * w * (in_dur + out_dur) * 24.0) / 1024.0
    cost = (tokens / 1000.0) * SEEDANCE_25_TOKEN_USD_PER_1K
    if has_video_refs:
        cost *= SEEDANCE_25_VIDEO_REF_MULTIPLIER
    return round(max(0.05, cost), 3)


def clamp_vision_num_images(spec: VisionModelSpec, n: int | None) -> int:
    """UI batch count for stills: 1..VISION_BATCH_MAX (sequential if API is 1-at-a-time)."""
    try:
        want = int(n) if n is not None else 1
    except (TypeError, ValueError):
        want = 1
    want = max(1, want)
    if is_still_mode(spec.mode):
        return min(want, VISION_BATCH_MAX)
    return 1


def estimate_vision_cost(
    spec: VisionModelSpec,
    *,
    duration_token: str | None = None,
    resolution: str | None = None,
    aspect_ratio: str | None = None,
    generate_audio: bool | None = None,
    num_images: int | None = None,
    has_video_refs: bool = False,
    input_video_duration_s: float = 0.0,
    draft: bool = False,
) -> float:
    """
    Conservative USD ballpark for UI (not billing).

    Video modes: **total job cost** = rate × selected duration (seconds), then
    resolution / audio multipliers. Never show a bare per-second rate as the total.
    Still modes: per-image × count (multi-variant batch).

    Seedance 2.5 uses fal's token formula ($0.0214/1k tokens; video refs ×0.6).
    """
    if is_still_mode(spec.mode):
        ep_still = (spec.endpoint or "").lower()
        n = clamp_vision_num_images(spec, num_images)
        res = (resolution or spec.default_resolution or "").lower()
        if "qwen-image-3" in ep_still:
            unit = 0.075 if res in ("2k", "2048") else 0.04
            return round(max(0.01, unit * n), 3)
        # Flat per-image estimates; bump for large aspect / higher resolution
        base = float(spec.cost_estimate_usd)
        asp = (aspect_ratio or spec.default_aspect or "").lower()
        if "match" in asp:
            pass  # source-sized edit — no bump
        elif "16:9" in asp or "9:16" in asp or "hd" in asp or "auto 4" in asp:
            base *= 1.15
        if "auto 4" in asp or "auto_4" in asp:
            base *= 1.35
        res = (resolution or spec.default_resolution or "").lower()
        if res in ("4k", "4K".lower()):
            base *= 2.4
        elif res in ("2k", "2K".lower()):
            base *= 1.55
        elif res in ("0.5k", "0.5K".lower()):
            base *= 0.7
        # Nano Banana Pro is steeper at high res
        if "nano-banana-pro" in spec.endpoint and res in ("2k", "4k"):
            base *= 1.15
        return round(max(0.01, base * n), 3)

    # --- Video: total = per-second rate × duration_eff (clamped to enum / max) ---
    secs, _dur_tok = vision_duration_eff(spec, duration_token)
    default_secs = duration_seconds(spec.default_duration) or 8.0

    if draft and getattr(spec, "draft_endpoint", None):
        from app.flux3_draft import estimate_draft_cost_usd

        amt = estimate_draft_cost_usd(spec, duration_s=secs)
        if amt is not None:
            return float(amt)

    # Seedance 2.5 — token formula (prefer over flat $/s tables)
    if is_seedance_25_spec(spec):
        return estimate_seedance_25_cost(
            duration_s=secs,
            resolution=resolution or spec.default_resolution or "720p",
            aspect_ratio=aspect_ratio or spec.default_aspect or "16:9",
            has_video_refs=bool(has_video_refs),
            input_video_duration_s=float(input_video_duration_s or 0.0),
        )

    by_res = getattr(spec, "cost_per_second_by_resolution", None) or {}
    rate: float | None = None
    if by_res:
        res_key = (resolution or spec.default_resolution or "720p").strip().lower()
        if not res_key or res_key in ("auto", "default"):
            res_key = (spec.default_resolution or "720p").strip().lower()
        # Match keys case-insensitively
        amap = {str(k).lower(): float(v) for k, v in by_res.items()}
        rate = amap.get(res_key) or amap.get("720p") or next(iter(amap.values()), None)

    if rate is None and spec.cost_per_second is not None and float(spec.cost_per_second) > 0:
        rate = float(spec.cost_per_second)

    if rate is not None and rate > 0:
        # Full job total — never return the bare $/s figure
        base = float(rate) * secs
    else:
        # Flat estimate assumed for default_duration; scale linearly with selected length
        flat = float(spec.cost_estimate_usd or 0.0)
        base = flat * (secs / default_secs) if default_secs > 0 else flat

    # Resolution multipliers only when the model bills by res (not flat $/s Veo/H3/FLUX table)
    ep = (spec.endpoint or "").lower()
    is_flat_rate = (
        "veo3.1" in ep
        or "veo3" in ep
        or "minimax/h3" in ep
        or "hailuo-03" in ep
        or "flux-3" in ep
        or bool(by_res)
        or (spec.cost_per_second is not None and "2k" in (spec.default_resolution or "").lower())
    )
    if not is_flat_rate:
        res = (resolution or spec.default_resolution or "720p").lower()
        if "1080" in res or res == "1080p":
            base *= 1.35
        elif "4k" in res or "2160" in res:
            base *= 2.2
        elif "512" in res:
            base *= 0.75

    # No invented audio multiplier unless fal quotes a separate audio rate.
    _ = generate_audio

    return round(max(0.05, base), 3)


def format_vision_cost(
    spec: VisionModelSpec,
    *,
    duration_token: str | None = None,
    resolution: str | None = None,
    aspect_ratio: str | None = None,
    generate_audio: bool | None = None,
    num_images: int | None = None,
    has_video_refs: bool = False,
    input_video_duration_s: float = 0.0,
    draft: bool = False,
) -> str:
    """
    Human label for the **total** estimated job cost.

    Video: ``Est. cost: $X.XX · {duration}s ({model})``
    Still: ``Est. cost: $X.XX · N image(s) ({model})`` — per-image × count
    Seedance 2.5 with video refs notes the ×0.6 video-ref flag.
    """
    from app.pricing import format_job_cost

    amt = estimate_vision_cost(
        spec,
        duration_token=duration_token,
        resolution=resolution,
        aspect_ratio=aspect_ratio,
        generate_audio=generate_audio,
        num_images=num_images,
        has_video_refs=has_video_refs,
        input_video_duration_s=input_video_duration_s,
        draft=draft,
    )
    if is_still_mode(spec.mode):
        n = clamp_vision_num_images(spec, num_images)
        unit = "1 image" if n == 1 else f"{n} images"
        api_max = max(1, int(getattr(spec, "max_num_images", 1) or 1))
        if n > api_max:
            unit = f"{unit} · {n} sequential runs"
        return format_job_cost(amt, unit=unit, model=spec.label)
    secs, _dur_tok = vision_duration_eff(spec, duration_token)
    dur_txt = f"{secs:.0f}" if abs(secs - round(secs)) < 1e-6 else f"{secs:.1f}"
    unit = f"{dur_txt}s"
    if draft and getattr(spec, "draft_endpoint", None):
        unit = f"{dur_txt}s draft"
    if is_seedance_25_spec(spec) and has_video_refs:
        unit = f"{dur_txt}s · video-ref ×0.6"
    return format_job_cost(amt, unit=unit, model=spec.label)


def build_vision_arguments(
    spec: VisionModelSpec,
    *,
    prompt: str,
    image_url: str | None = None,
    first_frame_url: str | None = None,
    last_frame_url: str | None = None,
    ref_urls: list[str] | None = None,
    ref_video_urls: list[str] | None = None,
    ref_audio_urls: list[str] | None = None,
    source_video_url: str | None = None,
    duration: str | None = None,
    aspect_ratio: str | None = None,
    resolution: str | None = None,
    negative_prompt: str | None = None,
    generate_audio: bool | None = None,
    num_images: int | None = None,
    seed: int | None = None,
) -> dict[str, Any]:
    """Map UI fields → fal payload for the selected Vision model."""
    args: dict[str, Any] = dict(spec.extra_defaults)
    text = (prompt or "").strip()
    if (
        not text
        and "sync-lipsync" not in spec.endpoint.lower()
        and not getattr(spec, "supports_multi_prompt", False)
    ):
        raise ValueError(
            "Enter a prompt."
            if is_still_mode(spec.mode)
            else "Enter a motion / shot prompt."
        )
    if text:
        args["prompt"] = text
    if seed is not None:
        try:
            args["seed"] = int(seed)
        except (TypeError, ValueError):
            pass
    if "sync-lipsync" in spec.endpoint.lower():
        args.pop("prompt", None)
    if "avatar-x" in spec.endpoint.lower():
        args["script"] = text
        args.pop("prompt", None)
        if len(text) < 50:
            raise ValueError("Mirage Avatar X script needs at least 50 characters.")

    # --- Text → Image (no media uploads) ---
    if spec.mode == "text_to_image":
        ep = spec.endpoint.lower()
        size = map_t2i_image_size(aspect_ratio or spec.default_aspect)
        if not size:
            size = map_t2i_image_size(spec.default_aspect) or "landscape_16_9"
        colon_ar = map_t2i_aspect_colon(aspect_ratio or spec.default_aspect)
        res = (resolution or spec.default_resolution or "").strip()
        # Batch size for this API call (caller may loop for sequential variants)
        n = clamp_vision_num_images(spec, num_images)
        api_max = max(1, int(spec.max_num_images or 1))
        args["num_images"] = min(n, api_max)

        if "grok-imagine-image" in ep:
            args["aspect_ratio"] = colon_ar
            picked = None
            for a in spec.resolution_choices or ():
                if str(a).lower() == res.lower():
                    picked = str(a)
                    break
            args["resolution"] = picked or (spec.default_resolution or "1k")
            args.setdefault("quality", "medium")
        elif "nano-banana" in ep:
            # Nano Banana / 2 / Pro: exact colon enum only (never "9:16 portrait")
            args["aspect_ratio"] = (
                clamp_nano_aspect(aspect_ratio or colon_ar)
                or spec.default_aspect
                or "16:9"
            )
            if spec.resolution_choices:
                # Map loose UI value to API enum (0.5K, 1K, 2K, 4K)
                picked = None
                for a in spec.resolution_choices:
                    if str(a).lower() == res.lower():
                        picked = str(a)
                        break
                args["resolution"] = picked or (spec.default_resolution or "1K")
        elif "seedream" in ep or "bytedance" in ep:
            # Seedream T2I: image_size preset or auto_2K / auto_4K
            args["image_size"] = size
        elif "qwen-image-3" in ep:
            args["image_size"] = qwen_t2i_image_size(size, res)
        elif "recraft/v4" in ep:
            args["image_size"] = size
        elif "recraft" in ep:
            args["aspect_ratio"] = colon_ar
        elif "flux-pro/v1.1-ultra" in ep or "flux-pro/v1.1" in ep:
            args["aspect_ratio"] = colon_ar
        elif "fibo-gen-1.5" in ep or "fibo/generate" in ep:
            ar = colon_ar if colon_ar and colon_ar not in ("auto",) else "1:1"
            if ar not in (spec.aspect_choices or ()):
                ar = spec.default_aspect or "1:1"
            args["aspect_ratio"] = ar
            picked = None
            for a in spec.resolution_choices or ():
                if str(a).lower() == res.lower():
                    picked = str(a)
                    break
            args["resolution"] = picked or (spec.default_resolution or "1MP")
            args.pop("num_images", None)
            args.pop("image_size", None)
        elif "muse-image" in ep:
            raw_ar = (aspect_ratio or spec.default_aspect or "16:9").strip()
            allowed = {str(a).lower(): str(a) for a in (spec.aspect_choices or ())}
            picked_ar = allowed.get(raw_ar.lower())
            if not picked_ar:
                bare = raw_ar.replace(" ", "")
                if "9:21" in bare:
                    picked_ar = allowed.get("9:21")
                else:
                    picked_ar = allowed.get(colon_ar.lower())
            args["aspect_ratio"] = picked_ar or spec.default_aspect or "16:9"
            args.pop("image_size", None)
        else:
            # Flux 2 family: image_size enum
            args["image_size"] = size

        neg = (negative_prompt or "").strip()
        if neg and spec.supports_negative:
            args["negative_prompt"] = neg
        for k in list(args.keys()):
            if args[k] is None or args[k] == "":
                args.pop(k, None)
        return args

    # --- Image → Image is built via fal build_edit_arguments in vision_service ---
    if spec.mode == "image_to_image":
        raise ValueError(
            "Image→Image uses build_edit_arguments in vision_service (not this path)."
        )

    ep = spec.endpoint.lower()
    is_h3 = "minimax/h3" in ep or "hailuo-03" in ep
    is_flux3 = "flux-3" in ep or "blackforestlabs/flux-3" in ep

    dur = (duration or spec.default_duration or "").strip()
    if dur and spec.duration_param and spec.duration_choices:
        # Normalize: some models want "8s", others "8" / "5" / "auto"
        if "veo" in ep or "luma" in ep:
            if not dur.endswith("s") and dur.isdigit():
                dur = f"{dur}s"
        elif (
            "kling" in ep
            or "seedance" in ep
            or "hailuo" in ep
            or is_h3
            or is_flux3
            or "grok-imagine-video" in ep
            or "ltx-2.5" in ep
            or "lightricks/ltx" in ep
            or "wan-3.0" in ep
            or getattr(spec, "duration_as_int", False)
        ):
            dur = dur.replace("s", "").strip()
        if str(dur).lower() == "auto" and any(
            str(c).lower() == "auto" for c in (spec.duration_choices or ())
        ):
            args[spec.duration_param] = "auto"
        else:
            if spec.duration_choices and dur not in spec.duration_choices:
                # try closest allowed (skip auto)
                dur = spec.default_duration
            if str(dur).lower() == "auto":
                args[spec.duration_param] = "auto"
            elif getattr(spec, "duration_as_int", False) or is_h3 or is_flux3:
                try:
                    args[spec.duration_param] = int(str(dur).replace("s", ""))
                except (TypeError, ValueError):
                    args[spec.duration_param] = dur
            elif "veo" in ep or "luma" in ep:
                # Veo / Luma Ray enums are "5s" / "10s"
                args[spec.duration_param] = dur
            else:
                # Seedance (and similar): string enum "15" / "auto", not int
                args[spec.duration_param] = str(dur).replace("s", "").strip()

    aspect = (aspect_ratio or spec.default_aspect or "").strip()
    is_grok_v = "grok-imagine-video" in ep

    if is_h3:
        res = resolution or spec.default_resolution or "2K"
        # API expects "2K" on H3; H3 Max uses 480P / 768P
        choices = tuple(spec.resolution_choices or ())
        amap = {str(a).lower(): str(a) for a in choices}
        if str(res).lower() == "2k" and (not amap or "2k" in amap):
            res = amap.get("2k", "2K")
        elif amap:
            res = amap.get(str(res).lower(), amap.get(str(spec.default_resolution or "").lower(), res))
        args["resolution"] = res
        # I2V: aspect follows start image (no aspect_ratio param)
        # T2V / omni: send aspect including "adaptive"
        if "image-to-video" not in ep:
            if aspect and aspect not in ("", "—"):
                args["aspect_ratio"] = aspect
    elif is_flux3:
        res = resolution or spec.default_resolution or "720p"
        if res and spec.resolution_choices:
            # Prefer exact allowed casing
            picked = None
            for a in spec.resolution_choices:
                if str(a).lower() == str(res).lower():
                    picked = str(a)
                    break
            args["resolution"] = picked or str(res)
        # FLUX 3 I2V + central omit list (aspect_omit.py)
        from app.aspect_omit import (
            endpoint_omits_aspect_ratio,
            is_aspect_omit_ui_sentinel,
        )

        omit_ar = (
            bool(getattr(spec, "omit_aspect_ratio", False))
            or endpoint_omits_aspect_ratio(ep)
            or ("image-to-video" in ep and "first-last" not in ep)
        )
        if omit_ar:
            args.pop("aspect_ratio", None)
        elif aspect and not is_aspect_omit_ui_sentinel(aspect):
            al = aspect.strip().lower()
            if al not in ("", "—", "none"):
                args["aspect_ratio"] = aspect
    elif is_grok_v:
        res = resolution or spec.default_resolution
        if res and spec.resolution_choices:
            args["resolution"] = res
        # I2V: no aspect_ratio; T2V / R2V: send aspect
        if "image-to-video" not in ep and aspect and aspect not in ("", "auto", "—"):
            args["aspect_ratio"] = aspect
    elif "hailuo" in ep:
        res = resolution or spec.default_resolution
        if res:
            args["resolution"] = res
    elif "seedance" in ep:
        from app.aspect_omit import is_aspect_omit_ui_sentinel

        # R2V accepts aspect including "auto"; I2V same enum family
        if aspect and not is_aspect_omit_ui_sentinel(aspect):
            args["aspect_ratio"] = aspect
        elif "reference-to-video" in ep:
            args["aspect_ratio"] = "auto"
        res = resolution or spec.default_resolution or "720p"
        res_l = str(res).strip().lower()
        if "reference-to-video" in ep and res_l in ("1080p", "4k", "2k"):
            res = "720p"
        if res and spec.resolution_choices:
            picked = None
            for a in spec.resolution_choices:
                if str(a).lower() == str(res).lower():
                    picked = str(a)
                    break
            args["resolution"] = picked or str(res)
        else:
            args["resolution"] = str(res)
    elif "kling-video" in ep:
        args.pop("resolution", None)
        if aspect and aspect not in ("", "auto", "—"):
            args["aspect_ratio"] = aspect
    else:
        # Veo / Luma / Gemini / reference
        if aspect and aspect not in ("", "—"):
            args["aspect_ratio"] = aspect
        res = resolution or spec.default_resolution
        if res and spec.resolution_choices:
            picked = None
            for a in spec.resolution_choices:
                if str(a).lower() == str(res).lower():
                    picked = str(a)
                    break
            args["resolution"] = picked or str(res)

    if generate_audio is not None and spec.supports_audio:
        args["generate_audio"] = bool(generate_audio)
    elif is_flux3 and "generate_audio" not in args and spec.supports_audio:
        # Prefer explicit UI value; fall back to extra_defaults already merged
        pass

    neg = (negative_prompt or "").strip()
    if neg and spec.supports_negative:
        args["negative_prompt"] = neg

    if spec.mode == "image_to_video":
        if not image_url:
            raise ValueError("Image→Video needs a start still.")
        args[spec.image_field] = image_url
        # Optional last frame for Hailuo / H3 I2V
        if last_frame_url and (
            "hailuo" in ep or is_h3 or getattr(spec, "supports_end_frame", False)
        ):
            args["end_image_url"] = last_frame_url

    elif spec.mode == "reference_to_video":
        # R2V: multi-ref / omni / single identity — freer framing (not start-frame lock)
        imgs = [u for u in (ref_urls or []) if u]
        if image_url and image_url not in imgs:
            imgs = [image_url] + imgs
        vids = [u for u in (ref_video_urls or []) if u]
        auds = [u for u in (ref_audio_urls or []) if u]
        if "avatar-x" in ep:
            audio = (auds[0] if auds else None)
            video = (vids[0] if vids else source_video_url)
            if not audio:
                raise ValueError(
                    "Mirage Avatar X reference needs a voice/audio clip "
                    "(and optional talking-head video)."
                )
            args["audio_url"] = audio
            if video:
                args["video_url"] = video
            return args
        if not imgs and not vids:
            raise ValueError(
                "R2V needs Character 1 / identity refs (or a motion clip)."
            )
        if "gemini-omni-flash" in ep:
            cap_i = max(1, int(spec.max_refs or 8))
            cap_v = max(0, int(getattr(spec, "max_ref_videos", 0) or 0)) or 3
            if imgs:
                args["image_urls"] = imgs[:cap_i]
            if vids:
                args["reference_video_urls"] = vids[:cap_v]
        elif getattr(spec, "omni_reference", False) or (
            is_h3 and "reference-to-video" in ep
        ):
            cap_i = max(1, int(spec.max_refs or 9))
            cap_v = max(0, int(getattr(spec, "max_ref_videos", 0) or 0)) or 3
            cap_a = max(0, int(getattr(spec, "max_ref_audios", 0) or 0)) or 3
            total_cap = int(getattr(spec, "max_total_refs", 0) or 0) or 12
            imgs, vids, auds = imgs[:cap_i], vids[:cap_v], auds[:cap_a]
            while len(imgs) + len(vids) + len(auds) > total_cap:
                if auds:
                    auds.pop()
                elif imgs and len(imgs) > 1:
                    imgs.pop()
                elif vids:
                    vids.pop()
                else:
                    break
            if imgs:
                args["reference_image_urls"] = imgs
            if vids:
                args["reference_video_urls"] = vids
            if auds:
                args["reference_audio_urls"] = auds
        elif "image_urls" in (spec.image_field or "") or "seedance" in ep:
            # Seedance 2.0/2.5 R2V: image_urls + optional video_urls / audio_urls
            cap_i = max(1, int(spec.max_refs or 9))
            cap_v = max(0, int(getattr(spec, "max_ref_videos", 0) or 0))
            cap_a = max(0, int(getattr(spec, "max_ref_audios", 0) or 0))
            total_cap = int(getattr(spec, "max_total_refs", 0) or 0) or 0
            if not cap_v and "seedance" in ep:
                cap_v = 3 if "2.5" not in ep else 10
            if not cap_a and "seedance" in ep:
                cap_a = 3 if "2.5" not in ep else 10
            if not total_cap and "seedance-2.5" in ep:
                total_cap = 50
            use_imgs = imgs[:cap_i]
            use_vids = vids[:cap_v] if cap_v else []
            use_auds = auds[:cap_a] if cap_a else []
            if total_cap > 0:
                while len(use_imgs) + len(use_vids) + len(use_auds) > total_cap:
                    if use_auds:
                        use_auds.pop()
                    elif use_imgs and len(use_imgs) > 1:
                        use_imgs.pop()
                    elif use_vids:
                        use_vids.pop()
                    else:
                        break
            if use_imgs:
                args["image_urls"] = use_imgs
            if use_vids:
                args["video_urls"] = use_vids
            if use_auds:
                args["audio_urls"] = use_auds
        elif "reference_image" in (spec.image_field or ""):
            field = spec.image_field or "reference_image_urls"
            args[field] = imgs[: max(1, int(spec.max_refs or 7))]
        else:
            # Single-image R2V (e.g. FLUX 3 identity) — first ref as image_url
            field = (spec.image_field or "image_url").strip() or "image_url"
            args[field] = imgs[0]
        # Soft-inject citation if missing
        if (imgs or vids) and (
            getattr(spec, "omni_reference", False)
            or int(spec.max_refs or 0) > 1
            or (spec.prompt_citation_style or "") == "image_ref"
        ):
            low = text.lower()
            style = (spec.prompt_citation_style or "plain").lower()
            if style == "angle" and "<image_0>" not in low and "<image0>" not in low:
                tags = ", ".join(f"<IMAGE_{i}>" for i in range(min(len(imgs), 7)))
                args["prompt"] = (
                    text.rstrip(".")
                    + f". Use {tags} as visual reference(s) for subject and style."
                )
            elif style == "image_ref" and "<image_ref_0>" not in low and "<video_ref_0>" not in low:
                tags: list[str] = []
                n_img = len(args.get("image_urls") or imgs or [])
                n_vid = len(args.get("reference_video_urls") or vids or [])
                tags.extend(f"<IMAGE_REF_{i}>" for i in range(min(n_img, 8)))
                tags.extend(f"<VIDEO_REF_{i}>" for i in range(min(n_vid, 3)))
                if tags:
                    args["prompt"] = (
                        text.rstrip(".")
                        + f". Use {', '.join(tags)} as reference(s)."
                    )
            elif style == "plain" and "image 1" not in low:
                args["prompt"] = (
                    text.rstrip(".")
                    + ". Use Image 1 (and Image 2…) as character identity reference(s)."
                )

    elif spec.mode == "bridge":
        if not first_frame_url or not last_frame_url:
            raise ValueError("Bridge needs both a start frame and an end frame.")
        args[spec.first_frame_field] = first_frame_url
        args[spec.last_frame_field] = last_frame_url

    elif spec.mode in ("extend", "video_to_video"):
        vid = (source_video_url or "").strip()
        if not vid and ref_video_urls:
            vid = str(ref_video_urls[0] or "").strip()
        if not vid:
            raise ValueError(
                "V2V needs a source video clip."
                if spec.mode == "video_to_video"
                else "Extend needs a source video clip."
            )
        vfield = (getattr(spec, "video_field", None) or "video_url").strip() or "video_url"
        args[vfield] = vid
        if "sync-lipsync" in ep:
            auds = [u for u in (ref_audio_urls or []) if u]
            if not auds:
                raise ValueError("sync-3 lipsync needs a dialogue audio clip.")
            args["audio_url"] = auds[0]
            args.pop("prompt", None)

    elif spec.mode == "text_to_video":
        if getattr(spec, "omni_reference", False) or (
            is_h3 and "reference-to-video" in ep
        ):
            # Legacy path if omni still tagged text_to_video
            imgs = [u for u in (ref_urls or []) if u]
            vids = [u for u in (ref_video_urls or []) if u]
            auds = [u for u in (ref_audio_urls or []) if u]
            if not imgs and not vids:
                raise ValueError(
                    "Omni reference needs at least one still or motion clip "
                    "(audio cannot be the only reference)."
                )
            if auds and not imgs and not vids:
                raise ValueError(
                    "Reference audio must accompany an image or video reference."
                )
            cap_i = max(1, int(spec.max_refs or 9))
            cap_v = max(0, int(getattr(spec, "max_ref_videos", 0) or 0)) or 3
            cap_a = max(0, int(getattr(spec, "max_ref_audios", 0) or 0)) or 3
            total_cap = int(getattr(spec, "max_total_refs", 0) or 0) or 12
            imgs = imgs[:cap_i]
            vids = vids[:cap_v]
            auds = auds[:cap_a]
            while len(imgs) + len(vids) + len(auds) > total_cap:
                if auds:
                    auds.pop()
                elif imgs and len(imgs) > 1:
                    imgs.pop()
                elif vids:
                    vids.pop()
                else:
                    break
            if imgs:
                args["reference_image_urls"] = imgs
            if vids:
                args["reference_video_urls"] = vids
            if auds:
                args["reference_audio_urls"] = auds
            # Soft-inject citation language if missing
            style = (getattr(spec, "prompt_citation_style", None) or "plain").lower()
            low = text.lower()
            if style == "plain" and "image 1" not in low and "video 1" not in low:
                cite_bits: list[str] = []
                if imgs:
                    cite_bits.append("Image 1 as subject/style lock")
                if vids:
                    cite_bits.append("Video 1 as camera path / motion only")
                if auds:
                    cite_bits.append("Audio 1 as timed bed")
                if cite_bits:
                    args["prompt"] = (
                        text.rstrip(".") + ". Use " + "; ".join(cite_bits) + "."
                    )
        elif spec.max_refs > 0:
            urls = [u for u in (ref_urls or []) if u]
            if not urls:
                raise ValueError(
                    "Reference pack model needs at least one reference still."
                )
            field = (spec.image_field or "image_urls").strip() or "image_urls"
            # Grok Imagine 1.5 R2V uses reference_image_urls + <IMAGE_n> tags
            if "reference-to-video" in ep and "image_url" not in field:
                field = "reference_image_urls"
            args[field] = urls[: max(1, spec.max_refs)]
            style = (getattr(spec, "prompt_citation_style", None) or "").lower()
            low = text.lower()
            if style == "angle" and "<image_0>" not in low:
                n = min(len(args[field]), 7)
                tags = ", ".join(f"<IMAGE_{i}>" for i in range(n))
                args["prompt"] = (
                    text.rstrip(".")
                    + f". Use {tags} as visual reference(s) for subject and style."
                )
        elif ref_urls and "reference-to-video" in spec.endpoint:
            if "grok-imagine-video" in ep:
                args["reference_image_urls"] = list(ref_urls)[:7]
            else:
                args["image_urls"] = list(ref_urls)[:8]

    # Clean empty optionals
    for k in list(args.keys()):
        if args[k] is None or args[k] == "":
            args.pop(k, None)

    # Single durable aspect policy (omit list + send enums) — last word before return
    from app.aspect_omit import apply_aspect_policy

    req = aspect_ratio
    if req is None and "aspect_ratio" in args:
        req = args.get("aspect_ratio")
    args = apply_aspect_policy(
        args,
        endpoint=spec.endpoint,
        mode=getattr(spec, "mode", None),
        requested=req,
    )
    # Seedance R2V: strict allowlist (no negative_prompt), duration str, res 480p/720p
    from app.aspect_omit import sanitize_seedance_r2v_arguments

    args = sanitize_seedance_r2v_arguments(args, endpoint=spec.endpoint)
    from app.fal.models import apply_wan30_payload

    args = apply_wan30_payload(args, endpoint=spec.endpoint)
    return args
