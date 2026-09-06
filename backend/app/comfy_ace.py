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
DESKTOP_COMFY_URL = "http://127.0.0.1:8000"
PORTABLE_COMFY_URL = "http://127.0.0.1:8188"
WORKFLOW_NAME = "ace_step_1_5_api.json"
_BOTH_FAIL = (
    "No Comfy API. Desktop default is :8000, portable is :8188. "
    "Set Comfy URL in Settings."
)
_UI_PORT = "UI port, not API. Try /api/prompt or :8188"
_POLL_S = 1.0
_POLL_MAX_S = 600.0
_BPM_RE = re.compile(r"(\d{2,3})\s*bpm", re.I)
_KEY_RE = re.compile(
    r"\b([A-G](?:#|b)?)\s*(major|minor)\b",
    re.I,
)


def comfy_url() -> str:
    raw = str(load_prefs().get("comfy_url") or "").strip() or DEFAULT_COMFY_URL
    return raw.rstrip("/")


def use_local_comfy_music() -> bool:
    return bool(load_prefs().get("use_local_comfy_music"))


def candidate_urls(preferred: str | None = None) -> list[str]:
    """Settings URL first, then portable :8188, then desktop :8000."""
    out: list[str] = []

    def add(raw: str | None) -> None:
        u = str(raw or "").strip().rstrip("/")
        if u and u not in out:
            out.append(u)

    add(preferred)
    add(comfy_url())
    add(PORTABLE_COMFY_URL)
    add(DESKTOP_COMFY_URL)
    return out


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


def _get_status(url: str, timeout: float = 3.0) -> int:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return int(getattr(resp, "status", 200) or 200)
    except urllib.error.HTTPError as exc:
        return int(exc.code)


def probe_comfy(base: str) -> tuple[bool, str | None]:
    """Health: GET /system_stats then GET /prompt. 405 on /prompt still counts."""
    root = base.rstrip("/")
    try:
        stats = _get_status(root + "/system_stats", timeout=2.5)
    except Exception as exc:
        return False, _classify_error(exc, root, "/system_stats")
    if stats == 404:
        return False, f"{root}/system_stats 404"
    if stats >= 400 and stats != 405:
        return False, f"{root}/system_stats {stats}"
    try:
        prompt = _get_status(root + "/prompt", timeout=2.5)
    except Exception as exc:
        return False, _classify_error(exc, root, "/prompt")
    if prompt == 404:
        return False, f"{root}/prompt 404"
    if prompt >= 500:
        return False, f"{root}/prompt {prompt}"
    return True, None


def resolve_comfy_url(preferred: str | None = None) -> tuple[str | None, str]:
    """Return (working_url, error). Generate must use working_url."""
    last = ""
    for url in candidate_urls(preferred):
        ok, err = probe_comfy(url)
        if ok:
            return url, ""
        last = err or f"{url} failed"
    return None, _BOTH_FAIL if last else _BOTH_FAIL


def is_ace_step(spec: Any) -> bool:
    blob = f"{getattr(spec, 'key', '')} {getattr(spec, 'endpoint', '')} {getattr(spec, 'label', '')}".lower()
    return "ace-step" in blob or "ace step" in blob or blob.startswith("comfy:")


def workflow_path() -> Path:
    here = Path(__file__).resolve().parent / "workflows" / WORKFLOW_NAME
    if here.is_file():
        return here
    if is_frozen():
        alt = PROJECT_ROOT / "app" / "workflows" / WORKFLOW_NAME
        if alt.is_file():
            return alt
    return here


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
    """(post_url, origin_base) — stop at first HTTP 200."""
    root = base.rstrip("/")
    rows: list[tuple[str, str]] = []

    def add(origin: str, path: str) -> None:
        origin = origin.rstrip("/")
        post = origin + path
        if (post, origin) not in rows:
            rows.append((post, origin))

    add(root, "/api/prompt")
    add(root, "/prompt")
    if root.endswith(":8000"):
        add(PORTABLE_COMFY_URL, "/prompt")
        add(PORTABLE_COMFY_URL, "/api/prompt")
    return rows


def persist_comfy_url(url: str) -> None:
    from app.prefs import save_prefs

    clean = str(url or "").strip().rstrip("/")
    if clean:
        save_prefs(comfy_url=clean)


def queue_prompt(base: str, graph: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    """POST until 200. Returns (origin_base, post_url, body)."""
    payload = {"prompt": graph, "client_id": str(uuid.uuid4())}
    saw_405 = False
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
            saw_405 = True
            last_err = f"{post_url} 405"
            continue
        last_err = f"{post_url} {status}"
        if isinstance(body.get("error"), str) and body["error"]:
            last_err = str(body["error"])
    if saw_405:
        raise RuntimeError(_UI_PORT)
    raise RuntimeError(last_err or _BOTH_FAIL)


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


def load_workflow() -> dict[str, Any]:
    path = workflow_path()
    if not path.is_file():
        raise FileNotFoundError(f"Missing ACE-Step workflow: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("prompt"), dict):
        data = data["prompt"]
    if not isinstance(data, dict):
        raise ValueError("ACE-Step workflow is not API-format JSON.")
    if "nodes" in data and "last_node_id" in data:
        raise ValueError(
            "ACE-Step workflow is a UI graph. Export (API) from Comfy and pin "
            "workflows/ace_step_1_5_api.json."
        )
    if not any(
        isinstance(v, dict) and v.get("class_type") for v in data.values()
    ):
        raise ValueError("ACE-Step workflow is not Comfy Export (API) JSON.")
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
        elif ct == "EmptyAceStep1.5LatentAudio":
            inputs["seconds"] = dur
        elif ct == "KSampler":
            inputs["seed"] = seed_i
            inputs["steps"] = steps_i
            inputs["cfg"] = cfg_f
            inputs["sampler_name"] = samp
            inputs["scheduler"] = sched
            inputs["denoise"] = denoise_f
    return out


def _history_files(hist: dict[str, Any]) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    outputs = hist.get("outputs") if isinstance(hist, dict) else None
    if not isinstance(outputs, dict):
        return files
    for node_out in outputs.values():
        if not isinstance(node_out, dict):
            continue
        for key in ("audio", "mp3", "flac", "wav", "images"):
            items = node_out.get(key)
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("filename") or "").strip()
                if not name:
                    continue
                files.append(
                    {
                        "filename": name,
                        "subfolder": str(item.get("subfolder") or ""),
                        "type": str(item.get("type") or "output"),
                    }
                )
    return files


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

    preferred = str(extra.get("comfy_url") or "").strip() or None
    base, health_err = resolve_comfy_url(preferred)
    if not base:
        return AudioResult(
            ok=False,
            status=health_err or _BOTH_FAIL,
            cost_label="Cost: $0.00",
            model=getattr(spec, "label", "ACE-Step 1.5 (local Comfy)"),
            model_key=getattr(spec, "key", "ace step 1.5"),
            endpoint=preferred or comfy_url(),
            job_kind="music",
        )
    tags = str(extra.get("tags") or prompt or "").strip()
    instrumental = extra.get("instrumental")
    if instrumental is None:
        instrumental = True
    lyrics = str(extra.get("lyrics") or "")
    if instrumental:
        lyrics = ""
    bpm = parse_bpm(extra.get("bpm") or tags, 120)
    keyscale = parse_keyscale(extra.get("keyscale") or "", "C major")
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
        )
        origin, post_url, queued = queue_prompt(base, graph)
        try:
            persist_comfy_url(origin)
        except Exception:
            pass
        base = origin
    except FileNotFoundError as exc:
        return AudioResult(ok=False, status=str(exc), cost_label="Cost: $0.00", job_kind="music")
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
        err = queued.get("error") or queued.get("node_errors") or "Comfy returned no prompt_id."
        return AudioResult(ok=False, status=str(err), cost_label="Cost: $0.00", job_kind="music")
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
        if hist.get("status", {}).get("completed") or _history_files(hist):
            status = hist.get("status") if isinstance(hist.get("status"), dict) else {}
            if status.get("status_str") == "error":
                msg = status.get("messages") or "Comfy job failed."
                return AudioResult(
                    ok=False,
                    status=str(msg),
                    cost_label="Cost: $0.00",
                    job_kind="music",
                )
            if _history_files(hist):
                break
    files = _history_files(hist)
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
    dest = unique_path(media_dir, stem, ".mp3")
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
