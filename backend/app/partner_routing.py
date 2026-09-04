"""Fal partner routing for Enhance / Generate.

Legal jobs only. Rewrite for the selected model, or offer a one-click switch.
Never auto-switch. Never turn safety_checker off. Photoreal checkbox is a
style lock elsewhere — this module does not read it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# Routing signals (job+model), not a filter-evasion token list.
_GUN_RE = re.compile(
    r"\b(firearm|handgun|rifle|pistol|shotgun|assault rifle|ak-?47|"
    r"glock|real guns?|replica guns?|machine gun|sniper)\b",
    re.I,
)
_PRC_RE = re.compile(
    r"\b(xi jinping|tiananmen|chinese communist party|\bccp\b|"
    r"taiwan independence|prc (leader|politics)|dalai lama)\b",
    re.I,
)
_ELECTION_RE = re.compile(
    r"\b(election campaign|campaign ad|political campaign|vote for|"
    r"for president|attack ad|ballot)\b",
    re.I,
)
_SEXY_RE = re.compile(r"\bsexier\b|\bsexy\b", re.I)
_PERSON_RE = re.compile(
    r"\b(person|people|man|woman|men|women|face|faces|portrait|"
    r"character|actor|actress|kid|boy|girl|human)\b",
    re.I,
)
_BRAND_RE = re.compile(
    r"\b(nike|adidas|disney|marvel|coca-?cola|mcdonald'?s|"
    r"louis vuitton|gucci|apple logo|starbucks)\b",
    re.I,
)
# Likeness / living-person cue — routing, not a celebrity cheat sheet.
_LIKENESS_RE = re.compile(
    r"\b(looks like|lookalike|celebrity|named after|real person|"
    r"real people|likeness of)\b",
    re.I,
)
_NAME_PAIR_RE = re.compile(r"\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b")

_VIDEO_MODS = frozenset({"t2v", "i2v", "r2v", "v2v", "bridge", "extend", "storyboard"})
_STILL_INPUT_MODS = frozenset({"i2v", "r2v", "bridge", "storyboard", "v2v"})


@dataclass(frozen=True)
class SwitchOffer:
    message: str
    action_label: str
    target_model_id: str
    target_label: str

    @property
    def line(self) -> str:
        return f"{self.message} [{self.action_label}]"

    def as_dict(self) -> dict[str, str]:
        return {
            "message": self.message,
            "action_label": self.action_label,
            "target_model_id": self.target_model_id,
            "target_label": self.target_label,
            "line": self.line,
        }


@dataclass
class RoutingDecision:
    prompt: str
    block: bool = False
    switch: SwitchOffer | None = None
    warning: str | None = None
    family: str = ""
    notes: list[str] = field(default_factory=list)

    @property
    def message(self) -> str:
        if self.switch:
            return self.switch.line
        return self.warning or ""


def family_of(*, model_id: str = "", label: str = "", endpoint: str = "") -> str:
    blob = f"{model_id} {label} {endpoint}".lower()
    if "seedance" in blob:
        return "seedance"
    if "veo" in blob:
        return "veo"
    if "gemini-omni" in blob or "omni-flash" in blob or "gemini omni" in blob:
        return "omni"
    if "kling" in blob:
        return "kling"
    if "hailuo" in blob or "minimax/h3" in blob or "minimax h3" in blob:
        return "hailuo"
    if "ideogram" in blob:
        return "ideogram"
    if "recraft" in blob:
        return "recraft"
    if "qwen" in blob:
        return "qwen"
    if "nano-banana" in blob or "nano banana" in blob:
        return "nano"
    if "wan-3.0" in blob or "wan 3.0" in blob:
        return "wan"
    if "flux" in blob:
        return "flux"
    return ""


def enhance_instructions(*, family: str, modality: str) -> str:
    """Model-specific Enhance notes. Content embellish, not a policy bypass."""
    mod = (modality or "").strip().lower()
    lines: list[str] = [
        "Creative Enhance stays content embellish, not a policy bypass. "
        "Do not add sexualization, living-person names, or filter-evasion wording.",
        "Photoreal wording is a style lock from the UI; do not treat it as a Fal flag.",
    ]
    if family in ("veo", "omni") and mod in _VIDEO_MODS:
        lines.append(
            "Google video: drop real people's names; describe unnamed fictional adults. "
            "Do not describe a lookalike of a living person."
        )
    if family == "recraft":
        lines.append(
            "Recraft: do not use the word 'sexy'. Prefer editorial, fitted, confident."
        )
    if family == "nano":
        lines.append(
            "Google still: if this is a bland portrait, keep one unnamed adult and a "
            "simple uncluttered background. Do not add a couple or child unless the user asked."
        )
    if family == "qwen":
        lines.append(
            "Qwen: if the user named a brand or logo, warn in the prompt that the mark "
            "is not invented. Do not draw a Nike (or other) logo."
        )
    if family == "seedance" and mod in ("t2v",):
        lines.append(
            "Seedance T2V of unnamed photoreal adults is in-scope. Do not attach face stills."
        )
    return "\n".join(lines) + "\n"


def soft_rewrite(prompt: str, *, family: str, modality: str) -> tuple[str, str | None]:
    """Deterministic wording for the selected model. Does not invent IP marks."""
    text = prompt or ""
    warning = None
    if family == "recraft" and _SEXY_RE.search(text):
        text = _SEXY_RE.sub("editorial, fitted, confident", text)
    if family == "nano" and _looks_bland_portrait(text):
        if "simple" not in text.lower() or "unnamed" not in text.lower():
            text = text.rstrip(". ") + ". One unnamed adult, simple uncluttered background."
    if family in ("veo", "omni") and (modality or "").lower() in _VIDEO_MODS:
        text = _drop_likeness_names(text)
    if family == "qwen" and _BRAND_RE.search(text):
        warning = (
            "Qwen may flag logos (ip_infringement_suspect). The rewrite does not invent a brand mark."
        )
    return text, warning


def _looks_bland_portrait(prompt: str) -> bool:
    low = (prompt or "").lower()
    if any(w in low for w in ("couple", "grandson", "holding a notebook", "farmer")):
        return True
    if len(low) < 80 and _PERSON_RE.search(low) and "background" not in low:
        return True
    return False


def _drop_likeness_names(prompt: str) -> str:
    text = prompt or ""
    text = _LIKENESS_RE.sub("an unnamed adult", text)
    # Drop First Last pairs that look like living-person names in video prompts.
    def _repl(m: re.Match[str]) -> str:
        a, b = m.group(1), m.group(2)
        skip = {a.lower(), b.lower()} & {
            "image",
            "video",
            "shot",
            "slow",
            "push",
            "wide",
            "new",
            "york",
            "los",
            "angeles",
            "united",
            "states",
        }
        if skip:
            return m.group(0)
        return "an unnamed adult"

    return _NAME_PAIR_RE.sub(_repl, text)


def has_face_still(
    *,
    modality: str,
    prompt: str = "",
    start_still: str | None = None,
    end_still: str | None = None,
    ref_images: list[str] | None = None,
    character_ids: list[str] | None = None,
) -> bool:
    """Photoreal-face *input* heuristic. Does not read the Photoreal checkbox."""
    mod = (modality or "").strip().lower()
    if mod not in _STILL_INPUT_MODS:
        return False
    if character_ids:
        return True
    paths = " ".join(
        [start_still or "", end_still or "", *(ref_images or [])]
    ).lower().replace("\\", "/")
    if "character" in paths or "/characters/" in paths:
        return True
    stills = bool(start_still or end_still or ref_images)
    if mod in ("r2v", "storyboard") and stills:
        return True
    if stills and _PERSON_RE.search(prompt or ""):
        return True
    return False


def _fallback_ids(modality: str, *, still: bool = False) -> tuple[str, str, str]:
    """(target_model_id, target_label, action_label). Prefer Wan when video."""
    mod = (modality or "").strip().lower()
    if still or mod in ("t2i", "i2i", "r2i"):
        return ("flux 2 pro t2i", "Flux 2 Pro", "Switch to Flux")
    if mod in ("r2v", "storyboard"):
        return ("wan 3.0 reference", "Wan 3.0", "Switch to Wan")
    return ("wan 3.0 i2v", "Wan 3.0", "Switch to Wan")


def resolve_fallback(
    modality: str,
    *,
    still: bool = False,
    catalog: list[Any] | None = None,
) -> tuple[str, str, str]:
    want_id, want_label, action = _fallback_ids(modality, still=still)
    rows = catalog
    if rows is None:
        try:
            from app.create_catalog import list_models_for_ui

            mode = "image" if still or (modality or "").lower() in ("t2i", "i2i", "r2i") else "video"
            rows = list_models_for_ui(mode, modality if mode == "video" else modality)
        except Exception:
            rows = []
    needle = "flux" if still else "wan 3.0"
    for e in rows or []:
        blob = f"{getattr(e, 'id', '')} {getattr(e, 'label', '')} {getattr(e, 'endpoint', '')}".lower()
        if needle in blob:
            return (str(getattr(e, "id", "") or want_id), str(getattr(e, "label", "") or want_label), action)
    return (want_id, want_label, action)


def evaluate(
    *,
    model_id: str,
    modality: str,
    prompt: str,
    label: str = "",
    endpoint: str = "",
    start_still: str | None = None,
    end_still: str | None = None,
    ref_images: list[str] | None = None,
    character_ids: list[str] | None = None,
    catalog: list[Any] | None = None,
) -> RoutingDecision:
    family = family_of(model_id=model_id, label=label, endpoint=endpoint)
    mod = (modality or "").strip().lower()
    rewritten, warning = soft_rewrite(prompt, family=family, modality=mod)
    notes: list[str] = []
    if rewritten != (prompt or ""):
        notes.append("rewrote for selected model")
    face = has_face_still(
        modality=mod,
        prompt=rewritten,
        start_still=start_still,
        end_still=end_still,
        ref_images=ref_images,
        character_ids=character_ids,
    )
    switch: SwitchOffer | None = None
    block = False

    if family == "seedance" and mod in ("i2v", "r2v", "bridge", "storyboard") and face:
        tid, tlab, action = resolve_fallback(mod, catalog=catalog)
        switch = SwitchOffer(
            message="Seedance R2V blocks photoreal face refs — use Wan 3.0 / H3 / Kling.",
            action_label=action,
            target_model_id=tid,
            target_label=tlab,
        )
        block = True
    elif family in ("veo", "omni") and mod in _VIDEO_MODS and (
        _LIKENESS_RE.search(prompt or "")
        or _NAME_PAIR_RE.search(prompt or "")
        or (face and mod in _STILL_INPUT_MODS)
    ):
        # After rewrite, names may be gone; still block if a face still remains.
        still_likeness = face and mod in _STILL_INPUT_MODS
        names_left = bool(_LIKENESS_RE.search(rewritten) or _NAME_PAIR_RE.search(rewritten))
        if still_likeness or names_left:
            tid, tlab, action = resolve_fallback(mod, catalog=catalog)
            switch = SwitchOffer(
                message="Veo / Gemini Omni block real names or likenesses — use Wan 3.0 / H3 / Kling.",
                action_label=action,
                target_model_id=tid,
                target_label=tlab,
            )
            block = True
    elif family == "kling" and (_GUN_RE.search(prompt or "") or _PRC_RE.search(prompt or "")):
        tid, tlab, action = resolve_fallback(mod, catalog=catalog)
        switch = SwitchOffer(
            message="Kling blocks real guns / PRC politics — use Wan 3.0 / H3.",
            action_label=action,
            target_model_id=tid,
            target_label=tlab,
        )
        block = True
    elif family in ("hailuo", "ideogram") and _ELECTION_RE.search(prompt or ""):
        still = family == "ideogram" or mod in ("t2i", "i2i", "r2i")
        tid, tlab, action = resolve_fallback(mod, still=still, catalog=catalog)
        switch = SwitchOffer(
            message="Hailuo / Ideogram block election campaign ads — use Flux 2 or Wan 3.0.",
            action_label=action,
            target_model_id=tid,
            target_label=tlab,
        )
        block = True

    return RoutingDecision(
        prompt=rewritten,
        block=block,
        switch=switch,
        warning=warning,
        family=family,
        notes=notes,
    )


def evaluate_state(entry: Any, state: Any) -> RoutingDecision:
    slots = getattr(state, "slots", None)
    return evaluate(
        model_id=str(getattr(entry, "id", "") or getattr(state, "model_id", "") or ""),
        label=str(getattr(entry, "label", "") or ""),
        endpoint=str(getattr(entry, "endpoint", "") or ""),
        modality=str(getattr(state, "modality", "") or ""),
        prompt=str(getattr(state, "prompt", "") or ""),
        start_still=getattr(slots, "start_still", None) if slots else None,
        end_still=getattr(slots, "end_still", None) if slots else None,
        ref_images=list(getattr(slots, "ref_images", None) or []) if slots else None,
        character_ids=list(getattr(slots, "character_ids", None) or []) if slots else None,
    )


def switch_from_error(
    raw: str,
    *,
    model_id: str = "",
    label: str = "",
    endpoint: str = "",
    modality: str = "",
) -> SwitchOffer | None:
    """Map Fal 422 / content_policy_violation / partner_validation to a switch."""
    blob = f"{raw} {model_id} {label} {endpoint}".lower()
    family = family_of(model_id=model_id, label=label, endpoint=endpoint)
    if "seedance" in blob or family == "seedance":
        if any(
            t in blob
            for t in (
                "content_policy",
                "partner_validation",
                "422",
                "likeness",
                "photoreal",
                "real people",
                "face",
            )
        ):
            tid, tlab, action = resolve_fallback(modality or "r2v")
            return SwitchOffer(
                message="Seedance R2V blocks photoreal face refs — use Wan 3.0 / H3 / Kling.",
                action_label=action,
                target_model_id=tid,
                target_label=tlab,
            )
    if family in ("veo", "omni") or "can't create videos with real people" in blob:
        tid, tlab, action = resolve_fallback(modality or "i2v")
        return SwitchOffer(
            message="Veo / Gemini Omni block real names or likenesses — use Wan 3.0 / H3 / Kling.",
            action_label=action,
            target_model_id=tid,
            target_label=tlab,
        )
    if family == "kling" and any(t in blob for t in ("gun", "weapon", "politic", "policy")):
        tid, tlab, action = resolve_fallback(modality or "i2v")
        return SwitchOffer(
            message="Kling blocks real guns / PRC politics — use Wan 3.0 / H3.",
            action_label=action,
            target_model_id=tid,
            target_label=tlab,
        )
    if family in ("hailuo", "ideogram") and any(t in blob for t in ("election", "campaign", "politic")):
        still = family == "ideogram"
        tid, tlab, action = resolve_fallback(modality or "t2i", still=still)
        return SwitchOffer(
            message="Hailuo / Ideogram block election campaign ads — use Flux 2 or Wan 3.0.",
            action_label=action,
            target_model_id=tid,
            target_label=tlab,
        )
    if "content_policy_violation" in blob or "partner_validation" in blob:
        tid, tlab, action = resolve_fallback(modality or "i2v")
        return SwitchOffer(
            message="This model refused the job — try Wan 3.0 / H3 / Kling.",
            action_label=action,
            target_model_id=tid,
            target_label=tlab,
        )
    return None
