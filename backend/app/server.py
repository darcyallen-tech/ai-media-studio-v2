"""Production server entry: no reload, loopback, optional browser open."""

from __future__ import annotations

import os
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


def _ensure_backend_on_path() -> None:
    backend = Path(__file__).resolve().parent.parent
    text = str(backend)
    if text not in sys.path:
        sys.path.insert(0, text)


def _open_when_ready(url: str, *, attempts: int = 60) -> None:
    health = url.rstrip("/") + "/health"
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(health, timeout=0.6) as resp:
                if getattr(resp, "status", 200) < 500:
                    webbrowser.open(url)
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.25)
    try:
        webbrowser.open(url)
    except Exception:
        pass


def main(*, open_browser: bool = True, host: str = "127.0.0.1", port: int = 8000) -> None:
    _ensure_backend_on_path()
    os.environ["AMS_DEV"] = "0"
    import uvicorn
    from app.main import app

    url = f"http://{host}:{port}/"
    if open_browser:
        threading.Thread(
            target=_open_when_ready,
            args=(url,),
            daemon=True,
        ).start()
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main(open_browser="--no-browser" not in sys.argv)
