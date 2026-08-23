"""Production server entry: no reload, loopback, optional browser open."""

from __future__ import annotations

import os
import sys
import webbrowser
from pathlib import Path


def _ensure_backend_on_path() -> None:
    backend = Path(__file__).resolve().parent.parent
    text = str(backend)
    if text not in sys.path:
        sys.path.insert(0, text)


def main(*, open_browser: bool = True, host: str = "127.0.0.1", port: int = 8000) -> None:
    _ensure_backend_on_path()
    os.environ["AMS_DEV"] = "0"
    import uvicorn

    url = f"http://{host}:{port}/"
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main(open_browser="--no-browser" not in sys.argv)
