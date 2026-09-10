"""Character pipeline: Z-Image Front → Qwen Multiangle → SeedVR Confirm."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from app.assets import attach_identity_still, get_asset, public_asset
from app.comfy_client import (
    COMFY_DOWN,
    ComfyError,
    run_workflow,
)
from app.config import OUTPUT_DIR
from app.library import record_generated
from app.naming import job_media_dir, make_output_stem, timestamp_now, unique_path

ZIMAGE_ASPECT = "9:16 (Portrait Widescreen)"
ZIMAGE_MP = 2
CAMERA_LOCK = "Do not change appearance or clothing."

# slot -> horizontal, vertical, zoom, camera phrase
ANGLE_CAM: dict[str, tuple[int, int, int, str]] = {
    "threequarter_front": (
        45,
        0,
        4,
        "Rotate the camera 45 degrees around the subject, three-quarter front, full body.",
    ),
    "side": (90, 0, 4, "Rotate the camera 90 degrees to the side, full-body profile."),
    "threequarter_back": (
        135,
        0,
        4,
        "Rotate the camera 135 degrees, three-quarter back, full body.",
    ),
    "back": (180, 0, 4, "Rotate the camera 180 degrees to the back, full body."),
    "closeup": (0, 0, 9, "Move in for a close-up of the face."),
    "top": (0, 70, 4, "Raise the camera high and look down at the subject."),
}

CHAR_SLOTS = ("front",) + tuple(ANGLE_CAM.keys())


def _seed() -> int:
    return int(uuid.uuid4().int % (2**32))


def _public_output(path: Path) -> str:
    try:
        rel = path.resolve().relative_to(OUTPUT_DIR.resolve())
        return "/outputs/" + rel.as_posix()
    except ValueError:
        return ""


def _dest(stem_hint: str, model: str, ext: str = ".png") -> Path:
    stamp = timestamp_now()
    media = job_media_dir(OUTPUT_DIR, stamp=stamp)
    stem = make_output_stem(stem_hint, model, stamp=stamp, kind="img")
    return unique_path(media, stem, ext)


def _pack(pub: dict[str, Any], *, slot: str, prompt: str, job: dict[str, Any]) -> dict[str, Any]:
    path = str(job.get("path") or "")
    ms = int(job.get("duration_ms") or 0)
    pub["angle"] = slot
    pub["prompt"] = prompt
    pub["path"] = path
    pub["preview_path"] = path
    pub["cost"] = f"Local · $0.00 · {ms / 1000:.1f}s" if ms else "Local · $0.00"
    pub["duration_ms"] = ms
    pub["duration_sec"] = round(ms / 1000, 3) if ms else 0
    pub["width"] = job.get("width") or 0
    pub["height"] = job.get("height") or 0
    pub["workflow"] = job.get("workflow") or ""
    pub["model_used"] = "comfy:local"
    url = ""
    ident_urls = pub.get("identity_urls") if isinstance(pub.get("identity_urls"), dict) else {}
    if slot in ident_urls:
        url = str(ident_urls[slot])
    if not url:
        url = _public_output(Path(path)) if path else ""
    pub["url"] = url
    pub["qwen_source"] = str((pub.get("identity") or {}).get(slot) or path)
    return pub


def generate_front(*, asset_id: str, prompt: str, seed: int | None = None) -> dict[str, Any]:
    text = (prompt or "").strip()
    if not text:
        raise ComfyError("Front prompt is empty.")
    dest = _dest(text[:40] or "character-front", "zimage-turbo")
    job = run_workflow(
        binding_key="zimage_t2i",
        values={
            "prompt": text,
            "aspect_ratio": ZIMAGE_ASPECT,
            "megapixels": ZIMAGE_MP,
            "seed": int(seed) if seed is not None else _seed(),
        },
        dest=dest,
    )
    pub = attach_identity_still(asset_id, "front", dest, model="comfy:zimage-turbo")
    record_generated([str(dest)], cost="Local · $0.00", duration_sec=job.get("duration_ms", 0) / 1000, model="zimage-turbo")
    return _pack(pub, slot="front", prompt=text, job=job)


def generate_angle(
    *,
    asset_id: str,
    slot: str,
    prompt: str = "",
    source_still: str = "",
    enhanced: bool = False,
    seed: int | None = None,
) -> dict[str, Any]:
    key = (slot or "").strip().lower()
    cam = ANGLE_CAM.get(key)
    if not cam:
        raise ComfyError(f"Unknown character angle: {slot}")
    h, v, zoom, phrase = cam
    row = get_asset(asset_id) or {}
    ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    front = str(source_still or ident.get("front") or "").strip()
    if not front or not Path(front).is_file():
        raise ComfyError("Generate Front first.")
    lock = f"{phrase} {CAMERA_LOCK}".strip()
    extra = (prompt or "").strip()
    qwen_prompt = f"{extra}\n{lock}".strip() if enhanced and extra else lock
    dest = _dest(f"character-{key}", "qwen-multiangle")
    job = run_workflow(
        binding_key="qwen_angle",
        values={
            "h_angle": h,
            "v_angle": v,
            "zoom": zoom,
            "prompt": qwen_prompt,
            "seed": int(seed) if seed is not None else _seed(),
        },
        dest=dest,
        source_image=front,
        replace_links={"prompt": True},
    )
    pub = attach_identity_still(asset_id, key, dest, model="comfy:qwen-multiangle")
    record_generated(
        [str(dest)],
        cost="Local · $0.00",
        duration_sec=job.get("duration_ms", 0) / 1000,
        model="qwen-multiangle",
    )
    return _pack(pub, slot=key, prompt=qwen_prompt, job=job)


def confirm_upscale(*, asset_id: str, slot: str, source_still: str = "") -> dict[str, Any]:
    key = (slot or "front").strip().lower()
    row = get_asset(asset_id) or {}
    ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    src = str(source_still or ident.get(key) or ident.get("front") or "").strip()
    if not src or not Path(src).is_file():
        raise ComfyError("No still to Confirm. Generate first.")
    src_path = Path(src)
    dest_tmp = _dest(f"{src_path.stem}-seedvr", "seedvr2")
    job = run_workflow(
        binding_key="seedvr_confirm",
        values={
            "max_resolution": 3840,
            "batch_size": 1,
            "temporal_overlap": 0,
            "prepend_frames": 0,
        },
        dest=dest_tmp,
        source_image=src_path,
    )
    four_k = src_path.with_name(f"{src_path.stem}_4k.png")
    four_k.write_bytes(Path(job["path"]).read_bytes())
    # Keep 2 MP identity slot; preview is the 4K sibling.
    out_copy = _dest(f"{src_path.stem}-4k", "seedvr2")
    out_copy.write_bytes(four_k.read_bytes())
    job["path"] = str(out_copy.resolve())
    record_generated(
        [str(out_copy), str(four_k)],
        cost="Local · $0.00",
        duration_sec=job.get("duration_ms", 0) / 1000,
        model="seedvr2",
    )
    pub = public_asset(asset_id) or {}
    packed = _pack(pub, slot=key, prompt="", job=job)
    packed["qwen_source"] = str(src_path.resolve())
    packed["path"] = str(src_path.resolve())
    packed["preview_path"] = str(four_k.resolve())
    packed["url"] = _public_output(out_copy)
    packed["confirmed_4k"] = True
    packed["identity"] = dict(ident)
    packed["identity"][key] = str(src_path.resolve())
    return packed


def run_character_job(
    *,
    job: str,
    asset_id: str,
    slot: str = "front",
    prompt: str = "",
    source_still: str = "",
    enhanced: bool = False,
    seed: int | None = None,
) -> dict[str, Any]:
    kind = (job or "").strip().lower()
    if kind in ("front", "zimage", "zimage_t2i"):
        return generate_front(asset_id=asset_id, prompt=prompt, seed=seed)
    if kind in ("angle", "qwen", "qwen_angle"):
        return generate_angle(
            asset_id=asset_id,
            slot=slot,
            prompt=prompt,
            source_still=source_still,
            enhanced=enhanced,
            seed=seed,
        )
    if kind in ("confirm", "seedvr", "seedvr_confirm"):
        return confirm_upscale(asset_id=asset_id, slot=slot, source_still=source_still)
    raise ComfyError(f"Unknown Comfy character job: {job}")
