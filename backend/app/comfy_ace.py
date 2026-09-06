"""Local ACE-Step 1.5 via ComfyUI HTTP API. Does not spawn or embed Comfy."""

from __future__ import annotations

import json
import re
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.config import PROJECT_ROOT, is_frozen
from app.naming import job_media_dir, make_output_stem, timestamp_now, unique_path
from app.prefs import load_prefs

DEFAULT_COMFY_URL = "http://127.0.0.1:8188"
WORKFLOW_NAME = "audio_ace_step_1_5_split.json"
_EXPORT_API = "Export (API) from Comfy, replace this file."
_AMS_PORTS = frozenset({8000, 8001, 5173})
_SKIP_UI_TYPES = frozenset(
    {
        "Note",
        "MarkdownNote",
        "Reroute",
        "PrimitiveNode",
        "PrimitiveInt",
        "PrimitiveFloat",
        "PrimitiveString",
        "PrimitiveBoolean",
    }
)
_WIDGET_NAMES: dict[str, list[str]] = {
    "UNETLoader": ["unet_name", "weight_dtype"],
    "CLIPLoader": ["clip_name", "type", "device"],
    "DualCLIPLoader": ["clip_name1", "clip_name2", "type", "device"],
    "VAELoader": ["vae_name"],
    "KSampler": [
        "seed",
        "control_after_generate",
        "steps",
        "cfg",
        "sampler_name",
        "scheduler",
        "denoise",
    ],
    "ModelSamplingAuraFlow": ["shift"],
    "TextEncodeAceStepAudio1.5": [
        "tags",
        "lyrics",
        "seed",
        "bpm",
        "duration",
        "timesignature",
        "language",
        "keyscale",
        "generate_audio_codes",
        "cfg_scale",
        "temperature",
        "top_p",
        "top_k",
        "min_p",
    ],
    "TextEncodeAceStepAudio": ["lyrics", "lyrics_strength", "tags"],
    "EmptyAceStep1.5LatentAudio": ["seconds", "batch_size"],
    "EmptyAceStepLatentAudio": ["seconds", "batch_size"],
    "SaveAudioMP3": ["filename_prefix", "quality"],
    "SaveAudio": ["filename_prefix"],
    "SaveAudioAdvanced": ["filename_prefix", "format", "format.quality"],
    "VAEDecodeAudio": [],
    "ConditioningZeroOut": [],
}
_SKIP_WIDGETS = frozenset({"control_after_generate"})
_AUDIO_EXT = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"}
_POLL_S = 1.0
_POLL_MAX_S = 600.0
_BPM_RE = re.compile(r"(\d{2,3})\s*bpm", re.I)
_KEY_RE = re.compile(
    r"\b([A-G](?:#|b)?)\s*(major|minor)\b",
    re.I,
)


def normalize_comfy_url(raw: str | None) -> str:
    """Settings COMFY_URL only. Never AMS origin, Vite, or a relative path."""
    u = str(raw or "").strip().rstrip("/")
    if not u or u.startswith("/") or u.startswith("?"):
        return DEFAULT_COMFY_URL
    if "://" not in u:
        u = "http://" + u
    parsed = urllib.parse.urlparse(u)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return DEFAULT_COMFY_URL
    if parsed.hostname in ("localhost", "127.0.0.1") and parsed.port == 5173:
        return DEFAULT_COMFY_URL
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def comfy_url() -> str:
    return normalize_comfy_url(str(load_prefs().get("comfy_url") or "") or DEFAULT_COMFY_URL)


def use_local_comfy_music() -> bool:
    return bool(load_prefs().get("use_local_comfy_music"))


def format_405(post_url: str) -> str:
    return f"405 on {post_url} (this app) — set Comfy URL to :8188"


def candidate_urls(preferred: str | None = None) -> list[str]:
    """Only Settings COMFY_URL (optional Prompt override). Never :8000 fallback."""
    return [normalize_comfy_url(preferred or comfy_url())]


def _classify_error(exc: BaseException, url: str, path: str) -> str:
    msg = str(getattr(exc, "reason", exc) or exc).lower()
    code = getattr(exc, "code", None)
    if isinstance(exc, TimeoutError) or "timed out" in msg or "timeout" in msg:
        return f"{url}{path} timeout"
    if code == 404 or "404" in msg:
        return f"{url}{path} 404"
    if (
        "refused" in msg
        or "10061" in msg
        or "errno 111" in msg
        or "winerror 10061" in msg
    ):
        return f"{url}{path} connection refused"
    if code:
        return f"{url}{path} {code}"
    return f"{url}{path} {exc}"


def probe_comfy(base: str) -> tuple[bool, str | None]:
    """GET {COMFY_URL}/system_stats. Comfy JSON has devices/system. AMS /health is not Comfy."""
    root = normalize_comfy_url(base)
    path = "/system_stats"
    url = root + path
    try:
        raw = _get(url, timeout=2.5)
    except urllib.error.HTTPError as exc:
        return False, _classify_error(exc, root, path)
    except Exception as exc:
        return False, _classify_error(exc, root, path)
    try:
        data = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
    except json.JSONDecodeError:
        return False, f"{url} is not Comfy JSON (AMS /health is not Comfy)"
    if not isinstance(data, dict):
        return False, f"{url} is not Comfy JSON (AMS /health is not Comfy)"
    if "devices" not in data and "system" not in data:
        return False, f"{url} is not Comfy (need devices/system). AMS /health is not Comfy."
    return True, None


def resolve_comfy_url(preferred: str | None = None) -> tuple[str | None, str]:
    """Return (Settings COMFY_URL, error). Never AMS/Vite fallback."""
    base = normalize_comfy_url(preferred or comfy_url())
    ok, err = probe_comfy(base)
    if ok:
        return base, ""
    return None, err or (
        f"No Comfy API at {base}. Set Comfy URL in Settings "
        f"(default {DEFAULT_COMFY_URL})."
    )


def looks_like_ace(*parts: Any) -> bool:
    blob = " ".join(str(p or "") for p in parts).lower()
    return (
        "ace-step" in blob
        or "ace step" in blob
        or blob.startswith("comfy:")
        or "comfy:ace" in blob
    )


def is_ace_step(spec: Any) -> bool:
    return looks_like_ace(
        getattr(spec, "key", ""),
        getattr(spec, "endpoint", ""),
        getattr(spec, "label", ""),
    )


_TAGS_LYRICS_RE = re.compile(
    r"TAGS:\s*(.*?)\s*LYRICS:\s*(.*)\s*$",
    re.I | re.S,
)


def split_tags_lyrics(text: str) -> tuple[str, str]:
    raw = (text or "").strip()
    hit = _TAGS_LYRICS_RE.search(raw)
    if hit:
        return hit.group(1).strip(), hit.group(2).strip()
    return raw, ""


def structure_only_lyrics(lyrics: str) -> str:
    """Keep [Section] markers; drop sung lines. Never invent sections."""
    kept: list[str] = []
    for line in (lyrics or "").splitlines():
        s = line.strip()
        if not s:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if s.startswith("[") and "]" in s:
            kept.append(s[: s.find("]") + 1])
    text = "\n".join(kept).strip()
    return re.sub(r"\n{3,}", "\n\n", text)


def resolve_ace_lyrics(lyrics: str, *, instrumental: bool) -> str:
    text = lyrics or ""
    if not instrumental:
        return text
    return structure_only_lyrics(text)


def workflow_path() -> Path:
    """Project root first, then workflows/ (checkout + packaged)."""
    roots = [
        PROJECT_ROOT,
        PROJECT_ROOT / "workflows",
        Path(__file__).resolve().parent / "workflows",
    ]
    if is_frozen():
        roots.append(PROJECT_ROOT / "app" / "workflows")
    for root in roots:
        hit = root / WORKFLOW_NAME
        if hit.is_file():
            return hit
    return PROJECT_ROOT / WORKFLOW_NAME


def _get(url: str, timeout: float = 3.0) -> bytes:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _post_json(
    url: str,
    payload: dict[str, Any],
    *,
    origin: str,
    timeout: float = 30.0,
) -> tuple[int, dict[str, Any]]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Origin": origin,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            status = int(getattr(resp, "status", 200) or 200)
    except urllib.error.HTTPError as exc:
        raw = ""
        try:
            raw = exc.read().decode("utf-8", errors="replace")
        except Exception:
            raw = ""
        body: dict[str, Any] = {}
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    body = parsed
            except json.JSONDecodeError:
                body = {"error": raw[:300]}
        return int(exc.code), body
    out = json.loads(raw) if raw else {}
    return status, out if isinstance(out, dict) else {}


def queue_post_urls(base: str) -> list[tuple[str, str]]:
    """POST {COMFY_URL}/prompt then {COMFY_URL}/api/prompt only."""
    root = normalize_comfy_url(base)
    return [(root + "/prompt", root), (root + "/api/prompt", root)]


def persist_comfy_url(url: str) -> None:
    from app.prefs import save_prefs

    clean = normalize_comfy_url(url)
    parsed = urllib.parse.urlparse(clean)
    if parsed.port in _AMS_PORTS:
        return
    if clean:
        save_prefs(comfy_url=clean)


def queue_prompt(base: str, graph: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    """POST until 200. Returns (origin_base, post_url, body)."""
    payload = {"prompt": graph, "client_id": str(uuid.uuid4())}
    first_405 = ""
    last_err = ""
    for post_url, origin in queue_post_urls(base):
        try:
            status, body = _post_json(post_url, payload, origin=origin)
        except urllib.error.URLError as exc:
            last_err = _classify_error(exc, origin, urllib.parse.urlparse(post_url).path)
            continue
        except Exception as exc:
            last_err = str(exc)
            continue
        if status == 200:
            return origin, post_url, body
        if status == 405:
            if not first_405:
                first_405 = post_url
            last_err = format_405(post_url)
            continue
        if status == 400 or body.get("error") or body.get("node_errors"):
            raise RuntimeError(format_comfy_error(status, body))
        last_err = f"{post_url} {status}"
        if isinstance(body.get("error"), str) and body["error"]:
            last_err = str(body["error"])
    if first_405:
        raise RuntimeError(format_405(first_405))
    raise RuntimeError(
        last_err
        or f"No Comfy API at {normalize_comfy_url(base)}. Set Comfy URL in Settings "
        f"(default {DEFAULT_COMFY_URL})."
    )


def parse_bpm(raw: Any, fallback: int = 120) -> int:
    if isinstance(raw, (int, float)) and raw:
        n = int(raw)
        return max(10, min(300, n))
    text = str(raw or "")
    hit = _BPM_RE.search(text)
    if hit:
        return max(10, min(300, int(hit.group(1))))
    return fallback


def parse_keyscale(raw: Any, fallback: str = "C major") -> str:
    text = str(raw or "").strip()
    if not text:
        return fallback
    hit = _KEY_RE.search(text)
    if hit:
        return f"{hit.group(1).upper()} {hit.group(2).lower()}"
    low = text.lower()
    if "major" in low or "minor" in low:
        return text
    return fallback


def is_ui_graph(data: dict[str, Any]) -> bool:
    return isinstance(data.get("nodes"), list) and isinstance(data.get("links"), list)


def is_api_graph(data: dict[str, Any]) -> bool:
    nodes = [
        v
        for k, v in data.items()
        if str(k).isdigit() and isinstance(v, dict) and v.get("class_type")
    ]
    return bool(nodes)


def format_comfy_error(status: int, body: dict[str, Any]) -> str:
    """error.message + node_errors — never a bare '400'."""
    lines: list[str] = []
    err = body.get("error")
    if isinstance(err, dict):
        msg = str(err.get("message") or "").strip()
        details = str(err.get("details") or "").strip()
        etype = str(err.get("type") or "").strip()
        if msg:
            lines.append(msg)
        if details and details not in lines:
            lines.append(details)
        if not lines and etype:
            lines.append(etype)
    elif isinstance(err, str) and err.strip():
        lines.append(err.strip())
    node_errors = body.get("node_errors")
    if isinstance(node_errors, dict) and node_errors:
        for nid, info in node_errors.items():
            cls = ""
            bits: list[str] = []
            if isinstance(info, dict):
                cls = str(info.get("class_type") or "").strip()
                errs = info.get("errors")
                if isinstance(errs, list):
                    for item in errs:
                        if isinstance(item, dict):
                            em = str(item.get("message") or "").strip()
                            ed = str(item.get("details") or "").strip()
                            piece = em
                            if ed and ed != em:
                                piece = f"{em}: {ed}" if em else ed
                            if piece:
                                bits.append(piece)
                        elif item:
                            bits.append(str(item))
                elif info.get("message"):
                    bits.append(str(info["message"]))
            elif info:
                bits.append(str(info))
            label = f"node {nid}"
            if cls:
                label += f" ({cls})"
            extra = "; ".join(bits) if bits else json.dumps(info, ensure_ascii=False)[:500]
            lines.append(f"{label}: {extra}")
    if not lines:
        blob = json.dumps(body, ensure_ascii=False)[:800] if body else ""
        return f"Comfy {status}: {blob}" if blob else f"Comfy {status}"
    return "\n".join(lines)


def _primitive_value(node: dict[str, Any]) -> Any:
    vals = node.get("widgets_values")
    if isinstance(vals, list) and vals:
        return vals[0]
    return 0


def _follow_link(
    src_id: Any,
    src_slot: Any,
    nodes_by_id: dict[Any, dict[str, Any]],
    links_by_id: dict[Any, tuple[Any, Any]],
) -> tuple[str, Any] | tuple[str, int]:
    node = nodes_by_id.get(src_id)
    if not isinstance(node, dict):
        return str(src_id), int(src_slot or 0)
    ntype = str(node.get("type") or "")
    if ntype == "Reroute":
        ins = node.get("inputs") or []
        first = ins[0] if ins else None
        lid = first.get("link") if isinstance(first, dict) else None
        if lid in links_by_id:
            nxt_src, nxt_slot = links_by_id[lid]
            return _follow_link(nxt_src, nxt_slot, nodes_by_id, links_by_id)
    if ntype in _SKIP_UI_TYPES and ntype != "Reroute":
        return ("__value__", _primitive_value(node))
    return str(src_id), int(src_slot or 0)


def ui_to_api(data: dict[str, Any]) -> dict[str, Any]:
    """Comfy UI graph (nodes + links) → API map {id: {class_type, inputs}}."""
    raw_nodes = data.get("nodes") or []
    raw_links = data.get("links") or []
    nodes_by_id: dict[Any, dict[str, Any]] = {}
    for node in raw_nodes:
        if isinstance(node, dict) and node.get("id") is not None:
            nodes_by_id[node["id"]] = node
    links_by_id: dict[Any, tuple[Any, Any]] = {}
    for link in raw_links:
        if isinstance(link, (list, tuple)) and len(link) >= 5:
            links_by_id[link[0]] = (link[1], link[2])
    out: dict[str, Any] = {}
    for node in raw_nodes:
        if not isinstance(node, dict):
            continue
        nid = node.get("id")
        ctype = str(node.get("type") or "")
        if nid is None or not ctype or ctype in _SKIP_UI_TYPES:
            continue
        inputs: dict[str, Any] = {}
        linked: set[str] = set()
        for inp in node.get("inputs") or []:
            if not isinstance(inp, dict):
                continue
            name = str(inp.get("name") or "").strip()
            lid = inp.get("link")
            if not name or lid is None or lid not in links_by_id:
                continue
            src, slot = links_by_id[lid]
            resolved = _follow_link(src, slot, nodes_by_id, links_by_id)
            if resolved[0] == "__value__":
                inputs[name] = resolved[1]
            else:
                inputs[name] = [resolved[0], resolved[1]]
            linked.add(name)
        widgets = node.get("widgets_values")
        names = list(_WIDGET_NAMES.get(ctype, []))
        if isinstance(widgets, list) and names:
            wi = 0
            for wname in names:
                if wi >= len(widgets):
                    break
                val = widgets[wi]
                wi += 1
                if wname in _SKIP_WIDGETS or wname in linked:
                    continue
                inputs[wname] = val
        out[str(nid)] = {"class_type": ctype, "inputs": inputs}
    if not is_api_graph(out):
        raise ValueError(_EXPORT_API)
    return out


def load_workflow() -> dict[str, Any]:
    path = workflow_path()
    if not path.is_file():
        raise FileNotFoundError(f"Missing ACE-Step workflow: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("prompt"), dict):
        data = data["prompt"]
    if not isinstance(data, dict):
        raise ValueError(_EXPORT_API)
    if is_ui_graph(data):
        try:
            data = ui_to_api(data)
        except ValueError:
            raise
        except Exception:
            raise ValueError(_EXPORT_API) from None
    elif not is_api_graph(data):
        raise ValueError(_EXPORT_API)
    return data


def patch_workflow(
    graph: dict[str, Any],
    *,
    tags: str,
    lyrics: str,
    duration_s: float,
    bpm: int,
    keyscale: str,
    seed: int,
    steps: int = 8,
    cfg: float = 1.0,
    sampler_name: str = "er_sde",
    scheduler: str = "linear_quadratic",
    denoise: float = 1.0,
    timesignature: str = "4",
    language: str = "en",
) -> dict[str, Any]:
    out = deepcopy(graph)
    dur = float(max(1.0, min(2000.0, duration_s)))
    bpm_i = int(max(10, min(300, bpm)))
    seed_i = int(seed) if int(seed) >= 0 else 0
    tags_s = (tags or "").strip() or "instrumental music track"
    lyrics_s = lyrics or ""
    key_s = (keyscale or "C major").strip() or "C major"
    steps_i = int(max(1, min(150, steps)))
    cfg_f = float(cfg)
    denoise_f = float(denoise)
    samp = (sampler_name or "er_sde").strip() or "er_sde"
    sched = (scheduler or "linear_quadratic").strip() or "linear_quadratic"
    tsig = str(timesignature or "4").strip() or "4"
    lang = str(language or "en").strip() or "en"
    for node in out.values():
        if not isinstance(node, dict):
            continue
        ct = str(node.get("class_type") or "")
        inputs = node.setdefault("inputs", {})
        if not isinstance(inputs, dict):
            continue
        if ct == "TextEncodeAceStepAudio1.5" or ct.startswith("TextEncodeAceStepAudio"):
            inputs["tags"] = tags_s
            inputs["lyrics"] = lyrics_s
            inputs["duration"] = dur
            inputs["bpm"] = bpm_i
            inputs["keyscale"] = key_s
            inputs["seed"] = seed_i
            inputs["timesignature"] = tsig
            inputs["language"] = lang
        elif ct.startswith("EmptyAceStep") and "LatentAudio" in ct:
            inputs["seconds"] = dur
        elif ct == "KSampler":
            inputs["seed"] = seed_i
            inputs["steps"] = steps_i
            inputs["cfg"] = cfg_f
            inputs["sampler_name"] = samp
            inputs["scheduler"] = sched
            inputs["denoise"] = denoise_f
    return out


def _file_meta(item: dict[str, Any]) -> dict[str, str] | None:
    name = str(item.get("filename") or "").strip()
    if not name:
        return None
    return {
        "filename": name,
        "subfolder": str(item.get("subfolder") or ""),
        "type": str(item.get("type") or "output"),
    }


def _history_files(
    hist: dict[str, Any],
    graph: dict[str, Any] | None = None,
) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    preferred: list[dict[str, str]] = []
    save_ids = {
        str(nid)
        for nid, node in (graph or {}).items()
        if isinstance(node, dict)
        and str(node.get("class_type") or "").startswith("SaveAudio")
    }
    outputs = hist.get("outputs") if isinstance(hist, dict) else None
    if not isinstance(outputs, dict):
        return files
    for nid, node_out in outputs.items():
        if not isinstance(node_out, dict):
            continue
        bucket = preferred if str(nid) in save_ids else files
        for key, items in node_out.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                meta = _file_meta(item)
                if not meta:
                    continue
                ext = Path(meta["filename"]).suffix.lower()
                if key in ("audio", "mp3", "flac", "wav") or ext in _AUDIO_EXT:
                    bucket.append(meta)
    return preferred or files


def _download_view(base: str, meta: dict[str, str], dest: Path) -> None:
    qs = urllib.parse.urlencode(
        {
            "filename": meta["filename"],
            "subfolder": meta.get("subfolder") or "",
            "type": meta.get("type") or "output",
        }
    )
    data = _get(f"{base}/view?{qs}", timeout=120.0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def generate_ace_step(
    *,
    prompt: str,
    duration_s: float,
    extra: dict[str, Any],
    output_dir: str | Path,
    spec: Any,
):
    from app.audio_service import AudioResult

    preferred = str(extra.get("comfy_url") or "").strip() or comfy_url()
    base, health_err = resolve_comfy_url(preferred)
    if not base:
        return AudioResult(
            ok=False,
            status=health_err
            or f"No Comfy API at {preferred or comfy_url()}. Set Comfy URL in Settings "
            f"(default {DEFAULT_COMFY_URL}).",
            cost_label="Cost: $0.00",
            model=getattr(spec, "label", "ACE-Step 1.5 (local Comfy)"),
            model_key=getattr(spec, "key", "ace step 1.5"),
            endpoint=preferred or comfy_url(),
            job_kind="music",
        )
    tags = str(extra.get("tags") or "").strip()
    lyrics = str(extra.get("lyrics") or "")
    if not tags:
        tags, from_prompt = split_tags_lyrics(str(prompt or ""))
        if from_prompt and not lyrics:
            lyrics = from_prompt
    tags = tags or str(prompt or "").strip()
    instrumental = extra.get("instrumental")
    if instrumental is None:
        instrumental = True
    lyrics = resolve_ace_lyrics(lyrics, instrumental=bool(instrumental))
    bpm = parse_bpm(extra.get("bpm") or tags, 120)
    keyscale = parse_keyscale(extra.get("keyscale") or "", "C major")
    timesignature = str(extra.get("timesignature") or "4").strip() or "4"
    language = str(extra.get("language") or "en").strip() or "en"
    try:
        seed = int(extra.get("seed") if extra.get("seed") is not None else 0)
    except (TypeError, ValueError):
        seed = 0
    if seed < 0:
        seed = 0
    if extra.get("seed_randomize"):
        seed = int(uuid.uuid4().int % (2**32))
    try:
        steps = int(extra.get("steps") if extra.get("steps") is not None else 8)
    except (TypeError, ValueError):
        steps = 8
    try:
        cfg = float(extra.get("cfg") if extra.get("cfg") is not None else 1.0)
    except (TypeError, ValueError):
        cfg = 1.0
    sampler_name = str(extra.get("sampler_name") or "er_sde").strip() or "er_sde"
    scheduler = str(extra.get("scheduler") or "linear_quadratic").strip() or "linear_quadratic"
    try:
        denoise = float(extra.get("denoise") if extra.get("denoise") is not None else 1.0)
    except (TypeError, ValueError):
        denoise = 1.0
    t0 = time.perf_counter()
    try:
        graph = patch_workflow(
            load_workflow(),
            tags=tags,
            lyrics=lyrics,
            duration_s=duration_s,
            bpm=bpm,
            keyscale=keyscale,
            seed=seed,
            steps=steps,
            cfg=cfg,
            sampler_name=sampler_name,
            scheduler=scheduler,
            denoise=denoise,
            timesignature=timesignature,
            language=language,
        )
        origin, post_url, queued = queue_prompt(base, graph)
        try:
            persist_comfy_url(origin)
        except Exception:
            pass
        base = origin
    except FileNotFoundError as exc:
        return AudioResult(ok=False, status=str(exc), cost_label="Cost: $0.00", job_kind="music")
    except ValueError as exc:
        return AudioResult(
            ok=False,
            status=str(exc),
            cost_label="Cost: $0.00",
            model=getattr(spec, "label", "ACE-Step 1.5 (local Comfy)"),
            model_key=getattr(spec, "key", "ace step 1.5"),
            endpoint=base,
            job_kind="music",
        )
    except RuntimeError as exc:
        return AudioResult(
            ok=False,
            status=str(exc),
            cost_label="Cost: $0.00",
            model=getattr(spec, "label", "ACE-Step 1.5 (local Comfy)"),
            model_key=getattr(spec, "key", "ace step 1.5"),
            endpoint=base,
            job_kind="music",
        )
    except urllib.error.URLError as exc:
        return AudioResult(
            ok=False,
            status=_classify_error(exc, base, "/prompt"),
            cost_label="Cost: $0.00",
            model=getattr(spec, "label", "ACE-Step 1.5 (local Comfy)"),
            model_key=getattr(spec, "key", "ace step 1.5"),
            endpoint=base,
            job_kind="music",
        )
    except Exception as exc:
        return AudioResult(
            ok=False,
            status=f"Comfy ACE-Step failed: {exc}",
            cost_label="Cost: $0.00",
            job_kind="music",
        )
    prompt_id = str(queued.get("prompt_id") or queued.get("promptId") or "").strip()
    if not prompt_id:
        if queued.get("error") or queued.get("node_errors"):
            return AudioResult(
                ok=False,
                status=format_comfy_error(400, queued),
                cost_label="Cost: $0.00",
                job_kind="music",
            )
        return AudioResult(ok=False, status="Comfy returned no prompt_id.", cost_label="Cost: $0.00", job_kind="music")
    deadline = time.monotonic() + _POLL_MAX_S
    hist: dict[str, Any] = {}
    while time.monotonic() < deadline:
        time.sleep(_POLL_S)
        try:
            raw = json.loads(_get(f"{base}/history/{urllib.parse.quote(prompt_id)}", timeout=10.0))
        except Exception:
            continue
        if isinstance(raw, dict):
            hist = raw.get(prompt_id) if isinstance(raw.get(prompt_id), dict) else raw
        if hist.get("status", {}).get("completed") or _history_files(hist, graph):
            status = hist.get("status") if isinstance(hist.get("status"), dict) else {}
            if status.get("status_str") == "error":
                msg = status.get("messages") or "Comfy job failed."
                return AudioResult(
                    ok=False,
                    status=str(msg),
                    cost_label="Cost: $0.00",
                    job_kind="music",
                )
            if _history_files(hist, graph):
                break
    files = _history_files(hist, graph)
    if not files:
        return AudioResult(
            ok=False,
            status="Comfy ACE-Step finished without an audio file.",
            cost_label="Cost: $0.00",
            job_kind="music",
        )
    stamp = timestamp_now()
    media_dir = job_media_dir(output_dir, stamp=stamp)
    stem = make_output_stem(tags, "ace-step-1.5", stamp=stamp, kind="music")
    ext = Path(files[0]["filename"]).suffix.lower()
    if ext not in _AUDIO_EXT:
        ext = ".mp3"
    dest = unique_path(media_dir, stem, ext)
    try:
        _download_view(base, files[0], dest)
    except Exception as exc:
        return AudioResult(
            ok=False,
            status=f"Could not copy Comfy mp3: {exc}",
            cost_label="Cost: $0.00",
            job_kind="music",
        )
    if dest.stat().st_size < 64:
        return AudioResult(
            ok=False,
            status="Comfy mp3 was empty.",
            cost_label="Cost: $0.00",
            job_kind="music",
        )
    render_s = time.perf_counter() - t0
    return AudioResult(
        ok=True,
        path=str(dest.resolve()),
        status=f"ACE-Step 1.5 (local Comfy) OK. Saved {dest.name}. Cost: $0.00.",
        metrics_line=f"{render_s:.1f}s · Cost: $0.00",
        cost_label="Cost: $0.00",
        notes=[f"Queued Comfy at {post_url}", "Local ACE-Step 1.5 — not billed."],
        render_seconds=render_s,
        model=getattr(spec, "label", "ACE-Step 1.5 (local Comfy)"),
        model_key=getattr(spec, "key", "ace step 1.5"),
        endpoint=base,
        job_kind="music",
    )
