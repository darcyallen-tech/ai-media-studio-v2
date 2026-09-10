"""Generic ComfyUI HTTP client for local image workflows. Does not spawn Comfy."""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.comfy_ace import (
    DEFAULT_COMFY_URL,
    comfy_url,
    normalize_comfy_url,
    probe_comfy,
)
from app.config import PROJECT_ROOT, is_frozen

COMFY_DOWN = "ComfyUI is not running. Start Comfy, then retry."
CLIENT_ID = "ams-v2"
_POLL_S = 1.0
_POLL_MAX_S = 600.0
_BINDINGS_NAME = "bindings.json"


class ComfyError(RuntimeError):
    """User-facing Comfy failure (health, queue, node error)."""


def workflow_dir() -> Path:
    roots = [
        PROJECT_ROOT / "workflows" / "comfy",
        Path(__file__).resolve().parent / "workflows" / "comfy",
    ]
    if is_frozen():
        roots.append(PROJECT_ROOT / "workflows" / "comfy")
        roots.append(PROJECT_ROOT / "app" / "workflows" / "comfy")
    for root in roots:
        if root.is_dir():
            return root
    return PROJECT_ROOT / "workflows" / "comfy"


def bindings_path() -> Path:
    return workflow_dir() / _BINDINGS_NAME


def load_bindings() -> dict[str, Any]:
    path = bindings_path()
    if not path.is_file():
        raise ComfyError(f"Missing Comfy bindings: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ComfyError("Comfy bindings.json is not an object.")
    return data


def binding_for(key: str) -> dict[str, Any]:
    row = load_bindings().get(key)
    if not isinstance(row, dict) or not row.get("file"):
        raise ComfyError(f"Unknown Comfy workflow binding: {key}")
    return row


def load_workflow_file(name: str) -> dict[str, Any]:
    path = workflow_dir() / name
    if not path.is_file():
        raise ComfyError(f"Missing Comfy workflow: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("prompt"), dict):
        data = data["prompt"]
    if not isinstance(data, dict):
        raise ComfyError(f"Workflow is not API-format JSON: {name}")
    if "nodes" in data and "links" in data:
        raise ComfyError(
            f"{name} is a UI graph. Export (API) from Comfy and replace the file."
        )
    if not any(isinstance(v, dict) and v.get("class_type") for v in data.values()):
        raise ComfyError(f"{name} is not Comfy Export (API) JSON.")
    return data


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def _title(node: dict[str, Any]) -> str:
    meta = node.get("_meta") if isinstance(node.get("_meta"), dict) else {}
    return str(meta.get("title") or "")


def _is_link(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (str, int))
        and isinstance(value[1], int)
    )


def node_matches(node: dict[str, Any], selector: str) -> bool:
    sel = _norm(selector)
    if not sel:
        return False
    ct = _norm(str(node.get("class_type") or ""))
    title = _norm(_title(node))
    if sel == ct or sel == title:
        return True
    if sel in ct or sel in title:
        return True
    return False


def find_nodes(graph: dict[str, Any], selector: str) -> list[tuple[str, dict[str, Any]]]:
    out: list[tuple[str, dict[str, Any]]] = []
    for nid, node in graph.items():
        if isinstance(node, dict) and node_matches(node, selector):
            out.append((str(nid), node))
    return out


def patch_input(
    graph: dict[str, Any],
    selector: str,
    key: str,
    value: Any,
    *,
    replace_links: bool = False,
) -> int:
    """Patch inputs[key] on nodes matching class_type or title. Returns hits."""
    hits = 0
    for _nid, node in find_nodes(graph, selector):
        inputs = node.setdefault("inputs", {})
        if not isinstance(inputs, dict):
            continue
        if key not in inputs and not replace_links:
            # still set if the widget exists on similar nodes
            pass
        cur = inputs.get(key)
        if _is_link(cur):
            if not replace_links:
                continue
            inputs[key] = value
            hits += 1
            continue
        if replace_links:
            continue
        inputs[key] = value
        hits += 1
    return hits


def apply_binding_patches(
    graph: dict[str, Any],
    spec: dict[str, Any],
    values: dict[str, Any],
    *,
    replace_links: dict[str, bool] | None = None,
) -> dict[str, int]:
    """values keyed like prompt/seed; spec maps those to [selector, input_key]."""
    counts: dict[str, int] = {}
    relink = replace_links or {}
    for field, raw in spec.items():
        if field == "file" or field not in values:
            continue
        if not isinstance(raw, (list, tuple)) or len(raw) < 2:
            continue
        selector, key = str(raw[0]), str(raw[1])
        counts[field] = patch_input(
            graph,
            selector,
            key,
            values[field],
            replace_links=bool(relink.get(field)),
        )
    return counts


def require_comfy(base: str | None = None) -> str:
    url = normalize_comfy_url(base or comfy_url())
    ok, err = probe_comfy(url)
    if not ok:
        raise ComfyError(COMFY_DOWN if err else COMFY_DOWN)
    return url


def _get(url: str, timeout: float = 30.0) -> bytes:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _post_json(url: str, payload: dict[str, Any], timeout: float = 30.0) -> tuple[int, dict[str, Any]]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "Origin": urllib.parse.urlparse(url).scheme + "://" + urllib.parse.urlparse(url).netloc},
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
                body = {"error": raw[:400]}
        return int(exc.code), body
    out = json.loads(raw) if raw else {}
    return status, out if isinstance(out, dict) else {}


def _multipart(
    fields: dict[str, str],
    files: dict[str, tuple[str, bytes, str]],
) -> tuple[str, bytes]:
    boundary = "----AMSComfy" + uuid.uuid4().hex
    body = bytearray()
    for name, value in fields.items():
        body.extend(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n"
            ).encode("utf-8")
        )
    for name, (filename, data, ctype) in files.items():
        body.extend(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {ctype}\r\n\r\n"
            ).encode("utf-8")
        )
        body.extend(data)
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    return boundary, bytes(body)


def comfy_input_dir() -> Path | None:
    raw = (os.environ.get("COMFY_INPUT_DIR") or "").strip()
    if not raw:
        from app.prefs import load_prefs

        raw = str(load_prefs().get("comfy_input_dir") or "").strip()
    if not raw:
        return None
    path = Path(raw)
    return path if path.is_dir() else None


def upload_image(base: str, src: str | Path) -> str:
    path = Path(src)
    if not path.is_file():
        raise ComfyError(f"Source still not found: {path}")
    dest_dir = comfy_input_dir()
    if dest_dir is not None:
        target = dest_dir / path.name
        target.write_bytes(path.read_bytes())
        return target.name
    ctype = "image/png"
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        ctype = "image/jpeg"
    elif suffix == ".webp":
        ctype = "image/webp"
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
        with urllib.request.urlopen(req, timeout=60.0) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise ComfyError(f"Comfy upload failed ({exc.code}).") from exc
    except Exception as exc:
        raise ComfyError(COMFY_DOWN) from exc
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ComfyError("Comfy upload returned non-JSON.") from exc
    name = str((data or {}).get("name") or "").strip()
    if not name:
        raise ComfyError("Comfy upload returned no filename.")
    sub = str((data or {}).get("subfolder") or "").strip()
    return f"{sub}/{name}" if sub else name


def format_queue_error(status: int, body: dict[str, Any]) -> str:
    err = body.get("error")
    parts: list[str] = []
    if isinstance(err, dict):
        msg = str(err.get("message") or err.get("exception_message") or "").strip()
        details = str(err.get("details") or "").strip()
        if msg:
            parts.append(msg)
        if details and details not in parts:
            parts.append(details)
    elif isinstance(err, str) and err.strip():
        parts.append(err.strip())
    node_errors = body.get("node_errors")
    if isinstance(node_errors, dict):
        for nid, info in node_errors.items():
            if isinstance(info, dict):
                cls = str(info.get("class_type") or "")
                bits: list[str] = []
                for item in info.get("errors") or []:
                    if isinstance(item, dict):
                        em = str(item.get("message") or item.get("details") or "").strip()
                        if em:
                            bits.append(em)
                label = f"node {nid}" + (f" ({cls})" if cls else "")
                parts.append(f"{label}: {'; '.join(bits)}" if bits else label)
            else:
                parts.append(f"node {nid}: {info}")
    if not parts:
        return f"Comfy {status}" if status else "Comfy job failed."
    return "\n".join(parts)


def queue_prompt(base: str, graph: dict[str, Any]) -> str:
    payload = {"prompt": graph, "client_id": CLIENT_ID}
    url = base.rstrip("/") + "/prompt"
    try:
        status, body = _post_json(url, payload)
    except Exception as exc:
        raise ComfyError(COMFY_DOWN) from exc
    if status == 200:
        pid = str(body.get("prompt_id") or body.get("promptId") or "").strip()
        if pid:
            return pid
        if body.get("error") or body.get("node_errors"):
            raise ComfyError(format_queue_error(status, body))
        raise ComfyError("Comfy returned no prompt_id.")
    if status == 405:
        alt = base.rstrip("/") + "/api/prompt"
        try:
            status, body = _post_json(alt, payload)
        except Exception as exc:
            raise ComfyError(COMFY_DOWN) from exc
        if status == 200:
            pid = str(body.get("prompt_id") or body.get("promptId") or "").strip()
            if pid:
                return pid
    if status == 405:
        raise ComfyError(f"405 on {url} (this app) — set Comfy URL to :8188")
    raise ComfyError(format_queue_error(status, body))


def _history_images(hist: dict[str, Any]) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    outputs = hist.get("outputs") if isinstance(hist, dict) else None
    if not isinstance(outputs, dict):
        return files
    for node_out in outputs.values():
        if not isinstance(node_out, dict):
            continue
        for key in ("images", "gifs"):
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


def _history_error(hist: dict[str, Any]) -> str | None:
    status = hist.get("status") if isinstance(hist.get("status"), dict) else {}
    if str(status.get("status_str") or "") == "error":
        msgs = status.get("messages") or []
        if isinstance(msgs, list):
            for row in msgs:
                if isinstance(row, (list, tuple)) and len(row) >= 2:
                    payload = row[1]
                    if isinstance(payload, dict):
                        msg = str(
                            payload.get("exception_message")
                            or payload.get("message")
                            or ""
                        ).strip()
                        if msg:
                            return msg
                elif isinstance(row, dict):
                    msg = str(row.get("exception_message") or row.get("message") or "").strip()
                    if msg:
                        return msg
        return str(msgs or "Comfy job failed.")
    return None


def poll_history(base: str, prompt_id: str) -> dict[str, Any]:
    deadline = time.monotonic() + _POLL_MAX_S
    url = f"{base.rstrip('/')}/history/{urllib.parse.quote(prompt_id)}"
    last: dict[str, Any] = {}
    while time.monotonic() < deadline:
        time.sleep(_POLL_S)
        try:
            raw = json.loads(_get(url, timeout=15.0))
        except Exception:
            continue
        if isinstance(raw, dict):
            last = raw.get(prompt_id) if isinstance(raw.get(prompt_id), dict) else raw
        err = _history_error(last) if isinstance(last, dict) else None
        if err:
            raise ComfyError(err)
        if _history_images(last):
            return last
        if isinstance(last, dict) and last.get("status", {}).get("completed"):
            if _history_images(last):
                return last
            raise ComfyError("Comfy finished without an image.")
    raise ComfyError("Comfy timed out after 10 minutes.")


def download_view(base: str, meta: dict[str, str], dest: Path) -> None:
    qs = urllib.parse.urlencode(
        {
            "filename": meta["filename"],
            "subfolder": meta.get("subfolder") or "",
            "type": meta.get("type") or "output",
        }
    )
    data = _get(f"{base.rstrip('/')}/view?{qs}", timeout=120.0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def run_workflow(
    *,
    binding_key: str,
    values: dict[str, Any],
    dest: Path,
    replace_links: dict[str, bool] | None = None,
    source_image: str | Path | None = None,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    base = require_comfy()
    spec = binding_for(binding_key)
    graph = deepcopy(load_workflow_file(str(spec["file"])))
    patch_values = dict(values)
    if source_image:
        uploaded = upload_image(base, source_image)
        image_field = None
        for field, raw in spec.items():
            if field in ("image",) and isinstance(raw, (list, tuple)):
                image_field = field
                break
        if image_field:
            patch_values[image_field] = uploaded
    apply_binding_patches(graph, spec, patch_values, replace_links=replace_links)
    prompt_id = queue_prompt(base, graph)
    hist = poll_history(base, prompt_id)
    files = _history_images(hist)
    if not files:
        raise ComfyError("Comfy finished without an image.")
    download_view(base, files[0], dest)
    if not dest.is_file() or dest.stat().st_size < 32:
        raise ComfyError("Comfy image was empty.")
    width = height = 0
    try:
        from PIL import Image

        with Image.open(dest) as im:
            width, height = im.size
    except Exception:
        pass
    ms = int((time.perf_counter() - t0) * 1000)
    return {
        "path": str(dest.resolve()),
        "width": width,
        "height": height,
        "duration_ms": ms,
        "workflow": str(spec["file"]),
        "prompt_id": prompt_id,
        "comfy_url": base,
    }


def health() -> dict[str, Any]:
    url = normalize_comfy_url(comfy_url())
    ok, err = probe_comfy(url)
    return {
        "ok": ok,
        "url": url,
        "status": "Connected" if ok else "Offline",
        "error": None if ok else (err or COMFY_DOWN),
        "default": DEFAULT_COMFY_URL,
    }
