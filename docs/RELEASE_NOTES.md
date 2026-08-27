# AI Media Studio V2 — release notes

## 2.0.0-rc4 (Windows)

Windows zip: `AIMediaStudioV2-2.0.0-rc4-windows.zip`. Double-click `AIMediaStudioV2.exe` (keep `_internal` next to it). Keys stay in Settings / `%LOCALAPPDATA%\AI Media Studio V2`.

Mac/Linux have no exe — run from source (see README). The older **2.0.0-rc3** GitHub zip is stale: it does not include Muse fallback / Match source, H3 Max, or Gemini Omni Flash 1.1.

**Catalog / canvas**
- **Muse Image** (`meta/muse-image/text-to-image`) and **Muse Image Edit** (`meta/muse-image/edit`) — T2I + I2I/R2I, ~$0.01, no `mask_url`. Strong cheap furniture test. Aspect **Match source** omits `aspect_ratio` so output follows the still; do not default I2I to 9:16. Partner fetch cannot use stale `v3b.fal.media` URLs — app falls back to data-URI / JPEG-WebP re-upload on `file_download_error`.
- **MiniMax H3 Max** T2V + I2V beside existing H3 (does not replace it). Promo ~$0.025/s @480p / ~$0.04/s @768p until 1 Sep 2026.
- **Gemini Omni Flash 1.1** — T2V, I2V, R2V, and V2V edit (NL video edit: prompt + source clip).
- **Catalog hide** (endpoints kept for history): Flux 1.1 Pro Ultra, Seedream 4.5, Fibo Edit v1, Kling 2.5 / 2.6, Grok Imagine v1 Edit / Quality Edit, MiniMax Music 2.6, Lyria 2, Luma Ray 2, MiniMax Speech 02 HD.
- Still visible: Flux Kontext Pro, LTX 2.3 Retake, Fibo Edit 1.5, Aleph 2.0.
- JPEG convert must not lock the UI.

## 2.0.0-rc3 (Windows)

Windows zip: `AIMediaStudioV2-2.0.0-rc3-windows.zip`. Double-click `AIMediaStudioV2.exe` (keep `_internal` next to it). Keys stay in Settings / `%LOCALAPPDATA%\AI Media Studio V2`.

Mac/Linux have no exe — run from source (see README). The older **2.0.0-rc2** GitHub zip is stale: it does not include Compare Source or the Mask node.

**Catalog / canvas**
- **Fibo Edit 1.5** (`bria/fibo-edit-1.5/edit`) — I2I/R2I, up to 4 refs, ~$0.04, licensed. Strong furniture pop-in in testing. A strong default for staging; Flux 2 Pro / Nano Banana Pro remain in the list. Optional mask only with a single source still. Extra refs disable mask.
- **Compare Source** on still Results — opens a COMPARE node (source under result, opacity, overlay toggle, swap). Enabled when the job had a source still. T2I: button visible, disabled, “No source image on this job.” Tool results (Upscale / Restore / Deblur) inherit the original job’s source still.
- **Mask node** — one **Add Mask** button on Prompt; **Mask attached** chip when a mask exists. I2I (and R2I with exactly 1 image) when the model supports_mask (Fibo Edit 1.5 / Fibo Edit v1) or Seedream boxes. Boxes + brush. White = edit, black = keep. Same pixel size as source.
- Image Region subtab removed. Region editing is the Mask node only. Drop-a-still is no longer the primary mask UI. Seedream 5 Pro edit stays in the I2I model list.

## 2.0.0-rc2 (Windows)

Windows zip: `AIMediaStudioV2-2.0.0-rc2-windows.zip`. Double-click `AIMediaStudioV2.exe` (keep `_internal` next to it). Keys stay in Settings / `%LOCALAPPDATA%\AI Media Studio V2`.

Mac/Linux have no exe — run from source (see README).

**Catalog**
- **Wan 3.0** (fal) — T2V, I2V (optional last frame), R2V. Up to 30s @ 1080p, native audio. R2V: up to 10 stills + video/audio refs; cite Image 1 / Image 2 in the prompt. Est. $0.05/s @480p, $0.10/s @720p, $0.20/s @1080p.
- **Fibo Gen 1.5** (Bria, fal) — T2I, high-fidelity / typography / licensed data. ~$0.04 per image. Commercial OK.
- **Fibo Edit** (Bria, fal) — I2I, precise local edits, optional mask. ~$0.04 per image. Commercial OK.

## Phase 26

Native desktop window via pywebview (Edge WebView2). Double-click `AIMediaStudioV2.exe` opens **AI Media Studio V2** at `http://127.0.0.1:8000/` instead of a browser tab. Closing the window stops the server. If WebView2 is missing, the default browser opens as in Phase 25. Port 8000 busy → try 8001, else a clear console message.

## Phase 25

Windows one-folder package (`packaging/build_windows.ps1` → `dist/AIMediaStudioV2/`). Double-click `AMS_V2.bat` / `AIMediaStudioV2.exe`; browser opens the UI. Data and keys stay in `%LOCALAPPDATA%\AI Media Studio V2`. Console stays visible for RC.

## Phase 24

Production foundation (not an EXE): FastAPI serves the Vite SPA from the same origin, portable data under `%LOCALAPPDATA%\AI Media Studio V2`, `python run_server.py` (no reload, opens the browser). Keys come from Settings / secrets store — no repo `.env` required in production.

## Phase 23B

Kling 3.0 Elements tray (`@ElementN`) on I2V / O3 V2V, and Storyboard → native `multi_prompt` (customize / intelligent cuts) for Kling 3.0 I2V and T2V. Non-Kling storyboard still uses the flattened R2V prompt.
