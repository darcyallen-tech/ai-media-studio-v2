"""
Unified Create model catalog.

Wraps Studio (IMAGE_EDIT / VIDEO) and Creative Vision registries so
list_models(mode, modality) returns only valid models. Existing registries
remain the field-level source of truth — this is the index Phase 2 will use.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from app.create_state import (
    IMAGE_MODALITIES,
    VIDEO_MODALITIES,
    CreateMode,
    modality_from_vision_mode,
    mode_for_modality,
    normalize_modality,
    vision_mode_from_modality,
)

CreateBackend = Literal["vision", "studio_image", "studio_video"]


@dataclass(frozen=True)
class ModelEntry:
    """One catalog row: mode + modalities + slots + dispatch metadata."""

    id: str
    label: str
    mode: CreateMode
    modalities: tuple[str, ...]
    endpoint: str
    required_slots: tuple[str, ...]
    optional_slots: tuple[str, ...]
    duration_min: int | None = None
    duration_max: int | None = None
    duration_enum: tuple[str, ...] = ()
    size_limits: dict[str, Any] = field(default_factory=dict)
    cost_fn: str = ""
    notes: str = ""
    tags: tuple[str, ...] = ()
    backend: CreateBackend = "vision"
    source_key: str = ""
    vision_mode: str = ""
    aliases: tuple[str, ...] = ()
    default_duration: str = ""
    omni: bool = False
    requires_end_frame: bool = False
    supports_end_frame: bool = False
    aspect_choices: tuple[str, ...] = ()
    resolution_choices: tuple[str, ...] = ()
    default_aspect: str = ""
    default_resolution: str = ""
    supports_audio: bool = False
    supports_strength: bool = False
    native_stereo_audio: bool = False
    hidden: bool = False
    first_last: bool = False
    supports_draft: bool = False
    supports_elements: bool = False
    max_elements: int = 0
    element_allows_video: bool = False
    supports_multi_prompt: bool = False
    max_multi_prompt: int = 0


def _parse_duration_token(tok: str | None) -> int | None:
    raw = (tok or "").strip().lower().rstrip("s").strip()
    if not raw or raw in ("auto", "default"):
        return None
    try:
        return int(round(float(raw)))
    except (TypeError, ValueError):
        return None


def _duration_from_choices(
    choices: tuple[str, ...] | list[str] | None,
    *,
    min_s: float | None = None,
    max_s: float | None = None,
) -> tuple[int | None, int | None, tuple[str, ...]]:
    enum = tuple(str(c) for c in (choices or ()) if str(c).strip())
    nums = [n for n in (_parse_duration_token(c) for c in enum) if n is not None]
    dmin = min(nums) if nums else (int(min_s) if min_s else None)
    dmax = max(nums) if nums else (int(max_s) if max_s else None)
    if min_s is not None:
        dmin = int(min_s) if dmin is None else min(dmin, int(min_s))
    if max_s is not None:
        dmax = int(max_s) if dmax is None else max(dmax, int(max_s))
    return dmin, dmax, enum


def _needs_still_proxy(endpoint: str | None) -> bool:
    ep = (endpoint or "").lower()
    return any(
        n in ep
        for n in ("kling-video", "kling", "seedance", "minimax/h3", "hailuo")
    )


def _size_limits(
    *,
    endpoint: str = "",
    max_ref_images: int = 0,
    max_ref_videos: int = 0,
    max_ref_audios: int = 0,
    max_total_refs: int = 0,
    max_num_images: int = 1,
    max_resolution: str = "",
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "max_ref_images": int(max_ref_images or 0),
        "max_refs": int(max_ref_images or 0),
        "max_ref_videos": int(max_ref_videos or 0),
        "max_ref_audios": int(max_ref_audios or 0),
        "max_total_refs": int(max_total_refs or 0),
        "max_num_images": int(max_num_images or 1),
    }
    if max_resolution:
        out["max_resolution"] = max_resolution
    if _needs_still_proxy(endpoint):
        # Document only — resize stays in the upload path (prepare_api_still).
        try:
            from app.motion_sync_prep import (
                MAX_API_STILL_BYTES,
                MAX_API_STILL_SIDE,
            )

            out["max_still_side"] = int(MAX_API_STILL_SIDE)
            out["max_still_bytes"] = int(MAX_API_STILL_BYTES)
        except Exception:
            out["max_still_side"] = 1920
            out["max_still_bytes"] = 8 * 1024 * 1024
    return out


def _kling_ui_flags(spec: Any) -> dict[str, Any]:
    return {
        "supports_elements": bool(getattr(spec, "supports_elements", False)),
        "max_elements": int(getattr(spec, "max_elements", 0) or 0),
        "element_allows_video": bool(getattr(spec, "element_allows_video", False)),
        "supports_multi_prompt": bool(getattr(spec, "supports_multi_prompt", False)),
        "max_multi_prompt": int(getattr(spec, "max_multi_prompt", 0) or 0),
    }


def _slots_for(
    modality: str,
    *,
    requires_end: bool = False,
    omni: bool = False,
    max_refs: int = 0,
    max_ref_videos: int = 0,
    max_ref_audios: int = 0,
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    m = normalize_modality(modality)
    if m == "t2i":
        return (), ("ref_images", "num_images")
    if m == "i2i":
        opt = ["ref_images"] if max_refs > 1 else []
        return ("start_still",), tuple(opt)
    if m == "r2i":
        return ("ref_images",), ("start_still", "character_ids", "scene_ids")
    if m == "region":
        return ("start_still",), ("mask",)
    if m == "t2v":
        opt: list[str] = []
        if max_refs > 0:
            opt.append("ref_images")
        return (), tuple(opt)
    if m == "i2v":
        if omni:
            return (), (
                "start_still",
                "end_still",
                "source_video",
                "ref_images",
                "ref_videos",
                "ref_audios",
            )
        req = ("start_still", "end_still") if requires_end else ("start_still",)
        opt = ["end_still"] if (not requires_end) else []
        if max_refs > 1:
            opt.append("ref_images")
        return req, tuple(opt)
    if m == "r2v":
        return ("ref_images",), (
            "start_still",
            "source_video",
            "ref_videos",
            "ref_audios",
            "character_ids",
            "scene_ids",
        )
    if m == "v2v":
        opt = ["start_still", "ref_images"]
        if max_ref_audios > 0:
            opt.append("ref_audios")
        return ("source_video",), tuple(opt)
    if m == "bridge":
        return ("start_still", "end_still"), ()
    if m == "extend":
        return ("source_video",), ()
    return (), ()


def _tags_for(
    *,
    modality: str,
    notes: str,
    endpoint: str,
    requires_end: bool,
    omni: bool,
    backend: str,
    source_key: str,
    draft: bool = False,
    native_stereo: bool = False,
    supports_end: bool = False,
) -> tuple[str, ...]:
    tags: list[str] = []
    ep = (endpoint or "").lower()
    note_l = (notes or "").lower()
    if modality == "bridge" or requires_end or supports_end or "first-last" in ep:
        tags.append("first→last")
    if modality == "v2v" and (
        "video-to-video/edit" in ep or "camera" in note_l or "motion-preserv" in note_l
    ):
        tags.append("camera-lock")
    if omni:
        tags.append("omni")
    if draft:
        tags.append("draft")
    if native_stereo:
        tags.append("native-audio")
    if "extend" in ep or modality == "extend":
        tags.append("extend")
    if source_key:
        tags.append(source_key)
    return tuple(dict.fromkeys(tags))


def _aliases(*parts: str | None) -> tuple[str, ...]:
    seen: set[str] = set()
    out: list[str] = []
    for p in parts:
        raw = (p or "").strip()
        if not raw:
            continue
        for cand in (raw, raw.lower()):
            if cand not in seen:
                seen.add(cand)
                out.append(cand)
    return tuple(out)


def _studio_video_modalities(spec: Any) -> tuple[str, ...]:
    from app.studio_modality import _is_r2v_video_spec

    mods: list[str] = []
    task = getattr(spec, "task", "")
    ep = (getattr(spec, "endpoint", None) or "").lower()
    key = (getattr(spec, "key", None) or "").lower()
    if task == "video_edit":
        mods.append("v2v")
        if "extend" in key or "extend-video" in ep:
            mods.append("extend")
    elif task == "image_to_video":
        if _is_r2v_video_spec(spec):
            mods.append("r2v")
        else:
            mods.append("i2v")
        if getattr(spec, "requires_end_frame", False) or "first-last" in ep:
            mods.append("bridge")
    return tuple(mods)


def _entry_from_vision(spec: Any) -> ModelEntry:
    short = modality_from_vision_mode(getattr(spec, "mode", "") or "")
    requires_end = bool(getattr(spec, "requires_end_frame", False)) or short == "bridge"
    omni = bool(getattr(spec, "omni_reference", False))
    max_refs = int(getattr(spec, "max_refs", 0) or 0)
    req, opt = _slots_for(
        short,
        requires_end=requires_end,
        omni=omni,
        max_refs=max_refs,
        max_ref_videos=int(getattr(spec, "max_ref_videos", 0) or 0),
        max_ref_audios=int(getattr(spec, "max_ref_audios", 0) or 0),
    )
    dmin, dmax, denum = _duration_from_choices(getattr(spec, "duration_choices", ()) or ())
    key = str(getattr(spec, "key", "") or "")
    label = str(getattr(spec, "label", "") or key)
    endpoint = str(getattr(spec, "endpoint", "") or "")
    notes = str(getattr(spec, "notes", "") or "")
    supports_end = bool(getattr(spec, "supports_end_frame", False)) or requires_end
    first_last = bool(
        requires_end
        or supports_end
        or short == "bridge"
        or "first-last" in endpoint.lower()
    )
    supports_draft = bool(getattr(spec, "draft_endpoint", None))
    return ModelEntry(
        id=f"vision:{key}",
        label=label,
        mode=mode_for_modality(short),
        modalities=(short,),
        endpoint=endpoint,
        required_slots=req,
        optional_slots=opt,
        duration_min=dmin,
        duration_max=dmax,
        duration_enum=denum,
        size_limits=_size_limits(
            endpoint=endpoint,
            max_ref_images=max_refs,
            max_ref_videos=int(getattr(spec, "max_ref_videos", 0) or 0),
            max_ref_audios=int(getattr(spec, "max_ref_audios", 0) or 0),
            max_total_refs=int(getattr(spec, "max_total_refs", 0) or 0),
            max_num_images=int(getattr(spec, "max_num_images", 1) or 1),
            max_resolution=str(getattr(spec, "default_resolution", "") or ""),
        ),
        cost_fn="vision",
        notes=notes,
        tags=_tags_for(
            modality=short,
            notes=notes,
            endpoint=endpoint,
            requires_end=requires_end,
            omni=omni,
            backend="vision",
            source_key=key,
            draft=supports_draft,
            native_stereo=bool(getattr(spec, "native_stereo_audio", False)),
            supports_end=supports_end,
        ),
        backend="vision",
        source_key=key,
        vision_mode=str(getattr(spec, "mode", "") or vision_mode_from_modality(short)),
        aliases=_aliases(key, label, f"vision:{key}"),
        default_duration=str(getattr(spec, "default_duration", "") or ""),
        omni=omni,
        requires_end_frame=requires_end,
        supports_end_frame=supports_end,
        aspect_choices=tuple(getattr(spec, "aspect_choices", ()) or ()),
        resolution_choices=tuple(getattr(spec, "resolution_choices", ()) or ()),
        default_aspect=str(getattr(spec, "default_aspect", "") or ""),
        default_resolution=str(getattr(spec, "default_resolution", "") or ""),
        supports_audio=bool(getattr(spec, "supports_audio", False)),
        supports_strength=bool(getattr(spec, "supports_strength", False)),
        native_stereo_audio=bool(getattr(spec, "native_stereo_audio", False)),
        hidden=bool(getattr(spec, "hidden", False)),
        first_last=first_last,
        supports_draft=supports_draft,
        **_kling_ui_flags(spec),
    )


def _entry_from_image_edit(spec: Any, *, extra_modalities: tuple[str, ...] = ()) -> ModelEntry:
    max_refs = int(getattr(spec, "max_ref_images", 1) or 1)
    mods = ["i2i"]
    if max_refs > 1:
        mods.append("r2i")
    for m in extra_modalities:
        if m not in mods:
            mods.append(m)
    # Primary slots from the first (i2i) modality; region overrides below
    primary = "region" if extra_modalities == ("region",) and "i2i" not in extra_modalities else "i2i"
    if extra_modalities == ("region",) and len(mods) == 1:
        primary = "region"
    # Region-only entries (seedream listed under region)
    if "region" in extra_modalities and extra_modalities == ("region",):
        mods = ["region"]
        primary = "region"
    req, opt = _slots_for(primary, max_refs=max_refs)
    key = str(getattr(spec, "key", "") or "")
    label = str(getattr(spec, "label", "") or key)
    endpoint = str(getattr(spec, "endpoint", "") or "")
    notes = str(getattr(spec, "notes", "") or "")
    suffix = "region" if primary == "region" else "img"
    cid = f"studio:{suffix}:{key}"
    return ModelEntry(
        id=cid,
        label=label,
        mode="image",
        modalities=tuple(mods),
        endpoint=endpoint,
        required_slots=req,
        optional_slots=opt,
        size_limits=_size_limits(
            endpoint=endpoint,
            max_ref_images=max_refs,
            max_num_images=int(getattr(spec, "max_num_images", 1) or 1),
            max_resolution=str(getattr(spec, "max_resolution", "") or ""),
        ),
        cost_fn="studio_image",
        notes=notes,
        tags=_aliases(*_tags_for(
            modality=primary,
            notes=notes,
            endpoint=endpoint,
            requires_end=False,
            omni=False,
            backend="studio_image",
            source_key=key,
        )),
        backend="studio_image",
        source_key=key,
        aliases=_aliases(key, label, cid, f"studio:{key}"),
        aspect_choices=tuple(getattr(spec, "allowed_aspect_ratios", ()) or ()),
        resolution_choices=tuple(getattr(spec, "allowed_resolutions", ()) or ()),
        default_aspect=str(getattr(spec, "default_aspect_ratio", "") or ""),
        default_resolution=str(getattr(spec, "default_resolution", "") or ""),
        supports_audio=False,
        supports_strength=True,
        native_stereo_audio=False,
        hidden=bool(getattr(spec, "hidden", False)),
        first_last=False,
        supports_draft=False,
    )


def _entry_from_video(spec: Any) -> ModelEntry:
    mods = _studio_video_modalities(spec)
    if not mods:
        mods = ("i2v",)
    requires_end = bool(getattr(spec, "requires_end_frame", False)) or "bridge" in mods
    omni = bool(
        getattr(spec, "ref_image_field", None)
        and "reference-to-video" in (getattr(spec, "endpoint", "") or "")
        and int(getattr(spec, "max_ref_videos", 0) or 0) > 0
    )
    max_refs = int(getattr(spec, "max_ref_images", 0) or 0)
    # Slots: use the most specific modality (bridge > r2v > extend > v2v > i2v)
    primary = mods[0]
    for pref in ("bridge", "r2v", "extend", "v2v", "i2v"):
        if pref in mods:
            primary = pref
            break
    req, opt = _slots_for(
        primary,
        requires_end=requires_end,
        omni=omni,
        max_refs=max_refs,
        max_ref_videos=int(getattr(spec, "max_ref_videos", 0) or 0),
        max_ref_audios=int(getattr(spec, "max_ref_audios", 0) or 0),
    )
    dmin, dmax, denum = _duration_from_choices(
        getattr(spec, "allowed_durations", ()) or (),
        min_s=getattr(spec, "min_duration_seconds", None),
        max_s=getattr(spec, "max_duration_seconds", None),
    )
    key = str(getattr(spec, "key", "") or "")
    label = str(getattr(spec, "label", "") or key)
    endpoint = str(getattr(spec, "endpoint", "") or "")
    notes = str(getattr(spec, "notes", "") or "")
    supports_end = bool(getattr(spec, "supports_end_frame", False)) or requires_end
    first_last = bool(
        requires_end
        or supports_end
        or "bridge" in mods
        or "first-last" in endpoint.lower()
    )
    supports_draft = bool(getattr(spec, "draft_endpoint", None))
    return ModelEntry(
        id=f"studio:vid:{key}",
        label=label,
        mode="video",
        modalities=mods,
        endpoint=endpoint,
        required_slots=req,
        optional_slots=opt,
        duration_min=dmin,
        duration_max=dmax,
        duration_enum=denum,
        size_limits=_size_limits(
            endpoint=endpoint,
            max_ref_images=max_refs,
            max_ref_videos=int(getattr(spec, "max_ref_videos", 0) or 0),
            max_ref_audios=int(getattr(spec, "max_ref_audios", 0) or 0),
            max_total_refs=int(getattr(spec, "max_total_refs", 0) or 0),
            max_resolution=str(getattr(spec, "default_resolution", "") or ""),
        ),
        cost_fn="studio_video",
        notes=notes,
        tags=_tags_for(
            modality=primary,
            notes=notes,
            endpoint=endpoint,
            requires_end=requires_end,
            omni=omni,
            backend="studio_video",
            source_key=key,
            draft=supports_draft,
            native_stereo=bool(getattr(spec, "native_stereo_audio", False)),
            supports_end=supports_end,
        ),
        backend="studio_video",
        source_key=key,
        aliases=_aliases(key, label, f"studio:vid:{key}", f"studio:{key}"),
        default_duration=str(getattr(spec, "default_duration", "") or ""),
        omni=omni,
        requires_end_frame=requires_end,
        supports_end_frame=supports_end,
        aspect_choices=tuple(getattr(spec, "allowed_aspect_ratios", ()) or ()),
        resolution_choices=tuple(getattr(spec, "allowed_resolutions", ()) or ()),
        default_aspect=str(getattr(spec, "default_aspect_ratio", "") or ""),
        default_resolution=str(getattr(spec, "default_resolution", "") or ""),
        supports_audio=bool(
            getattr(spec, "generate_audio_param", None)
            or getattr(spec, "native_stereo_audio", False)
        ),
        supports_strength=False,
        native_stereo_audio=bool(getattr(spec, "native_stereo_audio", False)),
        hidden=bool(getattr(spec, "hidden", False)),
        first_last=first_last,
        supports_draft=supports_draft,
        **_kling_ui_flags(spec),
    )


def _build_catalog() -> list[ModelEntry]:
    from app.fal.models import IMAGE_EDIT_MODELS, VIDEO_MODELS
    from app.region_edit import REGION_MODEL_KEYS
    from app.vision_registry import (
        BRIDGE_MODELS,
        EXTEND_MODELS,
        I2I_MODELS,
        I2V_MODELS,
        R2I_MODELS,
        R2V_MODELS,
        T2I_MODELS,
        T2V_MODELS,
        V2V_MODELS,
    )

    out: list[ModelEntry] = []

    for spec in IMAGE_EDIT_MODELS.values():
        extra: tuple[str, ...] = ()
        if spec.key in REGION_MODEL_KEYS:
            extra = ("region",)
        out.append(_entry_from_image_edit(spec, extra_modalities=extra))

    for spec in VIDEO_MODELS.values():
        out.append(_entry_from_video(spec))

    for registry in (
        T2I_MODELS,
        I2I_MODELS,
        R2I_MODELS,
        T2V_MODELS,
        I2V_MODELS,
        R2V_MODELS,
        V2V_MODELS,
        BRIDGE_MODELS,
        EXTEND_MODELS,
    ):
        for spec in registry.values():
            out.append(_entry_from_vision(spec))

    return out


_CATALOG: list[ModelEntry] | None = None
_BY_ID: dict[str, ModelEntry] | None = None


def all_models() -> list[ModelEntry]:
    """Full catalog (Studio + Creative Vision + Bridge + Extend)."""
    global _CATALOG, _BY_ID
    if _CATALOG is None:
        _CATALOG = _build_catalog()
        _BY_ID = {e.id: e for e in _CATALOG}
    return list(_CATALOG)


def get_model(model_id: str | None) -> ModelEntry | None:
    if not model_id:
        return None
    all_models()
    assert _BY_ID is not None
    return _BY_ID.get(model_id.strip())


def is_first_last_capable(entry: ModelEntry) -> bool:
    return bool(entry.first_last)


def _matches_modality(entry: ModelEntry, modality: str) -> bool:
    m = normalize_modality(modality)
    if m not in entry.modalities:
        return False
    # Pure T2V: hide omni / required-ref models (same as Studio Video filter)
    if m == "t2v" and (entry.omni or int(entry.size_limits.get("max_refs") or 0) > 0):
        return False
    if m == "r2i" and int(entry.size_limits.get("max_ref_images") or 0) <= 1:
        # Vision R2I rows have max_refs; studio i2i-only singles must not appear
        if "r2i" not in entry.modalities:
            return False
        if entry.backend == "studio_image" and int(entry.size_limits.get("max_ref_images") or 0) <= 1:
            return False
    return True


def list_models(
    mode: str | None = None,
    modality: str | None = None,
    *,
    surface: str | None = None,
) -> list[ModelEntry]:
    """
    Models valid for ``mode`` + ``modality``.

    ``bridge`` returns only first→last-capable models (required start + end).
    Optional ``surface`` ("studio" | "vision") narrows to that backend family.
    """
    want_mode = (mode or "").strip().lower() or None
    want_mod = normalize_modality(modality) if modality else None
    if want_mod and not want_mode:
        want_mode = mode_for_modality(want_mod)
    surf = (surface or "").strip().lower() or None

    out: list[ModelEntry] = []
    for e in all_models():
        if want_mode and e.mode != want_mode:
            continue
        if want_mod and not _matches_modality(e, want_mod):
            continue
        if want_mod == "bridge" and not is_first_last_capable(e):
            continue
        if want_mod == "region" and "region" not in e.modalities:
            continue
        if surf == "studio" and not e.backend.startswith("studio"):
            continue
        if surf == "vision" and e.backend != "vision":
            continue
        out.append(e)
    return out


def list_slots(model_id: str) -> dict[str, tuple[str, ...]]:
    """Required / optional slots for a catalog id (or label/key)."""
    entry = resolve_model(model_id)
    if entry is None:
        return {"required": (), "optional": ()}
    return {"required": entry.required_slots, "optional": entry.optional_slots}


def resolve_model(
    model_id: str | None,
    *,
    mode: str | None = None,
    modality: str | None = None,
    surface: str | None = None,
) -> ModelEntry | None:
    """
    Resolve a catalog id, registry key, or UI label.

    When several entries share a key (Studio Kling I2V vs Vision Kling I2V),
    ``surface`` / ``modality`` pick the right one.
    """
    if not model_id:
        return None
    raw = model_id.strip()
    if not raw:
        return None
    hit = get_model(raw)
    if hit is not None:
        return hit

    want_mod = normalize_modality(modality) if modality else None
    surf = (surface or "").strip().lower() or None
    want_mode = (mode or "").strip().lower() or None
    raw_l = raw.lower()

    candidates: list[ModelEntry] = []
    for e in all_models():
        aliases = {a.lower() for a in e.aliases}
        if (
            raw_l == e.id.lower()
            or raw_l == e.source_key.lower()
            or raw_l == e.label.lower()
            or raw_l in aliases
        ):
            candidates.append(e)
    if not candidates:
        return None

    def _score(e: ModelEntry) -> tuple[int, int, int]:
        s_mod = 1 if (want_mod and want_mod in e.modalities) else 0
        s_surf = 0
        if surf == "vision" and e.backend == "vision":
            s_surf = 1
        elif surf == "studio" and e.backend.startswith("studio"):
            s_surf = 1
        s_mode = 1 if (want_mode and e.mode == want_mode) else 0
        return (s_mod, s_surf, s_mode)

    candidates.sort(key=_score, reverse=True)
    return candidates[0]


# Preferred default model hints (matched against id / key / label)
_DEFAULT_HINTS: dict[str, tuple[str, ...]] = {
    "i2i": ("flux 2 pro", "Image · Flux 2 Pro (edit)"),
    "t2i": ("flux 2 pro t2i", "Flux 2 Pro (T2I)"),
    "r2i": ("flux 2 pro", "Image · Flux 2 Pro (edit)"),
    "region": ("seedream 5 pro", "Image · Seedream 5 Pro (edit)"),
    "i2v": ("kling o3 standard i2v", "Kling O3 Standard", "seedance 2.5 i2v"),
    "t2v": ("veo 3.1 fast", "Veo 3.1 Fast", "seedance 2.5 t2v"),
    "v2v": ("kling o3 standard edit", "Kling O3 Standard – V2V"),
    "r2v": ("minimax h3", "Omni"),
    "bridge": ("kling o3 pro bridge", "Kling O3 Pro · First→Last"),
    "extend": ("flux 3 extend", "FLUX 3 · Extend"),
}


def list_models_for_ui(mode: str | None, modality: str | None) -> list[ModelEntry]:
    """
    Filtered catalog for the Create dropdown.

    One row per endpoint (Studio + Vision often wrap the same fal path).
    Prefers Vision rows for T2I / T2V / Bridge / Extend; Studio otherwise.
    """
    m = normalize_modality(modality) if modality else None
    prefer_vision = m in ("t2i", "t2v", "bridge", "extend")
    rows = list_models(mode, modality)
    rows.sort(key=lambda e: (0 if (e.backend == "vision") == prefer_vision else 1))
    seen: set[str] = set()
    out: list[ModelEntry] = []
    for e in rows:
        if e.hidden:
            continue
        key = (e.endpoint or "").strip().lower()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        out.append(e)
    return out


def default_model_for(mode: str | None, modality: str | None) -> ModelEntry | None:
    """First sensible model from the filtered UI list."""
    rows = list_models_for_ui(mode, modality)
    if not rows:
        return None
    hints = _DEFAULT_HINTS.get(normalize_modality(modality) if modality else "", ())
    for e in rows:
        blob = f"{e.id} {e.source_key} {e.label}".lower()
        if any(h.lower() in blob for h in hints):
            return e
    return rows[0]
