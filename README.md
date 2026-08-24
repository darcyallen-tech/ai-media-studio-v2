# AI Media Studio V2

A free Windows desktop app for stills, video, audio, and a clip Frame Editor. You work on a node canvas, pick a model, and generate. You bring your own API keys (fal for almost everything; optional xAI for prompt enhance; optional Runware for Frame Editor / Aleph). You pay those providers for usage. This app does not sell credits.

Version **2.0.0-rc1**.

**Docs:** [FEATURES.md](FEATURES.md) (what is in the catalog) · [HOW_TO.md](HOW_TO.md) (first-run walkthrough)

---

## Windows (Release zip)

1. Download the Release zip for this repo (GitHub Releases). Unzip it.
2. Run `AIMediaStudioV2.exe` or `AMS_V2.bat`. Keep the `_internal` folder next to the exe.
3. Open **Settings**, paste your keys, **Save keys**.

A window titled **AI Media Studio V2** opens (Microsoft Edge WebView2). If the window fails, install the [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) and retry; the app can fall back to your default browser.

Generated files and secrets live under `%LOCALAPPDATA%\AI Media Studio V2\` -- not inside the zip. See [HOW_TO.md](HOW_TO.md) if a port is busy or a key is missing.

---


## From source

Need Node 20 and Python 3.11 or newer.

Build the SPA in the frontend directory.
Install the backend requirements file.
From the repo root, run the production entry (run_server). That serves UI and API on port 8000, opens the desktop window, and stores data under LOCALAPPDATA (AMS_DEV off).

### Dev checkout (hot reload)

Use two terminals. Turn AMS_DEV on so outputs and data stay in the repo.
Run the FastAPI app from backend on port 8000.
Run the frontend dev server, then open localhost port 5173 (it proxies API calls).
Paste keys in Settings, or copy `.env.example` to `.env` at the repo root (gitignored).

---

## Keys

Bring your own. Never commit `.env` or `secrets.json`.

| Key | Used for | Where to get it |
|-----|----------|-----------------|
| fal (`FAL_KEY`) | Image, video, audio, Tools | https://fal.ai/dashboard/keys |
| xAI (optional) | Prompt Enhance / Grok text | https://console.x.ai/team/default/api-keys |
| Runware (optional) | Frame Editor / Aleph only | https://my.runware.ai/keys |

Packaged app: Settings only (`%LOCALAPPDATA%\AI Media Studio V2\secrets.json`). Dev: Settings or repo-root `.env` (gitignored).

---

## Layout

```
ai-media-studio-v2/
  backend/          FastAPI
  frontend/         Vite + React canvas
  packaging/        Windows one-folder build
  FEATURES.md
  HOW_TO.md
  run_server.py     production entry (SPA + API + window)
```

`dist/` is the PyInstaller output. It is gitignored. Publish a zip from GitHub Releases; do not commit `dist/` as source.

---

## License

Free to use. No warranty. You are responsible for API bills, keys, and what you generate.

Optional support: [Donate via PayPal](https://www.paypal.com/donate/?business=B8KD4347C4F9L&no_recurring=0&currency_code=CAD)

Built with [Grok](https://grok.com).

