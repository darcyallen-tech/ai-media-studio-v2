# AI Media Studio V2 — release notes

## Phase 25

Windows one-folder package (`packaging/build_windows.ps1` → `dist/AIMediaStudioV2/`). Double-click `AMS_V2.bat` / `AIMediaStudioV2.exe`; browser opens the UI. Data and keys stay in `%LOCALAPPDATA%\AI Media Studio V2`. Console stays visible for RC.

## Phase 24

Production foundation (not an EXE): FastAPI serves the Vite SPA from the same origin, portable data under `%LOCALAPPDATA%\AI Media Studio V2`, `python run_server.py` (no reload, opens the browser). Keys come from Settings / secrets store — no repo `.env` required in production.

## Phase 23B

Kling 3.0 Elements tray (`@ElementN`) on I2V / O3 V2V, and Storyboard → native `multi_prompt` (customize / intelligent cuts) for Kling 3.0 I2V and T2V. Non-Kling storyboard still uses the flattened R2V prompt.
