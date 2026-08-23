# -*- mode: python ; coding: utf-8 -*-
"""One-folder Windows package for AI Media Studio V2."""

import os

from PyInstaller.utils.hooks import (
    collect_all,
    collect_data_files,
    collect_submodules,
)

block_cipher = None

repo = os.path.abspath(os.path.join(SPECPATH, ".."))
backend = os.path.join(repo, "backend")
frontend_dist = os.path.join(repo, "frontend", "dist")
prompts = os.path.join(backend, "app", "prompts")
entry = os.path.join(SPECPATH, "entry.py")

if not os.path.isfile(os.path.join(frontend_dist, "index.html")):
    raise SystemExit(
        "frontend/dist is missing. Run: cd frontend && npm run build"
    )

datas: list = [
    (frontend_dist, os.path.join("frontend", "dist")),
    (prompts, os.path.join("app", "prompts")),
]
binaries: list = []
hiddenimports: list = []

for pkg in (
    "cv2",
    "numpy",
    "PIL",
    "uvicorn",
    "fastapi",
    "starlette",
    "pydantic",
    "anyio",
    "httpx",
    "httpcore",
    "h11",
    "httptools",
    "idna",
    "certifi",
    "multipart",
    "python_multipart",
    "fal_client",
    "openai",
    "dotenv",
    "app",
):
    try:
        pkg_datas, pkg_bins, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_bins
        hiddenimports += pkg_hidden
    except Exception:
        pass

hiddenimports += collect_submodules("app")
hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "starlette.middleware.cors",
    "pydantic.deprecated",
    "cv2",
    "numpy",
    "PIL",
    "PIL.Image",
    "PIL.ImageOps",
    "certifi",
]
try:
    datas += collect_data_files("certifi")
except Exception:
    pass

excludes = [
    "watchfiles",
    "IPython",
    "pytest",
    "setuptools.tests",
    "tkinter.test",
]

a = Analysis(
    [entry],
    pathex=[backend, repo],
    binaries=binaries,
    datas=datas,
    hiddenimports=sorted(set(hiddenimports)),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AIMediaStudioV2",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="AIMediaStudioV2",
)
