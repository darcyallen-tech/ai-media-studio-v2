# AI Media Studio V2

Greenfield web app (FastAPI + Vite/React). This repo is a **sibling** of V1.

**V1 remains at `../ai-media-studio` for production.** Do not modify V1 from this tree.

Phase 4: Resolve receive (From Resolve inbox) + Send to Resolve.

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

Copy `.env.example` → `.env` at the **repo root** (`ai-media-studio-v2/.env`).

Easiest if you already run V1: copy keys from `../ai-media-studio/.env` into this `.env`.

| Env | Used for |
|-----|----------|
| `FAL_KEY` | Almost all generation (image / video / audio on fal) |
| `XAI_KEY` or `XAI_API_KEY` | Optional Grok enhance / text |
| `RUNWARE_KEY` or `RUNWARE_API_KEY` | Optional Aleph / Runware only |

Never commit real keys. `.env` is gitignored.

## Backend

```powershell
cd C:\Users\Darcy\ai-media-studio-v2\backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run uvicorn with cwd = `backend` so `app` imports resolve.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | App + whether keys are loaded (not the values) |
| GET | `/models?mode=image\|video\|audio&modality=t2i` | Catalog for the dropdown |
| GET | `/estimate?mode=&modality=&model_id=` | Cost only |
| POST | `/estimate` | Same CreateState JSON as generate |
| POST | `/generate` | `{ ok, result_paths[], local_paths[], cost, duration_sec, error? }` |
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

Day canvas: light grey + dot grid. Middle-mouse pan, wheel zoom. Prompt node; **Add Source** when the modality needs a still/clip. Library (right drawer): From Resolve (V1 `data/resolve_handoff` if present), Uploads, Generated. Import or drag OS files into Uploads; click/drag onto a Source node. Result node: preview, cost, time, Show in folder, Copy path.

Smoke: T2I still works with Prompt only. Import an image → attach to Source → I2I Generate → Result.

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

Production desktop (Flet) stays at `C:\Users\Darcy\ai-media-studio`. V2 does not modify it.
