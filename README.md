# AI Media Studio V2

A free desktop app for stills, video, audio, and a clip Frame Editor. You work on a node canvas, pick a model, and generate. You bring your own API keys (fal for almost everything; optional xAI for prompt enhance; optional Runware for Frame Editor / Aleph). You pay those providers for usage. This app does not sell credits.

Version **2.0.0-rc2**.

**Windows** has a Release zip with an `.exe`. **macOS and Linux** run from source (no packaged binary yet).

**Docs:** [FEATURES.md](FEATURES.md) (what is in the catalog) · [HOW_TO.md](HOW_TO.md) (first-run walkthrough)

Video catalog includes **Alibaba Wan 3.0** on fal (T2V / I2V / R2V): up to 30s at 1080p, native audio, up to 10 reference stills on R2V.

Image catalog includes **Bria Fibo Gen 1.5** (T2I) and **Fibo Edit 1.5** (I2I/R2I, up to 4 refs) plus Fibo Edit v1 — licensed data, commercial OK.

---

## Windows (Release zip)

Current package: **`AIMediaStudioV2-2.0.0-rc2-windows.zip`** (GitHub Releases). Includes Wan 3.0 (T2V / I2V / R2V) and Fibo Gen 1.5 (T2I) / Fibo Edit (I2I).

1. Download the Release zip for this repo (GitHub Releases). Unzip it.
2. Run `AIMediaStudioV2.exe` or `AMS_V2.bat`. Keep the `_internal` folder next to the exe.
3. Open **Settings**, paste your keys, **Save keys**.

A window titled **AI Media Studio V2** opens (Microsoft Edge WebView2). If the window fails, install the [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) and retry; the app can fall back to your default browser.

Generated files and secrets live under `%LOCALAPPDATA%\AI Media Studio V2\` — not inside the zip. See [HOW_TO.md](HOW_TO.md) if a port is busy or a key is missing.

---

## macOS and Linux (from source)

There is no `.exe` on Mac or Linux. Use a git checkout of this repo: https://github.com/darcyallen-tech/ai-media-studio-v2

You need Node 20 or newer and Python 3.11 or newer. Build the frontend SPA. Create a Python virtual environment at the repo root and install the backend requirements file. From the repo root, run `run_server.py`.

That serves UI and API on port 8000 (8001 if 8000 is busy) and opens a native window titled **AI Media Studio V2**. macOS uses the built-in WKWebView. Linux needs WebKitGTK for that window (Debian/Ubuntu: python3-gi, python3-gi-cairo, gir1.2-gtk-3.0, gir1.2-webkit2-4.1). If the window cannot start, the app opens your default browser at http://127.0.0.1:8000. Pass `--no-browser` to skip the window.

Then **Settings**, paste keys, **Save keys**.

### Where files go

`run_server.py` runs in production mode (AMS_DEV off). Outputs, Library, and secrets are not inside the clone:

| OS | Folder |
|----|--------|
| macOS | `~/Library/Application Support/AI Media Studio V2/` |
| Linux | `~/.config/ai-media-studio/` (or `$XDG_CONFIG_HOME/ai-media-studio`) |
| Windows (from source, same mode) | `%LOCALAPPDATA%\AI Media Studio V2\` |

### Command recipe

1. `git clone` the URL above, then enter the folder.
2. Frontend folder: install Node packages, then production build, then back to repo root.
3. Repo root: make `.venv`, activate it, install `backend/requirements.txt`.
4. Repo root: `python run_server.py`

### Dev checkout (hot reload)

Two terminals. Turn AMS_DEV on so outputs and data stay in the repo. Run FastAPI from `backend/` on port 8000. Run the frontend dev server, then open localhost port 5173 (it proxies API calls). Paste keys in Settings, or copy `.env.example` to `.env` at the repo root (gitignored). On Windows PowerShell, set AMS_DEV in the environment and activate `.venv\Scripts\Activate.ps1`.

---

## Keys

Bring your own. Never commit `.env` or `secrets.json`.

| Key | Used for | Where to get it |
|-----|----------|-----------------|
| fal (`FAL_KEY`) | Image, video, audio, Tools | https://fal.ai/dashboard/keys |
| xAI (optional) | Prompt Enhance / Grok text | https://console.x.ai/team/default/api-keys |
| Runware (optional) | Frame Editor / Aleph only | https://my.runware.ai/keys |

Packaged Windows app: Settings only (`%LOCALAPPDATA%\AI Media Studio V2\secrets.json`). From source in production mode: Settings (OS app-data folder above). Dev (`AMS_DEV=1`): Settings or repo-root `.env` (gitignored).

---

## Layout

    ai-media-studio-v2/
      backend/          FastAPI
      frontend/         Vite + React canvas
      packaging/        Windows one-folder build
      FEATURES.md
      HOW_TO.md
      run_server.py     production entry (SPA + API + window)

`dist/` is the PyInstaller output. It is gitignored. Publish a zip from GitHub Releases; do not commit `dist/` as source.

---

## License

[MIT](LICENSE). Free to use. No warranty. You are responsible for API bills, keys, and what you generate.

Built with [Grok](https://grok.com).

