# AI Media Studio V2

Greenfield web app (FastAPI + Vite/React). This repo is a **sibling** of V1.

**V1 remains at `../ai-media-studio` for production.** Do not modify V1 from this tree.

Phase 2: day-mode node canvas. One Prompt node → Generate → Result node. No night mode yet.

## Layout

```
ai-media-studio-v2/
  backend/app/     FastAPI + create_state / catalog / generate (V1 logic, imports adapted)
  frontend/        Vite + React day canvas (Prompt node, Result node)
  outputs/         generated media (served at /outputs/...)
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
| POST | `/generate` | `{ ok, result_paths[], cost, duration_sec, error? }` |
| GET | `/outputs/...` | Generated files |

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

Open <http://localhost:5173> — Vite proxies `/models`, `/generate`, `/estimate`, `/outputs` to the backend.

Day canvas: light grey + dot grid. Middle-mouse pan, wheel zoom (clamped). Prompt node (Image/Video/Audio, modality chips, model, prompt, Generate). On success a Result node appears, connected from Prompt.

Smoke: open UI → dotted light canvas + Prompt node → Image/T2I/Flux 2 Pro → Generate → Result node with image, cost, and time.

## V1

Production desktop (Flet) stays at `C:\Users\Darcy\ai-media-studio`. V2 does not modify it.
