"""Prompt enhance — xAI rewrite, model-aware, policy-light (no lectures)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.create_catalog import resolve_model
from app.partner_routing import enhance_instructions, evaluate, family_of
from app.xai_client import XAIConfigError, chat_json, chat_json_vision, still_data_url

log = logging.getLogger("ams.enhance")

SYSTEM = """You rewrite image/video generation prompts.

Rules:
- Preserve the user's creative intent, mood, camera, composition, and details.
- Adapt wording to the named model and modality (still, clip, music, SFX, or spoken voice).
- Replace likely-flagged trademark, franchise, celebrity, or brand names with
  short descriptive visual equivalents (look, costume, setting) — never the name.
- Do not add lectures, warnings, disclaimers, or meta commentary.
- Do not invent a new location, new character, or new plot beat the user did not ask for.
- Do not refuse. Just rewrite.
- Do not change the selected model. This is not a filter bypass.
- If character / scene / source / prop references are listed, mention them by role
  (character, scene, source, prop) so the rewrite stays consistent with those
  identities, locations, and objects. Do not drop them.
- For storyboard boards: keep shot order, attributed dialogue (Name: "line"),
  camera/move, duration, and framing. Rewrite into one master video prompt
  (global notes) for the selected model. Do not collapse or omit shots.
- When a hard character cap is given, FIT under that cap: short Image N map
  (Image 1 = character/scene/costume) plus one line per shot. Do not dump
  costume seams, fabric, or unused stats.
- When a source still is attached, look at it. First briefly note what is
  visible (sky, house, smoke, people, furniture, lighting). Then rewrite the
  user's prompt for the selected edit model, keeping their intent, grounded
  in that same frame. Do not invent a different scene.
- For Scene stills: do not paste the photoreal lock into the rewrite body.
  The lock is appended once after. Never write "not, not, not".
- When asked to strip cinematic/painterly/volumetric/concept-art/god rays:
  remove those words even if they appear in Notes. Keep 18mm / wide /
  architecture facts.
- Return JSON only: {"prompt": "<rewritten prompt>"}.
"""

TIGHT_NOTE = (
    "Creative Enhance is OFF. Tighten for the selected model. Do not invent shops, "
    "doors, or set dressing. Facts only: keep the user's location, camera, and architecture. "
    "If a photoreal lock is requested, keep it as one sentence after the rewrite — "
    "do not paste it into the body.\n\n"
)

CREATIVE_NOTE = (
    "Creative Enhance is ON. The user wrote a brief. Expand into a production location "
    "brief: architecture, materials, lighting direction, what sits on the far wall, "
    "entrance behind camera if Opposite. Stay in this location. Invent fitting set dressing "
    "that belongs here (bunks, weapon racks, straw, slit windows, stalls, bottles — "
    "whatever fits THIS place). Do not invent a new location, character, or plot beat. "
    "Photoreal lock one sentence if checked. Photoreal ON means more CONTENT, still "
    "photograph not painting. Not a filter bypass. Do not change the selected model.\n\n"
)

STORYBOARD_CREATIVE_NOTE = (
    "Storyboard + Creative ON: you may embroider shot-to-shot continuity from the "
    "attached shot prompts. You must still include every shot's camera and action; "
    "do not replace or drop shots.\n\n"
)

ACE_PACK = """ACE-Step 1.5 is selected (local Comfy). Rewrite for ACE — not Suno/MiniMax prose.

ACE uses TWO fields:
1) tags (caption) — comma-separated keywords controlling SOUND (genre, mood, instruments, timbre, production, era). 5–12 strong tags. Genre first. Specific instruments beat vague adjectives.
2) lyrics — TEMPORAL SCRIPT: [Section] markers + optional sung lines. Not a second copy of the tags essay.

Also align metadata when the user implied them: bpm, keyscale, timesignature, duration, language, instrumental.

Rules:
- Preserve the user's creative intent, genre, flare/regional color, energy, and structure.
- Do NOT invent a new genre that replaces the user's primary genre (flare is color only). Peru/Andean/charango/bombo stay texture only.
- Do NOT add lectures, disclaimers, or model switching.
- Do NOT put BPM/key/time-signature essays only in tags if dedicated metadata fields exist — set bpm/keyscale/timesignature AND optionally echo "{N} bpm" once in tags for rhythm lock.
- Do NOT stack conflicting tags (lo-fi + hi-fi; aggressive + serene; techno @ 70 bpm).
- Do NOT write long poetic paragraphs as tags.
- Caption ↔ lyrics consistency: instruments/energy in tags must match section labels in lyrics.
- Structure tags: keep concise. Prefer "[Chorus - anthemic]" over five stacked hyphen tags. Put rich style words in tags, not in the bracket.
- Lines meant to be sung: ~4–8 words / ~6–10 syllables; blank line between sections.
- Creative Enhance ON: expand tags with fitting instruments/production/texture AND flesh lyrics structure (intro/verse/chorus/bridge/outro or instrumental arc). Stay in the same genre/mood.
- Creative Enhance OFF: tighten into clean tags + minimal structure lyrics; do not invent new sections the user did not imply.
- Instrumental ON: include instrumental or no vocals in tags; lyrics are structure-only [Section] markers with NO sung text. Do not blank the structure.
- With vocals: vocal type in tags; never no vocals plus sung lines.
- Return JSON: {"prompt":"<tags>","tags":"<same as prompt>","lyrics":"[Intro]\\n\\n[Chorus - high energy]\\n\\n[Outro - fade out]","bpm":140,"keyscale":"D major","timesignature":"4","language":"en","instrumental":true}. prompt MUST equal tags.
"""

ACE_TIGHT_NOTE = (
    "Creative Enhance is OFF. Tighten into 5–12 clean comma tags + minimal "
    "[Section] lyrics from user hints only. Do not invent new sections. "
    "Do not write a MiniMax/Suno paragraph.\n\n"
)

ACE_CREATIVE_NOTE = (
    "Creative Enhance is ON. Expand tags with fitting instruments, production, "
    "and texture. Flesh the lyrics section arc (intro / main / solo / chorus energy / outro). "
    "Stay in the same genre and mood. Flare and Peru are color only — never replace the primary genre. "
    "Not a production location brief. Not a filter bypass.\n\n"
)

ACE_JSON_RULE = (
    'Return JSON only: {"prompt":"<tags>","tags":"<same as prompt>","lyrics":"...","bpm":140,'
    '"keyscale":"D major","timesignature":"4","language":"en","instrumental":true}. '
    "prompt MUST equal tags. tags are comma-separated keywords, not an essay."
)


def _parse_prompt(raw: str, fallback: str) -> str:
    text = (raw or "").strip()
    if not text:
        return fallback
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            out = str(data.get("prompt") or data.get("optimized_prompt") or "").strip()
            if out:
                return out
        if isinstance(data, str) and data.strip():
            return data.strip()
    except json.JSONDecodeError:
        pass
    quoted = re.search(
        r'"(?:prompt|optimized_prompt)"\s*:\s*"((?:\\.|[^"\\])*)"',
        text,
        re.DOTALL,
    )
    if quoted:
        try:
            return json.loads(f'"{quoted.group(1)}"').strip() or fallback
        except json.JSONDecodeError:
            cleaned = quoted.group(1).replace('\\"', '"').replace("\\n", "\n").strip()
            if cleaned:
                return cleaned
    if text[:1] in "{[" and len(text) < 8:
        return fallback
    return text or fallback


YUE_JSON_RULE = (
    'Return JSON only: {"style":"<sonic-only>","lyrics":"<section-tagged>"}. '
    "Never put verses, section tags, or \"no vocals / no lyrics\" dumps in style. "
    "Never leave lyrics empty. No Suno meta tags. "
    "Style keeps the chips, adds sonic fusion from Notes, and holds vocal timbre. "
    "Instrumental true: polish style; keep [Section] tags and (instrumental, ...) lines; no sung words. "
    "Instrumental false: under every [Section] put ONE short musical (cue) for arrangement, "
    "entry, or texture, THEN sung lines. Do not replace that cue with sung lines. "
    "Allowed cues: drums kick, full band, record scratches, guitar stab. "
    "Forbidden in cues and lyric lines: timbre and stage direction "
    "(gritty male, southern drawl, spitting) — those stay in style. "
    "Do not write (instrumental…) or (no vocals)."
)


def yue_enhance_target(
    *,
    model_id: str = "",
    label: str = "",
    endpoint: str = "",
) -> bool:
    blob = f"{model_id} {label} {endpoint}".lower()
    return "yue2" in blob or "yue 2" in blob


_LYRIC_PREMISE = re.compile(r"\blyrics?\b|\babout\b|\bwrite verses\b", re.I)
_SUNG_CUE = re.compile(
    r"\([^)\n]*(?:instrumental|no vocals)[^)\n]*\)|\binstrumental groove\b|\bno vocals\b",
    re.I,
)


def _chips_only_style(style: str) -> str:
    parts = [part.strip(" ,") for part in re.split(r",|\n", style) if part.strip(" ,")]
    kept = [part for part in parts if not _LYRIC_PREMISE.search(part)]
    return ", ".join(kept).strip(" ,")


_TIMBRE_WORD = re.compile(
    r"\b(?:warm|bright|airy|gritty|raspy|belted|intimate|southern drawl|"
    r"rap cadence|spoken-sung|stacked doubles|male voice|female voice|"
    r"raw grit|spitting)\b",
    re.I,
)
_ARRANGEMENT_WORD = re.compile(
    r"\b(?:band|groove|riff|swell|hit|fade|stop|drum|guitar|build|kick|"
    r"chord|arrangement|solo)\b",
    re.I,
)


_STAGE_PHRASE = re.compile(
    r"\b(?:gritty\s+male(?:\s+voice)?(?:\s+raw)?|male\s+voice(?:\s+raw)?|"
    r"female\s+voice(?:\s+raw)?|southern\s+drawl|raw\s+grit|"
    r"spitting|belted\s+vocal|rap\s+cadence|spoken-sung|stacked\s+doubles)\b",
    re.I,
)
_PLACEHOLDER_CUE = re.compile(r"^\([^)\n]*—\s*enhance fills\)$", re.I)
_CUE_SHORT = {
    "intro": "(cold-open riff, drums kick)",
    "verse": "(full band, groove)",
    "pre-chorus": "(build, guitar stab)",
    "chorus": "(full band, big hit)",
    "bridge": "(strip back, guitar stab)",
    "outro": "(ring out)",
}
_CUE_RICH = {
    "intro": "(cold-open riff, drums kick, record scratches under guitar)",
    "verse": "(full band, groove, guitar stab)",
    "pre-chorus": "(gradual build, guitar stab)",
    "chorus": "(full band, big hit, record scratches)",
    "bridge": "(strip back, then guitar stab)",
    "outro": "(ring out, soft fade)",
}


def _strip_instrumental_words(inner: str) -> str:
    text = re.sub(r"\bno vocals\b", "", inner or "", flags=re.I)
    text = re.sub(r"\binstrumental\b", "", text, flags=re.I)
    text = re.sub(r"\s+,", ",", text)
    text = re.sub(r"(?:,\s*){2,}", ", ", text)
    return re.sub(r"\s{2,}", " ", text).strip(" ,;-")


def _paren_inner_musical(inner: str) -> str:
    """Drop instrumental, no-vocals, and timbre words. Keep arrangement."""
    text = _TIMBRE_WORD.sub("", _strip_instrumental_words(inner))
    text = _STAGE_PHRASE.sub("", text)
    text = re.sub(r"\s+,", ",", text)
    text = re.sub(r"(?:,\s*){2,}", ", ", text)
    return re.sub(r"\s{2,}", " ", text).strip(" ,;-")


def _append_style_phrase(style: str, phrase: str) -> str:
    phrase = re.sub(r"\s{2,}", " ", (phrase or "")).strip(" ,;")
    if not phrase:
        return (style or "").strip(" ,")
    if phrase.lower() in (style or "").lower():
        return (style or "").strip(" ,")
    base = (style or "").strip(" ,")
    return f"{base}, {phrase}".strip(" ,") if base else phrase


def lift_timbre(style: str, lyrics: str) -> tuple[str, str]:
    """Vocal timbre leaves lyric parentheses and stage-direction lines for style.

    Musical arrangement parentheses stay. Only the timbre words inside them move.
    """
    found: list[str] = []

    def _take_timbre(source: str) -> None:
        seen: set[str] = set()
        for token in list(_TIMBRE_WORD.findall(source)) + list(_STAGE_PHRASE.findall(source)):
            key = token.lower()
            if key in seen:
                continue
            seen.add(key)
            found.append(token)

    def grab(match: re.Match[str]) -> str:
        inner = match.group(1).strip()
        if not inner or not (_TIMBRE_WORD.search(inner) or _STAGE_PHRASE.search(inner)):
            return match.group(0)
        _take_timbre(inner)
        kept = _paren_inner_musical(inner)
        return f"({kept})" if kept else ""

    text = re.sub(r"\(([^)\n]*)\)", grab, lyrics or "")
    body_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("[") or stripped.startswith("("):
            body_lines.append(stripped)
            continue
        if _STAGE_PHRASE.search(stripped):
            _take_timbre(stripped)
        cleaned = _STAGE_PHRASE.sub("", stripped)
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" ,;-")
        if cleaned:
            body_lines.append(cleaned)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(body_lines)).strip()
    next_style = (style or "").strip()
    for phrase in found:
        next_style = _append_style_phrase(next_style, phrase)
    return next_style, text


def enforce_sung_lyrics(lyrics: str, notes: str) -> str:
    """Strip instrumental / no-vocals words only. Musical cues stay.

    Notes are the Enhance premise and are not pasted under sections.
    """
    _ = notes
    out: list[str] = []
    for line in (lyrics or "").splitlines():
        stripped = line.strip()
        if not stripped:
            out.append(line)
            continue
        if re.fullmatch(r"\[[^\]]+\]", stripped) or _PLACEHOLDER_CUE.match(stripped):
            if not _PLACEHOLDER_CUE.match(stripped):
                out.append(stripped)
            continue
        if stripped.startswith("(") and stripped.endswith(")"):
            inner = _strip_instrumental_words(stripped[1:-1])
            if inner:
                out.append(f"({inner})")
            continue
        out.append(line)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()
    text = re.sub(r"\bno vocals\b", "", text, flags=re.I)
    text = re.sub(r"\binstrumental\b", "", text, flags=re.I)
    text = re.sub(r"\(\s*,", "(", text)
    text = re.sub(r",\s*\)", ")", text)
    text = re.sub(r"\(\s*\)", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def ensure_musical_cues(lyrics: str, *, creative: bool = False) -> str:
    """One arrangement cue under each [Section], then the sung lines."""
    text = (lyrics or "").strip()
    if "[" not in text:
        return text
    table = _CUE_RICH if creative else _CUE_SHORT
    chunks = re.split(r"(?m)^(?=\[[^\]]+\])", text)
    blocks: list[str] = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        lines = [line.strip() for line in chunk.splitlines() if line.strip()]
        tag = lines[0]
        if not re.fullmatch(r"\[[^\]]+\]", tag):
            blocks.append(chunk)
            continue
        name = tag[1:-1].split("-")[0].split(":")[0].strip().lower()
        cue = ""
        bodies: list[str] = []
        for line in lines[1:]:
            if line.startswith("(") and line.endswith(")") and line.count("(") == 1:
                if _PLACEHOLDER_CUE.match(line):
                    continue
                inner = _paren_inner_musical(line[1:-1])
                if inner and not cue:
                    cue = f"({inner})"
                continue
            if line:
                bodies.append(line)
        if not cue:
            cue = table.get(name) or ("(full band, groove, guitar stab)" if creative else "(full band, groove)")
        block = f"{tag}\n{cue}"
        if bodies:
            block += "\n" + "\n".join(bodies)
        blocks.append(block)
    return "\n\n".join(blocks).strip()


_VOICE_FRAGMENT = re.compile(
    r"\b(?:vocal|gritty|belted|airy|bright|warm|intimate|southern drawl|"
    r"rap cadence|spoken-sung|stacked doubles|male lead|female lead|"
    r"mixed leads|harmony stack|choir / chant)\b",
    re.I,
)


def merge_sonic_notes(style: str, notes: str, fallback_style: str = "") -> str:
    """Keep chip voice character and add short sonic fusion from Notes."""
    parts = [part.strip() for part in _chips_only_style(style).split(",") if part.strip()]
    have = ", ".join(parts).lower()

    def add(fragment: str) -> None:
        nonlocal have
        fragment = re.sub(r"\s{2,}", " ", fragment).strip(" ,;")
        if not fragment or _LYRIC_PREMISE.search(fragment):
            return
        if fragment.lower() in have:
            return
        parts.append(fragment)
        have = f"{have}, {fragment.lower()}".strip(" ,")

    for frag in re.split(r",|\n|;", notes or ""):
        frag = frag.strip()
        if not frag or _LYRIC_PREMISE.search(frag) or len(frag.split()) > 8:
            continue
        add(frag)
    for frag in re.split(r",", fallback_style or ""):
        if _VOICE_FRAGMENT.search(frag):
            add(frag)
    return ", ".join(parts).strip(" ,")


def _parse_style_lyrics(raw: str, fallback_style: str, fallback_lyrics: str) -> dict[str, str]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()
    data: dict[str, Any] = {}
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            data = parsed
    except json.JSONDecodeError:
        data = {}
    style = str(data.get("style") or data.get("tags") or data.get("prompt") or "").strip()
    lyrics = str(data.get("lyrics") or "").strip()
    if not style:
        style = (fallback_style or "").strip()
    if "[" not in lyrics:
        lyrics = (fallback_lyrics or "").strip()
    if "[" in style:
        style = style.split("[", 1)[0]
    style = " ".join(style.splitlines()).strip()
    style = re.sub(r"\b(no vocals|no lyrics|instrumental only)\b", "", style, flags=re.I)
    style = _chips_only_style(style)
    style = re.sub(r"\s{2,}", " ", style).strip(" ,")
    return {"style": style or _chips_only_style(fallback_style or ""), "lyrics": lyrics}


def ace_enhance_target(
    *,
    model_id: str = "",
    modality: str = "",
    mode: str = "",
    label: str = "",
    endpoint: str = "",
) -> bool:
    from app.comfy_ace import is_ace_step, looks_like_ace

    if looks_like_ace(model_id, modality, mode, label, endpoint):
        return True
    try:
        from app.audio_service import resolve_audio_spec

        spec = resolve_audio_spec(model_id, modality or "music")
        if spec and is_ace_step(spec):
            return True
    except Exception:
        pass
    return False


def _parse_ace_payload(raw: str, fallback: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()
    data: dict[str, Any] = {}
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            data = parsed
    except json.JSONDecodeError:
        data = {}
    tags = str(data.get("tags") or data.get("style") or data.get("prompt") or "").strip()
    lyrics = str(data.get("lyrics") or "")
    if not tags:
        from app.comfy_ace import split_tags_lyrics

        tags, split_lyrics = split_tags_lyrics(_parse_prompt(raw, fallback))
        if split_lyrics and not lyrics.strip():
            lyrics = split_lyrics
    if not tags:
        tags = _parse_prompt(raw, fallback)
    bpm = data.get("bpm")
    try:
        bpm_i = int(bpm) if bpm is not None and str(bpm).strip() != "" else None
    except (TypeError, ValueError):
        bpm_i = None
    instrumental = data.get("instrumental")
    if isinstance(instrumental, str):
        instrumental = instrumental.strip().lower() in ("1", "true", "yes", "on")
    elif instrumental is not None:
        instrumental = bool(instrumental)
    prompt = tags or fallback
    return {
        "prompt": prompt,
        "tags": prompt,
        "lyrics": lyrics,
        "bpm": bpm_i,
        "keyscale": str(data.get("keyscale") or "").strip() or None,
        "timesignature": str(data.get("timesignature") or "").strip() or None,
        "language": str(data.get("language") or "").strip() or None,
        "instrumental": instrumental,
        "notes": data.get("notes") if isinstance(data.get("notes"), list) else None,
    }


def _ace_looks_like_essay(tags: str) -> bool:
    t = (tags or "").strip()
    if t.count(",") >= 3:
        return False
    if len(t) > 160 and (". " in t or t.lower().startswith("create a")):
        return True
    return False


def _refs_block(refs: list[dict[str, Any]] | None) -> str:
    lines: list[str] = []
    for raw in refs or []:
        if not isinstance(raw, dict):
            continue
        role = str(raw.get("role") or "").strip().lower()
        if role not in ("character", "scene", "source", "prop", "costume"):
            continue
        name = str(raw.get("name") or raw.get("id") or role).strip() or role
        note = str(raw.get("note") or "").strip()
        if note:
            lines.append(f"- {role}: {name} — {note}")
        else:
            lines.append(f"- {role}: {name}")
    if not lines:
        return ""
    return (
        "References (mention each by role so the rewrite stays consistent):\n"
        + "\n".join(lines)
    )


def enhance_prompt_text(
    *,
    prompt: str,
    model_id: str = "",
    modality: str = "",
    mode: str = "",
    refs: list[dict[str, Any]] | None = None,
    image_urls: list[str] | None = None,
    max_prompt: int | None = None,
    creative: bool = False,
    instrumental: bool | None = None,
    lyrics: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    original = (prompt or "").strip()
    if not original:
        return {
            "ok": False,
            "prompt": "",
            "original": "",
            "error": "Enter a prompt to enhance.",
        }
    entry = resolve_model(model_id, mode=mode or None, modality=modality or None)
    label = (entry.label if entry else "") or model_id or "default model"
    extra = _refs_block(refs)
    wan_note = ""
    ep = ((entry.endpoint if entry else "") or "").lower()
    if "wan-3.0" in ep and "reference" in ep:
        wan_note = (
            "Wan 3.0 prefers clear positional refs in the rewritten prompt "
            "(Image 1 = character, Image 2 = scene, Video 1 = motion).\n\n"
        )
    if "fibo-edit-1.5" in ep:
        wan_note += (
            "Fibo Edit 1.5: label attached stills as <image_1> (source to edit), "
            "<image_2> <image_3> <image_4> for extra references (furniture, "
            "costume, object, style). Keep those tags in the rewrite.\n\n"
        )
    cap = 0
    try:
        cap = int(max_prompt or 0)
    except (TypeError, ValueError):
        cap = 0
    if cap > 0:
        wan_note += (
            f"HARD CAP: the rewritten prompt MUST be ≤ {cap} characters. "
            "Short Image N map (Image 1 = character, Image 2 = scene, "
            "costume ref = Image N) plus one line per shot. "
            "Do not dump costume seams, fabric, or unused stats.\n\n"
        )
    images = [p for p in (image_urls or []) if str(p).strip()]
    family_notes = ""
    if entry:
        fam = family_of(
            model_id=entry.id, label=entry.label, endpoint=entry.endpoint
        )
        family_notes = enhance_instructions(family=fam, modality=modality or "")
    readable = [p for p in images if still_data_url(p)]
    vision_note = (
        f"Source stills attached ({len(readable)}). Briefly note what is visible, "
        "then rewrite the user prompt for this edit model on that same frame.\n\n"
        if readable
        else ""
    )
    creative_on = bool(creative)
    flag = "true" if creative_on else "false"
    log.info("enhance.creative=%s", flag)
    print(f"enhance.creative={flag}", flush=True)
    endpoint = (entry.endpoint if entry else "") or ""
    ace = ace_enhance_target(
        model_id=model_id,
        modality=modality,
        mode=mode,
        label=label,
        endpoint=endpoint,
    )
    yue = (not ace) and yue_enhance_target(
        model_id=model_id, label=label, endpoint=endpoint
    )
    if ace:
        print("enhance.ace=true", flush=True)
        log.info("enhance.ace=true")
    creative_note = CREATIVE_NOTE if creative_on else TIGHT_NOTE
    if yue:
        creative_note = (
            "Style stays sonic: keep the chips, add fusion from Notes "
            "(hip-hop pocket, boom-bap, color) and vocal timbre. "
            "Do not write a location brief or put verses in style.\n\n"
        )
        if instrumental is False:
            if creative_on:
                creative_note += (
                    "Creative Enhance ON: one richer musical cue under each [Section], "
                    "then denser sung lines. Still one cue per section.\n\n"
                )
            else:
                creative_note += (
                    "Creative Enhance OFF: tighter words. Still one short musical cue "
                    "under each [Section], then the sung lines.\n\n"
                )
    elif ace:
        creative_note = ACE_CREATIVE_NOTE if creative_on else ACE_TIGHT_NOTE
    if creative_on and (mode or "").strip().lower() in ("storyboard", "board") and not ace:
        creative_note += STORYBOARD_CREATIVE_NOTE
    system = SYSTEM
    if yue:
        system = YUE_JSON_RULE
    elif ace:
        system = SYSTEM + "\n" + ACE_JSON_RULE
        if creative_on:
            system += (
                "\nCreative Enhance ON: expand ACE tags + section arc. "
                "A MiniMax/Suno essay is a failure."
            )
        else:
            system += "\nCreative Enhance OFF: tighten into ACE tags + minimal structure lyrics."
    elif creative_on:
        system = (
            SYSTEM
            + "\nCreative Enhance ON: expand the brief. A short tight rewrite is a failure. "
            "Add concrete production detail that fits the same location."
        )
    else:
        system = (
            SYSTEM
            + "\nCreative Enhance OFF: Tighten for the selected model. "
            "Do not invent shops, doors, or set dressing."
        )
    inst_line = ""
    if (ace or yue) and instrumental is not None:
        inst_line = f"Instrumental: {'true' if instrumental else 'false'}\n"
    lyric_line = ""
    if (lyrics or "").strip() and (ace or yue):
        lyric_line = f"Current lyrics:\n{lyrics.strip()}\n\n"
    if yue and (notes or "").strip():
        lyric_line += (
            "Notes: sonic fusion goes in style only. Lyric themes stay out of style "
            "and are not repeated under every section.\n"
            f"{notes.strip()}\n\n"
        )
    if yue and instrumental is False:
        cue_rule = (
            "one richer musical (cue), then denser sung lines"
            if creative_on
            else "one short musical (cue), then sung lines"
        )
        lyric_line += (
            "Instrumental is false. Under every [Section] write "
            f"{cue_rule}. "
            "The cue is arrangement, entry, or texture "
            "(drums kick, full band, record scratches, guitar stab). "
            "Do not replace that cue with sung lines. "
            "Do not return (instrumental…) or (no vocals). "
            "Do not put timbre or stage direction in the cue or the lyric lines "
            "(no gritty male, southern drawl, spitting). Those belong in style.\n\n"
        )
    user = (
        f"Mode: {mode or 'image'}\n"
        f"Modality: {modality or 't2i'}\n"
        f"Model: {label}\n"
        + inst_line
        + "\n"
        + creative_note
        + (ACE_PACK + "\n" if ace else "")
        + vision_note
        + wan_note
        + family_notes
        + (f"{extra}\n\n" if extra else "")
        + lyric_line
        + f"User prompt:\n{original}"
    )
    vision_used = False
    try:
        if readable:
            try:
                raw = chat_json_vision(
                    system=system,
                    user_text=user,
                    image_paths=readable,
                    temperature=0.35 if not creative_on else 0.7,
                    max_tokens=4000 if creative_on else 2200,
                )
                vision_used = True
            except Exception:
                log.exception("Enhance vision failed; falling back to text-only")
                raw = chat_json(
                    system=system,
                    user=user,
                    temperature=0.35 if not creative_on else 0.7,
                    max_tokens=4000 if creative_on else 2200,
                )
                vision_used = False
        else:
            raw = chat_json(
                system=system,
                user=user,
                temperature=0.35 if not creative_on else 0.7,
                max_tokens=4000 if creative_on else 2200,
            )
    except XAIConfigError as exc:
        return {"ok": False, "prompt": original, "original": original, "error": str(exc), "vision": False}
    except Exception as exc:
        return {
            "ok": False,
            "prompt": original,
            "original": original,
            "error": f"Enhance failed: {exc}",
            "vision": False,
        }
    ace_fields: dict[str, Any] | None = None
    yue_fields: dict[str, str] | None = None
    if yue:
        yue_fields = _parse_style_lyrics(raw, original, lyrics or "")
        if instrumental is True:
            kept: list[str] = []
            for line in yue_fields["lyrics"].splitlines():
                s = line.strip()
                if not s or s.startswith("[") or s.startswith("("):
                    kept.append(line)
            yue_fields["lyrics"] = "\n".join(kept).strip() or (lyrics or "").strip()
        rewritten = yue_fields["style"]
        if instrumental is False:
            yue_fields["lyrics"] = enforce_sung_lyrics(yue_fields["lyrics"], notes or "")
            lifted_style, lifted_lyrics = lift_timbre(
                _chips_only_style(yue_fields["style"]),
                yue_fields["lyrics"],
            )
            yue_fields["lyrics"] = ensure_musical_cues(lifted_lyrics, creative=creative_on)
            yue_fields["style"] = merge_sonic_notes(
                lifted_style, notes or "", original or ""
            )
            rewritten = yue_fields["style"]
    elif ace:
        ace_fields = _parse_ace_payload(raw, original)
        rewritten = str(ace_fields.get("prompt") or "")
        if instrumental is True:
            from app.comfy_ace import resolve_ace_lyrics

            ace_fields["lyrics"] = resolve_ace_lyrics(
                str(ace_fields.get("lyrics") or ""),
                instrumental=True,
            )
            ace_fields["instrumental"] = True
        if (
            creative_on
            and rewritten
            and (
                rewritten.strip() == original.strip()
                or _ace_looks_like_essay(rewritten)
            )
        ):
            log.info("enhance.ace creative retry (essay or duplicate)")
            try:
                raw = chat_json(
                    system=system,
                    user=user
                    + "\n\nYour last rewrite was MiniMax/Suno prose or a copy of the user. "
                    "Return ACE JSON: comma tags (genre first) + [Section] lyrics. prompt == tags.",
                    temperature=0.75,
                    max_tokens=4000,
                )
                retry_fields = _parse_ace_payload(raw, rewritten)
                retry_tags = str(retry_fields.get("prompt") or "")
                if retry_tags and not _ace_looks_like_essay(retry_tags):
                    ace_fields = retry_fields
                    rewritten = retry_tags
            except Exception:
                log.exception("Enhance ACE creative retry failed")
    else:
        rewritten = _parse_prompt(raw, "")
        if (
            rewritten
            and creative_on
            and (
                rewritten.strip() == original.strip()
                or len(rewritten) < max(80, int(len(original) * 1.25))
            )
        ):
            log.info("enhance.creative=true retry (tight or duplicate rewrite)")
            try:
                raw = chat_json(
                    system=system,
                    user=user
                    + "\n\nYour last rewrite was too tight. Creative Enhance is ON. "
                    "Expand into a production brief with concrete set dressing that "
                    "fits this location (architecture, materials, lighting direction, "
                    "far wall, entrance behind camera if Opposite).",
                    temperature=0.75,
                    max_tokens=4000,
                )
                retry = _parse_prompt(raw, "")
                if retry and len(retry) > len(rewritten):
                    rewritten = retry
            except Exception:
                log.exception("Enhance creative retry failed")
    if not rewritten:
        return {
            "ok": False,
            "prompt": original,
            "original": original,
            "error": "Enhance returned an empty or incomplete reply. Try again.",
            "vision": vision_used,
        }
    from app.sheet import (
        ensure_scene_photoreal,
        strip_scene_enhance_style,
        strip_scene_photoreal,
    )

    low = original.lower()
    sceneish = (not ace) and (not yue) and (
        "scene enhance" in low
        or "creative enhance" in low
        or "keep photoreal photograph lock" in low
        or "do not add a photoreal" in low
        or "location still" in low
        or "location-sheet" in low
        or "production location sheet" in low
        or "photoreal photograph, real materials" in low
    )
    if sceneish:
        rewritten = strip_scene_photoreal(rewritten)
        photoreal_off = "do not add a photoreal" in low
        if not photoreal_off:
            rewritten = strip_scene_enhance_style(original, rewritten)
            rewritten = ensure_scene_photoreal(rewritten, True)
    decision = evaluate(
        model_id=(entry.id if entry else model_id) or "",
        label=(entry.label if entry else "") or "",
        endpoint=(entry.endpoint if entry else "") or "",
        modality=modality or "",
        prompt=rewritten,
        ref_images=list(images),
        character_ids=[
            str(r.get("name") or r.get("id") or "")
            for r in (refs or [])
            if isinstance(r, dict) and str(r.get("role") or "").lower() == "character"
        ],
    )
    rewritten = decision.prompt
    out: dict[str, Any] = {
        "ok": True,
        "prompt": rewritten,
        "original": original,
        "error": None,
        "vision": vision_used,
        "creative": creative_on,
    }
    if yue and yue_fields:
        style = yue_fields["style"] or original
        out["prompt"] = style
        out["style"] = style
        out["tags"] = style
        out["lyrics"] = yue_fields["lyrics"]
        if instrumental is not None:
            out["instrumental"] = bool(instrumental)
    elif ace and ace_fields:
        tags = str(ace_fields.get("tags") or rewritten).strip() or rewritten
        out["prompt"] = tags
        out["tags"] = tags
        out["lyrics"] = str(ace_fields.get("lyrics") or "")
        if ace_fields.get("bpm") is not None:
            out["bpm"] = ace_fields["bpm"]
        if ace_fields.get("keyscale"):
            out["keyscale"] = ace_fields["keyscale"]
        if ace_fields.get("timesignature"):
            out["timesignature"] = ace_fields["timesignature"]
        if ace_fields.get("language"):
            out["language"] = ace_fields["language"]
        if ace_fields.get("instrumental") is not None:
            out["instrumental"] = bool(ace_fields["instrumental"])
        elif instrumental is not None:
            out["instrumental"] = bool(instrumental)
        if ace_fields.get("notes"):
            out["notes"] = ace_fields["notes"]
    if decision.switch:
        out["switch"] = decision.switch.as_dict()
    if decision.warning:
        out["warning"] = decision.warning
    return out
