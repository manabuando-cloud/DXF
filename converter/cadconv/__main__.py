"""CLI used by the Laravel queue worker.

    python -m cadconv INPUT --to pdf|dxf --out OUTPUT [--paper A3] ...

Always prints exactly one JSON object on stdout; exit code 0 on success,
1 on a user-facing conversion error, 2 on an unexpected failure.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from . import __version__
from .convert import convert
from .errors import ConversionError
from .pdf import PAPER_MM, PdfOptions


def main(argv=None) -> int:
    logging.disable(logging.WARNING)
    p = argparse.ArgumentParser(prog="cadconv")
    p.add_argument("input", type=Path)
    p.add_argument("--to", choices=["pdf", "dxf"], required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--paper", default="A4", choices=sorted(PAPER_MM))
    p.add_argument("--orientation", default="auto", choices=["auto", "landscape", "portrait"])
    p.add_argument("--color", default="mono", choices=["mono", "color"])
    p.add_argument("--margin", type=float, default=10.0)
    p.add_argument("--layouts", default="model", choices=["model", "all"])
    p.add_argument("--version", action="version", version=__version__)
    args = p.parse_args(argv)

    opts = PdfOptions(
        paper=args.paper, orientation=args.orientation, color=args.color,
        margin_mm=max(0.0, min(args.margin, 50.0)), layouts=args.layouts,
    )
    try:
        result = convert(args.input, args.to, args.out, opts)
        code = 0
    except ConversionError as exc:
        result, code = {"ok": False, "error": str(exc)}, 1
    except Exception as exc:  # noqa: BLE001
        result, code = {"ok": False, "error": "変換中に予期しないエラーが発生しました。", "detail": repr(exc)}, 2

    sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
    return code


if __name__ == "__main__":
    sys.exit(main())
