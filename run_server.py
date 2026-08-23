"""Start AI Media Studio V2 in production mode (SPA + API on :8000)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.environ["AMS_DEV"] = "0"

from app.server import main  # noqa: E402

if __name__ == "__main__":
    main(open_browser="--no-browser" not in sys.argv)
