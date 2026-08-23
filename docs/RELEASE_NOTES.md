# AI Media Studio V2 — release notes

## Phase 26

Native desktop window via pywebview (Edge WebView2). Double-click `AIMediaStudioV2.exe` opens **AI Media Studio V2** at `http://127.0.0.1:8000/` instead of a browser tab. Closing the window stops the server. If WebView2 is missing, the default browser opens as in Phase 25. Port 8000 busy → try 8001, else a clear console message.

## Phase 25

Windows one-folder package (`packaging/build_windows.ps1` → `dist/AIMediaStudioV2/`). Double-click `AMS_V2.bat` / `AIMediaStudioV2.exe`; browser opens the UI. Data and keys stay in `%LOCALAPPDATA%\AI Media Studio V2`. Console stays visible for RC.

## Phase 24

Production foundation (not an EXE): FastAPI serves the Vite SPA from the same origin, portable data under `%LOCALAPPDATA%\AI Media Studio V2`, `python run_server.py` (no reload, opens the browser). Keys come from Settings / secrets store — no repo `.env` required in production.

## Phase 23B

Kling 3.0 Elements tray (`@ElementN`) on I2V / O3 V2V, and Storyboard → native `multi_prompt` (customize / intelligent cuts) for Kling 3.0 I2V and T2V. Non-Kling storyboard still uses the flattened R2V prompt.
