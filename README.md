# AI Media Studio V2

Greenfield web app (FastAPI + Vite/React). This repo is a **sibling** of V1.

**V1 remains at `../ai-media-studio` for production.** Do not modify V1 from this tree.

Version **2.0.0-rc1**. Dev: Vite on :5173 + API on :8000. Production: one origin on :8000.

## Production run

Build the SPA, then start the production server (no `--reload`). The browser opens `http://127.0.0.1:8000/`.

```powershell
cd frontend
npm install
npm run build
cd ..
python run_server.py
```

- Same origin: UI + `/generate`, `/draft-enhance`, `/library`, `/outputs`.
- Data (outputs, uploads, library, assets, thumbs) goes to `%LOCALAPPDATA%\AI Media Studio V2\`.
- Keys: Settings → secrets store. Repo-root `.env` is **not** required.
- V1 root / Resolve inbox: optional in Settings (blank = disabled).
- Dev checkout: `cd backend; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` plus `npm run dev` in `frontend`. Set `AMS_DEV=1` to force repo-relative `outputs/` and `data/`.

## Windows build

One-folder PyInstaller package (not one-file). Console window stays visible for RC.

```powershell
cd frontend
npm run build
cd ..
powershell -File packaging/build_windows.ps1
```

Run the folder (no repo checkout required):

```
dist\AIMediaStudioV2\AMS_V2.bat
```

or double-click `AIMediaStudioV2.exe`. The browser opens `http://127.0.0.1:8000/`.

First run: open **Settings**, paste fal / xAI / Runware keys (saved under `%LOCALAPPDATA%\AI Media Studio V2\`). Outputs and Library write there, not next to the exe.

## Layout

```
ai-media-studio-v2/
  backend/app/     FastAPI + create_state / catalog / generate (V1 logic, imports adapted)
  frontend/        Vite + React day canvas (Prompt, Source, Result + Library)
  outputs/         generated media (served at /outputs/...)
  data/uploads/    imported Library files
```

## Prerequisites

- Python 3.11+ (3.14 works)
- Node.js 20+ (for the frontend)

## Keys

**Production:** paste keys in Settings (stored under `%LOCALAPPDATA%\AI Media Studio V2\secrets.json`). No repo `.env` required.

**Dev checkout:** copy `.env.example` → `.env` at the repo root, or paste in Settings. Never commit real keys.

| Env | Used for |
|-----|----------|
| `FAL_KEY` | Almost all generation (image / video / audio on fal) |
| `XAI_KEY` or `XAI_API_KEY` | Optional Grok enhance / text |
| `RUNWARE_KEY` or `RUNWARE_API_KEY` | Optional Aleph / Runware only |

## Backend

```powershell
cd C:\Users\Darcy\ai-media-studio-v2\backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

From a checkout this keeps repo-relative `outputs/` and `data/`. Production: `python run_server.py` from the repo root (adds `backend` to `sys.path`, `AMS_DEV=0`).

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | App + whether keys are loaded (not the values) |
| GET | `/models?mode=image\|video\|audio&modality=t2i` | Catalog for the dropdown |
| GET | `/estimate?mode=&modality=&model_id=` | Cost only |
| POST | `/estimate` | Same CreateState JSON as generate |
| POST | `/generate` | `{ ok, result_paths[], local_paths[], cost, duration_sec, error? }` |
| POST | `/enhance` | `{ prompt, model_id, modality, mode }` → rewritten prompt |
| GET | `/library?source=&type=` | Resolve / uploads / generated |
| POST | `/library/import` | Multipart files or local `path` → uploads |
| GET | `/library/file` · `/library/thumb` | Serve / thumbnail a library item |
| POST | `/library/reveal` | Open the file in Explorer |
| GET | `/outputs/...` | Generated files |
| GET | `/resolve/status` | Inbox path + still/video counts |
| POST | `/resolve/send` | `{ path, type: image\|video }` — V1-style Media Pool import |

`POST /generate` body (CreateState-compatible):

```json
{
  "mode": "image",
  "modality": "t2i",
  "model_id": "vision:flux 2 pro t2i",
  "prompt": "a red chair in a sunlit loft",
  "params": { "aspect": "16:9" }
}
```

Audio: models list works; generate returns a Phase 7 no-op error.

## Frontend

```powershell
cd C:\Users\Darcy\ai-media-studio-v2\frontend
npm install
npm run dev
```

Open <http://localhost:5173> — Vite proxies `/models`, `/generate`, `/estimate`, `/library`, `/resolve`, `/outputs` to the backend.

Day canvas: light grey + dot grid. Middle-mouse pan, wheel zoom. Prompt node; **Add Source** / **First Frame** / **Last Frame** from the modality. Duration / aspect / **resolution** / audio only when the catalog model lists choices. **Enhance** rewrites the prompt via xAI (does not generate). Drag Library items onto Source / First / Last (green = ok, red = wrong type).

| Modality | Inputs |
|----------|--------|
| T2I / T2V | Prompt only |
| I2I / I2V | Source still |
| V2V / Extend | Source video |
| Bridge | First Frame + Last Frame |

Smoke: I2V still → video Result. Bridge two stills at 3s → video Result. T2I / I2I still work.

Follow-up (not this phase): Character / Scene nodes (Phase 6), Upscale node.

## Resolve handoff

**Receive (Resolve → V2 Library → From Resolve)** uses V1’s inbox folder. V2 only reads it.

| Priority | Env / location |
|----------|----------------|
| 1 | `RESOLVE_INBOX` or `RESOLVE_HANDOFF` (folder of stills/clips + `latest.json`) |
| 2 | `AI_MEDIA_STUDIO_ROOT` / `AI_MEDIA_STUDIO_V1_ROOT` → `<root>/data/resolve_handoff` |
| 3 | Sibling `../ai-media-studio/data/resolve_handoff` |

Typical inbox:

```
<V1>/data/resolve_handoff/
  latest.json
  handoff_*.json
  handoff_*_still.png
```

The Resolve script that *writes* this folder is V1’s `resolve_scripts/Send_to_AI_Media_Studio.py` (Workspace → Scripts). V2 watches/refreshes the same folder — **Refresh From Resolve** in the Library, plus a 4s poll while that tab is open.

**Send (V2 → Resolve)** is not a folder drop. Same as V1: Resolve scripting API (`POST /resolve/send`). Requires Resolve Studio open, a project loaded, **Preferences → System → General → External scripting = Local**. Imports into Media Pool bin `AI Media Studio / <date>`. If Resolve is closed, V2 reveals the file in Explorer and shows an error toast.

There is no `RESOLVE_OUTBOX` in V1; send goes straight into the open project.

## V1

Production desktop (Flet) stays in the V1 sibling checkout. V2 does not modify it. Packaged V2 does not require V1 on disk.
