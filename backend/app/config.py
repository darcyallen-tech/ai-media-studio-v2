"""Application configuration and defaults."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from app.fal.models import catalog_for_enhance, model_dropdown_choices


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False)) or hasattr(sys, "_MEIPASS")


def _code_root() -> Path:
    """Checkout root, or PyInstaller _MEIPASS (never write here)."""
    if is_frozen():
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            return Path(str(meipass))
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent.parent


# backend/app/config.py → code tree (checkout or frozen extract)
PROJECT_ROOT = _code_root()


def _truthy(raw: str | None) -> bool | None:
    val = (raw or "").strip().lower()
    if val in ("1", "true", "yes", "on"):
        return True
    if val in ("0", "false", "no", "off"):
        return False
    return None


def _repo_markers_present(root: Path) -> bool:
    return (root / "frontend" / "package.json").is_file() and (
        root / "backend" / "app" / "main.py"
    ).is_file()


def is_dev_checkout() -> bool:
    """
    Repo-relative data + optional .env.

    Frozen builds are never a checkout.
    AMS_DEV=1 → always checkout paths.
    AMS_DEV=0 → portable LOCALAPPDATA paths (production / freeze-ready).
    Unset → infer from frontend/package.json + backend/app/main.py.
    """
    if is_frozen():
        return False
    flag = _truthy(os.environ.get("AMS_DEV"))
    if flag is not None:
        return flag
    return _repo_markers_present(PROJECT_ROOT)


def user_data_dir() -> Path:
    from app.secrets_store import app_data_dir

    return app_data_dir()


def data_root() -> Path:
    """outputs / data/uploads / data/library / data/assets live here."""
    if is_dev_checkout():
        return PROJECT_ROOT
    return user_data_dir()


OUTPUT_DIR = data_root() / "outputs"
UPLOADS_DIR = data_root() / "data" / "uploads"
LIBRARY_DIR = data_root() / "data" / "library"
THUMBS_DIR = LIBRARY_DIR / "thumbs"
ASSETS_DIR = data_root() / "data" / "assets"
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

ENHANCE_SYSTEM_PROMPT_PATH = (
    Path(__file__).resolve().parent / "prompts" / "enhance_system.txt"
)

# Dropdown labels (grouped Image · / Video ·)
MODEL_LABELS: list[str] = model_dropdown_choices()

# Keys aligned where possible for model_id_from_choice (curated registry keys)
MODEL_OPTIONS: list[str] = [""] + [
    # image
    "flux 2 pro",
    "flux 2 max",
    "gpt image 2",
    "mai image 2.5 pro",
    "mai image 2.5",
    "nano banana pro",
    "nano banana 2",
    "qwen image 3",
    "seedream 5 pro",
    "flux 2 flex",
    "flux kontext pro",
    "grok imagine 2.0 edit",
    "fibo edit 1.5",
    "muse image edit",
    # video edit
    "kling o3 standard edit",
    "kling o3 pro edit",
    "kling o3 4k edit",
    "kling o3 4k reference",
    "ltx retake",
    "grok imagine edit video",
    "gemini omni 1.1 edit",
    "flux 3 extend",
    # image-to-video
    "kling o3 standard i2v",
    "kling o3 pro i2v",
    "kling v3 standard i2v",
    "kling v3 pro i2v",
    "grok imagine 1.5 i2v",
    "grok imagine 1.5 reference",
    "seedance 2.5 i2v",
    "seedance 2.5 reference",
    "flux 3 i2v",
    "flux 3 first last",
    "minimax h3 i2v",
    "minimax h3 max i2v",
    "minimax h3 reference",
    "minimax h3 max reference",
    "gemini omni 1.1 i2v",
    "gemini omni 1.1 reference",
    "wan 3.0 i2v",
    "wan 3.0 reference",
]

MODEL_CATALOG: dict[str, dict] = catalog_for_enhance()

APP_TITLE = "AI Media Studio V2"
APP_DESCRIPTION = (
    "Web app (FastAPI + Vite) for personal AI image, video, and audio generation. "
    "V1 Flet desktop app remains at ../ai-media-studio for production. "
    "Outputs: outputs/YYYY-MM-DD/."
)

# Version / update check — prefer APP_VERSION + git SHA over calendar stamps
try:
    from app import __version__ as _pkg_ver

    APP_VERSION = str(_pkg_ver or "2.0.0-rc4").strip() or "2.0.0-rc4"
except Exception:
    APP_VERSION = "2.0.0-rc4"
# Calendar day of this build/release (YYYY-MM-DD). Bump on tagged releases.
# Same-day remote commits are treated as current unless the git SHA differs.
APP_BUILD_DATE = os.environ.get("AI_MEDIA_STUDIO_BUILD_DATE", "2026-08-27").strip()


def _resolve_app_git_sha() -> str:
    """
    Embedded / local git SHA for update checks (full or short).

    Order: env AI_MEDIA_STUDIO_GIT_SHA → app/_build_sha.txt →
    ``git rev-parse HEAD`` from PROJECT_ROOT → empty.
    """
    env = (os.environ.get("AI_MEDIA_STUDIO_GIT_SHA") or "").strip()
    if env:
        return env[:40]
    try:
        sha_file = Path(__file__).resolve().parent / "_build_sha.txt"
        if sha_file.is_file():
            raw = sha_file.read_text(encoding="utf-8").strip().splitlines()
            if raw and raw[0].strip():
                return raw[0].strip()[:40]
    except OSError:
        pass
    try:
        import subprocess

        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        if out.returncode == 0 and (out.stdout or "").strip():
            return (out.stdout or "").strip()[:40]
    except Exception:
        pass
    return ""


APP_GIT_SHA = _resolve_app_git_sha()
GITHUB_REPO = "darcyallen-tech/ai-media-studio"
GITHUB_URL = f"https://github.com/{GITHUB_REPO}"

XAI_BASE_URL = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1").rstrip("/")
XAI_DEFAULT_MODEL = os.environ.get("XAI_MODEL", "grok-4.5")


def ensure_output_dir(path: Path | None = None) -> Path:
    out = path or OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)
    return out


def model_label_for(model_id: str | None) -> str:
    if not model_id:
        return MODEL_LABELS[0]
    mid = model_id.strip().lower()
    from app.fal.models import (
        IMAGE_EDIT_MODELS,
        VIDEO_MODELS,
        resolve_image_edit_model,
        resolve_video_model,
    )

    img = resolve_image_edit_model(model_id)
    if img:
        return img.label
    vid = resolve_video_model(model_id)
    if vid:
        return vid.label
    for opt, label in zip(MODEL_OPTIONS, MODEL_LABELS):
        if opt and opt.lower() == mid:
            return label
    return model_id.strip()


def model_id_from_choice(model_choice: str | None) -> str:
    if not model_choice:
        return ""
    choice = model_choice.strip()
    if choice in MODEL_OPTIONS:
        return choice
    if choice in MODEL_LABELS:
        # Map label → key
        from app.fal.models import resolve_image_edit_model, resolve_video_model

        img = resolve_image_edit_model(choice)
        if img:
            return img.key
        vid = resolve_video_model(choice)
        if vid:
            return vid.key
        if choice == MODEL_LABELS[0]:
            return ""
    if choice.lower() in ("auto (default)", "auto", "default"):
        return ""
    lower = choice.lower()
    for key in MODEL_CATALOG:
        if key == lower or MODEL_CATALOG[key].get("label", "").lower() == lower:
            return key
    return choice


def format_model_catalog_for_prompt() -> str:
    lines: list[str] = []
    for model_id, spec in MODEL_CATALOG.items():
        lines.append(f"- id: `{model_id}`")
        for k, v in spec.items():
            lines.append(f"  - {k}: {v}")
    return "\n".join(lines) if lines else "(no models configured)"
