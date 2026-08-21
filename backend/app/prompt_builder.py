"""Prompt Builder: scenario catalogs + apply-to-prompt text."""

from __future__ import annotations

from typing import Any

from app.scenarios import (
    ARCHITECTURE_LOCK,
    BLANK_CANVAS_KEY,
    app_scenario_items,
    build_scenario_prompt,
    get_scenario,
    simple_control_schema,
)
from app.scene_builder import POPIN_INTENT, PRESERVATION_BLOCK, SWAP_INTENT

EXTRA_IMAGE_SCENARIOS: list[tuple[str, str, str]] = [
    (
        "mirror_remove",
        "Mirror remove",
        "Remove mirrors and their reflections; keep the room otherwise identical.",
    ),
    (
        "object_remove",
        "Object remove",
        "Remove a named object; keep architecture, lighting, and everything else.",
    ),
]

BUILDER_ROOMS = [
    "Living Room",
    "Master bedroom",
    "Kids Room (Boy)",
    "Kids Room (Girl)",
    "Kids Room (Neutral)",
    "Teen Room",
    "Home Office",
    "Dining Room",
    "Kitchen",
    "Patio / Outdoor",
    "Other",
]

BUILDER_STYLES = [
    "Modern",
    "Contemporary",
    "Mid-century Modern",
    "Minimalist",
    "Transitional",
    "Coastal",
    "Traditional",
    "Industrial",
    "Natural",
    "Farmhouse",
    "Scandinavian",
    "Custom notes",
]

_STYLE_LANG = {
    "Modern": (
        "modern aesthetic with clean lines, simple silhouettes, and a restrained "
        "neutral palette (warm grays, soft whites, light wood)"
    ),
    "Contemporary": (
        "contemporary look with current designer forms, soft neutrals, and polished "
        "but livable finishes"
    ),
    "Mid-century Modern": (
        "mid-century modern character—tapered legs, warm wood tones, organic curves, "
        "and a retro-modern palette"
    ),
    "Minimalist": (
        "minimalist staging—essential pieces only, lots of negative space, muted tones, "
        "and zero visual clutter"
    ),
    "Transitional": (
        "transitional style blending classic comfort with modern simplicity—soft lines, "
        "balanced neutrals, approachable elegance"
    ),
    "Coastal": (
        "coastal light-and-airy feel—pale woods, soft blues/whites, breezy textiles, "
        "and bright natural light"
    ),
    "Traditional": (
        "traditional elegance—classic furniture forms, richer fabrics, refined symmetry, "
        "and warm inviting tones"
    ),
    "Industrial": (
        "industrial-inspired staging—metal accents, raw textures used sparingly, "
        "darker neutrals, and utilitarian chic"
    ),
    "Natural": (
        "natural, organic staging—raw woods, linen and stone textures, earthy neutrals, "
        "and an unforced lived-in calm"
    ),
    "Farmhouse": (
        "modern farmhouse staging—warm woods, simple classic forms, soft whites, "
        "and approachable country-contemporary comfort"
    ),
    "Scandinavian": (
        "Scandinavian staging—light woods, airy neutrals, functional silhouettes, "
        "and cozy restraint"
    ),
}


def _field(
    fid: str,
    label: str,
    *,
    kind: str = "select",
    choices: list[str] | None = None,
    value: str = "",
    placeholder: str = "",
) -> dict[str, Any]:
    return {
        "id": fid,
        "label": label,
        "type": kind,
        "choices": list(choices or []),
        "value": value,
        "placeholder": placeholder,
    }


def list_builder_scenarios(mode: str | None, modality: str | None) -> dict[str, Any]:
    mode_l = (mode or "image").strip().lower()
    mod = (modality or "").strip().lower()
    if mode_l == "audio":
        if mod == "sfx":
            rows = [
                {
                    "key": "audio_sfx",
                    "label": "SFX",
                    "description": "Short sound effect.",
                    "fields": _sfx_fields(),
                }
            ]
            return {"mode": mode_l, "modality": mod, "default_id": "audio_sfx", "scenarios": rows}
        if mod == "voice":
            rows = [
                {
                    "key": "audio_voice",
                    "label": "Voice",
                    "description": "Spoken line / VO.",
                    "fields": _voice_fields(),
                }
            ]
            return {"mode": mode_l, "modality": mod, "default_id": "audio_voice", "scenarios": rows}
        rows = [
            {
                "key": "audio_music",
                "label": "Music",
                "description": "Core genre first; Flare is a secondary color only.",
                "fields": _music_fields(),
            }
        ]
        return {"mode": mode_l, "modality": mod or "music", "default_id": "audio_music", "scenarios": rows}

    rows: list[dict[str, Any]] = []
    for key, label in app_scenario_items():
        spec = get_scenario(key)
        rows.append(
            {
                "key": key,
                "label": label,
                "description": (spec.description if spec else "") or "",
                "fields": _image_fields(key),
            }
        )
    for key, label, desc in EXTRA_IMAGE_SCENARIOS:
        rows.append({"key": key, "label": label, "description": desc, "fields": _image_fields(key)})
    if mode_l in ("video", "frame"):
        for row in rows:
            if row["key"] != BLANK_CANVAS_KEY:
                row["fields"] = list(row["fields"]) + [
                    _field(
                        "camera_note",
                        "Camera / motion (optional)",
                        kind="text",
                        value="",
                        placeholder="e.g. locked tripod, slow push-in",
                    )
                ]
    default_id = "furniture_popin"
    if not any(r["key"] == default_id for r in rows):
        default_id = rows[0]["key"] if rows else BLANK_CANVAS_KEY
    return {"mode": mode_l, "modality": mod, "default_id": default_id, "scenarios": rows}


def _image_fields(key: str) -> list[dict[str, Any]]:
    if key == BLANK_CANVAS_KEY:
        return [
            _field(
                "note",
                "Custom prompt",
                kind="textarea",
                value="",
                placeholder="Write the prompt yourself…",
            )
        ]
    if key in ("furniture_popin", "furniture_swap"):
        return _furniture_fields()
    if key == "day_to_night":
        return _day_night_fields()
    if key == "sky_mood":
        return _sky_fields()
    if key == "dehaze":
        return _dehaze_fields()
    if key == "landscaper":
        return _landscaper_fields()
    if key == "mirror_remove":
        return _mirror_fields()
    if key == "object_remove":
        return _object_fields()
    return _simple_fields(key)


def _furniture_fields() -> list[dict[str, Any]]:
    return [
        _field("room_type", "Room", choices=BUILDER_ROOMS, value="Living Room"),
        _field("style", "Style", choices=BUILDER_STYLES, value="Modern"),
        _field(
            "style_note",
            "Style note (optional)",
            kind="text",
            value="",
            placeholder="Used when Style is Custom notes, or to tweak any style",
        ),
        _field(
            "seating",
            "Seating",
            choices=["Sectional", "Sofa", "Loveseat", "Armchair", "Mix", "None"],
            value="Sofa",
        ),
        _field("coffee_table", "Coffee table", choices=["Yes", "No"], value="Yes"),
        _field("side_tables", "Side tables", choices=["Yes", "No"], value="Yes"),
        _field(
            "table_material",
            "Table material",
            choices=["Wood", "Metal", "Glass", "Mixed"],
            value="Wood",
        ),
        _field(
            "area_rug",
            "Area rug",
            choices=["None", "Light", "Medium", "Bold"],
            value="Light",
        ),
        _field(
            "furniture_density",
            "Furniture amount",
            choices=["Sparse", "Balanced", "Full"],
            value="Balanced",
        ),
        _field(
            "decor_amount",
            "Decor",
            choices=["None", "Light", "Medium", "Heavy"],
            value="Light",
        ),
        _field(
            "decor_note",
            "Decor note (optional)",
            kind="text",
            value="",
            placeholder="e.g. linen pillows, one ceramic vase",
        ),
        _field("plants", "Plants", choices=["None", "Light", "Medium", "Heavy"], value="Light"),
        _field(
            "camera_feel",
            "Camera / lens feel",
            choices=["Natural", "Wide", "Normal", "Tighter"],
            value="Natural",
        ),
        _field(
            "note",
            "Optional notes",
            kind="textarea",
            value="",
            placeholder="Anything else to include or avoid…",
        ),
    ]


def _day_night_fields() -> list[dict[str, Any]]:
    return [
        _field("scope", "Scope", choices=["Interior", "Exterior", "Both feel"], value="Exterior"),
        _field(
            "intensity",
            "Intensity",
            choices=["Subtle", "Moderate", "Dramatic"],
            value="Moderate",
        ),
        _field(
            "interior_lights",
            "Interior lights",
            choices=["On", "Soft glow", "Off"],
            value="On",
        ),
        _field(
            "landscape_lights",
            "Landscape / path lights",
            choices=["On", "Warm path lights", "Off"],
            value="On",
        ),
        _field(
            "moonlight",
            "Moonlight",
            choices=["None", "Soft moonlight", "Strong moonlight"],
            value="Soft moonlight",
        ),
        _field(
            "note",
            "Optional notes",
            kind="text",
            value="",
            placeholder="e.g. keep porch lantern, no extra fixtures",
        ),
    ]


def _sky_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "sky_type",
            "Sky type",
            choices=[
                "Clear blue",
                "Soft overcast",
                "Dramatic clouds",
                "Sunset",
                "Golden hour",
                "Storm-cleared",
            ],
            value="Clear blue",
        ),
        _field(
            "coverage",
            "Coverage",
            choices=["Sky only", "Sky + light wrap"],
            value="Sky + light wrap",
        ),
        _field(
            "time_feel",
            "Time feel",
            choices=["Midday", "Late afternoon", "Dusk"],
            value="Midday",
        ),
        _field(
            "saturation",
            "Saturation",
            choices=["Natural", "Punchy", "Muted"],
            value="Natural",
        ),
        _field(
            "horizon",
            "Horizon",
            choices=["Keep horizon", "Soft blend"],
            value="Keep horizon",
        ),
        _field(
            "note",
            "Optional notes",
            kind="text",
            value="",
            placeholder="e.g. keep the oak silhouette, no extra sun flare",
        ),
    ]


def _dehaze_fields() -> list[dict[str, Any]]:
    return [
        _field("strength", "Strength", choices=["Light", "Medium", "Strong"], value="Medium"),
        _field(
            "target",
            "Target",
            choices=["Smoke", "Haze", "Fog", "Mixed atmosphere"],
            value="Haze",
        ),
        _field("contrast", "Contrast", choices=["Natural", "Punchier"], value="Natural"),
        _field("color", "Color", choices=["Neutral", "Warm", "Cool"], value="Neutral"),
        _field(
            "keep_distance",
            "Keep distant atmosphere",
            choices=["Yes", "No"],
            value="Yes",
        ),
        _field(
            "note",
            "Optional notes",
            kind="text",
            value="",
            placeholder="e.g. clear the hills, leave a hint of valley mist",
        ),
    ]


def _landscaper_fields() -> list[dict[str, Any]]:
    return [
        _field("density", "Density", choices=["Sparse", "Balanced", "Lush"], value="Balanced"),
        _field(
            "lawn",
            "Lawn",
            choices=["Fresh green", "Dormant", "Keep existing"],
            value="Fresh green",
        ),
        _field("trees", "Trees", choices=["None", "Light", "Mature"], value="Light"),
        _field(
            "shrubs",
            "Shrubs",
            choices=["None", "Foundation only", "Full beds"],
            value="Foundation only",
        ),
        _field(
            "color",
            "Color",
            choices=["Cool greens", "Warm", "Seasonal color"],
            value="Cool greens",
        ),
        _field(
            "note",
            "Optional notes",
            kind="text",
            value="",
            placeholder="e.g. keep the oak on the left, mulch beds only",
        ),
    ]


def _mirror_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "target",
            "Target",
            choices=["All mirrors", "Named only"],
            value="All mirrors",
        ),
        _field(
            "which",
            "Which mirrors",
            kind="text",
            value="",
            placeholder="e.g. the tall mirror on the left wall",
        ),
        _field(
            "fill",
            "Fill with",
            choices=["Match wall", "Match adjacent finish"],
            value="Match wall",
        ),
        _field(
            "remove_reflections",
            "Remove reflections too",
            choices=["Yes", "No"],
            value="Yes",
        ),
        _field(
            "match_lighting",
            "Match lighting / reflection",
            choices=["Yes", "No"],
            value="Yes",
        ),
        _field(
            "note",
            "Optional notes",
            kind="text",
            value="",
            placeholder="Anything else to keep or avoid…",
        ),
    ]


def _object_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "which",
            "What to remove",
            kind="text",
            value="",
            placeholder="e.g. the trash can and orange cone",
        ),
        _field(
            "scope",
            "Scope",
            choices=["Named object only", "Object + shadow"],
            value="Object + shadow",
        ),
        _field(
            "fill",
            "Fill with",
            choices=["Reconstruct background", "Match nearby surface"],
            value="Reconstruct background",
        ),
        _field(
            "match_lighting",
            "Match lighting / reflection",
            choices=["Yes", "No"],
            value="Yes",
        ),
        _field(
            "note",
            "Optional notes",
            kind="text",
            value="",
            placeholder="e.g. keep the hose bib, do not touch the planter",
        ),
    ]


def _simple_fields(key: str) -> list[dict[str, Any]]:
    schema = simple_control_schema(key)
    fields: list[dict[str, Any]] = []
    if schema.get("opt_a_choices") and schema["opt_a_choices"] != ["—"]:
        fields.append(
            _field(
                "opt_a",
                str(schema.get("opt_a_label") or "Option A"),
                choices=list(schema["opt_a_choices"]),
                value=str(schema.get("opt_a_value") or ""),
            )
        )
    if schema.get("opt_b_choices") and schema["opt_b_choices"] != ["—"]:
        fields.append(
            _field(
                "opt_b",
                str(schema.get("opt_b_label") or "Option B"),
                choices=list(schema["opt_b_choices"]),
                value=str(schema.get("opt_b_value") or ""),
            )
        )
    if schema.get("show_opt_c"):
        fields.append(
            _field(
                "opt_c",
                str(schema.get("opt_c_label") or "Option C"),
                choices=list(schema.get("opt_c_choices") or []),
                value=str(schema.get("opt_c_value") or ""),
            )
        )
    if schema.get("show_opt_d"):
        fields.append(
            _field(
                "opt_d",
                str(schema.get("opt_d_label") or "Option D"),
                choices=list(schema.get("opt_d_choices") or []),
                value=str(schema.get("opt_d_value") or ""),
            )
        )
    if schema.get("show_note"):
        fields.append(
            _field(
                "note",
                str(schema.get("note_label") or "Notes"),
                kind="text",
                value="",
                placeholder=str(schema.get("note_placeholder") or ""),
            )
        )
    return fields


def _music_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "genre",
            "Genre",
            choices=[
                "Hard rock",
                "Rock",
                "Metal",
                "Pop",
                "Hip-hop",
                "Electronic",
                "Jazz",
                "Folk",
                "Country",
                "R&B / Soul",
                "Cinematic",
                "Ambient",
                "Latin",
                "World",
                "Classical",
                "Custom",
            ],
            value="Hard rock",
        ),
        _field(
            "subgenre",
            "Sub-genre",
            kind="text",
            value="",
            placeholder="e.g. Classic hard rock",
        ),
        _field(
            "flare",
            "Flare (color only)",
            choices=[
                "",
                "Peru",
                "Andes",
                "Brazil",
                "Mexico",
                "Cuba",
                "Jamaica",
                "West Africa",
                "North Africa",
                "Middle East",
                "India",
                "Japan",
                "Korea",
                "China",
                "Spain",
                "Ireland",
                "Scandinavia",
                "Balkans",
                "New Orleans",
                "Custom",
            ],
            value="",
        ),
        _field("era", "Era", kind="text", value=""),
        _field("energy", "Energy", kind="text", value="driving"),
        _field("tempo", "Tempo / BPM", kind="text", value="driving (~120 BPM)"),
        _field("mood", "Mood", kind="text", value=""),
        _field(
            "instruments",
            "Instrumentation",
            kind="text",
            value="electric guitar, bass, drums",
            placeholder="comma-separated",
        ),
        _field(
            "regional",
            "Regional instruments",
            kind="text",
            value="",
            placeholder="when Flare is set, e.g. charango, cajón",
        ),
        _field("vocals", "Vocals", kind="text", value=""),
        _field("intro", "Intro feel", kind="text", value="cold-open riff"),
        _field("buildup", "Buildup", kind="text", value="kick in at ~8s"),
        _field("ending", "Ending", kind="text", value="hard stop"),
        _field("use_case", "Use case", kind="text", value=""),
        _field("notes", "Notes", kind="textarea", value=""),
        _field("instrumental", "Instrumental (no vocals)", kind="check", value="true"),
    ]


def _sfx_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "sfx_type",
            "Type",
            choices=[
                "Whoosh",
                "Impact",
                "Ambience",
                "Foley",
                "UI / click",
                "Riser",
                "Texture",
                "Custom",
            ],
            value="Impact",
        ),
        _field(
            "length",
            "Length",
            choices=["Very short", "Short", "Medium", "Long", "Loop-friendly"],
            value="Short",
        ),
        _field(
            "tone",
            "Tone",
            choices=["Clean", "Gritty", "Cinematic", "Cartoon", "Organic", "Designed"],
            value="Clean",
        ),
        _field(
            "space",
            "Space",
            choices=["Dry", "Tight room", "Wide", "Outdoor"],
            value="Dry",
        ),
        _field("weight", "Weight", choices=["Soft", "Medium", "Hard"], value="Medium"),
        _field("note", "Notes", kind="text", value="", placeholder="e.g. wooden door close, close mic"),
    ]


def _voice_fields() -> list[dict[str, Any]]:
    return [
        _field(
            "tone",
            "Tone",
            choices=["Warm", "Neutral", "Authoritative", "Casual", "Friendly", "Documentary"],
            value="Warm",
        ),
        _field("pace", "Pace", choices=["Slow", "Natural", "Brisk"], value="Natural"),
        _field(
            "delivery",
            "Delivery",
            choices=["Conversational", "Read", "Announcer"],
            value="Conversational",
        ),
        _field(
            "distance",
            "Distance",
            choices=["Intimate", "Studio", "Distant"],
            value="Studio",
        ),
        _field(
            "script",
            "Script",
            kind="textarea",
            value="",
            placeholder="Words to speak…",
        ),
    ]


def apply_builder(
    scenario_key: str,
    fields: dict[str, Any] | None,
    *,
    mode: str = "image",
    modality: str = "",
) -> str:
    vals = {str(k): ("" if v is None else str(v)) for k, v in (fields or {}).items()}
    mode_l = (mode or "image").strip().lower()
    key = (scenario_key or "").strip()

    if key == "audio_music":
        return _apply_music(vals)
    if key == "audio_sfx":
        return _apply_sfx(vals)
    if key == "audio_voice":
        return _apply_voice(vals)
    if key in ("furniture_popin", "furniture_swap"):
        return _maybe_video(_apply_furniture(key, vals), mode_l, vals)
    if key == "day_to_night":
        return _maybe_video(_apply_day_night(vals), mode_l, vals)
    if key == "sky_mood":
        return _maybe_video(_apply_sky(vals), mode_l, vals)
    if key == "dehaze":
        return _maybe_video(_apply_dehaze(vals), mode_l, vals)
    if key == "landscaper":
        return _maybe_video(_apply_landscaper(vals), mode_l, vals)
    if key == "mirror_remove":
        return _maybe_video(_apply_mirror(vals), mode_l, vals)
    if key == "object_remove":
        return _maybe_video(_apply_object(vals), mode_l, vals)

    text = build_scenario_prompt(
        key,
        room_type=vals.get("room_type"),
        style=vals.get("style"),
        furniture_density=vals.get("furniture_density"),
        decor_amount=vals.get("decor_amount"),
        plants=vals.get("plants"),
        camera_feel=vals.get("camera_feel"),
        opt_a=vals.get("opt_a"),
        opt_b=vals.get("opt_b"),
        opt_c=vals.get("opt_c"),
        opt_d=vals.get("opt_d"),
        note=vals.get("note"),
    )
    return _maybe_video(text, mode_l, vals)


def _maybe_video(text: str, mode: str, vals: dict[str, str]) -> str:
    if mode not in ("video", "frame"):
        return (text or "").strip()
    cam = (vals.get("camera_note") or "").strip()
    extra = cam or "Keep camera motion continuous and natural; no hard cuts."
    body = (text or "").strip()
    if not body:
        return extra
    return f"{body}\n\nCamera / motion: {extra}"


def _apply_furniture(key: str, vals: dict[str, str]) -> str:
    room = (vals.get("room_type") or "Living Room").strip()
    style = (vals.get("style") or "Modern").strip()
    style_note = (vals.get("style_note") or "").strip()
    seating = (vals.get("seating") or "Sofa").strip()
    coffee = (vals.get("coffee_table") or "Yes").strip()
    sides = (vals.get("side_tables") or "Yes").strip()
    material = (vals.get("table_material") or "Wood").strip().lower()
    rug = (vals.get("area_rug") or "Light").strip()
    amount = (vals.get("furniture_density") or "Balanced").strip()
    decor = (vals.get("decor_amount") or "Light").strip()
    decor_note = (vals.get("decor_note") or "").strip()
    plants = (vals.get("plants") or "Light").strip()
    camera = (vals.get("camera_feel") or "Natural").strip()
    note = (vals.get("note") or "").strip()
    swap = key == "furniture_swap"

    if style == "Custom notes":
        style_lang = style_note or "a custom furniture style described in the notes"
    else:
        style_lang = _STYLE_LANG.get(style, f"{style.lower()} aesthetic")
        if style_note:
            style_lang = f"{style_lang}; {style_note}"

    pieces: list[str] = []
    seating_line = {
        "Sectional": "a well-proportioned sectional",
        "Sofa": "a sofa",
        "Loveseat": "a loveseat",
        "Armchair": "armchair seating",
        "Mix": "a mix of sofa and accent chairs",
        "None": "",
    }.get(seating, "a sofa")
    if seating_line:
        pieces.append(seating_line)

    tables: list[str] = []
    if coffee == "Yes":
        tables.append(f"a {material} coffee table")
    if sides == "Yes":
        tables.append(f"{material} side tables")
    if tables:
        pieces.append(" and ".join(tables))

    rug_line = {
        "None": "no area rug",
        "Light": "a light, quiet area rug",
        "Medium": "a medium-presence area rug that still reads listing-clean",
        "Bold": "a bold area rug that stays orderly and listing-clean",
    }.get(rug, "a light area rug")

    amount_line = {
        "Sparse": "Furniture amount: sparse—only the named pieces, generous empty floor.",
        "Balanced": "Furniture amount: balanced—complete but not crowded.",
        "Full": "Furniture amount: full staging for a premium listing, still orderly.",
    }.get(amount, "Furniture amount: balanced—complete but not crowded.")

    decor_line = {
        "None": "no decorative accessories or clutter",
        "Light": "light, restrained decor (a few pillows, one art piece or tray max)",
        "Medium": "balanced decor (pillows, art, and a few surface accents—still tidy)",
        "Heavy": "rich layered decor (pillows, throws, art, and styled surfaces—still ordered, not messy)",
    }.get(decor, "light, restrained decor")
    if decor_note and decor != "None":
        decor_line = f"{decor_line}; {decor_note}"

    plant_line = {
        "None": "no plants",
        "Light": "light greenery (one or two small plants only)",
        "Medium": "moderate plants for life and freshness without overcrowding",
        "Heavy": "generous but tasteful plant presence for a lush, lived-in feel",
    }.get(plants, "light greenery")

    if camera == "Wide":
        camera_line = (
            "Keep the exact same camera position, framing, and viewpoint as the source image; "
            "if needed, only a subtle wider-spacious composition feel—"
            "do not re-crop the room or invent a new angle."
        )
    elif camera == "Tighter":
        camera_line = (
            "Keep the exact same camera position, framing, and viewpoint as the source image; "
            "if needed, only a subtle tighter/longer-lens compression feel—"
            "do not re-crop the room or invent a new angle."
        )
    elif camera == "Normal":
        camera_line = (
            "Keep the exact same camera position, framing, and viewpoint as the source image; "
            "natural listing-photo focal length, no wide distortion."
        )
    else:
        camera_line = (
            "Keep the exact same camera position, framing, and viewpoint as the source image; "
            "keep a natural listing-photo feel."
        )

    audience = ""
    if "Kids" in room:
        if "Boy" in room:
            audience = "Age-appropriate for a young boy—playful but listing-clean, no logos or brand text."
        elif "Girl" in room:
            audience = "Age-appropriate for a young girl—soft and cheerful but listing-clean, no logos or brand text."
        else:
            audience = "Age-appropriate and gender-neutral for kids—calm colors, listing-clean, no logos or brand text."
    elif room == "Teen Room":
        audience = "Age-appropriate for a teen—casual modern, listing-clean, no logos or brand text."
    elif room == "Patio / Outdoor":
        audience = "Outdoor furniture suitable for a residential patio; weather-appropriate fabrics."
    elif room == "Kitchen":
        audience = "Kitchen staging only—do not remodel cabinets, counters, or appliances."
    elif room == "Other":
        audience = "Stage the visible room type as photographed; do not invent a different room."

    include = ", ".join(p for p in pieces if p) or "only the essential movable pieces named above"
    intent = SWAP_INTENT if swap else POPIN_INTENT
    verb = "Restage this" if swap else "Stage this space as a"
    extra_swap = (
        " Remove or fully replace current movable furniture so old and new pieces do not mix."
        if swap
        else ""
    )

    parts = [
        intent,
        (
            f"{verb} {room.lower()} using a {style_lang} for the furniture and soft goods only—"
            f"style applies to furnishings, not the room shell "
            f"(walls, floors, and architecture stay as photographed).{extra_swap}"
        ),
        f"Include {include}. Area rug: {rug_line}.",
        amount_line,
        f"Decor: {decor_line}.",
        f"Plants: {plant_line}.",
        camera_line,
    ]
    if audience:
        parts.append(audience)
    if note:
        parts.append(f"Additional notes: {note}")
    parts.append(PRESERVATION_BLOCK)
    return " ".join(parts)


def _apply_day_night(vals: dict[str, str]) -> str:
    scope = (vals.get("scope") or "Exterior").strip()
    intensity = (vals.get("intensity") or "Moderate").strip()
    interior = (vals.get("interior_lights") or "On").strip()
    landscape = (vals.get("landscape_lights") or "On").strip()
    moon = (vals.get("moonlight") or "Soft moonlight").strip()
    note = (vals.get("note") or "").strip()

    intensity_lang = {
        "Subtle": (
            "subtle naturalistic night: gentle ambient fill, modest practicals, "
            "sky still readable with a hint of residual dusk light"
        ),
        "Moderate": (
            "balanced listing night: clear deep-night sky, believable house and path lights, "
            "rich but not underexposed shadows"
        ),
        "Dramatic": (
            "cinematic night: deep blacks, strong contrast, bold practical pools of light, "
            "starry or inky sky — still photoreal, not fantasy"
        ),
    }.get(intensity, "balanced listing night")

    if scope == "Interior":
        where = "Turn this daytime interior into night. Exterior/sky should only change if visible through windows."
    elif scope == "Both feel":
        where = (
            "Turn this daytime photo into night with both interior and exterior night feel "
            "(rooms and any visible outside)."
        )
    else:
        where = "Turn this daytime exterior into a natural night look."

    interior_lang = {
        "On": "keep interior practicals on with warm, believable glow through lamps and windows",
        "Soft glow": "soft interior glow only—dim, cozy, no extra fixtures invented",
        "Off": "interior lights off; rooms read dark except leftover ambient night light",
    }.get(interior, "keep interior lights on")

    landscape_lang = {
        "On": "keep landscape and path lights on where they already exist",
        "Warm path lights": "warm path / landscape lights on if fixtures already exist; do not invent new poles",
        "Off": "landscape and path lights off",
    }.get(landscape, "keep landscape lights as photographed")

    moon_lang = {
        "None": "no obvious moonlight; night comes from practicals and sky only",
        "Soft moonlight": "soft moonlight as a cool fill—subtle, not a second sun",
        "Strong moonlight": "stronger moonlight as cool rim/fill, still photoreal",
    }.get(moon, "soft moonlight")

    parts = [
        where,
        f"Night intensity: {intensity_lang}.",
        f"Practicals: {interior_lang}. {landscape_lang}. Moonlight: {moon_lang}.",
        "Only lighting, sky, and existing light sources may change.",
        ARCHITECTURE_LOCK,
    ]
    if note:
        parts.append(f"Additional notes: {note}")
    return " ".join(parts)


def _apply_sky(vals: dict[str, str]) -> str:
    sky = (vals.get("sky_type") or "Clear blue").strip()
    coverage = (vals.get("coverage") or "Sky + light wrap").strip()
    time_feel = (vals.get("time_feel") or "Midday").strip()
    sat = (vals.get("saturation") or "Natural").strip()
    horizon = (vals.get("horizon") or "Keep horizon").strip()
    note = (vals.get("note") or "").strip()

    sky_lang = {
        "Clear blue": "a clean clear-blue sky with soft natural gradient",
        "Soft overcast": "a soft even overcast sky, bright but not stormy",
        "Dramatic clouds": "a dramatic clouded sky that still reads listing-real",
        "Sunset": "a warm sunset sky with believable color bands",
        "Golden hour": "a golden-hour sky with warm low light",
        "Storm-cleared": "a storm-cleared sky—cooler, crisp, leftover drama without rain",
    }.get(sky, "a clean natural sky")

    wrap = (
        "Replace the sky only; do not recolor the house or landscape."
        if coverage == "Sky only"
        else "Replace the sky and softly wrap ambient light/color onto the property so the mood matches, without redesigning materials."
    )
    horizon_lang = (
        "Keep the existing horizon line and tree/roof silhouettes exactly."
        if horizon == "Keep horizon"
        else "Soft-blend the new sky at the horizon so silhouettes stay locked."
    )
    sat_lang = {
        "Natural": "natural saturation",
        "Punchy": "slightly punchier color, still photoreal",
        "Muted": "muted, restrained color",
    }.get(sat, "natural saturation")

    parts = [
        f"Replace the sky with {sky_lang}. Time feel: {time_feel.lower()}. Color: {sat_lang}.",
        wrap,
        horizon_lang,
        "Do not add objects, people, or new structures. Architecture and landscape layout stay locked.",
        ARCHITECTURE_LOCK,
    ]
    if note:
        parts.append(f"Additional notes: {note}")
    return " ".join(parts)


def _apply_dehaze(vals: dict[str, str]) -> str:
    strength = (vals.get("strength") or "Medium").strip()
    target = (vals.get("target") or "Haze").strip()
    contrast = (vals.get("contrast") or "Natural").strip()
    color = (vals.get("color") or "Neutral").strip()
    keep = (vals.get("keep_distance") or "Yes").strip()
    note = (vals.get("note") or "").strip()

    strength_lang = {
        "Light": "gently clear",
        "Medium": "clear",
        "Strong": "strongly clear",
    }.get(strength, "clear")
    keep_lang = (
        "Keep a hint of distant atmospheric perspective so it stays natural."
        if keep == "Yes"
        else "Clear the air fully, including distant atmosphere."
    )
    contrast_lang = "natural contrast" if contrast == "Natural" else "slightly punchier contrast"
    color_lang = {
        "Neutral": "neutral color, no warm/cool grade",
        "Warm": "a slight warm clear-air grade",
        "Cool": "a slight cool clear-air grade",
    }.get(color, "neutral color")

    parts = [
        f"{strength_lang.capitalize()} {target.lower()} from this photo. Restore true local color and {contrast_lang}. {color_lang}.",
        keep_lang,
        "Do not sharpen into artifacts, do not redesign the property, and do not change the sky type unless haze is hiding it.",
        ARCHITECTURE_LOCK,
    ]
    if note:
        parts.append(f"Additional notes: {note}")
    return " ".join(parts)


def _apply_landscaper(vals: dict[str, str]) -> str:
    density = (vals.get("density") or "Balanced").strip()
    lawn = (vals.get("lawn") or "Fresh green").strip()
    trees = (vals.get("trees") or "Light").strip()
    shrubs = (vals.get("shrubs") or "Foundation only").strip()
    color = (vals.get("color") or "Cool greens").strip()
    note = (vals.get("note") or "").strip()

    density_lang = {
        "Sparse": "sparse, tidy landscaping—edited and clean, not empty-looking neglect",
        "Balanced": "balanced listing landscaping—manicured but not overplanted",
        "Lush": "lush but orderly landscaping—full beds, still listing-clean",
    }.get(density, "balanced listing landscaping")
    lawn_lang = {
        "Fresh green": "fresh, even green lawn",
        "Dormant": "dormant / seasonal lawn, still tidy",
        "Keep existing": "keep the existing lawn color and pattern",
    }.get(lawn, "fresh, even green lawn")
    trees_lang = {
        "None": "no new trees; keep existing tree silhouettes if present",
        "Light": "light tree presence—one or two tasteful trees if the lot allows",
        "Mature": "mature, well-placed trees that still respect the existing layout",
    }.get(trees, "light tree presence")
    shrubs_lang = {
        "None": "no new shrub beds",
        "Foundation only": "neat foundation plantings along the house",
        "Full beds": "full, shaped shrub beds that stay inside existing bed lines",
    }.get(shrubs, "neat foundation plantings")
    color_lang = {
        "Cool greens": "cool, fresh greens",
        "Warm": "warmer olive and sunlit greens",
        "Seasonal color": "tasteful seasonal color in the beds, still restrained",
    }.get(color, "cool, fresh greens")

    parts = [
        "Upgrade the exterior softscape to listing-ready landscaping.",
        f"Density: {density_lang}. Lawn: {lawn_lang}. Trees: {trees_lang}. Shrubs: {shrubs_lang}. Color: {color_lang}.",
        "Architecture and hardscape stay locked—house, driveway, walkways, fencing, and bed outlines do not move.",
        ARCHITECTURE_LOCK,
    ]
    if note:
        parts.append(f"Additional notes: {note}")
    return " ".join(parts)


def _apply_mirror(vals: dict[str, str]) -> str:
    target = (vals.get("target") or "All mirrors").strip()
    which = (vals.get("which") or "").strip()
    fill = (vals.get("fill") or "Match wall").strip()
    reflections = (vals.get("remove_reflections") or "Yes").strip()
    match = (vals.get("match_lighting") or "Yes").strip()
    note = (vals.get("note") or "").strip()

    if target == "Named only" and which:
        what = which
    elif which:
        what = which
    else:
        what = "all mirrors"

    fill_lang = (
        "Fill the space with the matching wall surface"
        if fill == "Match wall"
        else "Fill the space with the adjacent finish so the join is invisible"
    )
    refl = (
        "Remove the mirrors and their reflections only."
        if reflections == "Yes"
        else "Remove the mirror objects; leave unrelated reflections if they belong to other surfaces."
    )
    light = (
        "Match existing lighting, bounce, and reflection so the fill looks photographed, not painted in."
        if match == "Yes"
        else "Fill cleanly without adding new lighting."
    )
    parts = [
        f"Remove {what} only. {refl} {fill_lang}. {light}",
        "Keep architecture, camera, materials, and everything else identical.",
        PRESERVATION_BLOCK,
    ]
    if note:
        parts.append(f"Additional notes: {note}")
    return " ".join(parts)


def _apply_object(vals: dict[str, str]) -> str:
    which = (vals.get("which") or "").strip() or "the named object"
    scope = (vals.get("scope") or "Object + shadow").strip()
    fill = (vals.get("fill") or "Reconstruct background").strip()
    match = (vals.get("match_lighting") or "Yes").strip()
    note = (vals.get("note") or "").strip()

    scope_lang = (
        "Remove the named object only, leaving its shadow if it belongs to the room."
        if scope == "Named object only"
        else "Remove the named object and its contact shadow."
    )
    fill_lang = (
        "Reconstruct what should be behind it"
        if fill == "Reconstruct background"
        else "Fill with the nearby surface so the patch matches"
    )
    light = (
        "Match lighting and reflection so the repair is invisible."
        if match == "Yes"
        else "Fill cleanly without adding new lighting."
    )
    parts = [
        f"Remove {which} only. {scope_lang} {fill_lang}. {light}",
        "Change nothing else — same camera, lighting, materials, and architecture.",
        PRESERVATION_BLOCK,
    ]
    if note:
        parts.append(f"Additional notes: {note}")
    return " ".join(parts)


def _csv(raw: str) -> list[str]:
    return [p.strip() for p in (raw or "").replace(";", ",").split(",") if p.strip()]


def _apply_music(vals: dict[str, str]) -> str:
    def bit(key: str) -> str:
        v = (vals.get(key) or "").strip()
        if not v or v.lower() in ("custom", "—", "-"):
            return ""
        return v

    genre = bit("genre")
    sub = bit("subgenre")
    flare = bit("flare") or bit("flare_custom")
    era = bit("era")
    energy = bit("energy")
    tempo = bit("tempo") or bit("tempo_custom")
    mood = bit("mood")
    intro = bit("intro")
    buildup = bit("buildup")
    ending = bit("ending")
    use_case = bit("use_case") or bit("useCase")
    notes = bit("notes")
    vocals = bit("vocals")
    instrumental = (vals.get("instrumental") or "true").strip().lower() in (
        "true",
        "1",
        "yes",
        "on",
        "",
    )
    core = _csv(vals.get("instruments") or "")
    regional = _csv(vals.get("regional") or "")

    lines: list[str] = []
    if genre and sub:
        lines.append(f"{genre} track ({sub}).")
    elif genre:
        lines.append(f"{genre} track.")
    elif sub:
        lines.append(f"{sub} track.")
    else:
        lines.append("Instrumental music track.")

    feel = ", ".join(
        p
        for p in (
            f"{era} feel" if era else "",
            f"{energy} energy" if energy else "",
            tempo,
            mood,
        )
        if p
    )
    if feel:
        lines.append(feel[0].upper() + feel[1:] + ".")

    if core:
        lines.append(f"Core band: {', '.join(core)}.")
    if regional and flare:
        lines.append(
            f"Optional color: {', '.join(regional)} used sparingly as texture only — not the lead sound."
        )
    if flare and genre:
        lines.append(
            f"Flare: a light {flare} color on top of the {genre.lower()} core — "
            f"do not replace the primary genre; keep {genre.lower()} as the identity."
        )
    elif flare:
        lines.append(
            f"Flare: a light {flare} color only — secondary influence, not a genre swap."
        )

    struct: list[str] = []
    if intro:
        struct.append(f"Intro: {intro}")
    if buildup:
        struct.append(buildup)
    if ending:
        struct.append(f"Ending: {ending}")
    if struct:
        lines.append(". ".join(struct) + ".")
    if use_case:
        lines.append(f"Use: {use_case}.")
    if instrumental:
        lines.append("Instrumental only — no vocals, no lyrics, no choir.")
    elif vocals:
        lines.append(f"Vocals: {vocals}.")
    if notes:
        lines.append(notes)
    return " ".join(lines)


def _apply_sfx(vals: dict[str, str]) -> str:
    bits = [
        vals.get("sfx_type") or "SFX",
        (vals.get("length") or "").strip(),
        (vals.get("tone") or "").strip(),
        (vals.get("space") or "").strip(),
        (vals.get("weight") or "").strip(),
    ]
    head = ", ".join(b for b in bits if b)
    note = (vals.get("note") or "").strip()
    if note:
        return f"{head}. {note}"
    return head


def _apply_voice(vals: dict[str, str]) -> str:
    tone = (vals.get("tone") or "Warm").strip()
    pace = (vals.get("pace") or "Natural").strip()
    delivery = (vals.get("delivery") or "Conversational").strip()
    distance = (vals.get("distance") or "Studio").strip()
    script = (vals.get("script") or "").strip()
    lead = f"Tone: {tone}. Pace: {pace}. Delivery: {delivery}. Mic: {distance}."
    if script:
        return f"{lead}\n\n{script}"
    return lead
