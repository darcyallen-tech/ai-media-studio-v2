# AI Media Studio V2

Greenfield web app (FastAPI + Vite/React). This repo is a **sibling** of V1.

**V1 remains at `../ai-media-studio` for production.** Do not modify V1 from this tree.

Scaffold only: catalog + `generate()` ported from V1, frontend shell. Prompt → Generate end-to-end is the next phase.

## Layout

```
ai-media-studio-v2/
  backend/app/     FastAPI + create_state / catalog / generate (V1 logic, imports adapted)
  frontend/        Vite + React shell
  outputs/         generated media
```

## Prerequisites

- Python 3.11+ (3.14 works)
- Node.js 20+ (for the frontend)

## Backend

```powershell
cd C:\Users\Darcy\ai-media-studio-v2\backend
python -m pip install -r requirements.txt
copy ..\.env.example ..\.env
# edit ..\.env — FAL_KEY, XAI_KEY, RUNWARE_KEY (no real secrets in git)
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health: <http://127.0.0.1:8000/health>
- Models: <http://127.0.0.1:8000/models?mode=image&modality=t2i>
- Generate: `POST /generate` with a CreateState JSON body (prompt, mode, modality, model_id, slots, params)

Run uvicorn with cwd = `backend` so `app` imports resolve.

## Frontend

```powershell
cd C:\Users\Darcy\ai-media-studio-v2\frontend
npm install
npm run dev
```

Opens the V2 shell: mode pills (Image | Video | Audio), prompt box, Generate **disabled**. No node canvas yet.

## Keys

| Env | Used for |
|-----|----------|
| `FAL_KEY` | Almost all generation (image / video / audio on fal) |
| `XAI_KEY` or `XAI_API_KEY` | Optional Grok enhance / text |
| `RUNWARE_KEY` or `RUNWARE_API_KEY` | Optional Aleph / Runware only |

Copy `.env.example` → `.env`. Never commit real keys.

## V1

Production desktop (Flet) stays at `C:\Users\Darcy\ai-media-studio`. V2 copies create/catalog/generate logic only — no Flet UI.
