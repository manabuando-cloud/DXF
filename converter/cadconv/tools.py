"""Locating the external command-line converters."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUNDLED_BIN = HERE.parent / "bin"


def find_tool(env_var: str, *names: str) -> str | None:
    explicit = os.environ.get(env_var)
    if explicit:
        return explicit if Path(explicit).exists() else None
    for name in names:
        for candidate in (BUNDLED_BIN / name, HERE.parent / "native" / "jww2jif" / name):
            if candidate.exists():
                return str(candidate)
        found = shutil.which(name)
        if found:
            return found
    return None


def dwg2dxf() -> str | None:
    return find_tool("CADCONV_DWG2DXF", "dwg2dxf", "dwg2dxf.exe")


def oda_converter() -> str | None:
    return find_tool("CADCONV_ODA", "ODAFileConverter", "ODAFileConverter.exe")


def jww2jif() -> str | None:
    return find_tool("CADCONV_JWW2JIF", "jww2jif", "jww2jif.exe")
