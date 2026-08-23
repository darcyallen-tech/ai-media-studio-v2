"""PyInstaller entry: freeze_support, portable data, production server."""

from __future__ import annotations

import multiprocessing
import os
import sys


def _main() -> None:
    multiprocessing.freeze_support()
    os.environ["AMS_DEV"] = "0"
    from app.server import main

    main(open_browser="--no-browser" not in sys.argv)


if __name__ == "__main__":
    _main()
