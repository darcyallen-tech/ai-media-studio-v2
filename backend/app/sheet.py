"""Character / Scene / Prop sheet prompts and one-angle generate."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app.assets import (
    attach_identity_still,
    get_asset,
)

CORE_SLOTS: tuple[str, ...] = ("front", "side", "closeup")
EXTRA_SLOTS: tuple[str, ...] = (
    "back",
    "threequarter_front",
    "threequarter_back",
    "top",
)
SCENE_SLOTS: tuple[str, ...] = (
    "hero",
    "opposite",
    "feature",
    "detail",
    "overview",
)
SHEET_SLOT = "sheet"
ALL_SLOTS: tuple[str, ...] = CORE_SLOTS + EXTRA_SLOTS + SCENE_SLOTS + (SHEET_SLOT,)

SLOT_LABELS: dict[str, str] = {
    "front": "Front (full body)",
    "side": "Side (full body)",
    "closeup": "Close-up (detail)",
    "back": "Back (full body)",
    "threequarter_front": "¾ front",
    "threequarter_back": "¾ back",
    "top": "Top / high angle",
    "sheet": "Costume sheet",
    "hero": "Hero (walk-in wide)",
    "opposite": "Opposite",
    "feature": "Feature",
    "detail": "Detail",
    "overview": "Overview",
}

SCENE_SLOT_LABELS: dict[str, str] = {
    "hero": "Hero (walk-in wide)",
    "opposite": "Opposite",
    "feature": "Feature",
    "detail": "Detail",
    "overview": "Overview",
    "sheet": "Scene sheet",
}

SCENE_PHOTOREAL_LOCK = (
    "photoreal photograph, real materials and daylight/practicals, "
    "not concept art, not matte painting, not illustration."
)


def _photoreal_on(fields: dict[str, Any] | None) -> bool:
    raw = str((fields or {}).get("photoreal") or "on").strip().lower()
    return raw not in ("off", "0", "false", "no")


def strip_scene_photoreal(text: str) -> str:
    """Remove every copy of the photo lock so it can be appended once."""
    t = text or ""
    t = re.sub(
        r"photoreal photograph,\s*real materials and daylight/practicals,\s*"
        r"not concept art,\s*not matte painting,\s*not illustration\.?",
        "",
        t,
        flags=re.I,
    )
    t = re.sub(
        r"photoreal photograph,\s*real materials and daylight/practicals\.?",
        "",
        t,
        flags=re.I,
    )
    t = re.sub(
        r"not concept art,\s*not matte painting,\s*not illustration\.?",
        "",
        t,
        flags=re.I,
    )
    t = re.sub(r"\bnot(?:\s*,\s*not)+\b", "not", t, flags=re.I)
    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r"\s+([,.;])", r"\1", t)
    return t.strip(" ,.;")


def ensure_scene_photoreal(text: str, force: bool = False) -> str:
    t = strip_scene_photoreal(text)
    if not force and not t:
        return t
    blob = f"{text or ''} {t}".lower()
    wants = force or any(
        tok in blob
        for tok in (
            "photoreal",
            "photo real",
            "photo-real",
            "photograph",
            "photo realistic",
        )
    )
    if not wants:
        return t
    return f"{t} {SCENE_PHOTOREAL_LOCK}" if t else SCENE_PHOTOREAL_LOCK


_SCENE_STYLE_BANNED = (
    "god rays",
    "god-rays",
    "godrays",
    "concept-art",
    "concept art",
    "matte painting",
    "painterly",
    "cinematic",
    "volumetric",
    "illustration",
)


def strip_scene_enhance_style(_original: str, rewritten: str) -> str:
    """Drop cinematic/painterly/volumetric/concept-art/god rays even if they were in Notes."""
    out = rewritten or ""
    for phrase in _SCENE_STYLE_BANNED:
        pat = re.compile(r"\b" + re.escape(phrase).replace(r"\ ", r"\s+") + r"\b", re.I)
        out = pat.sub("", out)
    return re.sub(r"\s{2,}", " ", out).replace(" ,", ",").strip(" ,.;")

SCENE_VIEWS: dict[str, str] = {
    "hero": "Walk-in wide of the space — enter the location as a visitor would.",
    "opposite": (
        "Same town, same day, same architecture. Camera is now at the FAR END "
        "of the square, 180 degrees from the hero still. We look BACK toward "
        "the hero camera position. The fountain/center landmark must change "
        "place in frame (if it was mid-ground center, it is now closer or "
        "offset). Do not repeat the hero composition."
    ),
    "feature": (
        "Same space. 3/4 view of the hero landmark (fountain / inn / gate). "
        "Camera off the center axis, still chest height. Do not regenerate "
        "the wide establishing."
    ),
    "detail": (
        "Tight photograph of one real surface in this scene (stone, timber, "
        "stall, fountain basin). No new wide street."
    ),
    "overview": (
        "Unlabeled isometric or high top-down of THIS square only. "
        "No compass letters, no map labels."
    ),
}
SCENE_EXTRA_CAMERA_GUARD = "Do not copy the source camera angle."

CLEAN_PLATE = (
    "Pure solid black background only (#000000). Isolated subject on a clean plate — "
    "no environment, no floor, no props, no other people, no text, no logo. "
    "Clean silhouette, fully visible for the target angle."
)

WARDROBE_M = (
    "simple neutral athletic wear, non-revealing, studio character reference"
)
WARDROBE_F = (
    "simple neutral athletic wear, non-revealing, studio character reference"
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
        "direct overhead / top-down, camera above the crown, "
        "subject does not look up at camera, full body visible including head and feet, "
        "subject centered, no three-quarter tilt"
    ),
}

CHAR_AGES = ("20s", "30s", "40s", "50s", "60+")
CHAR_HAIR_LENGTH = ("bald", "buzz", "short", "medium", "long", "very long")
CHAR_HAIR_STYLE = (
    "straight",
    "wavy",
    "curly",
    "coily",
    "pulled back",
    "bun",
    "ponytail",
    "cropped",
)
CHAR_HAIR_COLOR = (
    "black",
    "dark brown",
    "brown",
    "auburn",
    "blonde",
    "red",
    "gray",
    "white",
)
CHAR_FACIAL_HAIR = (
    "none",
    "stubble",
    "short beard",
    "full beard",
    "mustache",
    "goatee",
)
CHAR_EYES = ("brown", "dark brown", "hazel", "green", "blue", "gray", "amber")
CHAR_SKIN = ("fair", "light", "medium", "olive", "tan", "brown", "deep")
CHAR_HEIGHT = ("short", "average", "tall", "5'4\"", "5'8\"", "6'0\"", "6'2\"")
CHAR_WEIGHT = ("slim", "average", "athletic", "heavy", "stocky")
CHAR_BODY = (
    "lean",
    "average",
    "muscular",
    "curvy",
    "lanky",
    "hourglass",
    "rectangle",
)
CHAR_FACE = ("oval", "round", "square", "heart", "diamond", "oblong")
CHAR_NOSE = ("straight", "button", "roman", "wide", "narrow", "upturned")
CHAR_JAW = ("soft", "defined", "square", "rounded", "pointed", "cleft")
CHAR_BODY_HAIR = ("none", "light", "medium", "heavy")
CHAR_BUST = ("small", "medium", "large")
SCENE_SETTINGS = ("interior", "exterior", "mixed")
SCENE_THEMES = (
    "contemporary",
    "noir",
    "fantasy",
    "sci-fi",
    "western",
    "historical",
    "horror",
    "coastal",
)
SCENE_LOCATIONS = (
    "bar",
    "nightclub",
    "diner",
    "street",
    "alley",
    "apartment",
    "kitchen",
    "office",
    "lobby",
    "hotel",
    "warehouse",
    "garage",
    "studio",
    "library",
    "hospital",
    "rooftop",
    "subway",
    "marketplace",
    "park",
    "forest",
    "beach",
    "cabin",
    "castle",
    "temple",
    "church",
)
SCENE_TIMES = ("dawn", "day", "golden hour", "dusk", "night")
SCENE_WEATHER = ("clear", "overcast", "rain", "fog", "snow", "storm", "wind")
SCENE_MOODS = (
    "calm",
    "tense",
    "romantic",
    "gritty",
    "luxurious",
    "playful",
    "ominous",
    "melancholic",
    "energetic",
    "sterile",
    "cozy",
    "chaotic",
    "mysterious",
    "nostalgic",
)
SCENE_ARCHITECTURE = (
    "modern",
    "industrial",
    "victorian",
    "brutalist",
    "timber",
    "stone",
    "neon",
    "art deco",
    "gothic",
    "mid-century",
    "colonial",
    "glass curtain",
    "brick",
    "adobe",
)
SCENE_LIGHTING = (
    "practical",
    "neon",
    "candle",
    "moonlight",
    "fluorescent",
    "cinematic",
    "window light",
    "tungsten",
    "streetlamp",
    "firelight",
    "overcast daylight",
    "sodium vapor",
    "RGB accent",
)
SCENE_CAMERA = (
    "wide establishing",
    "eye-level",
    "low angle",
    "high angle",
    "handheld",
    "locked-off still",
    "medium shot",
    "close-up",
    "dutch angle",
    "aerial",
    "over-the-shoulder",
    "anamorphic wide",
)
SCENE_GRADES = (
    "natural",
    "warm tungsten",
    "cool moonlight",
    "teal-orange",
    "bleach bypass",
    "neon night",
    "faded film",
)
PROP_TYPES = (
    "object",
    "handheld",
    "furniture",
    "vehicle",
    "food",
    "tool",
    "weapon",
    "other",
)
PROP_MATERIALS = (
    "metal",
    "wood",
    "plastic",
    "glass",
    "fabric",
    "ceramic",
    "leather",
    "mixed",
)
PROP_SCALES = ("miniature", "handheld", "tabletop", "life-size", "oversized")
PROP_CONDITIONS = ("pristine", "new", "worn", "rusty", "broken")
PROP_THEMES = ("everyday", "fantasy", "military", "industrial", "luxury", "ancient")
PROP_VIEWS = ("hero three-quarter", "front", "side", "top-down", "detail")
COSTUME_TAGS = (
    "everyday",
    "hero",
    "era",
    "fantasy",
    "formal",
    "sport",
    "workwear",
    "armor",
    "ceremonial",
)
COSTUME_GENDERS = ("Male", "Female")
COSTUME_ERAS = (
    "contemporary",
    "1920s",
    "1940s",
    "1960s",
    "1980s",
    "medieval",
    "victorian",
    "ancient",
    "far future",
)
COSTUME_REGIONS = (
    "western",
    "east asian",
    "south asian",
    "middle eastern",
    "african",
    "nordic",
    "generic studio",
)
COSTUME_SILHOUETTES = (
    "slim",
    "tailored",
    "bulky armor",
    "flowing",
    "layered",
    "utilitarian",
)
COSTUME_MATERIALS = (
    "cotton",
    "linen",
    "wool",
    "silk",
    "leather",
    "denim",
    "velvet",
    "canvas",
    "metal plate",
    "chainmail",
    "rubber",
)
COSTUME_COLORS = (
    "black",
    "white",
    "red",
    "blue",
    "green",
    "gold",
    "silver",
    "brown",
    "crimson",
    "steel",
)
COSTUME_FITS = ("fitted", "tailored", "loose", "oversized", "layered")
COSTUME_CONDITIONS = ("pristine", "new", "worn", "weathered", "battle-damaged")
COSTUME_LAYERS: tuple[str, ...] = (
    "top",
    "bottom",
    "footwear",
    "over",
    "head",
    "hands",
    "accessories",
)
COSTUME_SLOTS: tuple[str, ...] = ("front", "side", "back")


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
                "theme": {"label": "Theme", "choices": list(SCENE_THEMES)},
                "location": {"label": "Location type", "choices": list(SCENE_LOCATIONS)},
                "setting": {"label": "Interior / exterior", "choices": list(SCENE_SETTINGS)},
                "time": {"label": "Time of day", "choices": list(SCENE_TIMES)},
                "weather": {"label": "Weather", "choices": list(SCENE_WEATHER)},
                "mood": {"label": "Mood", "choices": list(SCENE_MOODS)},
                "architecture": {"label": "Architecture", "choices": list(SCENE_ARCHITECTURE)},
                "lighting": {"label": "Lighting", "choices": list(SCENE_LIGHTING)},
                "camera": {"label": "Camera feel", "choices": list(SCENE_CAMERA)},
                "elements": {"label": "Key elements", "type": "text"},
                "furniture": {"label": "Furniture / fixtures", "type": "text"},
                "grade": {"label": "Color grade", "choices": list(SCENE_GRADES)},
                "notes": {"label": "Notes", "type": "text"},
            },
        }
    if k == "prop":
        return {
            "ok": True,
            "kind": "prop",
            "fields": {
                "theme": {"label": "Theme", "choices": list(PROP_THEMES)},
                "ptype": {"label": "Type", "choices": list(PROP_TYPES)},
                "view": {"label": "View", "choices": list(PROP_VIEWS)},
                "material": {"label": "Material", "choices": list(PROP_MATERIALS)},
                "color": {"label": "Color", "type": "text"},
                "scale": {"label": "Scale", "choices": list(PROP_SCALES)},
                "condition": {"label": "Condition", "choices": list(PROP_CONDITIONS)},
                "notes": {"label": "Notes", "type": "text"},
            },
        }
    if k == "costume":
        layer_fields: dict[str, Any] = {}
        stacked = list(COSTUME_LAYERS) + [f"top_{i}" for i in range(2, 6)]
        for layer in stacked:
            if layer == "over":
                continue
            title = "Body layer 1" if layer == "top" else (
                f"Body layer {layer.split('_')[1]}" if layer.startswith("top_") else layer.title()
            )
            layer_fields[layer] = {"label": title, "type": "text"}
            layer_fields[f"{layer}_material"] = {
                "label": f"{title} material",
                "choices": list(COSTUME_MATERIALS),
            }
            layer_fields[f"{layer}_color"] = {
                "label": f"{title} color",
                "choices": list(COSTUME_COLORS),
            }
            layer_fields[f"{layer}_fit"] = {
                "label": f"{title} fit",
                "choices": list(COSTUME_FITS),
            }
            layer_fields[f"{layer}_condition"] = {
                "label": f"{title} condition",
                "choices": list(COSTUME_CONDITIONS),
            }
        return {
            "ok": True,
            "kind": "costume",
            "slots": [
                {"id": s, "label": SLOT_LABELS.get(s, s), "core": True}
                for s in COSTUME_SLOTS
            ],
            "fields": {
                "gender": {"label": "Gender", "choices": list(COSTUME_GENDERS)},
                "category": {"label": "Category", "choices": list(COSTUME_TAGS)},
                "era": {"label": "Era", "choices": list(COSTUME_ERAS)},
                "region": {"label": "Region", "choices": list(COSTUME_REGIONS)},
                "silhouette": {"label": "Hero silhouette", "choices": list(COSTUME_SILHOUETTES)},
                "palette": {"label": "Hero palette", "type": "text"},
                "signature": {"label": "Signature piece", "type": "text"},
                "emblem": {"label": "Emblem", "type": "text"},
                "wardrobe": {"label": "Outfit", "type": "text"},
                "notes": {"label": "Notes", "type": "text"},
                **layer_fields,
            },
        }
    return {
        "ok": True,
        "kind": "character",
        "slots": [{"id": s, "label": SLOT_LABELS[s], "core": s in CORE_SLOTS} for s in ALL_SLOTS],
        "fields": {
            "gender": {"label": "Gender", "choices": ["Male", "Female"]},
            "age": {"label": "Age", "choices": list(CHAR_AGES)},
            "hair_length": {"label": "Hair length", "choices": list(CHAR_HAIR_LENGTH)},
            "hair_style": {"label": "Hair style", "choices": list(CHAR_HAIR_STYLE)},
            "hair_color": {"label": "Hair color", "choices": list(CHAR_HAIR_COLOR)},
            "facial_hair": {"label": "Facial hair", "choices": list(CHAR_FACIAL_HAIR)},
            "body_hair": {"label": "Body hair", "choices": list(CHAR_BODY_HAIR)},
            "bust": {"label": "Bust size", "choices": list(CHAR_BUST)},
            "eye_color": {"label": "Eye color", "choices": list(CHAR_EYES)},
            "skin": {"label": "Skin tone", "choices": list(CHAR_SKIN)},
            "height": {"label": "Height", "choices": list(CHAR_HEIGHT)},
            "weight": {"label": "Weight / build", "choices": list(CHAR_WEIGHT)},
            "body": {"label": "Body type", "choices": list(CHAR_BODY)},
            "face_shape": {"label": "Face shape", "choices": list(CHAR_FACE)},
            "nose": {"label": "Nose", "choices": list(CHAR_NOSE)},
            "jaw": {"label": "Jaw / chin", "choices": list(CHAR_JAW)},
            "wardrobe": {"label": "Wardrobe override", "type": "text"},
            "notes": {"label": "Notes", "type": "text"},
        },
        "wardrobe_defaults": {"Male": WARDROBE_M, "Female": WARDROBE_F},
    }


def _nv(v: Any) -> str:
    return str(v or "").strip()


def _choice(fields: dict[str, Any], key: str) -> str:
    raw = _nv(fields.get(key))
    if raw.lower() == "custom":
        return _nv(fields.get(f"{key}_custom"))
    if raw.lower() in ("", "—", "-", "skip"):
        return ""
    return raw


def character_brief(fields: dict[str, Any] | None, *, costume: bool = False) -> str:
    f = fields or {}
    override = _nv(f.get("identity_prompt"))
    if override:
        return override
    parts: list[str] = []
    gender = _choice(f, "gender")
    age = _choice(f, "age")
    if gender and age:
        parts.append(f"{gender.lower()} in their {age}")
    elif gender:
        parts.append(gender.lower())
    elif age:
        parts.append(f"adult in their {age}")
    height = _choice(f, "height")
    if height:
        parts.append(f"height: {height}")
    weight = _choice(f, "weight") or _choice(f, "build")
    if weight:
        parts.append(f"build: {weight}")
    body = _choice(f, "body")
    if body:
        parts.append(f"body type: {body}")
    hair_bits = [
        x
        for x in (
            _choice(f, "hair_length"),
            _choice(f, "hair_style"),
            _choice(f, "hair_color"),
        )
        if x
    ]
    if not hair_bits and _choice(f, "hair"):
        hair_bits = [_choice(f, "hair")]
    if hair_bits:
        parts.append("hair: " + ", ".join(hair_bits))
    facial = _choice(f, "facial_hair")
    if facial:
        if facial.lower() == "none":
            parts.append("clean-shaven, no facial hair")
        else:
            parts.append(f"facial hair: {facial}")
    body_hair = _choice(f, "body_hair")
    if body_hair:
        if body_hair.lower() == "none":
            parts.append("no body hair")
        else:
            parts.append(f"body hair: {body_hair}")
    bust = _choice(f, "bust")
    if bust:
        parts.append(f"bust: {bust}")
    eyes = _choice(f, "eye_color")
    if eyes:
        parts.append(f"eyes: {eyes}")
    skin = _choice(f, "skin")
    if skin:
        parts.append(f"skin tone: {skin}")
    face_shape = _choice(f, "face_shape")
    if face_shape:
        parts.append(f"face shape: {face_shape}")
    nose = _choice(f, "nose")
    if nose:
        parts.append(f"nose: {nose}")
    jaw = _choice(f, "jaw")
    if jaw:
        parts.append(f"jaw/chin: {jaw}")
    face = _choice(f, "face")
    if face:
        parts.append(f"face notes: {face}")
    if not costume:
        wardrobe = _nv(f.get("wardrobe")) or default_wardrobe(gender)
        parts.append(f"wardrobe: {wardrobe}")
    head = "; ".join(parts)
    return head or "photoreal adult person"


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


def costume_brief(fields: dict[str, Any] | None) -> str:
    f = fields or {}
    override = _nv(f.get("wardrobe")) or _nv(f.get("identity_prompt"))
    if override:
        return override
    parts: list[str] = []
    cat = _choice(f, "category") or _choice(f, "tag")
    if cat:
        parts.append(f"{cat} costume")
    gender = _choice(f, "gender").lower()
    if gender.startswith("f"):
        parts.append("cut/fit: female figure, defined waist, feminine drape")
    elif gender.startswith("m"):
        parts.append("cut/fit: male figure, broader shoulder, straighter hang")
    era = _choice(f, "era")
    if era:
        parts.append(f"era: {era}")
    region = _choice(f, "region")
    if region:
        parts.append(f"region: {region}")
    sil = _choice(f, "silhouette")
    if sil:
        parts.append(f"silhouette: {sil}")
    pal = _nv(f.get("palette"))
    if pal:
        parts.append(f"palette: {pal}")
    sig = _nv(f.get("signature"))
    if sig:
        parts.append(f"signature piece: {sig}")
    emblem = _nv(f.get("emblem"))
    if emblem:
        parts.append(f"emblem: {emblem}")
    body_stack: list[str] = []
    for i in range(1, 6):
        prefix = "top" if i == 1 else f"top_{i}"
        item = _choice(f, prefix) or _nv(f.get(prefix))
        if not item:
            continue
        bits = [item]
        col = _choice(f, f"{prefix}_color") or _nv(f.get(f"{prefix}_color"))
        mat = _choice(f, f"{prefix}_material") or _nv(f.get(f"{prefix}_material"))
        fit = _choice(f, f"{prefix}_fit") or _nv(f.get(f"{prefix}_fit"))
        cond = _choice(f, f"{prefix}_condition") or _nv(f.get(f"{prefix}_condition"))
        if col:
            bits.append(col)
        if mat:
            bits.append(mat)
        if fit:
            bits.append(f"{fit} fit")
        if cond:
            bits.append(cond)
        body_stack.append(", ".join(bits))
    if body_stack:
        parts.append("body layers (innermost first): " + " → ".join(body_stack))
    for layer in COSTUME_LAYERS:
        if layer in ("top", "over"):
            continue
        item = _choice(f, layer) or _nv(f.get(layer))
        if not item:
            continue
        bits = [item]
        col = _choice(f, f"{layer}_color") or _nv(f.get(f"{layer}_color"))
        mat = _choice(f, f"{layer}_material") or _nv(f.get(f"{layer}_material"))
        fit = _choice(f, f"{layer}_fit") or _nv(f.get(f"{layer}_fit"))
        cond = _choice(f, f"{layer}_condition") or _nv(f.get(f"{layer}_condition"))
        if col:
            bits.append(col)
        if mat:
            bits.append(mat)
        if fit:
            bits.append(f"{fit} fit")
        if cond:
            bits.append(cond)
        parts.append(f"{layer}: {', '.join(bits)}")
    head = "; ".join(parts)
    extra = _nv(f.get("notes"))
    if extra:
        head = f"{head}. Extra: {extra}" if head else extra
    return head


SHEET_NO_GARBLED = (
    "No gibberish text, no watermarks, no logos, no random letters or captions."
)


def costume_sheet_prompt(outfit: str, extra: str = "") -> str:
    outfit_s = _nv(outfit) or "the described costume"
    body = (
        f"Single costume reference SHEET of: {outfit_s}. One image only. "
        "Build the sheet from the attached costume angle stills: faceless mannequin "
        "Front, Side, and Back (full-body) plus detail callouts of fabric, trim, "
        "closures, and any emblem, and a small color-palette row. "
        "Labeled or clean unlabeled grid. Match the attached stills. "
        "No face, no human identity, no living model, no environment. "
        "Photoreal garments, even studio lighting. Dark studio ground. "
        + SHEET_NO_GARBLED
    )
    if _nv(extra):
        body += f" {_nv(extra)}"
    return body


def character_sheet_prompt(name: str, extra: str = "") -> str:
    who = _nv(name) or "this character"
    body = (
        f"Production character SHEET of {who}. One image only. "
        "Clean studio grid built from the attached angle stills "
        "(front, side, back, close-up, and any extra views). "
        "Every FULL BODY panel is head-to-toe with feet in frame — no crop at shins or knees. "
        "Close-up and top-down are the only allowed crops. "
        "Same person in every panel — identity, face, hair, body, and wardrobe locked to the attached stills. "
        "Isolated on a clean plate. Photoreal. Optional small clean labels only. "
        + SHEET_NO_GARBLED
    )
    if _nv(extra):
        body += f" {_nv(extra)}"
    return body


def dress_sheet_prompt(name: str, outfit: str, extra: str = "") -> str:
    who = _nv(name) or "the character"
    outfit_s = _nv(outfit) or "the attached costume"
    body = (
        f"Production character SHEET of {who} dressed in: {outfit_s}. One image only. "
        "Take the attached character sheet (or angle stills) and dress EVERY pose and angle "
        "in the attached costume. Keep identity, face, hair, age, skin, and body. "
        "Same grid layout: full-body front/side/back plus close-up, now wearing the costume. "
        "Match costume color, cut, and fabric. Isolated on a clean plate. Photoreal. "
        + SHEET_NO_GARBLED
    )
    if _nv(extra):
        body += f" {_nv(extra)}"
    return body


def costume_prompt(slot: str, outfit: str, extra: str = "") -> str:
    """Standalone costume plate — mannequin / no face identity."""
    key = (slot or "front").strip().lower()
    outfit_s = _nv(outfit) or "the described costume"
    if key == "sheet":
        return costume_sheet_prompt(outfit_s, extra)
    if key == "closeup":
        body = (
            f"Studio costume DETAIL plate of: {outfit_s}. "
            "NOT a full-body shot. NOT a standing mannequin from head to toe. "
            "Tight macro close-ups filling the frame: fabric weave and texture, "
            "stitching, trim, closures, hardware, and any emblem or signature piece. "
            "Optional small inset material callouts. "
            "No face, no person, no full figure, no environment. Photoreal garment details. "
            "Pure solid black background only (#000000)."
        )
        if _nv(extra):
            body += f" {_nv(extra)}"
        return body
    view = PROFILE_VIEWS.get(key, PROFILE_VIEWS["front"])
    framing = {
        "front": (
            "Front full-body costume plate on a faceless mannequin or headless dress form. "
            "Entire garment visible including hems and footwear."
        ),
        "side": (
            "Side-view costume plate on a faceless mannequin or headless dress form. "
            "Clean silhouette of the outfit, entire garment visible."
        ),
        "back": (
            "Back-view costume plate on a faceless mannequin. Entire garment visible."
        ),
    }.get(key, view)
    return (
        f"Studio costume reference still of: {outfit_s}. {framing} "
        "No face, no human identity, no model, no head. Faceless mannequin only. "
        "Photoreal garment, even studio lighting. "
        + CLEAN_PLATE
        + (f" {_nv(extra)}" if _nv(extra) else "")
    )


def dress_prompt(slot: str, outfit: str, extra: str = "") -> str:
    """Put a saved costume onto a saved character (keep identity)."""
    key = slot if slot in PROFILE_VIEWS else "front"
    view = PROFILE_VIEWS[key]
    outfit_s = _nv(outfit) or "the costume described by the reference"
    lock = (
        " Same outfit as the costume reference plates. Match color, cut, fabric, details exactly."
        if key != "front"
        else ""
    )
    return (
        "Keep the same person identity, face, hair, age, skin tone, and body "
        "proportions from the character reference images. Do not change who they are. "
        f"Change only the wardrobe / outfit / clothing to: {outfit_s}.{lock} "
        f"Generate a character-reference still: {view}. "
        + CLEAN_PLATE
        + (f" {_nv(extra)}" if _nv(extra) else "")
    )


def scene_sheet_prompt(
    fields: dict[str, Any] | None,
    extra: str = "",
    attached: list[str] | None = None,
) -> str:
    brief = scene_prompt(fields, slot="hero")
    names = [str(n).strip() for n in (attached or []) if str(n).strip()]
    panels = (
        "Clean studio grid of the same space from the attached stills only: "
        + ", ".join(names)
        + ". Do not invent extra panels."
        if names
        else "Clean studio grid of the same space from the attached stills only. Do not invent extra panels."
    )
    body = (
        f"Production location SHEET of {strip_scene_photoreal(brief)}. One image only. "
        f"{panels} "
        "Empty of prominent people. Optional small clean labels only. "
        "No gibberish text, no watermarks, no logos."
    )
    if _nv(extra):
        body += f" {_nv(extra)}"
    if _photoreal_on(fields):
        body = ensure_scene_photoreal(body, True)
    else:
        body = strip_scene_photoreal(body)
    return body


def prop_sheet_prompt(fields: dict[str, Any] | None, extra: str = "") -> str:
    f = fields or {}
    brief = _nv(f.get("prompt")) or _nv(f.get("name")) or "this object"
    body = (
        f"Product reference SHEET of {brief}. One image only. "
        "Hero three-quarter of the full prop plus a tight detail of material, "
        "edge wear, and construction. Isolated studio. Match the attached stills. "
        "No gibberish text, no watermarks, no logos."
    )
    if _nv(extra):
        body += f" {_nv(extra)}"
    return body


def scene_prompt(
    fields: dict[str, Any] | None,
    *,
    detail: bool = False,
    slot: str = "",
) -> str:
    f = fields or {}
    override = _nv(f.get("identity_prompt")) or _nv(f.get("prompt"))
    name = _nv(f.get("name")) or "the location"
    loc = _choice(f, "location")
    setting = _choice(f, "setting")
    time = _choice(f, "time")
    weather = _choice(f, "weather")
    mood = _choice(f, "mood")
    arch = _choice(f, "architecture")
    light = _choice(f, "lighting")
    cam = _choice(f, "camera")
    elements = _nv(f.get("elements"))
    furniture = _nv(f.get("furniture"))
    grade = _choice(f, "grade") or _nv(f.get("grade"))
    notes = _nv(f.get("notes"))
    if override:
        head = override
    else:
        bits: list[str] = []
        theme = _choice(f, "theme")
        if loc:
            bits.append(f"{name}, a {loc}" if name != "the location" else f"{loc} location")
        elif name != "the location":
            bits.append(name)
        else:
            bits.append(f"Establishing still of {name}.")
        if theme:
            bits.append(f"{theme} setting")
        if setting:
            bits.append(setting)
        if time:
            bits.append(f"time: {time}")
        if weather and setting != "interior":
            bits.append(f"weather: {weather}")
        if mood:
            bits.append(f"mood: {mood}")
        if arch:
            bits.append(f"architecture: {arch}")
        if light:
            bits.append(f"lighting: {light}")
        if elements:
            bits.append(f"key elements: {elements}")
        if furniture:
            bits.append(f"furniture / fixtures: {furniture}")
        if grade:
            bits.append(f"color grade: {grade}")
        head = "; ".join(bits) if bits else f"Location still of {name}."
    key = (slot or ("detail" if detail else "hero")).strip().lower() or "hero"
    if key == "hero":
        view = f"Camera: {cam}." if cam else SCENE_VIEWS["hero"]
    else:
        view = (
            f"{SCENE_EXTRA_CAMERA_GUARD} "
            + SCENE_VIEWS.get(key, SCENE_VIEWS["detail"])
        )
    empty = (
        ""
        if re.search(r"empty of prominent people", view, re.I)
        else " Empty of prominent people. No text, no logo, no watermark."
    )
    out = f"{strip_scene_photoreal(head)}. {view}{empty}"
    if notes and notes not in out:
        out = f"{out} {notes}"
    if _photoreal_on(f):
        out = ensure_scene_photoreal(out, True)
    else:
        out = strip_scene_photoreal(out)
    return out


def prop_prompt(fields: dict[str, Any] | None) -> str:
    f = fields or {}
    override = _nv(f.get("identity_prompt")) or _nv(f.get("prompt"))
    name = _nv(f.get("name")) or "the object"
    ptype = _choice(f, "ptype") or _nv(f.get("type"))
    material = _choice(f, "material")
    color = _nv(f.get("color")) or _choice(f, "color")
    scale = _choice(f, "scale")
    condition = _choice(f, "condition")
    notes = _nv(f.get("notes"))
    if override:
        head = override
    else:
        bits = [name]
        theme = _choice(f, "theme")
        if theme:
            bits.append(f"{theme} prop")
        if ptype:
            bits.append(f"type: {ptype}")
        if material:
            bits.append(f"material: {material}")
        if color:
            bits.append(f"color: {color}")
        if scale:
            bits.append(f"scale: {scale}")
        if condition:
            bits.append(f"condition: {condition}")
        view = _choice(f, "view") or _nv(f.get("view"))
        if view:
            bits.append(f"view: {view}")
        head = "; ".join(bits)
    out = (
        f"Product-style still of {head}. Isolated on a clean neutral studio background, "
        "even lighting, no people, no text, no logo, no watermark."
    )
    if notes and notes not in out:
        out = f"{out} {notes}"
    return out


def _sheet_r2i_ref_cap(entry: Any | None) -> int:
    """Catalog max_ref_images from IMAGE_EDIT_MODELS / size_limits."""
    limits = getattr(entry, "size_limits", None) or {}
    n = 0
    if isinstance(limits, dict):
        try:
            n = int(limits.get("max_ref_images") or limits.get("max_refs") or 0)
        except (TypeError, ValueError):
            n = 0
    if n > 0:
        return n
    blob = " ".join(
        str(getattr(entry, key, "") or "")
        for key in ("id", "label", "endpoint", "source_key")
    ).lower()
    if "muse" in blob or "seedream" in blob:
        return 10
    if "qwen" in blob:
        return 3
    return 4


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
    if key == "identity":
        brief = character_brief(merged, costume=is_costume)
        note = _nv(extra) or _nv(merged.get("notes"))
        if note:
            return f"{brief}. Extra: {note}" if brief else note
        return brief
    if kind == "scene":
        if key == SHEET_SLOT:
            return scene_sheet_prompt(merged, extra)
        return scene_prompt(merged, slot=key, detail=key == "detail")
    if kind == "prop":
        if key == SHEET_SLOT:
            return prop_sheet_prompt(merged, extra)
        return prop_prompt(merged)
    outfit = wardrobe or _nv((fields or {}).get("wardrobe")) or costume_brief(fields)
    if key == SHEET_SLOT:
        if kind == "costume":
            return costume_sheet_prompt(outfit, extra)
        if is_costume or _nv((fields or {}).get("costume_id")):
            return dress_sheet_prompt(str(name or merged.get("name") or ""), outfit, extra)
        return character_sheet_prompt(str(name or merged.get("name") or ""), extra)
    if kind == "costume":
        return costume_prompt(key, outfit, extra)
    if is_costume or _nv((fields or {}).get("costume_id")):
        return dress_prompt(key, outfit, extra)
    if key == "front":
        return character_front_prompt(fields, extra)
    return character_angle_prompt(key, fields, extra)


def _usd_from_label(label: str) -> float:
    import re

    match = re.search(r"\$([0-9]+(?:\.[0-9]+)?)", label or "")
    return float(match.group(1)) if match else 0.0


def _angle_usd(model_id: str, modality: str, resolution: str = "") -> tuple[str, float]:
    from app.create import estimate_create_cost
    from app.create_catalog import default_model_for, resolve_model
    from app.create_state import CreateParams, CreateState

    mid = (model_id or "").strip()
    if not mid:
        fallback = default_model_for("image", modality)
        mid = fallback.id if fallback else ""
    usd = 0.0
    size = character_angle_resolution(mid, modality, requested=resolution)
    if mid:
        label = estimate_create_cost(
            CreateState(
                mode="image",
                modality=modality,
                model_id=mid,
                prompt="sheet",
                params=CreateParams(resolution=size, aspect=size),
            )
        )
        usd = _usd_from_label(label)
        if usd <= 0:
            entry = resolve_model(mid, mode="image", modality=modality)
            if entry is not None:
                try:
                    from app.vision_registry import find_vision_model

                    spec = find_vision_model(
                        entry.source_key or entry.label,
                        entry.vision_mode or None,  # type: ignore[arg-type]
                    )
                    if spec is not None:
                        usd = float(getattr(spec, "cost_estimate_usd", 0) or 0)
                except Exception:
                    usd = 0.0
    if usd <= 0:
        usd = 0.04 if modality == "t2i" else 0.03
    return mid, usd


def estimate_sheet_cost(
    *,
    kind: str = "character",
    t2i_model_id: str = "",
    r2i_model_id: str = "",
    slots: list[str] | None = None,
    t2i_resolution: str = "",
    r2i_resolution: str = "",
) -> dict[str, Any]:
    """Sum catalog estimates for the selected models × still count."""
    try:
        return _estimate_sheet_cost_inner(
            kind=kind,
            t2i_model_id=t2i_model_id,
            r2i_model_id=r2i_model_id,
            slots=slots,
            t2i_resolution=t2i_resolution,
            r2i_resolution=r2i_resolution,
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception("sheet estimate failed")
        return {"ok": True, "cost": "Est. cost: —", "usd": 0.0, "count": 0, "angles": []}


def _estimate_sheet_cost_inner(
    *,
    kind: str = "character",
    t2i_model_id: str = "",
    r2i_model_id: str = "",
    slots: list[str] | None = None,
    t2i_resolution: str = "",
    r2i_resolution: str = "",
) -> dict[str, Any]:
    want = (kind or "character").strip().lower()
    planned = [s for s in (slots or list(CORE_SLOTS)) if s]
    if not planned:
        planned = ["front"]
    angles: list[dict[str, Any]] = []
    total = 0.0
    for i, slot in enumerate(planned):
        first = i == 0 or slot == "front" or slot == "hero"
        if want == "costume":
            modality = "r2i"
            mid = (r2i_model_id or t2i_model_id).strip()
        elif first:
            modality = "t2i"
            mid = (t2i_model_id or "").strip()
        elif want in ("character", "scene"):
            modality = "r2i"
            mid = (r2i_model_id or t2i_model_id).strip()
        else:
            modality = "i2i"
            mid = (r2i_model_id or t2i_model_id).strip()
        size = r2i_resolution if (want == "costume" or not first) else t2i_resolution
        mid, usd = _angle_usd(mid, modality, resolution=size)
        total += usd
        angles.append(
            {
                "slot": slot,
                "modality": modality,
                "model_id": mid,
                "cost": f"${usd:.2f}",
                "usd": usd,
            }
        )
    n = len(planned)
    unit = "1 still" if n == 1 else f"{n} stills"
    cost = f"Est. cost: ${total:.2f} · {unit}"
    return {"ok": True, "cost": cost, "usd": total, "count": n, "angles": angles}


_VIDEO_SIZE_TOKENS: frozenset[str] = frozenset(
    {"360p", "480p", "540p", "720p", "1080p", "1440p", "2160p"}
)
_PORTRAIT_SIZE_PREFER: tuple[str, ...] = (
    "auto_2K",
    "2K",
    "portrait_16_9",
    "portrait_4_3",
    "9:16 portrait",
    "9:16",
    "3:4 portrait",
    "square_hd",
    "1:1 square HD",
    "auto_4K",
    "4K",
    "1K",
    "auto",
)
_SHEET_SIZE_PREFER: tuple[str, ...] = (
    "16:9 landscape",
    "landscape_16_9",
    "16:9",
    "4:3 landscape",
    "landscape_4_3",
    "4:3",
    "auto_2K",
    "2K",
    "square_hd",
    "1:1 square HD",
    "auto_4K",
    "4K",
    "1K",
    "auto",
)


def short_generate_error(
    exc: BaseException | str,
    *,
    image_size: str = "",
) -> str:
    """One-line user error — no traceback / pydantic dump."""
    text = str(exc or "").strip()
    if not text:
        return "Generate failed."
    low = text.lower()
    compact = low.replace("_", "").replace("-", "").replace(" ", "")
    sent = (image_size or "").strip().lower()
    sent_auto = sent in ("", "auto", "default")
    if "imagesize" in compact and (
        "auto" in low or "enum" in low or "input should be" in low
    ):
        if sent_auto:
            pass
        elif "should be" in low and "auto" in low:
            return "This model only accepts Auto for image_size."
        else:
            return "This model rejected image_size. Pick a listed resolution (not Auto)."
    if "aspect" in low and (
        "enum" in low or "input should be" in low or "invalid" in low
    ):
        return "Invalid aspect ratio for this model. Use 9:16, 1:1, or 16:9 — not a label like '9:16 portrait'."
    if any(
        tok in low
        for tok in (
            "content policy",
            "safety",
            "flagged",
            "nudge",
            "image_rejected",
            "prohibited",
        )
    ):
        return "The model declined this prompt (content policy). Soften wardrobe/body notes and retry."
    if text.lstrip()[:1] in "{[":
        return "Generate failed."
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("File ") or "Traceback" in line:
            continue
        if "pydantic" in line.lower() or "validationerror" in line.lower():
            continue
        if line[:1] in "{[":
            continue
        return line[:200] + ("…" if len(line) > 200 else "")
    return "Generate failed."


def _is_video_size_token(value: str) -> bool:
    return (value or "").strip().lower() in _VIDEO_SIZE_TOKENS


def _is_quality_token(value: str) -> bool:
    return (value or "").strip().lower().replace(" ", "") in _QUALITY_TOKENS


def _size_choices_for_entry(entry: Any) -> list[str]:
    if entry is None:
        return []
    choices = [str(x).strip() for x in (getattr(entry, "resolution_choices", ()) or ()) if str(x).strip()]
    if not choices:
        choices = [str(x).strip() for x in (getattr(entry, "aspect_choices", ()) or ()) if str(x).strip()]
    return [c for c in choices if not _is_video_size_token(c)]


def pick_character_resolution(
    allowed: list[str],
    requested: str = "",
    default: str = "",
    prefer: tuple[str, ...] | None = None,
) -> str:
    opts = [a for a in allowed if a and not _is_video_size_token(a)]
    if not opts:
        req = (requested or "").strip()
        if req and not _is_video_size_token(req):
            return req
        fallback = (default or "").strip()
        if fallback and not _is_video_size_token(fallback):
            return fallback
        return "portrait_16_9"
    lower = {a.lower(): a for a in opts}
    req = (requested or "").strip()
    if req and not _is_video_size_token(req) and req.lower() in lower:
        picked = lower[req.lower()]
        if picked.lower() != "auto" or all(k == "auto" for k in lower):
            return picked
    req_compact = req.lower().replace(" ", "")
    if req_compact and not _is_video_size_token(req):
        for a in opts:
            ac = a.lower().replace(" ", "")
            if req_compact == ac or req_compact in ac or ac in req_compact:
                if a.lower() != "auto" or all(k == "auto" for k in lower):
                    return a
    for pref in prefer or _PORTRAIT_SIZE_PREFER:
        if pref.lower() in lower:
            return lower[pref.lower()]
    if default and default.lower() in lower and default.lower() != "auto":
        return lower[default.lower()]
    non_auto = [a for a in opts if a.lower() != "auto"]
    return non_auto[0] if non_auto else opts[0]


def character_angle_resolution(
    model_id: str,
    modality: str,
    requested: str = "",
) -> str:
    from app.create_catalog import default_model_for, resolve_model

    mid = (model_id or "").strip()
    entry = resolve_model(mid, mode="image", modality=modality) if mid else None
    if entry is None:
        entry = default_model_for("image", modality)
    allowed = _size_choices_for_entry(entry)
    default = str(
        getattr(entry, "default_resolution", "")
        or getattr(entry, "default_aspect", "")
        or ""
    )
    return pick_character_resolution(allowed, requested, default)


_QUALITY_TOKENS = {"0.5k": "0.5K", "1k": "1K", "2k": "2K", "4k": "4K"}


def character_angle_params(
    model_id: str,
    modality: str,
    requested: str = "",
    requested_aspect: str = "",
    landscape: bool = False,
) -> tuple[str, str]:
    """Return (aspect, resolution) using each model's exact allowed API strings."""
    from app.create_catalog import default_model_for, resolve_model
    from app.vision_registry import clamp_nano_aspect

    mid = (model_id or "").strip()
    entry = resolve_model(mid, mode="image", modality=modality) if mid else None
    if entry is None:
        entry = default_model_for("image", modality)
    blob = " ".join(
        str(getattr(entry, k, "") or "")
        for k in ("endpoint", "label", "source_key", "id")
    ).lower()
    endpoint = str(getattr(entry, "endpoint", "") or "").lower()
    is_nano = "nano" in blob or "banana" in blob
    is_flux_edit = "flux" in blob and (
        "/edit" in endpoint or ("edit" in blob and "t2i" not in blob)
    )
    is_qwen = "qwen" in blob
    is_muse = "muse" in blob
    aspects = [
        str(x).strip()
        for x in (getattr(entry, "aspect_choices", ()) or ())
        if str(x).strip() and not _is_video_size_token(str(x))
    ]
    resolutions = [
        str(x).strip()
        for x in (getattr(entry, "resolution_choices", ()) or ())
        if str(x).strip() and not _is_video_size_token(str(x))
    ]
    req = (requested or "").strip()
    req_aspect = (requested_aspect or "").strip()
    if _is_video_size_token(req):
        req = ""
    if _is_video_size_token(req_aspect):
        req_aspect = ""
    quality = ""
    for token, canon in _QUALITY_TOKENS.items():
        if req.lower().replace(" ", "") == token:
            quality = canon
            req = ""
            break
    if not quality:
        for token, canon in _QUALITY_TOKENS.items():
            if req_aspect.lower().replace(" ", "") == token:
                quality = canon
                req_aspect = ""
                break
    is_flux_t2i = "flux" in blob and (
        "t2i" in blob or ("flux-2" in endpoint and "/edit" not in endpoint)
    ) and ("pro" in blob or "max" in blob or "flex" in blob)
    is_gpt = "gpt-image-2" in endpoint or "gpt image 2" in blob
    if is_flux_edit:
        return "auto", "auto"
    if is_flux_t2i:
        framing = (req_aspect or req).strip()
        if not framing or _is_quality_token(framing) or _is_video_size_token(framing):
            framing = "landscape_16_9" if landscape else "portrait_16_9"
        aspect = pick_character_resolution(
            [a for a in aspects if a] or ["landscape_16_9", "portrait_16_9"],
            framing,
            prefer=_SHEET_SIZE_PREFER if landscape else _PORTRAIT_SIZE_PREFER,
        )
        q_raw = (quality or req or req_aspect or "").lower()
        resolution = "~2K (4MP max)" if ("2k" in q_raw or "4mp" in q_raw) else "1K"
        if quality and "1k" in quality.lower().replace(" ", "") and "2k" not in quality.lower():
            resolution = "1K"
        return aspect or "landscape_16_9", resolution
    if is_gpt:
        framing = (req_aspect or req).strip()
        if not framing or _is_quality_token(framing) or _is_video_size_token(framing):
            framing = "landscape_16_9" if landscape else "auto"
        aspect = pick_character_resolution(
            [a for a in aspects if a]
            or [
                "landscape_16_9",
                "landscape_4_3",
                "square_hd",
                "auto",
            ],
            framing,
            prefer=_SHEET_SIZE_PREFER if landscape else ("auto", "portrait_16_9"),
        )
        q_allowed = {
            r.lower(): r
            for r in resolutions
            if r.lower() in ("auto", "low", "medium", "high")
        } or {"high": "high", "medium": "medium", "low": "low", "auto": "auto"}
        q_raw = (quality or req or "").strip().lower()
        resolution = q_allowed.get(q_raw) or q_allowed.get("high") or "high"
        return aspect or "landscape_16_9", resolution
    if is_muse:
        framing = (req_aspect or req).strip()
        low = framing.lower()
        if (
            not framing
            or "match" in low
            or "follow" in low
            or low in ("auto", "default")
        ):
            return "Match source", ""
        if landscape:
            return "16:9", ""
        return framing if framing in aspects else (aspects[0] if aspects else "9:16"), ""
    if is_nano:
        framing = req_aspect or req
        if not framing or _is_quality_token(framing) or _is_video_size_token(framing):
            framing = "16:9" if landscape else "9:16"
        aspect = clamp_nano_aspect(framing) or ("16:9" if landscape else "9:16")
        q_allowed = {
            r.lower(): r
            for r in resolutions
            if r.lower().replace(" ", "") in _QUALITY_TOKENS
        }
        resolution = ""
        if quality and quality.lower() in q_allowed:
            resolution = q_allowed[quality.lower()]
        elif q_allowed:
            resolution = (
                q_allowed.get("2k")
                or q_allowed.get("1k")
                or next(iter(q_allowed.values()))
            )
        return aspect, resolution
    if is_qwen:
        q_allowed = {
            r.lower(): r
            for r in resolutions
            if r.lower().replace(" ", "") in _QUALITY_TOKENS
        } or {"1k": "1K", "2k": "2K"}
        resolution = ""
        if quality and quality.lower() in q_allowed:
            resolution = q_allowed[quality.lower()]
        else:
            resolution = (
                q_allowed.get("2k")
                or q_allowed.get("1k")
                or next(iter(q_allowed.values()))
            )
        framing_opts = [
            a
            for a in (aspects or resolutions)
            if not _is_quality_token(a)
        ] or (["landscape_16_9"] if landscape else ["portrait_16_9"])
        framing = req_aspect or req
        if not framing or _is_quality_token(framing):
            framing = "landscape_16_9" if landscape else "portrait_16_9"
        aspect = pick_character_resolution(
            framing_opts,
            framing,
            prefer=_SHEET_SIZE_PREFER if landscape else _PORTRAIT_SIZE_PREFER,
        )
        return aspect, resolution
    # Seedream / Flux image_size or aspect labels
    allowed = resolutions or aspects
    picked = pick_character_resolution(
        allowed,
        req or req_aspect,
        prefer=_SHEET_SIZE_PREFER if landscape else _PORTRAIT_SIZE_PREFER,
    )
    if resolutions:
        return picked, picked
    return picked, quality


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
    resolution: str = "",
    aspect: str = "",
    extra_refs: list[str] | None = None,
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
    costume_id = _nv(fields.get("costume_id"))
    costume_row = get_asset(costume_id) if costume_id else None
    is_dress = kind == "character" and bool(parent or costume_row)
    is_costume = kind == "costume"
    if key == SHEET_SLOT and kind not in ("costume", "character", "scene", "prop"):
        raise ValueError("Sheet generate is only for Character, Costume, Scene, or Prop assets.")
    outfit = _nv(wardrobe) or _nv(fields.get("wardrobe"))
    if not outfit and costume_row:
        cfields = costume_row.get("fields") if isinstance(costume_row.get("fields"), dict) else {}
        outfit = _nv(cfields.get("wardrobe"))

    refs: list[str] = []
    prior = _nv(source_still)
    if prior and Path(prior).is_file():
        refs.append(prior)
    cref = _nv(costume_ref)
    if cref and Path(cref).is_file() and cref not in refs:
        refs.append(cref)
    for raw in extra_refs or []:
        p = _nv(raw)
        if p and Path(p).is_file() and p not in refs:
            refs.append(p)
    client_sent = bool(prior) or bool(extra_refs)
    if key == SHEET_SLOT and not client_sent:
        ident = row.get("identity") if isinstance(row.get("identity"), dict) else {}
        ordered: list[str] = []
        pack = SCENE_SLOTS if kind == "scene" else CORE_SLOTS + EXTRA_SLOTS
        for angle in pack:
            p = _nv(ident.get(angle))
            if p and Path(p).is_file() and p not in ordered:
                ordered.append(p)
        refs = ordered
        if not refs:
            raise ValueError("Generate at least one angle before the sheet.")
    elif key == SHEET_SLOT and not refs:
        raise ValueError("Generate at least one angle before the sheet.")

    text = _nv(prompt) or compose_angle_prompt(
        kind=kind,
        slot=key,
        fields=fields,
        name=str(row.get("name") or ""),
        is_costume=is_dress or is_costume,
        wardrobe=outfit,
        extra=extra,
    )
    photoreal_on = str(fields.get("photoreal") or "on").strip().lower() not in (
        "off",
        "0",
        "false",
        "no",
    )
    if kind == "scene" or key in SCENE_SLOTS:
        if photoreal_on:
            text = ensure_scene_photoreal(text, True)
        else:
            text = strip_scene_photoreal(text)
        if key in SCENE_SLOTS and key != "hero":
            if SCENE_EXTRA_CAMERA_GUARD.lower() not in text.lower():
                text = f"{SCENE_EXTRA_CAMERA_GUARD} {text}"

    modality = "t2i"
    if refs:
        modality = "r2i" if kind in ("character", "costume", "scene", "prop") else "i2i"
    mid = _nv(model_id)
    entry = resolve_model(mid, mode="image", modality=modality) if mid else None
    if mid:
        if entry is None:
            raise ValueError(f"Unknown model: {mid}.")
        mods = tuple(entry.modalities or ())
        if modality not in mods:
            label = getattr(entry, "label", None) or mid
            have = "/".join(m.upper() for m in mods) or "T2I"
            raise ValueError(
                f"{label} is a {have} model — this {key} angle needs {modality.upper()}. "
                "Pick an R2I/edit model. The app will not silently switch models."
            )
    else:
        fallback = default_model_for("image", modality)
        mid = fallback.id if fallback else mid
        entry = resolve_model(mid, mode="image", modality=modality) if mid else None
    if not mid:
        raise ValueError(f"No {modality} model available for this sheet angle.")

    cap = _sheet_r2i_ref_cap(entry)
    if cap > 0 and len(refs) > cap:
        if key == SHEET_SLOT:
            raise ValueError(
                f"This model allows {cap} refs — deselect extras (got {len(refs)})."
            )
        label = getattr(entry, "label", None) or getattr(entry, "id", None) or "This model"
        raise ValueError(
            f"{label} allows at most {cap} reference images (got {len(refs)}). "
            "Dress Front uses Character Front + Costume Front only; "
            "Side / Close-up use the costumed Front only."
        )

    start = refs[0] if refs else None
    extras = refs[1:] if len(refs) > 1 else []
    aspect, size = character_angle_params(
        mid,
        modality,
        requested=resolution,
        requested_aspect=aspect,
        landscape=key == SHEET_SLOT or key in SCENE_SLOTS,
    )
    state = CreateState(
        mode="image",
        modality=modality,  # type: ignore[arg-type]
        model_id=mid,
        prompt=text,
        slots=CreateSlots(start_still=start, ref_images=extras),
        params=CreateParams(
            resolution=size or None,
            aspect=aspect or None,
        ),
        surface="studio",
        output_dir=OUTPUT_DIR,
    )
    try:
        result = generate(state)
    except Exception as exc:
        raise RuntimeError(short_generate_error(exc, image_size=size or aspect)) from exc
    if not result.ok:
        raise RuntimeError(
            short_generate_error(
                (result.status or "")
                or (result.errors[0] if result.errors else "Generate failed."),
                image_size=size or aspect,
            )
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
    pub["cost"] = (
        getattr(result, "cost_label", "")
        or getattr(result, "cost_estimate", "")
        or ""
    )
    pub["resolution"] = size
    return pub
