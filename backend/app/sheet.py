"""Character / Scene / Prop sheet prompts and one-angle generate."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.assets import (
    attach_identity_still,
    get_asset,
    primary_still_path,
)

CORE_SLOTS: tuple[str, ...] = ("front", "side", "closeup")
EXTRA_SLOTS: tuple[str, ...] = (
    "back",
    "threequarter_front",
    "threequarter_back",
    "top",
)
ALL_SLOTS: tuple[str, ...] = CORE_SLOTS + EXTRA_SLOTS

SLOT_LABELS: dict[str, str] = {
    "front": "Front (full body)",
    "side": "Side (full body)",
    "closeup": "Close-up",
    "back": "Back (full body)",
    "threequarter_front": "¾ front",
    "threequarter_back": "¾ back",
    "top": "Top / high angle",
}

CLEAN_PLATE = (
    "Pure solid black background only (#000000). Isolated subject on a clean plate — "
    "no environment, no floor, no props, no other people, no text, no logo. "
    "Clean silhouette, fully visible for the target angle."
)

WARDROBE_M = (
    "minimal form-fit neutral crew-neck tee and fitted trousers, simple shoes, "
    "no logos, no accessories"
)
WARDROBE_F = (
    "minimal form-fit neutral tank and fitted trousers, simple shoes, "
    "no logos, no accessories"
)

PROFILE_VIEWS: dict[str, str] = {
    "front": (
        "Full-body head-to-toe front view, entire figure visible including feet, "
        "standing straight, neutral pose, arms relaxed at sides, facing the camera, "
        "subject centered, no crop at head or feet"
    ),
    "side": (
        "Full-body head-to-toe clear side profile view, entire figure visible including "
        "feet, standing straight, neutral pose, arms relaxed, clean silhouette, "
        "subject centered, no crop at head or feet"
    ),
    "closeup": (
        "Face close-up portrait, shoulders up, sharp facial features, "
        "match identity from the references, subject correctly framed"
    ),
    "back": (
        "full-body head-to-toe back view, entire figure visible including feet, "
        "standing straight, neutral pose, arms relaxed, facing away from camera"
    ),
    "threequarter_front": (
        "full-body head-to-toe three-quarter front view (about 45°), entire figure "
        "visible including feet, standing straight, neutral pose"
    ),
    "threequarter_back": (
        "full-body head-to-toe three-quarter back view (about 45° from behind), "
        "entire figure visible including feet, standing straight, neutral pose"
    ),
    "top": (
        "high-angle / slight top-down view of the same person, head fully visible, "
        "neutral pose"
    ),
}

CHAR_AGES = ("20s", "30s", "40s", "50s", "60+")
CHAR_BUILDS = ("slim", "average", "athletic", "heavy")
CHAR_HAIR = (
    "black short",
    "dark brown short",
    "brown medium",
    "blonde long",
    "red wavy",
    "gray short",
    "bald",
)
SCENE_SETTINGS = ("interior", "exterior")
SCENE_TIMES = ("dawn", "day", "golden hour", "dusk", "night")
SCENE_MOODS = ("calm", "tense", "romantic", "gritty", "luxurious", "playful")
PROP_TYPES = ("object", "handheld", "furniture", "vehicle", "food", "other")
PROP_MATERIALS = ("metal", "wood", "plastic", "glass", "fabric", "ceramic", "mixed")


def default_wardrobe(gender: str) -> str:
    g = (gender or "").strip().lower()
    if g.startswith("f"):
        return WARDROBE_F
    return WARDROBE_M


def builder_fields(kind: str) -> dict[str, Any]:
    k = (kind or "character").strip().lower()
    if k == "scene":
        return {
            "ok": True,
            "kind": "scene",
            "fields": {
                "setting": {"label": "Setting", "choices": list(SCENE_SETTINGS)},
                "time": {"label": "Time of day", "choices": list(SCENE_TIMES)},
                "mood": {"label": "Mood", "choices": list(SCENE_MOODS)},
                "elements": {"label": "Key elements", "type": "text"},
                "notes": {"label": "Notes", "type": "text"},
            },
        }
    if k == "prop":
        return {
            "ok": True,
            "kind": "prop",
            "fields": {
                "ptype": {"label": "Type", "choices": list(PROP_TYPES)},
                "material": {"label": "Material", "choices": list(PROP_MATERIALS)},
                "color": {"label": "Color", "type": "text"},
                "notes": {"label": "Notes", "type": "text"},
            },
        }
    return {
        "ok": True,
        "kind": "character",
        "slots": [{"id": s, "label": SLOT_LABELS[s], "core": s in CORE_SLOTS} for s in ALL_SLOTS],
        "fields": {
            "gender": {"label": "Gender", "choices": ["Male", "Female"]},
            "age": {"label": "Age", "choices": list(CHAR_AGES)},
            "build": {"label": "Build", "choices": list(CHAR_BUILDS)},
            "hair": {"label": "Hair", "choices": list(CHAR_HAIR)},
            "face": {"label": "Face notes", "type": "text"},
            "wardrobe": {"label": "Wardrobe override", "type": "text"},
            "notes": {"label": "Notes", "type": "text"},
        },
        "wardrobe_defaults": {"Male": WARDROBE_M, "Female": WARDROBE_F},
    }


def _nv(v: Any) -> str:
    return str(v or "").strip()


def character_brief(fields: dict[str, Any] | None, *, costume: bool = False) -> str:
    f = fields or {}
    parts: list[str] = []
    gender = _nv(f.get("gender"))
    age = _nv(f.get("age"))
    if gender and age:
        parts.append(f"{gender.lower()} in their {age}")
    elif gender:
        parts.append(gender.lower())
    elif age:
        parts.append(f"adult in their {age}")
    build = _nv(f.get("build"))
    if build:
        parts.append(f"{build} build")
    hair = _nv(f.get("hair"))
    if hair:
        parts.append(f"hair: {hair}")
    face = _nv(f.get("face"))
    if face:
        parts.append(f"face: {face}")
    if not costume:
        wardrobe = _nv(f.get("wardrobe")) or default_wardrobe(gender)
        parts.append(f"wardrobe: {wardrobe}")
    notes = _nv(f.get("notes"))
    head = ", ".join(parts)
    if head and notes:
        return f"{head}. {notes}"
    return notes or head or "photoreal adult person"


def compile_wardrobe(
    *,
    top: str = "",
    bottom: str = "",
    footwear: str = "",
    extras: str = "",
    free: str = "",
) -> str:
    bits: list[str] = []
    if _nv(top):
        bits.append(f"top: {_nv(top)}")
    if _nv(bottom):
        bits.append(f"bottom: {_nv(bottom)}")
    if _nv(footwear):
        bits.append(f"footwear: {_nv(footwear)}")
    if _nv(extras):
        bits.append(_nv(extras))
    if _nv(free):
        bits.append(_nv(free))
    return ". ".join(bits)


def character_front_prompt(fields: dict[str, Any] | None, extra: str = "") -> str:
    desc = character_brief(fields)
    view = PROFILE_VIEWS["front"]
    bits = [
        f"Photoreal character reference still of: {desc}.",
        f"Framing: {view}.",
        "Single subject only, head unobstructed, natural expression.",
        "Entire figure visible head to toe including feet; no crop; subject centered.",
        CLEAN_PLATE,
    ]
    if _nv(extra):
        bits.append(_nv(extra))
    return " ".join(bits)


def character_angle_prompt(
    slot: str,
    fields: dict[str, Any] | None,
    extra: str = "",
) -> str:
    key = slot if slot in PROFILE_VIEWS else "front"
    view = PROFILE_VIEWS[key]
    desc = character_brief(fields)
    if key == "closeup":
        body = (
            "Same person as the reference image(s). "
            f"Generate a character-reference still: {view}. "
            "Preserve face, proportions, hair, skin tone, age, and lighting "
            "from the reference stills. Do not invent a different person. "
            "Head unobstructed. "
            + CLEAN_PLATE
        )
    else:
        body = (
            "Same person as the reference image(s). "
            f"Generate a character-reference still: {view}. "
            "Match face and identity from the reference image(s) exactly. "
            "Keep wardrobe, body proportions, and lighting. "
            "Do not invent a different person. "
            + CLEAN_PLATE
        )
    if desc:
        body += f" Subject description guide: {desc}."
    if _nv(extra):
        body += f" {_nv(extra)}"
    return body


def costume_prompt(slot: str, outfit: str, extra: str = "") -> str:
    key = slot if slot in PROFILE_VIEWS else "front"
    view = PROFILE_VIEWS[key]
    outfit_s = _nv(outfit) or "the costume described by the reference"
    lock = (
        " Same outfit as the costume reference(s). Match color, cut, fabric, details exactly."
        if key != "front"
        else ""
    )
    return (
        "Keep the same person identity, face, hair, age, skin tone, and body "
        "proportions from the reference images. Do not change who they are. "
        f"Change only the wardrobe / outfit / clothing to: {outfit_s}.{lock} "
        f"Generate a character-reference still: {view}. "
        + CLEAN_PLATE
        + (f" {_nv(extra)}" if _nv(extra) else "")
    )


def scene_prompt(fields: dict[str, Any] | None, *, detail: bool = False) -> str:
    f = fields or {}
    name = _nv(f.get("name")) or "the location"
    setting = _nv(f.get("setting"))
    time = _nv(f.get("time"))
    mood = _nv(f.get("mood"))
    elements = _nv(f.get("elements"))
    notes = _nv(f.get("notes"))
    bits = [f"Establishing still of {name}."]
    if setting:
        bits.append(f"{setting.capitalize()} location.")
    if time:
        bits.append(f"Time of day: {time}.")
    if mood:
        bits.append(f"Mood: {mood}.")
    if elements:
        bits.append(f"Key elements: {elements}.")
    if detail:
        bits.append("Closer detail angle of the same space, matching lighting and architecture.")
    else:
        bits.append("Wide hero view so we know the space.")
    bits.append("Empty of prominent people. Photoreal. No text, no logo, no watermark.")
    if notes:
        bits.append(notes)
    return " ".join(bits)


def prop_prompt(fields: dict[str, Any] | None) -> str:
    f = fields or {}
    name = _nv(f.get("name")) or "the object"
    ptype = _nv(f.get("ptype") or f.get("type"))
    material = _nv(f.get("material"))
    color = _nv(f.get("color"))
    notes = _nv(f.get("notes"))
    bits = [f"Product-style still of {name}."]
    if ptype:
        bits.append(f"Type: {ptype}.")
    look = " ".join(x for x in (color, material) if x)
    if look:
        bits.append(f"{look}.")
    bits.append(
        "Isolated on a clean neutral studio background, even lighting, "
        "no people, no text, no logo, no watermark."
    )
    if notes:
        bits.append(notes)
    return " ".join(bits)


def _identity_refs(row: dict[str, Any], parent: dict[str, Any] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def add(path: str) -> None:
        p = (path or "").strip()
        if not p:
            return
        try:
            key = str(Path(p).resolve())
        except OSError:
            key = p
        if key.lower() in seen or not Path(p).is_file():
            return
        seen.add(key.lower())
        out.append(p)

    ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
    parent_ident = (
        parent.get("identity") if parent and isinstance(parent.get("identity"), dict) else {}
    )
    for slot in CORE_SLOTS:
        add(str(ident.get(slot) or ""))
    if not out:
        add(primary_still_path(row))
    if parent:
        for slot in CORE_SLOTS:
            add(str(parent_ident.get(slot) or ""))
        if len(out) == 0:
            add(primary_still_path(parent))
    return out


def _pick_result_still(result: Any) -> str:
    paths = list(getattr(result, "image_paths", None) or []) + list(
        getattr(result, "paths", None) or []
    )
    for p in paths:
        if p and Path(p).is_file() and Path(p).suffix.lower() in {
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
        }:
            return str(p)
    return ""


def compose_angle_prompt(
    *,
    kind: str,
    slot: str,
    fields: dict[str, Any] | None,
    name: str = "",
    is_costume: bool = False,
    wardrobe: str = "",
    extra: str = "",
) -> str:
    key = (slot or "front").strip().lower()
    merged = {**(fields or {}), "name": name or (fields or {}).get("name") or ""}
    if kind == "scene":
        return scene_prompt(merged, detail=key != "front")
    if kind == "prop":
        return prop_prompt(merged)
    if is_costume:
        return costume_prompt(key, wardrobe or _nv((fields or {}).get("wardrobe")), extra)
    if key == "front":
        return character_front_prompt(fields, extra)
    return character_angle_prompt(key, fields, extra)


def _usd_from_label(label: str) -> float:
    import re

    match = re.search(r"\$([0-9]+(?:\.[0-9]+)?)", label or "")
    return float(match.group(1)) if match else 0.0


def estimate_sheet_cost(
    *,
    kind: str = "character",
    t2i_model_id: str = "",
    r2i_model_id: str = "",
    slots: list[str] | None = None,
) -> dict[str, Any]:
    """Sum catalog estimates for the selected models × still count."""
    from app.create import estimate_create_cost
    from app.create_catalog import default_model_for
    from app.create_state import CreateState

    want = (kind or "character").strip().lower()
    planned = [s for s in (slots or list(CORE_SLOTS)) if s]
    if not planned:
        planned = ["front"]
    angles: list[dict[str, Any]] = []
    total = 0.0
    for i, slot in enumerate(planned):
        first = i == 0 or slot == "front"
        if want == "costume":
            modality = "r2i"
            mid = (r2i_model_id or t2i_model_id).strip()
        elif first:
            modality = "t2i"
            mid = (t2i_model_id or "").strip()
        elif want == "character":
            modality = "r2i"
            mid = (r2i_model_id or t2i_model_id).strip()
        else:
            modality = "i2i"
            mid = (r2i_model_id or t2i_model_id).strip()
        if not mid:
            fallback = default_model_for("image", modality)
            mid = fallback.id if fallback else ""
        if not mid:
            label = "Est. cost: —"
            usd = 0.0
        else:
            label = estimate_create_cost(
                CreateState(mode="image", modality=modality, model_id=mid, prompt="sheet")
            )
            usd = _usd_from_label(label)
        total += usd
        angles.append(
            {
                "slot": slot,
                "modality": modality,
                "model_id": mid,
                "cost": label,
                "usd": usd,
            }
        )
    n = len(planned)
    unit = "1 still" if n == 1 else f"{n} stills"
    cost = f"Est. cost: ${total:.2f} · {unit}" if total else "Est. cost: —"
    return {"ok": True, "cost": cost, "usd": total, "count": n, "angles": angles}


def generate_angle(
    *,
    asset_id: str,
    slot: str,
    model_id: str = "",
    extra: str = "",
    costume_ref: str = "",
    wardrobe: str = "",
    prompt: str = "",
    source_still: str = "",
) -> dict[str, Any]:
    from app.config import OUTPUT_DIR
    from app.create import generate
    from app.create_catalog import default_model_for, resolve_model
    from app.create_state import CreateParams, CreateSlots, CreateState

    key = (slot or "front").strip().lower()
    if key not in ALL_SLOTS:
        raise ValueError(f"Unknown sheet slot: {slot}")
    row = get_asset(asset_id)
    if not row:
        raise ValueError("Asset not found.")
    kind = str(row.get("kind") or "character")
    fields = row.get("fields") if isinstance(row.get("fields"), dict) else {}
    parent = get_asset(str(row.get("parent_id") or "")) if row.get("parent_id") else None
    is_costume = bool(row.get("parent_id"))
    outfit = _nv(wardrobe) or _nv(fields.get("wardrobe"))

    refs: list[str] = []
    prior = _nv(source_still)
    if prior and Path(prior).is_file():
        refs.append(prior)
    cref = _nv(costume_ref)
    if cref and Path(cref).is_file() and cref not in refs:
        refs.append(cref)
    for path in _identity_refs(row, parent):
        if path not in refs:
            refs.append(path)

    text = _nv(prompt) or compose_angle_prompt(
        kind=kind,
        slot=key,
        fields=fields,
        name=str(row.get("name") or ""),
        is_costume=is_costume,
        wardrobe=outfit,
        extra=extra,
    )

    modality = "t2i"
    if refs:
        modality = "r2i" if kind == "character" else "i2i"
    mid = _nv(model_id)
    entry = resolve_model(mid, mode="image", modality=modality) if mid else None
    if entry is None or (modality not in (entry.modalities or ())):
        fallback = default_model_for("image", modality)
        mid = fallback.id if fallback else mid
        entry = resolve_model(mid, mode="image", modality=modality) if mid else None
    if not mid:
        raise ValueError(f"No {modality} model available for this sheet angle.")

    start = refs[0] if refs else None
    extras = refs[1:] if len(refs) > 1 else []
    state = CreateState(
        mode="image",
        modality=modality,  # type: ignore[arg-type]
        model_id=mid,
        prompt=text,
        slots=CreateSlots(start_still=start, ref_images=extras),
        params=CreateParams(),
        surface="studio",
        output_dir=OUTPUT_DIR,
    )
    result = generate(state)
    if not result.ok:
        raise RuntimeError(
            (result.status or "")
            or (result.errors[0] if result.errors else "Generate failed.")
        )
    still = _pick_result_still(result)
    if not still:
        raise RuntimeError("Generate returned no still.")
    pub = attach_identity_still(
        asset_id,
        key,
        still,
        model=result.model_key or result.model or mid,
    )
    pub["angle"] = key
    pub["modality"] = modality
    pub["model_used"] = mid
    pub["prompt"] = text
    return pub
