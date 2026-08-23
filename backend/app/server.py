"""Production server entry: uvicorn + native pywebview window."""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

WINDOW_TITLE = "AI Media Studio V2"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
FALLBACK_PORT = 8001
HEALTH_TIMEOUT_SEC = 15.0
HEALTH_POLL_SEC = 0.25
WEBVIEW2_URL = "https://developer.microsoft.com/microsoft-edge/webview2/"

_PORT_BUSY_HINT = (
    "Close the other AI Media Studio V2 window (or whatever is using that port), then try again."
)


def _ensure_backend_on_path() -> None:
    backend = Path(__file__).resolve().parent.parent
    text = str(backend)
    if text not in sys.path:
        sys.path.insert(0, text)


def _port_in_use(host: str, port: int) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.3)
    try:
        sock.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def _pick_port(host: str, preferred: int) -> int | None:
    if not _port_in_use(host, preferred):
        return preferred
    print(f"Port {preferred} is already in use.", flush=True)
    print(_PORT_BUSY_HINT, flush=True)
    if preferred == DEFAULT_PORT and not _port_in_use(host, FALLBACK_PORT):
        print(f"Trying port {FALLBACK_PORT} instead.", flush=True)
        return FALLBACK_PORT
    if preferred == DEFAULT_PORT:
        print(
            f"Ports {preferred} and {FALLBACK_PORT} are already in use. {_PORT_BUSY_HINT}",
            file=sys.stderr,
            flush=True,
        )
    else:
        print(
            f"Port {preferred} is already in use. {_PORT_BUSY_HINT}",
            file=sys.stderr,
            flush=True,
        )
    return None


def _wait_health(url: str, timeout: float = HEALTH_TIMEOUT_SEC) -> bool:
    health = url.rstrip("/") + "/health"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=0.6) as resp:
                if getattr(resp, "status", 200) < 500:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(HEALTH_POLL_SEC)
    return False


def _shutdown_server(server, thread: threading.Thread) -> None:
    try:
        server.should_exit = True
        server.force_exit = True
    except Exception:
        pass
    thread.join(timeout=8)


def _open_native_window(url: str) -> bool:
    """Show the SPA in a desktop window. False if pywebview / WebView2 cannot start."""
    try:
        import webview
    except Exception as exc:
        print(f"pywebview import failed: {exc}", file=sys.stderr, flush=True)
        return False
    try:
        webview.create_window(
            WINDOW_TITLE,
            url,
            width=1400,
            height=900,
            resizable=True,
        )
        kwargs = {}
        if sys.platform.startswith("win"):
            kwargs["gui"] = "edgechromium"
        webview.start(**kwargs)
        return True
    except Exception as exc:
        print(f"Native window failed: {exc}", file=sys.stderr, flush=True)
        print(
            "Microsoft Edge WebView2 Runtime is required for the desktop window.\n"
            f"Install it from {WEBVIEW2_URL}",
            file=sys.stderr,
            flush=True,
        )
        return False


def _browser_fallback(url: str) -> None:
    print(f"Opening default browser at {url}", flush=True)
    print(
        "Desktop window unavailable. Install Microsoft Edge WebView2 Runtime:\n"
        f"  {WEBVIEW2_URL}",
        flush=True,
    )
    try:
        webbrowser.open(url)
    except Exception as exc:
        print(f"Could not open browser: {exc}", file=sys.stderr, flush=True)


def main(*, open_browser: bool = True, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    _ensure_backend_on_path()
    os.environ["AMS_DEV"] = "0"
    import uvicorn
    from app.main import app

    chosen = _pick_port(host, port)
    if chosen is None:
        sys.exit(1)
    port = chosen
    url = f"http://{host}:{port}/"

    config = uvicorn.Config(app, host=host, port=port, reload=False, log_level="info")
    server = uvicorn.Server(config)
    # uvicorn tries to install signal handlers; that only works on the main thread.
    server.install_signal_handlers = lambda: None

    thread = threading.Thread(target=server.run, name="uvicorn", daemon=True)
    thread.start()

    if not _wait_health(url):
        print(
            f"Server did not become ready at {url}health within {int(HEALTH_TIMEOUT_SEC)}s.",
            file=sys.stderr,
            flush=True,
        )
        _shutdown_server(server, thread)
        sys.exit(1)

    print(f"{WINDOW_TITLE} is running at {url}", flush=True)

    try:
        if open_browser:
            if not _open_native_window(url):
                _browser_fallback(url)
                thread.join()
        else:
            thread.join()
    except KeyboardInterrupt:
        print("\nShutting down.", flush=True)
    finally:
        _shutdown_server(server, thread)


if __name__ == "__main__":
    main(open_browser="--no-browser" not in sys.argv)
