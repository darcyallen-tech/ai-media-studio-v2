"""Local YuE2 music via ComfyUI HTTP API. Does not spawn Comfy or call fal.

Graphs live in workflows/comfy/ (API format). T2M style and lyrics are
PrimitiveStringMultiline nodes 113 and 114. Nodes 24 and 25 take those
fields as links — never write style/lyrics onto 24 or 25.
"""

from __future__ import annotations

import json
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.comfy_ace import (
    DEFAULT_COMFY_URL,
    _classify_error,
    _download_view,
    _get,
    comfy_url,
    format_comfy_error,
    is_api_graph,
    persist_comfy_url,
    queue_prompt,
    resolve_comfy_url,
)
from app.comfy_client import _multipart, comfy_input_dir
from app.config import PROJECT_ROOT, is_frozen
from app.naming import job_media_dir, timestamp_now, unique_path

# YuE2 plans ABC then renders. Stay inside the 15–20 minute window.
_POLL_S = 2.0
_POLL_MAX_S = 20 * 60

_KIND_FILES = {
    "t2m": "YuE2 TEXT TO MUSIC GROK ROCK.json",
    "cover": "YuE2 COVER.json",
    "rerender": "YuE2 RERENDER FROM ABC.json",
}
_SAVE_PREFIX = {
    "t2m": "AIMS_YuE2_T2M",
    "cover": "AIMS_YuE2_Cover",
    "rerender": "AIMS_YuE2_Rerender",
}
_AUDIO_EXT = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}
_AUDIO_MIME = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
}
_INSTRUMENTAL_STYLE = "instrumental, no vocals, no choir"
_INSTRUMENTAL_LYRICS = "[Instrumental]\nno vocals, no choir"
# YUE2_ABC.md: history outputs[id].text is a list of strings.
# T2M primary is 52 (ABC that fed Music). 14 is the unused planner preview.
_ABC_NODE_ORDER = {
    "t2m": ("52", "14"),
    "cover": ("44",),
    "rerender": ("52",),
}


def yue2_kind(spec: Any) -> str | None:
    """Endpoint and key decide the graph. Do not sniff the label (it may say re-render)."""
    endpoint = str(getattr(spec, "endpoint", "") or "").strip().lower()
    key = str(getattr(spec, "key", "") or "").strip().lower()
    blob = f"{endpoint} {key}"
    if "yue2" not in blob and "yue 2" not in blob:
        return None
    if "yue2-cover" in endpoint or key == "yue2 cover":
        return "cover"
    if "yue2-rerender" in endpoint or key == "yue2 rerender abc":
        return "rerender"
    if "yue2-t2m" in endpoint or key == "yue2 text to music" or "yue2" in blob:
        return "t2m"
    return None


def is_yue2(spec: Any) -> bool:
    return yue2_kind(spec) is not None


def workflow_file(kind: str) -> Path:
    name = _KIND_FILES[kind]
    roots = [PROJECT_ROOT / "workflows" / "comfy"]
    if is_frozen():
        roots.append(PROJECT_ROOT / "app" / "workflows" / "comfy")
    for root in roots:
        hit = root / name
        if hit.is_file():
            return hit
    return roots[0] / name


def load_graph(kind: str) -> dict[str, Any]:
    path = workflow_file(kind)
    if not path.is_file():
        raise FileNotFoundError(f"Missing YuE2 workflow: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("prompt"), dict):
        data = data["prompt"]
    if not isinstance(data, dict) or not is_api_graph(data):
        raise ValueError(f"YuE2 workflow must be Comfy Export (API) JSON: {path.name}")
    return data


def _is_link(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (str, int))
        and isinstance(value[1], int)
        and not isinstance(value[1], bool)
    )


def set_workflow_scalar(graph: dict[str, Any], node_id: str, field: str, value: Any) -> None:
    """Set a widget. Refuses links so T2M style/lyrics cannot land on nodes 24/25."""
    node = graph.get(str(node_id))
    if not isinstance(node, dict):
        raise RuntimeError(f"YuE2 workflow missing node {node_id}.")
    inputs = node.setdefault("inputs", {})
    if not isinstance(inputs, dict):
        raise RuntimeError(f"YuE2 node {node_id} has no inputs.")
    current = inputs.get(field)
    if _is_link(current):
        raise RuntimeError(
            f"Refusing to patch node {node_id}.{field}: it is a link to {current[0]}. "
            "On YuE2 text-to-music, style and lyrics are PrimitiveStringMultiline "
            "nodes 113 and 114."
        )
    inputs[field] = value


def _assert_link(graph: dict[str, Any], node_id: str, field: str, source: str) -> None:
    node = graph.get(str(node_id))
    inputs = node.get("inputs") if isinstance(node, dict) else None
    current = inputs.get(field) if isinstance(inputs, dict) else None
    if not _is_link(current) or str(current[0]) != str(source):
        raise RuntimeError(
            f"YuE2 T2M node {node_id}.{field} is not a link from {source}. "
            "Style and lyrics belong on nodes 113 and 114."
        )


def _music_and_latent(graph: dict[str, Any]) -> tuple[str, str]:
    music_id = latent_id = None
    for nid, node in graph.items():
        if not isinstance(node, dict):
            continue
        kind = str(node.get("class_type") or "")
        if kind == "YuE2GenerateMusic":
            music_id = str(nid)
        elif kind == "EmptyYuE2LatentAudio":
            latent_id = str(nid)
    if not music_id or not latent_id:
        raise RuntimeError("YuE2 graph missing Generate Music or Empty latent.")
    return music_id, latent_id


def _set_duration(graph: dict[str, Any], seconds: float) -> None:
    """Request length is Music max_duration only. Latent seconds stays Music out 1."""
    sec = float(seconds)
    music_id, latent_id = _music_and_latent(graph)
    set_workflow_scalar(graph, music_id, "max_duration", sec)
    latent = graph[latent_id]
    inputs = latent.setdefault("inputs", {})
    if not isinstance(inputs, dict):
        raise RuntimeError("YuE2 latent node has no inputs.")
    current = inputs.get("seconds")
    if not _is_link(current) or str(current[0]) != music_id or int(current[1]) != 1:
        inputs["seconds"] = [music_id, 1]
    preflight_duration(graph, sec)


def apply_instrumental_lock(style: str, lyrics: str, *, instrumental: bool) -> tuple[str, str]:
    """When Instrumental is on, both fields carry an explicit no-vocals lock."""
    if not instrumental:
        return style, lyrics
    style_out = (style or "").strip()
    low = style_out.lower()
    if "no vocals" not in low or "no choir" not in low:
        style_out = f"{style_out}, {_INSTRUMENTAL_STYLE}".strip(" ,")
    lyr = (lyrics or "").strip()
    if not lyr:
        return style_out, _INSTRUMENTAL_LYRICS
    llow = lyr.lower()
    if "no vocals" not in llow or "no choir" not in llow:
        lyr = f"{lyr}\nno vocals, no choir"
    return style_out, lyr


def _set_save(graph: dict[str, Any], prefix: str) -> None:
    if not prefix.startswith("AIMS_YuE2_"):
        raise RuntimeError("YuE2 save prefix must start with AIMS_YuE2_.")
    set_workflow_scalar(graph, "109", "filename_prefix", prefix)
    node = graph.get("109") or {}
    inputs = node.get("inputs") if isinstance(node, dict) else {}
    if isinstance(inputs, dict) and "format" in inputs:
        set_workflow_scalar(graph, "109", "format", "wav")
    if isinstance(inputs, dict) and "also_mp3" in inputs:
        set_workflow_scalar(graph, "109", "also_mp3", False)


def patch_t2m(
    graph: dict[str, Any],
    *,
    style: str,
    lyrics: str,
    max_duration: float,
    mode: str,
    seed_abc: int | None,
    seed_music: int | None,
    seed_sampler: int | None,
    steps: int,
    pasted_abc: str,
    use_pasted_abc: bool,
) -> dict[str, Any]:
    out = deepcopy(graph)
    # JSON: 113/114 feed both the ABC planner (24) and the music node (25).
    _assert_link(out, "24", "style", "113")
    _assert_link(out, "25", "style", "113")
    _assert_link(out, "24", "lyrics", "114")
    _assert_link(out, "25", "lyrics", "114")
    set_workflow_scalar(out, "113", "value", style)
    set_workflow_scalar(out, "114", "value", lyrics)
    set_workflow_scalar(out, "25", "mode", mode)
    set_workflow_scalar(out, "24", "mode", mode)
    _set_duration(out, max_duration)
    if seed_abc is not None:
        set_workflow_scalar(out, "24", "seed", int(seed_abc))
    if seed_music is not None:
        set_workflow_scalar(out, "25", "seed", int(seed_music))
    if seed_sampler is not None:
        set_workflow_scalar(out, "8", "seed", int(seed_sampler))
    set_workflow_scalar(out, "8", "steps", int(steps))
    abc = (out.get("25") or {}).get("inputs", {}).get("abc") if isinstance(out.get("25"), dict) else None
    if not _is_link(abc) or str(abc[0]) != "24" or int(abc[1]) != 0:
        out["25"].setdefault("inputs", {})["abc"] = ["24", 0]
    _ = pasted_abc, use_pasted_abc
    _set_save(out, _SAVE_PREFIX["t2m"])
    return out


def patch_cover(
    graph: dict[str, Any],
    *,
    audio_name: str,
    style: str,
    lyrics: str,
    sheetsage_mode: str,
    music_mode: str,
    max_duration: float,
    seed_music: int | None,
    seed_sampler: int | None,
    steps: int,
) -> dict[str, Any]:
    out = deepcopy(graph)
    set_workflow_scalar(out, "45", "audio", audio_name)
    set_workflow_scalar(out, "25", "style", style)
    set_workflow_scalar(out, "25", "lyrics", lyrics)
    set_workflow_scalar(out, "41", "mode", sheetsage_mode)
    set_workflow_scalar(out, "25", "mode", music_mode)
    _set_duration(out, max_duration)
    if seed_music is not None:
        set_workflow_scalar(out, "25", "seed", int(seed_music))
    if seed_sampler is not None:
        set_workflow_scalar(out, "8", "seed", int(seed_sampler))
    set_workflow_scalar(out, "8", "steps", int(steps))
    _set_save(out, _SAVE_PREFIX["cover"])
    return out


def patch_rerender(
    graph: dict[str, Any],
    *,
    abc: str,
    style: str,
    lyrics: str,
    mode: str,
    max_duration: float,
    seed_music: int | None,
    seed_sampler: int | None,
    steps: int,
) -> dict[str, Any]:
    out = deepcopy(graph)
    set_workflow_scalar(out, "50", "value", abc)
    set_workflow_scalar(out, "25", "style", style)
    set_workflow_scalar(out, "25", "lyrics", lyrics)
    set_workflow_scalar(out, "25", "mode", mode)
    _set_duration(out, max_duration)
    if seed_music is not None:
        set_workflow_scalar(out, "25", "seed", int(seed_music))
    if seed_sampler is not None:
        set_workflow_scalar(out, "8", "seed", int(seed_sampler))
    set_workflow_scalar(out, "8", "steps", int(steps))
    _set_save(out, _SAVE_PREFIX["rerender"])
    return out


def _as_bool(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def _mode(raw: Any, default: str) -> str:
    text = str(raw or "").strip().lower()
    if text in ("full", "melody"):
        return text
    return default


# Widget max on YuE2GenerateMusic.max_duration. Not a quality cap.
_DURATION_WIDGET_MAX_S = 900.0


def _clamp_duration(kind: str, seconds: float) -> tuple[float, str | None]:
    _ = kind
    default = 120.0
    try:
        n = float(seconds)
    except (TypeError, ValueError):
        n = default
    if n <= 0:
        n = default
    n = max(10.0, n)
    warn = None
    if n > _DURATION_WIDGET_MAX_S:
        warn = (
            f"YuE2 max_duration clamped to {int(_DURATION_WIDGET_MAX_S)}s "
            f"(widget max; requested {n:.0f}s)."
        )
        n = _DURATION_WIDGET_MAX_S
    elif n > 480:
        warn = f"YuE2 max_duration {n:.0f}s is a long run (widget allows up to 900)."
    return n, warn


def seed_is_random(extra: dict[str, Any], key: str) -> bool:
    flag = extra.get(f"{key}_randomize")
    if flag is None:
        return False
    return _as_bool(flag)


def _opt_seed(extra: dict[str, Any], key: str, *, randomize: bool) -> int | None:
    if randomize:
        return int(uuid.uuid4().int % (2**32))
    if key not in extra or extra.get(key) in (None, ""):
        return None
    try:
        n = int(extra[key])
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else 0


def _steps(extra: dict[str, Any]) -> int:
    try:
        n = int(extra.get("steps") if extra.get("steps") is not None else 32)
    except (TypeError, ValueError):
        n = 32
    return max(1, min(150, n))


def upload_audio(base: str, src: str | Path) -> str:
    """Put a reference clip in Comfy's input folder. LoadAudio reads that filename."""
    path = Path(src)
    if not path.is_file():
        raise FileNotFoundError(f"Reference audio not found: {path}")
    dest_dir = comfy_input_dir()
    if dest_dir is not None:
        target = dest_dir / path.name
        target.write_bytes(path.read_bytes())
        return target.name
    ctype = _AUDIO_MIME.get(path.suffix.lower(), "application/octet-stream")
    boundary, body = _multipart(
        {"overwrite": "true", "type": "input", "subfolder": ""},
        {"image": (path.name, path.read_bytes(), ctype)},
    )
    url = base.rstrip("/") + "/upload/image"
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120.0) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Comfy audio upload failed ({exc.code}).") from exc
    except Exception as exc:
        raise RuntimeError(_classify_error(exc, base.rstrip("/"), "/upload/image")) from exc
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Comfy audio upload returned non-JSON.") from exc
    name = str((data or {}).get("name") or "").strip()
    if not name:
        raise RuntimeError("Comfy audio upload returned no filename.")
    sub = str((data or {}).get("subfolder") or "").strip()
    return f"{sub}/{name}" if sub else name


def _history_entry(raw: Any, prompt_id: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    inner = raw.get(prompt_id)
    if isinstance(inner, dict):
        return inner
    if isinstance(raw.get("outputs"), dict) or isinstance(raw.get("status"), dict):
        return raw
    return {}


def _status_error(status: dict[str, Any]) -> str | None:
    """Comfy failure text, including errors that arrive before status.completed."""
    if not isinstance(status, dict) or not status:
        return None
    bits: list[str] = []
    saw_error = str(status.get("status_str") or "") == "error"
    messages = status.get("messages") or []
    if isinstance(messages, list):
        for item in messages:
            if not isinstance(item, (list, tuple)) or not item:
                continue
            kind = str(item[0])
            info = item[1] if len(item) >= 2 and isinstance(item[1], dict) else {}
            if kind == "execution_error":
                saw_error = True
                msg = str(info.get("exception_message") or info.get("exception_type") or "").strip()
                node = info.get("node_id")
                ntype = info.get("node_type")
                label = "Comfy"
                if node is not None:
                    label = f"node {node}"
                    if ntype:
                        label += f" ({ntype})"
                bits.append(f"{label}: {msg}" if msg else label)
            elif kind in ("execution_interrupted", "interrupted"):
                saw_error = True
                msg = str(info.get("exception_message") or "").strip()
                bits.append(msg or "Comfy interrupted the job.")
    if not saw_error:
        return None
    return "\n".join(bits) or "Comfy job failed."


def preflight_duration(graph: dict[str, Any], seconds: float) -> None:
    """max_duration is the request. Latent seconds must stay Music output 1."""
    music_id, latent_id = _music_and_latent(graph)
    target = float(seconds)
    md = (graph[music_id].get("inputs") or {}).get("max_duration")
    sec = (graph[latent_id].get("inputs") or {}).get("seconds")
    if _is_link(md) or not isinstance(md, (int, float)) or abs(float(md) - target) > 0.05:
        raise RuntimeError(
            f"YuE2 duration mismatch: Generate Music max_duration is {md}, requested {target:.2f}s."
        )
    if not _is_link(sec) or str(sec[0]) != music_id or int(sec[1]) != 1:
        raise RuntimeError(
            "YuE2 latent seconds must stay a link from Music output 1 "
            f"[{music_id}, 1] (text-encode seconds). Got {sec}. "
            "Do not replace that link with the request duration."
        )


def _duration_telemetry(
    *,
    max_duration: float,
    mode: str,
    abc_chars: int,
    budget_reduced: bool = False,
) -> str:
    """What AIMS knows. Comfy resolves out1 seconds and latent frames at runtime."""
    line = (
        f"max_duration={max_duration}; mode={mode}; abc_chars={abc_chars}; "
        "music out1 seconds=yue2_frames/25 inside Comfy; "
        "latent shape[-1]=round(out1_seconds*25); "
        "latent seconds stayed a link to Music output 1."
    )
    if budget_reduced:
        line += " budget reduced."
    return line


def _annotate_duration_error(
    message: str,
    *,
    max_duration: float,
    mode: str,
    abc_chars: int,
    status: dict[str, Any] | None = None,
) -> str:
    """Surface request telemetry. Do not retry by writing the request into latent seconds."""
    stack = ""
    if isinstance(status, dict):
        messages = status.get("messages") or []
        if isinstance(messages, list):
            for item in messages:
                if not isinstance(item, (list, tuple)) or len(item) < 2:
                    continue
                info = item[1] if isinstance(item[1], dict) else {}
                tb = info.get("traceback")
                if isinstance(tb, list):
                    stack = "\n".join(str(line).rstrip() for line in tb[-8:] if str(line).strip())
                elif isinstance(tb, str) and tb.strip():
                    stack = "\n".join(tb.strip().splitlines()[-8:])
                if stack:
                    break
    blob = f"{message}\n{stack}".lower()
    if not any(
        token in blob
        for token in ("latent duration", "text encode", "out of bounds", "indices[", "budget reduced")
    ):
        return message
    line = _duration_telemetry(
        max_duration=max_duration,
        mode=mode,
        abc_chars=abc_chars,
        budget_reduced="budget reduced" in blob,
    )
    if stack:
        line = f"{line}\nstack:\n{stack}"
    print(f"yue2.duration {line} :: {message}", flush=True)
    return f"{message}\n{line}"


def _collect_audio(hist: dict[str, Any]) -> list[dict[str, str]]:
    outputs = hist.get("outputs") if isinstance(hist, dict) else None
    if not isinstance(outputs, dict):
        return []
    ranked: list[dict[str, str]] = []
    for nid, node_out in outputs.items():
        if not isinstance(node_out, dict):
            continue
        for key, items in node_out.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("filename") or "").strip()
                if not name:
                    continue
                ext = Path(name).suffix.lower()
                if ext not in _AUDIO_EXT and key not in ("audio", "wav", "flac", "mp3"):
                    continue
                ranked.append(
                    {
                        "filename": name,
                        "subfolder": str(item.get("subfolder") or ""),
                        "type": str(item.get("type") or "output"),
                        "node": str(nid),
                        "ext": ext,
                    }
                )

    def score(row: dict[str, str]) -> tuple[int, int]:
        return (0 if row["node"] == "109" else 1, 0 if row["ext"] == ".wav" else 1)

    ranked.sort(key=score)
    return ranked


def _text_chunks(node_out: dict[str, Any]) -> str:
    chunks: list[str] = []
    sources = [node_out]
    ui = node_out.get("ui")
    if isinstance(ui, dict):
        sources.append(ui)
    for source in sources:
        for key in ("text", "string", "strings", "value"):
            val = source.get(key)
            if isinstance(val, list):
                chunks.extend(str(item).strip() for item in val if str(item).strip())
            elif isinstance(val, str) and val.strip():
                chunks.append(val.strip())
        if chunks:
            return "\n".join(chunks).strip()
    for val in node_out.values():
        if isinstance(val, list) and val and all(isinstance(item, str) for item in val):
            joined = "\n".join(item.strip() for item in val if item.strip())
            if len(joined) > 8:
                return joined
    return ""


def _history_abc(hist: dict[str, Any], kind: str) -> str:
    outputs = hist.get("outputs") if isinstance(hist, dict) else None
    if not isinstance(outputs, dict):
        return ""
    found: dict[str, str] = {}
    for nid, node_out in outputs.items():
        if isinstance(node_out, dict):
            text = _text_chunks(node_out)
            if text:
                found[str(nid)] = text
    for nid in _ABC_NODE_ORDER.get(kind, ()):
        hit = found.get(nid, "").strip()
        if hit:
            return hit[:200_000]
    if not found:
        return ""
    return max(found.values(), key=len).strip()[:200_000]


def _fail(spec: Any, status: str, endpoint: str = "") -> Any:
    from app.audio_service import AudioResult

    return AudioResult(
        ok=False,
        status=status,
        cost_label="Cost: $0.00",
        model=getattr(spec, "label", "YuE2 (local Comfy)"),
        model_key=getattr(spec, "key", ""),
        endpoint=endpoint,
        job_kind="music",
    )


def generate_yue2(
    *,
    prompt: str,
    duration_s: float,
    extra: dict[str, Any],
    output_dir: str | Path,
    spec: Any,
):
    """Queue one YuE2 graph. Comfy down returns the ACE health error. Never fal."""
    kind = yue2_kind(spec) or "t2m"
    preferred = str(extra.get("comfy_url") or "").strip() or comfy_url()
    base, health_err = resolve_comfy_url(preferred)
    if not base:
        return _fail(
            spec,
            health_err
            or f"No Comfy API at {preferred or comfy_url()}. Set Comfy URL in Settings "
            f"(default {DEFAULT_COMFY_URL}).",
            preferred or comfy_url(),
        )

    style = str(extra.get("style") or prompt or "").strip()
    lyrics = str(extra.get("lyrics") if extra.get("lyrics") is not None else "")
    raw_inst = extra.get("instrumental")
    instrumental = _as_bool(raw_inst) if raw_inst is not None else False
    if not style:
        return _fail(spec, "Enter a style.", base)
    if not instrumental and not lyrics.strip():
        return _fail(spec, "Enter lyrics, or turn on Instrumental.", base)
    style, lyrics = apply_instrumental_lock(style, lyrics, instrumental=instrumental)
    use_pasted = _as_bool(extra.get("use_pasted_abc"))
    pasted = str(extra.get("pasted_abc") or "")
    abc = str(extra.get("abc") or "").strip()
    if kind == "rerender" and not abc:
        return _fail(spec, "Paste an ABC score to re-render.", base)
    audio_path = str(extra.get("audio_path") or extra.get("reference_audio") or "").strip()
    if kind == "cover" and not audio_path:
        audio_path = str(extra.get("audio") or "").strip()
    if kind == "cover" and (not audio_path or not Path(audio_path).is_file()):
        return _fail(spec, "YuE2 Cover needs a reference audio file.", base)

    seconds, duration_warn = _clamp_duration(kind, duration_s)
    mode_sent = _mode(extra.get("mode"), "melody" if kind == "cover" else "full")
    abc_chars = len(abc) if kind == "rerender" else 0
    steps = _steps(extra)
    seed_music = _opt_seed(extra, "seed_music", randomize=seed_is_random(extra, "seed_music"))
    seed_sampler = _opt_seed(extra, "seed_sampler", randomize=seed_is_random(extra, "seed_sampler"))
    seed_abc = _opt_seed(extra, "seed_abc", randomize=seed_is_random(extra, "seed_abc"))
    t0 = time.perf_counter()
    try:
        graph = load_graph(kind)
        if kind == "cover":
            audio_name = upload_audio(base, audio_path)
            graph = patch_cover(
                graph,
                audio_name=audio_name,
                style=style,
                lyrics=lyrics,
                sheetsage_mode=_mode(extra.get("sheetsage_mode") or extra.get("mode"), "melody"),
                music_mode=_mode(extra.get("music_mode") or extra.get("mode"), "melody"),
                max_duration=seconds,
                seed_music=seed_music,
                seed_sampler=seed_sampler,
                steps=steps,
            )
        elif kind == "rerender":
            graph = patch_rerender(
                graph,
                abc=abc,
                style=style,
                lyrics=lyrics,
                mode=mode_sent,
                max_duration=seconds,
                seed_music=seed_music,
                seed_sampler=seed_sampler,
                steps=steps,
            )
        else:
            graph = patch_t2m(
                graph,
                style=style,
                lyrics=lyrics,
                max_duration=seconds,
                mode=mode_sent,
                seed_abc=seed_abc,
                seed_music=seed_music,
                seed_sampler=seed_sampler,
                steps=steps,
                pasted_abc=pasted,
                use_pasted_abc=use_pasted,
            )
        origin, post_url, queued = queue_prompt(base, graph)
        try:
            persist_comfy_url(origin)
        except Exception:
            pass
        base = origin
    except FileNotFoundError as exc:
        return _fail(spec, str(exc), base)
    except ValueError as exc:
        return _fail(spec, str(exc), base)
    except RuntimeError as exc:
        return _fail(spec, str(exc), base)
    except urllib.error.URLError as exc:
        return _fail(spec, _classify_error(exc, base, "/prompt"), base)
    except Exception as exc:
        return _fail(spec, f"Comfy YuE2 failed: {exc}", base)

    prompt_id = str(queued.get("prompt_id") or queued.get("promptId") or "").strip()
    if not prompt_id:
        if queued.get("error") or queued.get("node_errors"):
            return _fail(spec, format_comfy_error(400, queued), base)
        return _fail(spec, "Comfy returned no prompt_id.", base)

    deadline = time.monotonic() + _POLL_MAX_S
    hist: dict[str, Any] = {}
    while time.monotonic() < deadline:
        time.sleep(_POLL_S)
        try:
            raw = json.loads(_get(f"{base}/history/{urllib.parse.quote(prompt_id)}", timeout=10.0))
        except urllib.error.URLError as exc:
            reason = str(getattr(exc, "reason", exc)).lower()
            if "timed out" in reason or "timeout" in reason:
                continue
            return _fail(spec, _classify_error(exc, base, "/history"), base)
        except Exception:
            continue
        hist = _history_entry(raw, prompt_id)
        status = hist.get("status") if isinstance(hist.get("status"), dict) else {}
        err = _status_error(status)
        if err:
            return _fail(
                spec,
                _annotate_duration_error(
                    err,
                    max_duration=seconds,
                    mode=mode_sent,
                    abc_chars=abc_chars,
                    status=status if isinstance(status, dict) else None,
                ),
                base,
            )
        files = _collect_audio(hist)
        if status.get("completed") or files:
            if files:
                break
            if status.get("completed"):
                return _fail(spec, "Comfy YuE2 finished without an audio file.", base)
    else:
        return _fail(
            spec,
            "YuE2 timed out after 20 min waiting for Comfy. No fal fallback. "
            "Check that Comfy is still running.",
            base,
        )

    files = _collect_audio(hist)
    if not files:
        return _fail(spec, "Comfy YuE2 finished without an audio file.", base)
    if not str(files[0]["filename"]).lower().endswith(".wav"):
        return _fail(spec, "Comfy YuE2 did not return a WAV.", base)

    stamp = timestamp_now()
    media_dir = job_media_dir(output_dir, stamp=stamp)
    tag = {"t2m": "T2M", "cover": "Cover", "rerender": "Rerender"}[kind]
    dest = unique_path(media_dir, f"AIMS_YuE2_{tag}_{stamp}", ".wav")
    try:
        _download_view(base, files[0], dest)
    except Exception as exc:
        return _fail(spec, f"Could not copy Comfy WAV: {exc}", base)
    if dest.stat().st_size < 64:
        return _fail(spec, "Comfy WAV was empty.", base)

    abc_text = _history_abc(hist, kind)
    abc_path = ""
    if abc_text:
        abc_file = dest.with_suffix(".abc")
        abc_file.write_text(abc_text, encoding="utf-8")
        abc_path = str(abc_file.resolve())
    render_s = time.perf_counter() - t0
    label = getattr(spec, "label", "YuE2 (local Comfy)")
    notes = [
        f"Queued Comfy at {post_url}",
        "Local YuE2 — not billed. Cost: $0.00.",
        "YuE2 weights are CC-BY-NC (personal/testing; not for selling tracks as-is).",
    ]
    if duration_warn:
        notes.insert(0, duration_warn)
    telemetry = _duration_telemetry(
        max_duration=seconds, mode=mode_sent, abc_chars=len(abc_text) or abc_chars
    )
    notes.append(telemetry)
    print(f"yue2.duration {telemetry}", flush=True)
    if abc_text:
        notes.append("ABC:\n" + abc_text)
    from app.audio_service import AudioResult

    return AudioResult(
        ok=True,
        path=str(dest.resolve()),
        status=(
            f"{label} OK. {duration_warn} Saved {dest.name}. Cost: $0.00."
            if duration_warn
            else f"{label} OK. Saved {dest.name}. Cost: $0.00."
        ),
        metrics_line=f"{render_s:.1f}s · Cost: $0.00",
        cost_label="Cost: $0.00",
        notes=notes,
        abc=abc_text,
        abc_path=abc_path,
        render_seconds=render_s,
        model=label,
        model_key=getattr(spec, "key", ""),
        endpoint=base,
        job_kind="music",
    )
